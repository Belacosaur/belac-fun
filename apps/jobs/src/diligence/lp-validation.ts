import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as kit from '@solana/kit';
import { concentratedPosition, discretePosition, dynamicPositionSizes, roundedRange } from './lp-math.js';
import { parseObject } from './lp-types.js';
import type { BinArrayState, Candle, DecodedValue, FeeRow, Idl, IdlStruct, IdlType, LpPool, MeteoraState, OrcaState, RpcAccount, RpcEnvelope } from './lp-types.js';

// A read-only evidence collector. Explicit RPC allowlist excludes all send methods.
const allowed = new Set(['getGenesisHash', 'getMultipleAccounts', 'getAccountInfo', 'getMinimumBalanceForRentExemption', 'getLatestBlockhash', 'getFeeForMessage']);
const root = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const directory = resolve(root, 'artifacts/diligence');
const stringify = (x: unknown) => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const sdkRequire = createRequire(createRequire(import.meta.url).resolve('@orca-so/whirlpools'));
const client = sdkRequire('@orca-so/whirlpools-client');
const core = sdkRequire('@orca-so/whirlpools-core');
const token = sdkRequire('@solana-program/token');
const token2022 = sdkRequire('@solana-program/token-2022');
const rpcUrl = 'https://solana-rpc.publicnode.com';
const program = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
const orcaProgram = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const sol = 'So11111111111111111111111111111111111111112';
const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const wallet = 'HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j';
const poolIds = ['5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6', 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y', 'BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh', 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'];
const evidence: unknown[] = [];
let requestId = 0;
async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  if (!allowed.has(method)) throw new Error(`Non-read-only RPC prohibited: ${method}`);
  const body = { jsonrpc: '2.0', id: ++requestId, method, params };
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const payload = await response.json() as RpcEnvelope<T>;
  evidence.push({ url: rpcUrl, retrievedAt: new Date().toISOString(), request: body, httpStatus: response.status, response: payload });
  if (!response.ok || payload.error) throw new Error(JSON.stringify(payload));
  return payload.result;
}
async function get(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    const text = await response.text();
    let payload: unknown; try { payload = JSON.parse(text); } catch { payload = text; }
    evidence.push({ url, retrievedAt: new Date().toISOString(), httpStatus: response.status, response: payload });
    return response.ok ? payload : { error: `HTTP ${response.status}`, payload };
  } catch (error) { const result = { error: String(error) }; evidence.push({ url, ...result }); return result; }
}
const addressEncoder = kit.getAddressEncoder();
const addressDecoder = kit.getAddressDecoder();
function bytes(account: RpcAccount) { return Buffer.from(account.data[0], 'base64'); }
function compact(account: RpcAccount) { return { owner: account.owner, lamports: account.lamports, executable: account.executable, space: bytes(account).length }; }
const integer = (n: number, length: number) => { const b = Buffer.alloc(length); b.writeBigInt64LE(BigInt(n)); return b; };
async function pda(programAddress: string, seeds: Parameters<typeof kit.getProgramDerivedAddress>[0]['seeds']) {
  return (await kit.getProgramDerivedAddress({ programAddress: kit.address(programAddress), seeds }))[0];
}
async function multiple(addresses: string[], extra = {}): Promise<{ slot: number; slots?: number[]; values: (RpcAccount | null)[] }> {
  if (addresses.length > 10) {
    const results = [];
    for (let i = 0; i < addresses.length; i += 10) results.push(await multiple(addresses.slice(i, i + 10), extra));
    return { slot: Math.min(...results.map(r => r.slot)), slots: results.map(r => r.slot), values: results.flatMap(r => r.values) };
  }
  const result = await rpc<{ context: { slot: number }; value: (RpcAccount | null)[] }>('getMultipleAccounts', [addresses, { commitment: 'confirmed', encoding: 'base64', ...extra }]);
  return { slot: result.context.slot, values: result.value };
}

async function main() {
  await mkdir(directory, { recursive: true });
  const idl = parseObject<Idl>(await readFile(resolve(directory, 'lp-meteora-idl-idl.json'), 'utf8'));
  const types = new Map<string, IdlStruct>(idl.types.map(t => [t.name, t.type]));
  function size(t: IdlType): number {
    if (typeof t === 'string') return t === 'pubkey' ? 32 : parseInt(t.slice(1)) / 8;
    if ('array' in t) return size(t.array[0]) * t.array[1];
    if ('defined' in t) return types.get(t.defined.name)!.fields.reduce((n: number, f) => n + size(f.type), 0);
    throw new Error('Unsupported fixed layout');
  }
  function decode<T>(name: string, data: Buffer): { value: T; bytesRead: number } {
    let offset = 8;
    const disc = idl.accounts.find(a => a.name === name)?.discriminator;
    if (disc && !data.subarray(0, 8).equals(Buffer.from(disc))) throw new Error(`Wrong ${name} discriminator`);
    function field(t: IdlType): DecodedValue {
      if (typeof t !== 'string' && 'array' in t) return Array.from({ length: t.array[1] }, () => field(t.array[0]));
      if (typeof t !== 'string' && 'defined' in t) return Object.fromEntries(types.get(t.defined.name)!.fields.map(f => [f.name, field(f.type)]));
      if (typeof t !== 'string') throw new Error('Unsupported IDL field');
      const length = size(t), b = data.subarray(offset, offset + length); offset += length;
      if (b.length !== length) throw new Error('Truncated account');
      if (t === 'pubkey') return addressDecoder.decode(b);
      let v = BigInt(0); for (let i = 0; i < length; i++) v += BigInt(b[i]!) << BigInt(8 * i);
      if (t.startsWith('i') && (b.at(-1)! & 128)) v -= 1n << BigInt(8 * length);
      return length <= 4 ? Number(v) : v;
    }
    return { value: Object.fromEntries(types.get(name)!.fields.map(f => [f.name, field(f.type)])) as T, bytesRead: offset };
  }
  const genesisHash = await rpc('getGenesisHash');
  if (genesisHash !== '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d') throw new Error('Not Solana mainnet');
  const accounts = await multiple([...poolIds, program, orcaProgram, wallet]);
  const pools: LpPool[] = poolIds.map((id, i) => {
    const account = accounts.values[i];
    if (!account || account.owner !== (i < 3 ? program : orcaProgram) || account.executable) throw new Error('Pool owner mismatch');
    const decoded = i < 3 ? decode<MeteoraState>('LbPair', bytes(account)).value : client.getWhirlpoolDecoder().decode(bytes(account)) as OrcaState;
    return { id, provider: i < 3 ? 'Meteora DLMM' : 'Orca Whirlpool', account: compact(account), slot: accounts.slot, decoded, ranges: [], vaults: [], priceUsdcPerSol: 0 };
  });
  const vaultAddresses: string[] = pools.flatMap((p, i) => i < 3 ? [(p.decoded as MeteoraState).reserve_x, (p.decoded as MeteoraState).reserve_y] : [(p.decoded as OrcaState).tokenVaultA, (p.decoded as OrcaState).tokenVaultB]);
  const vaults = await multiple(vaultAddresses);
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i]!;
    const mintX = i < 3 ? (pool.decoded as MeteoraState).token_x_mint : (pool.decoded as OrcaState).tokenMintA;
    const mintY = i < 3 ? (pool.decoded as MeteoraState).token_y_mint : (pool.decoded as OrcaState).tokenMintB;
    if (mintX !== sol || mintY !== usdc) throw new Error('Unexpected pair mints');
    pool.vaults = [0, 1].map(j => {
      const account = vaults.values[i * 2 + j];
      if (!account) throw new Error('Missing vault account');
      const data = bytes(account);
      const mint = addressDecoder.decode(data.subarray(0, 32)), authority = addressDecoder.decode(data.subarray(32, 64));
      const expectedMint = j === 0 ? sol : usdc;
      if (account.owner !== token.TOKEN_PROGRAM_ADDRESS || mint !== expectedMint || authority !== pool.id || data[108] !== 1) throw new Error('Vault identity/state mismatch');
      return { address: vaultAddresses[i * 2 + j], ...compact(account), mint, authority, amount: data.readBigUInt64LE(64), state: data[108], slot: vaults.slot };
    });
    if (i < 3) {
      for (const v of pool.vaults) v.derivedAddressMatches = v.address === await pda(program, [addressEncoder.encode(kit.address(pool.id)), addressEncoder.encode(kit.address(v.mint))]);
    }
  }
  const programDataAddresses = accounts.values.slice(4, 6).map(a => { if (!a) throw new Error('Missing program'); return addressDecoder.decode(bytes(a).subarray(4, 36)); });
  const programDatas = await multiple(programDataAddresses, { dataSlice: { offset: 0, length: 45 } });
  const programs = [program, orcaProgram].map((id, i) => {
    const a = accounts.values[4 + i], programData = programDatas.values[i];
    if (!a || !programData) throw new Error('Missing program data');
    const d = bytes(programData);
    return { address: id, account: compact(a), programData: programDataAddresses[i], lastDeploySlot: d.readBigUInt64LE(4), upgradeAuthority: d[12] ? addressDecoder.decode(d.subarray(13, 45)) : null, verifiedBuildHash: null };
  });
  const rentCache = new Map<number, number>();
  async function rent(size: number) {
    if (!rentCache.has(size)) rentCache.set(size, await rpc('getMinimumBalanceForRentExemption', [size, { commitment: 'confirmed' }]));
    return rentCache.get(size)!;
  }
  const userATAs: string[] = await Promise.all([sol, usdc].map(mint => token.findAssociatedTokenPda({ owner: kit.address(wallet), mint: kit.address(mint), tokenProgram: token.TOKEN_PROGRAM_ADDRESS }).then((a: [string, number]) => a[0])));
  const userAccounts = await multiple(userATAs);
  const sharedRent = { associatedTokenAccounts: userATAs.map((address, i) => ({ address, exists: !!userAccounts.values[i], mint: [sol, usdc][i], allocationBytes: 165 })), absentCount: userAccounts.values.filter(a => !a).length, tokenAccountRentLamports: await rent(165), rentRecoverableOnClose: true };
  const positionHeaderSize = 8 + size({ defined: { name: 'PositionV2' } });
  const positionBinSize = size({ defined: { name: 'PositionBinData' } });
  const binArraySize = 8 + size({ defined: { name: 'BinArray' } });
  const currentTime = Math.floor(Date.now() / 1000);
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i]!;
    const price: number = i < 3 ? (1 + (pool.decoded as MeteoraState).bin_step / 10000) ** (pool.decoded as MeteoraState).active_id * 1000 : core.sqrtPriceToPrice((pool.decoded as OrcaState).sqrtPrice, 9, 6);
    for (const width of i === 1 || i === 2 ? [0.03, 0.05, 0.1, 0.2, 0.3] : [0.1, 0.2, 0.3]) {
      if (i < 3) {
        const state = pool.decoded as MeteoraState;
        const range = roundedRange(price, width, state.bin_step);
        const sizes = dynamicPositionSizes(range.count, positionHeaderSize, positionBinSize);
        const positionRent = (await Promise.all(sizes.map(rent))).reduce((a, b) => a + b, 0);
        const indices = Array.from({ length: Math.floor(range.upper / 70) - Math.floor(range.lower / 70) + 1 }, (_, j) => Math.floor(range.lower / 70) + j);
        const arrays = await Promise.all(indices.map(index => pda(program, [new TextEncoder().encode('bin_array'), addressEncoder.encode(kit.address(pool.id)), integer(index, 8)])));
        const result = await multiple(arrays);
        const binSummaries = result.values.flatMap((a, k) => {
          if (!a) return [];
          if (a.owner !== program) throw new Error('Unexpected bin-array owner');
          const b = decode<BinArrayState>('BinArray', bytes(a)).value;
          if (b.lb_pair !== pool.id || Number(b.index) !== indices[k]) throw new Error('Bin array mismatch');
          return b.bins.map((bin, j: number) => ({ id: indices[k]! * 70 + j, ...bin })).filter(b => b.id >= range.lower && b.id <= range.upper).map(b => ({ id: b.id, solAtoms: b.amount_x, usdcAtoms: b.amount_y, liquiditySupply: b.liquidity_supply, feeGrowthX: b.fee_amount_x_per_token_stored, feeGrowthY: b.fee_amount_y_per_token_stored }));
        });
        const missingCount = result.values.filter(a => !a).length;
        const arrayRent = missingCount * await rent(binArraySize);
        pool.ranges.push({ requestedWidthPct: width * 100, ...range, actualLowerPct: (range.lowerPrice / price - 1) * 100, actualUpperPct: (range.upperPrice / price - 1) * 100,
          allocation: discretePosition(price, state.active_id, state.bin_step, range.lower, range.upper),
          existingBinArrays: arrays.map((address, k) => ({ address, index: indices[k], exists: !!result.values[k], dataLength: result.values[k] ? bytes(result.values[k]).length : null })), currentBins: binSummaries,
          setup: { positionSizesBytes: sizes, positionCount: sizes.length, positionRentLamports: positionRent, missingBinArrayCount: missingCount, missingBinArrayRentLamports: arrayRent, binArraySizeBytes: binArraySize, binArrayRentRecoverableByThisUser: false,
            userTokenAccountRentLamports: sharedRent.absentCount * sharedRent.tokenAccountRentLamports, recoverableRentLamports: positionRent + sharedRent.absentCount * sharedRent.tokenAccountRentLamports,
            totalUpfrontAccountLamports: positionRent + arrayRent + sharedRent.absentCount * sharedRent.tokenAccountRentLamports,
            networkFeesLamports: null, swapCostsUsd: null, rebalanceCostsUsd: null,
            note: 'Dynamic position rent from current RPC and official fixed header+extended-bin layouts. Transaction count/compute/priority fee and exact liquidity-instruction execution remain unquoted. No position created.' } });
      } else {
        const state = pool.decoded as OrcaState;
        const lower = core.getInitializableTickIndex(core.priceToTickIndex(price * (1 - width), 9, 6), state.tickSpacing, false);
        const upper = core.getInitializableTickIndex(core.priceToTickIndex(price * (1 + width), 9, 6), state.tickSpacing, true);
        const lowerPrice = core.tickIndexToPrice(lower, 9, 6), upperPrice = core.tickIndexToPrice(upper, 9, 6);
        const starts = [lower, upper].map(t => core.getTickArrayStartTickIndex(t, state.tickSpacing));
        const arrays: string[] = await Promise.all(starts.map(start => client.getTickArrayAddress(kit.address(pool.id), start, kit.address(orcaProgram)).then((p: [string, number]) => p[0])));
        const result = await multiple(arrays);
        const arrayDetails = result.values.map((a, k) => {
          if (!a) return { address: arrays[k], exists: false };
          if (a.owner !== orcaProgram) throw new Error('Orca tick array owner mismatch');
          const d = client.getTickArrayDecoder().decode(bytes(a));
          if (d.whirlpool !== pool.id || d.startTickIndex !== starts[k]) throw new Error('Orca tick array identity mismatch');
          const tick = d.ticks[core.getTickIndexInArray([lower, upper][k], starts[k], state.tickSpacing)];
          return { address: arrays[k], exists: true, ...compact(a), startTickIndex: starts[k], boundaryTick: tick };
        });
        const allocation = concentratedPosition(price, lowerPrice, upperPrice);
        // Token-2022 mint with MintCloseAuthority only (metadata explicitly disabled).
        const mintBytes = token2022.getMintSize([{ __kind: 'MintCloseAuthority', closeAuthority: kit.address(pool.id) }]);
        const nftAccountBytes = token2022.getTokenSize([{ __kind: 'ImmutableOwner' }]);
        const positionBaseRent = await rent(client.getPositionSize());
        const reserveForTwoTicks = 779520 * 2;
        const nftMintRent = await rent(mintBytes), nftTokenAccountRent = await rent(nftAccountBytes);
        const userRent = sharedRent.absentCount * sharedRent.tokenAccountRentLamports;
        const missingArrayRent = arrayDetails.filter(a => !a.exists).length * Math.max(1920960, await rent(client.getDynamicTickArrayMinSize()));
        const recoverableRent = Math.max(2394240, positionBaseRent) + reserveForTwoTicks + nftMintRent + nftTokenAccountRent + userRent;
        pool.ranges.push({ requestedWidthPct: width * 100, lower, upper, lowerPrice, upperPrice, actualLowerPct: (lowerPrice / price - 1) * 100, actualUpperPct: (upperPrice / price - 1) * 100, allocation,
          atomicDepositCaps: { solAtoms: Math.floor(allocation.x * 1e9), usdcAtoms: Math.floor(allocation.y * 1e6), note: 'Rounded down; cap sum at current price <= $10; exact core liquidity quote below.' }, tickArrays: arrayDetails,
          setup: { metadataExtension: false, positionBytes: client.getPositionSize(), positionBaseRentLamports: positionBaseRent, fallbackSafePositionRentLamports: Math.max(2394240, positionBaseRent), twoTickReserveLamports: reserveForTwoTicks, nftMintBytes: mintBytes, nftMintRentLamports: nftMintRent, nftTokenAccountBytes: nftAccountBytes, nftTokenAccountRentLamports: nftTokenAccountRent,
            userTokenAccountRentLamports: userRent, recoverableRentLamports: recoverableRent, missingTickArrayRentLamports: missingArrayRent, totalUpfrontAccountLamports: recoverableRent + missingArrayRent, networkFeesLamports: null, swapCostsUsd: null,
            note: 'Rent is RPC-observed; extra two-tick reserve and fallback floor are source-derived. Program deployed-build hash and unsigned execution simulation are not verified.' } });
      }
    }
    pool.priceUsdcPerSol = price;
    if (i < 3) {
      pool.history = await get(`https://dlmm.datapi.meteora.ag/pools/${pool.id}/ohlcv?timeframe=24h&start_time=${currentTime - 30 * 86400}&end_time=${currentTime}`) as { data: Candle[] };
      pool.volumeHistory = await get(`https://dlmm.datapi.meteora.ag/pools/${pool.id}/volume/history?timeframe=24h&start_time=${currentTime - 30 * 86400}&end_time=${currentTime}`) as { data: FeeRow[] };
      pool.indexedCurrent = await get(`https://dlmm.datapi.meteora.ag/pools/${pool.id}`) as { pool_config: { protocol_fee_pct: number } };
    }
  }
  const report = { createdAt: new Date().toISOString(), genesisHash, rpcUrl, executionEnabled: false, methods: [...allowed], wallet, walletExists: !!accounts.values[6], programs, sharedRent, rentReads: Object.fromEntries(rentCache), pools,
    assumptions: ['USDC is valued at $1; no depeg or issuer-freeze loss included.', 'Inventory scenarios assume monotonic arbitrage through all crossed ticks/bins, no fees or incentives, and no rebalancing.', 'Fees are zero in scenarios to isolate inventory loss, not a prediction that active liquidity earns no fees.', 'DLMM is an explicitly specified custom distribution; it is not attributed historical income.', 'Current per-bin/tick growth cannot reconstruct past position income without historical liquidity distribution, swap path and position ownership snapshots.', 'All current account data is confirmed at the stated RPC slots; API timestamps and indexing may differ.'],
    blockers: ['Owner loss/exit rules and entry approval pending.', 'Neither a funded-wallet execution simulation nor deployed program source hash verification performed.', 'Historical attributable LP income is unavailable; pool-wide fee/TVL is not position yield.', 'Swap/setup/exit compute/priority and any rebalance fees require final fresh quotes.'], sources: ['https://github.com/MeteoraAg/dlmm-sdk', 'https://github.com/orca-so/whirlpools', 'https://dlmm.datapi.meteora.ag/swagger-ui/'] };
  await writeFile(resolve(directory, 'lp-live-raw.json'), stringify(evidence));
  await writeFile(resolve(directory, 'lp-validation.json'), stringify(report));
  await writeFile(resolve(directory, 'lp-evidence-sha256.json'), stringify({ rawSha256: createHash('sha256').update(stringify(evidence)).digest('hex'), reportSha256: createHash('sha256').update(stringify(report)).digest('hex') }));
  console.log(stringify({ output: 'artifacts/diligence/lp-validation.json', slots: [accounts.slot, vaults.slot], pools: pools.map(p => ({ id: p.id, price: p.priceUsdcPerSol, ranges: p.ranges.map(r => ({ width: r.requestedWidthPct, count: r.count, upfrontSOL: r.setup.totalUpfrontAccountLamports / 1e9, upfrontUsd: r.setup.totalUpfrontAccountLamports / 1e9 * p.priceUsdcPerSol })) })) }));
}
main().catch(async error => { await writeFile(resolve(directory, 'lp-live-partial.json'), stringify({ error: String(error), evidence })); console.error(error); process.exitCode = 1; });
