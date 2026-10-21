import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';
import { decodeLayout, historySummary, layoutSize, parseLayout, type Layout } from './lending-layout.js';

interface EncodedAccount { owner: string; data: [string, string]; lamports: number }
interface AccountBatch { context: { slot: number }; value: (EncodedAccount | null)[] }
interface ReserveState {
  lendingMarket: string; farmCollateral: string; farmDebt: string; lastUpdate: Record<string, unknown>;
  liquidity: { mintPubkey: string; supplyVault: string; mintDecimals: string; totalAvailableAmount: string; borrowedAmountSf: string;
    accumulatedProtocolFeesSf: string; accumulatedReferrerFeesSf: string; pendingReferrerFeesSf: string };
  collateral: { mintPubkey: string; mintTotalSupply: string };
  config: { tokenInfo: { name: number[] }; status: number; loanToValuePct: number; liquidationThresholdPct: number;
    emergencyMode: number; borrowLimit: string; elevationGroups: number[]; disableUsageAsCollOutsideEmode: number;
    blockCtokenUsage: number; permissionedOps: string; depositLimit: string; depositWithdrawalCap: Record<string, unknown>; debtWithdrawalCap: Record<string, unknown> };
  withdrawQueue: { queuedCollateralAmount: string };
}
interface MarketState { emergencyMode: number; borrowDisabled: number; permissionedOps: string }
interface HistoryRow { timestamp: string; metrics: Record<string, unknown> & { exchangeRate: string } }
interface ReserveMetrics { reserve: string; supplyApy: string; [key: string]: unknown }
interface OraclePrice { mint: string; price: string; timestamp: string; [key: string]: unknown }

const out = new URL('../../../../artifacts/diligence/', import.meta.url);
const PROGRAM = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const OWNER = 'HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RPC = 'https://solana-rpc.publicnode.com';
const END = '2026-10-20T00:00:00.000Z';
const pairs = [
  { name: 'JLP', market: 'DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek', reserve: 'Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp' },
  { name: 'SOL/BTC', market: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF', reserve: 'D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59' },
];
const evidence: { file: string; url: string; method: string; fetchedAt: string; sha256: string }[] = [];
async function record(file: string, url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${url}: ${body.slice(0, 200)}`);
  await writeFile(new URL(file, out), body);
  evidence.push({ file, url, method: init?.method ?? 'GET', fetchedAt: new Date().toISOString(), sha256: createHash('sha256').update(body).digest('hex') });
  return body;
}
async function rpc<T>(method: string, params: unknown[], file: string): Promise<T> {
  const allowed = ['getGenesisHash', 'getMultipleAccounts', 'getAccountInfo', 'getMinimumBalanceForRentExemption', 'getTokenAccountsByOwner', 'getRecentPrioritizationFees'];
  if (!allowed.includes(method)) throw new Error('RPC method is not read-only allowlisted');
  const body: { result: T; error?: unknown } = JSON.parse(await record(`lending-rpc-${file}.json`, RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}
const schemas: Record<string, Layout> = {};
let commit = '';
async function schema(name: string, account = false): Promise<Layout> {
  if (schemas[name]) return schemas[name];
  const category = account ? 'accounts' : 'types';
  const source = await record(`lending-sdk-${category}-${name}.ts.txt`, `https://raw.githubusercontent.com/Kamino-Finance/klend-sdk/${commit}/src/@codegen/klend/${category}/${name}.ts`);
  const layout = parseLayout(source); schemas[name] = layout;
  async function refs(node: Layout): Promise<void> {
    if (node.kind.startsWith('ref:')) await schema(node.kind.slice(4));
    for (const child of node.children ?? []) await refs(child);
  }
  await refs(layout); return layout;
}
function decode<T = Record<string, unknown>>(name: string, info: EncodedAccount | null): T {
  if (!info || info.owner !== PROGRAM) throw new Error(`${name}: missing or wrong program owner`);
  const bytes = Buffer.from(info.data[0], 'base64');
  const size = layoutSize(schemas[name], schemas) + 8;
  if (size !== bytes.length) throw new Error(`${name}: SDK layout size ${size} does not match onchain size ${bytes.length}`);
  const expected = createHash('sha256').update(`account:${name}`).digest().subarray(0, 8);
  if (!bytes.subarray(0, 8).equals(expected)) throw new Error(`Bad ${name} discriminator`);
  const decoded = decodeLayout(schemas[name], bytes, schemas, 8);
  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Expected decoded account struct');
  return decoded as T;
}
const encoder = getAddressEncoder();
const key = (value: string) => Uint8Array.from(encoder.encode(address(value)));
async function derive(program: string, seeds: Uint8Array[]) {
  return (await getProgramDerivedAddress({ programAddress: address(program), seeds }))[0];
}
async function associated(mint: string) { return derive(ATA, [key(OWNER), key(TOKEN), key(mint)]); }
function integerSf(value: string) { return Number(BigInt(value)) / 2 ** 60; }
function units(value: string) { return Number(value) / 1e6; }

async function main() {
  await mkdir(out, { recursive: true });
  const reference: { sha: string } = JSON.parse(await record('lending-sdk-revision.json', 'https://api.github.com/repos/Kamino-Finance/klend-sdk/commits/master'));
  if (!/^[a-f0-9]{40}$/.test(reference.sha)) throw new Error('Invalid SDK revision');
  commit = reference.sha;
  await schema('Reserve', true); await schema('LendingMarket', true); await schema('Obligation', true); await schema('UserMetadata', true);
  const genesis = await rpc<string>('getGenesisHash', [], 'genesis');
  if (genesis !== '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d') throw new Error('Not mainnet');
  const chain = await rpc<AccountBatch>('getMultipleAccounts', [[...pairs.map(p => p.reserve), ...pairs.map(p => p.market)], { encoding: 'base64', commitment: 'finalized' }], 'reserves-markets');
  const reserves = pairs.map((p, i) => decode<ReserveState>('Reserve', chain.value[i]));
  const markets = pairs.map((p, i) => decode<MarketState>('LendingMarket', chain.value[i + 2]));
  const marketAccounts: { reserves: { pubkey: string }[] }[] = JSON.parse(await record('lending-all-reserves.json', `https://api.kamino.finance/kamino-market/reserves/account-data?markets=${pairs[0].market}&markets=${pairs[1].market}`));
  if (!Array.isArray(marketAccounts) || marketAccounts.some(m => !Array.isArray(m.reserves))) throw new Error('Invalid reserve discovery');
  const reserveAddresses = marketAccounts.flatMap(market => market.reserves.map(row => row.pubkey));
  const collateralUniverse: { reserve: string; market: string; mint: string; symbol: string; status: string; ltvPct: number; liquidationThresholdPct: number; emergencyMode: number; borrowLimitBaseUnits: string; elevationGroups: number[]; disableUsageAsCollOutsideEmode: number; slot: number }[] = [];
  for (let start = 0; start < reserveAddresses.length; start += 10) {
    const list = reserveAddresses.slice(start, start + 10);
    const result = await rpc<AccountBatch>('getMultipleAccounts', [list, { encoding: 'base64', commitment: 'finalized' }], `collateral-universe-${start}`);
    for (let n = 0; n < list.length; n++) {
      const r = decode<ReserveState>('Reserve', result.value[n]);
      collateralUniverse.push({ reserve: list[n], market: r.lendingMarket, mint: r.liquidity.mintPubkey,
        symbol: Buffer.from(r.config.tokenInfo.name).toString('utf8').replace(/\0/g, ''),
        status: ['Active', 'Obsolete', 'Hidden'][r.config.status], ltvPct: r.config.loanToValuePct,
        liquidationThresholdPct: r.config.liquidationThresholdPct, emergencyMode: r.config.emergencyMode,
        borrowLimitBaseUnits: r.config.borrowLimit, elevationGroups: r.config.elevationGroups.filter((v: number) => v > 0),
        disableUsageAsCollOutsideEmode: r.config.disableUsageAsCollOutsideEmode,
        slot: result.context.slot });
    }
  }
  const metadata = await derive(PROGRAM, [Buffer.from('user_meta'), key(OWNER)]);
  const usdcAta = await associated(USDC);
  const ctAtas = await Promise.all(reserves.map(r => associated(r.collateral.mintPubkey)));
  const obligations = await Promise.all(pairs.map(p => derive(PROGRAM, [Buffer.from([0]), Buffer.from([0]), key(OWNER), key(p.market), new Uint8Array(32), new Uint8Array(32)])));
  const accountAddresses = [OWNER, usdcAta, metadata, ...ctAtas, ...obligations, ...reserves.map(r => r.liquidity.supplyVault), ...reserves.map(r => r.collateral.mintPubkey)];
  const firstAccounts = await rpc<AccountBatch>('getMultipleAccounts', [accountAddresses.slice(0, 10), { encoding: 'base64', commitment: 'finalized' }], 'wallet-vaults-0');
  const remainingAccounts = await rpc<AccountBatch>('getMultipleAccounts', [accountAddresses.slice(10), { encoding: 'base64', commitment: 'finalized' }], 'wallet-vaults-1');
  const accounts = { context: firstAccounts.context, value: [...firstAccounts.value, ...remainingAccounts.value] };
  const states = Object.fromEntries(accountAddresses.map((a, i) => [a, accounts.value[i]]));
  const farmSource = await record('lending-farms-userState.ts.txt', 'https://raw.githubusercontent.com/Kamino-Finance/farms-sdk/master/src/@codegen/farms/accounts/userState.ts');
  const farmSize = Number(/getUserStateSize\(\): number\s*\{\s*return (\d+);/.exec(farmSource)?.[1]);
  if (farmSize !== 920) throw new Error('Unexpected farms account size');
  const farmProgram = 'FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr';
  const farmUsers = await Promise.all(reserves.map((r, i) => derive(farmProgram, [Buffer.from('user'), key(r.farmCollateral), key(obligations[i])])));
  const farmUsersInfo = await rpc<AccountBatch>('getMultipleAccounts', [farmUsers, { encoding: 'base64', commitment: 'finalized' }], 'farm-user-states');
  const rentSizes = [165, 82, layoutSize(schemas.UserMetadata, schemas) + 8, layoutSize(schemas.Obligation, schemas) + 8, 56, farmSize];
  const rents: Record<string, number> = {};
  for (const size of rentSizes) rents[size] = await rpc<number>('getMinimumBalanceForRentExemption', [size, { commitment: 'finalized' }], `rent-${size}`);
  const priority = await rpc<{ prioritizationFee: number }[]>('getRecentPrioritizationFees', [], 'priority');
  const price: OraclePrice[] = JSON.parse(await record('lending-oracle-prices.json', 'https://api.kamino.finance/oracles/prices?source=scope'));
  const portfolio: Record<string, unknown> = JSON.parse(await record('lending-wallet-portfolio.json', `https://api.kamino.finance/portfolio/${OWNER}`));
  const solPrice = price.find(row => row.mint === 'So11111111111111111111111111111111111111112');
  if (!solPrice || !Number.isFinite(Number(solPrice.price))) throw new Error('Missing SOL oracle price');
  const reports = [];
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i], r = reserves[i], m = markets[i];
    if (r.lendingMarket !== p.market || r.liquidity.mintPubkey !== USDC || Number(r.liquidity.mintDecimals) !== 6) throw new Error('Reserve identity mismatch');
    const historyUrl = `https://api.kamino.finance/kamino-market/${p.market}/reserves/${p.reserve}/metrics/history?start=2026-07-21T00%3A00%3A00.000Z&end=${encodeURIComponent(END)}&frequency=day`;
    const history: { history: HistoryRow[] } = JSON.parse(await record(`lending-history-${i}.json`, historyUrl));
    const allMetrics: ReserveMetrics[] = JSON.parse(await record(`lending-metrics-${i}.json`, `https://api.kamino.finance/kamino-market/${p.market}/reserves/metrics`));
    const metrics = allMetrics.find(row => row.reserve === p.reserve);
    if (!metrics || !Number.isFinite(Number(metrics.supplyApy))) throw new Error('Missing current reserve APY');
    const supplyBase = Number(r.liquidity.totalAvailableAmount) + integerSf(r.liquidity.borrowedAmountSf) - integerSf(r.liquidity.accumulatedProtocolFeesSf) - integerSf(r.liquidity.accumulatedReferrerFeesSf) - integerSf(r.liquidity.pendingReferrerFeesSf);
    const exchangeRate = Number(r.collateral.mintTotalSupply) / supplyBase;
    const queuedLiquidityBase = Math.floor(Number(r.withdrawQueue.queuedCollateralAmount) / exchangeRate);
    const freeBase = Math.max(0, Number(r.liquidity.totalAvailableAmount) - queuedLiquidityBase);
    const vaultAccount = states[r.liquidity.supplyVault], ctokenMint = states[r.collateral.mintPubkey];
    if (!vaultAccount || !ctokenMint || vaultAccount.owner !== TOKEN || ctokenMint.owner !== TOKEN) throw new Error('Missing or unexpected vault or collateral mint token program');
    const vaultBytes = Buffer.from(vaultAccount.data[0], 'base64');
    const vaultBalance = Number(vaultBytes.readBigUInt64LE(64));
    const ctokenBytes = Buffer.from(ctokenMint.data[0], 'base64');
    const ctDecimals = ctokenBytes[44];
    const depositCtokens = Math.floor(10_000_000 * exchangeRate);
    const ctokenRent = states[ctAtas[i]] ? 0 : rents['165'];
    const usdcRent = states[usdcAta] ? 0 : rents['165'];
    const existingObligation = states[obligations[i]] ? decode('Obligation', states[obligations[i]]) : null;
    reports.push({ ...p, currentMetrics: metrics, reserveState: r, marketState: m,
      collateralUniverse: collateralUniverse.filter(row => row.market === p.market),
      current: { reserveStatus: ['Active', 'Obsolete', 'Hidden'][r.config.status], reserveEmergencyMode: r.config.emergencyMode,
        marketEmergencyMode: m.emergencyMode, marketBorrowDisabled: m.borrowDisabled, blockCtokenUsage: r.config.blockCtokenUsage,
        reservePermissionedOps: r.config.permissionedOps, marketPermissionedOps: m.permissionedOps,
        lastUpdate: r.lastUpdate,
        totalSupplyUsdc: supplyBase / 1e6, borrowedUsdc: integerSf(r.liquidity.borrowedAmountSf) / 1e6,
        creditedAvailableUsdc: units(r.liquidity.totalAvailableAmount), liquidityVaultBalanceUsdc: vaultBalance / 1e6,
        liquidityVaultAccountState: ['Uninitialized', 'Initialized', 'Frozen'][vaultBytes[108]],
        collateralMintFreezeAuthorityPresent: ctokenBytes.readUInt32LE(46) !== 0,
        queuedLiquidityUsdc: queuedLiquidityBase / 1e6, freelyAvailableUsdcAtCurrentRefresh: freeBase / 1e6,
        depositLimitUsdc: units(r.config.depositLimit), depositHeadroomUsdc: units(r.config.depositLimit) - supplyBase / 1e6,
        depositWithdrawalCap: r.config.depositWithdrawalCap, debtWithdrawalCap: r.config.debtWithdrawalCap,
        collateralMint: r.collateral.mintPubkey, collateralDecimals: ctDecimals, collateralAta: ctAtas[i], collateralAtaExists: !!states[ctAtas[i]],
        obligation: obligations[i], obligationExists: !!existingObligation, existingObligation,
        estimatedCtokensForTenUsdcBaseUnits: depositCtokens, estimatedImmediateRedeemUsdc: Math.floor(depositCtokens / exchangeRate) / 1e6,
        ctokenRoundingLossUsdcMax: (1 / exchangeRate + 1) / 1e6 },
      history: [7, 30, 90].map(days => {
        const summary = historySummary(history.history, END, days);
        const last = history.history.at(-1);
        if (!last) throw new Error('Missing historical endpoint');
        const first = history.history.find(row => Date.parse(row.timestamp) === Date.parse(last.timestamp) - days * 86_400_000);
        if (!first) throw new Error('Missing exchange-rate endpoint');
        return { ...summary, ctokenExchangeRateObservation: { startBucket: first.timestamp, endBucket: last.timestamp,
          startCtokensPerUsdc: first.metrics.exchangeRate, endCtokensPerUsdc: last.metrics.exchangeRate,
          observedGrossReturnFraction: Number(first.metrics.exchangeRate) / Number(last.metrics.exchangeRate) - 1,
          tenUsdcGross: 10 * (Number(first.metrics.exchangeRate) / Number(last.metrics.exchangeRate) - 1),
          caveat: 'Exchange-rate values retain the last snapshot of each daily bucket; exact intra-bucket sample times are unavailable. This is a sampled reserve return, not a wallet backtest.' } };
      }),
      costs: { directCtokenRouteRentLamports: ctokenRent + usdcRent, directIncrementalRentVsFundedUsdcCashLamports: ctokenRent,
        directRouteMetadataObligationFarmLutRentLamports: 0,
        standardObligationRouteKnownRentLamports: usdcRent + (states[metadata] ? 0 : rents[rentSizes[2]]) + (existingObligation ? 0 : rents[rentSizes[3]]) + (farmUsersInfo.value[i] ? 0 : rents[farmSize]),
        standardRouteFarmUserState: { address: farmUsers[i], exists: !!farmUsersInfo.value[i], bytes: farmSize, rentLamports: rents[farmSize] },
        standardRouteLutMinimumAdditionalRentLamports: states[metadata] ? 0 : rents['56'],
        exactFullTransactionFeeLamports: null, unsignedMessageConstructed: false,
        networkScenario: { signaturesPerTransaction: 1, baseLamportsPerTransaction: 5000, directRoundTripTransactionCount: [2, 4], priorityLamportsRoundTrip: [0, 20000] },
        directCtokenRentRecovery: '165-byte SPL ATA rent refundable by closing empty ATA after redemption; closure transaction may add a fee if not bundled.',
        metadataObligationRentRecovery: 'Pinned official source automatically closes/refunds an obligation to its owner on a full exit with no remaining deposits or borrows. Metadata has no verified user-close path. Delegated farm close pays the farm administrator. LUT close requires owner authority, deactivation and cooldown. See lending-recovery.json for source/version limits.',
        protocolSupplyWithdrawFeeUsdc: 0, protocolFeeEvidence: 'Direct mint/redeem instruction has no deposit/withdraw fee argument; Borrow fees docs state no deposit or withdrawal protocol fees. Interest spread is already inside base supply APY.',
        trackingReady: false, trackingLimitation: 'Current portfolio lending reader attributes obligations; direct wallet-held cTokens need mint-aware valuation and station attribution before this route is usable.' },
    });
  }
  const result = { generatedAt: new Date().toISOString(), executionEnabled: false, network: 'mainnet-beta', genesis, reserveSlot: chain.context.slot,
    walletSlot: accounts.context.slot, wallet: OWNER, sdkCommit: commit, publicRpc: RPC,
    accountSizesBytes: { tokenAccount: 165, collateralMint: 82, metadata: rentSizes[2], obligation: rentSizes[3], emptyLookupTable: 56, farmUserState: farmSize },
    rentLamports: rents, metadata: { address: metadata, exists: !!states[metadata] }, usdcAta: { address: usdcAta, exists: !!states[usdcAta] },
    walletSolLamports: states[OWNER]?.lamports ?? null, solOraclePrice: solPrice ?? null,
    recentPrioritizationFeeMicroLamportsPerCu: { samples: priority.length, min: Math.min(...priority.map(row => row.prioritizationFee)), max: Math.max(...priority.map(row => row.prioritizationFee)) },
    portfolioShape: Object.keys(portfolio), reports, evidence };
  await writeFile(new URL('lending-validation.json', out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ generatedAt: result.generatedAt, slot: result.reserveSlot, sdkCommit: commit, sizes: result.accountSizesBytes, rents, reports: reports.map(r => ({ name: r.name, current: r.current, history: r.history, costs: r.costs })) }, null, 2));
  return result;
}
export type LendingValidation = Awaited<ReturnType<typeof main>>;
main().catch(error => { console.error(error); process.exitCode = 1; });
