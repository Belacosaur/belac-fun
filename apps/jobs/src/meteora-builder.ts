/** Builds an exact, unsigned owner-wallet entry. No secret, signing, or submission paths. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import * as k from "@solana/kit";
import { Decimal } from "decimal.js";
import { CHALLENGE_WALLET, type MeteoraPlan } from "../../../packages/contracts/src/trades.js";
import { DAMM, verifiedDammPool, decodeDamm, dammAmounts, capDammBudget, dammInstruction, type DammAccount } from "./meteora-damm.js";
import { checkMeteoraRoute, WHIRLPOOL, ROUTER, type Quote, type RpcInstruction } from "./meteora-route.js";
import { tradeRpc, type TradeRpc } from "./trade-rpc.js";
const sdk = createRequire(createRequire(import.meta.url).resolve("@orca-so/whirlpools")), client = sdk("@orca-so/whirlpools-client"), core = sdk("@orca-so/whirlpools-core");
export const METEORA_ACCOUNTS = { wallet: CHALLENGE_WALLET, usdc: "8DDPMR9LcM7YaHfwq41TteyGpnFi222gCgDEZUuy5PmE", wsol: "G5gUmEtvsE2RAj9gFSDP5ZgZ5WW4CeNRchj3r8fE4uvf", hold: 93680067n, orcaWsol: 209636n, feePool: 19859400n };
export function checkMeteoraInput(input: { wallet: string; station: number; mint: string }) {
  assert.equal(input.wallet, CHALLENGE_WALLET); assert.equal(input.station, 5); k.address(input.mint);
  assert(![CHALLENGE_WALLET, ...Object.values(DAMM), METEORA_ACCOUNTS.usdc, METEORA_ACCOUNTS.wsol].includes(input.mint));
}
export function tokenAtoms(a: DammAccount, mint: string, owner: string, program: string = DAMM.token): bigint {
  assert(a && a.owner === program && a.executable === false && a.data[1] === "base64"); const b = Buffer.from(a.data[0]!, "base64"); assert.equal(b.length, 165);
  assert.equal(k.getAddressDecoder().decode(b.subarray(0, 32)), mint); assert.equal(k.getAddressDecoder().decode(b.subarray(32, 64)), owner); assert.equal(b[108], 1); assert.equal(b.readUInt32LE(72), 0); return b.readBigUInt64LE(64);
}
async function accounts(rpc: TradeRpc, keys: string[]) { return (await rpc<{ context: { slot: number }; value: (DammAccount | null)[] }>("getMultipleAccounts", [keys, { encoding: "base64", commitment: "confirmed" }])).value; }
async function routeAccounts(rpc: TradeRpc, q: Quote) {
  const amm = q.routePlan[0]!.swapInfo.ammKey, [a] = await accounts(rpc, [amm]); assert(a?.owner === WHIRLPOOL && !a.executable);
  const s = client.getWhirlpoolDecoder().decode(Buffer.from(a.data[0]!, "base64")); assert.equal(s.tokenMintA, DAMM.sol); assert.equal(s.tokenMintB, DAMM.usdc);
  const start = core.getTickArrayStartTickIndex(s.tickCurrentIndex, s.tickSpacing);
  const arrays: string[] = await Promise.all([0, 1, 2].map(i => client.getTickArrayAddress(k.address(amm), start + i * 88 * s.tickSpacing).then((p: [string, number]) => p[0])));
  const raw = await accounts(rpc, [...arrays, s.tokenVaultA, s.tokenVaultB]);
  for (let i = 0; i < 3; i++) { assert.equal(raw[i]!.owner, WHIRLPOOL); const d = client.getTickArrayDecoder().decode(Buffer.from(raw[i]!.data[0]!, "base64")); assert.equal(d.whirlpool, amm); assert.equal(d.startTickIndex, start + i * 88 * s.tickSpacing); }
  tokenAtoms(raw[3]!, DAMM.sol, amm); tokenAtoms(raw[4]!, DAMM.usdc, amm);
  return [WHIRLPOOL, DAMM.token, CHALLENGE_WALLET, amm, METEORA_ACCOUNTS.wsol, s.tokenVaultA, METEORA_ACCOUNTS.usdc, s.tokenVaultB, ...arrays, (await client.getOracleAddress(k.address(amm)))[0]] as string[];
}
export async function buildMeteoraEntry(input: { wallet: string; station: number; mint: string }, endpoint: string, apiKey?: string, fetcher: typeof fetch = fetch, operatingAvailable = METEORA_ACCOUNTS.feePool): Promise<MeteoraPlan> {
  checkMeteoraInput(input); const rpc = tradeRpc(endpoint, fetcher), m = METEORA_ACCOUNTS, started = Date.now();
  assert.equal(await rpc("getGenesisHash", []), "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  const before = await accounts(rpc, [m.wallet, m.usdc, m.wsol, DAMM.pool, DAMM.vaultA, DAMM.vaultB, input.mint]);
  assert(before[0] && before[1] && before[2] && before[3] && !before[6], "Position mint already exists");
  const state = verifiedDammPool(before[3]), stable = tokenAtoms(before[1], DAMM.usdc, m.wallet), wrapped = tokenAtoms(before[2], DAMM.sol, m.wallet), native = BigInt(before[0].lamports);
  assert(operatingAvailable > 0n && operatingAvailable <= m.feePool);
  assert(native >= m.hold + operatingAvailable && stable >= 70077648n && wrapped >= m.orcaWsol, "Reconcile protected holdings before preparing");
  tokenAtoms(before[4]!, DAMM.sol, DAMM.authority); tokenAtoms(before[5]!, DAMM.usdc, DAMM.authority);
  const price = new Decimal(state.sqrt_price.toString()).pow(2).div(new Decimal(2).pow(128)).mul(1000);
  let lo = 0n, hi = 10n ** 35n;
  while (lo < hi) { const mid = (lo + hi + 1n) / 2n, a = dammAmounts(mid, state.sqrt_price, state.sqrt_min_price, state.sqrt_max_price, true); if (new Decimal(a.a.toString()).div(1e9).mul(price).add(new Decimal(a.b.toString()).div(1e6)).lte("9.85")) lo = mid; else hi = mid - 1n; }
  assert(lo > 0n); const inventory = dammAmounts(lo, state.sqrt_price, state.sqrt_min_price, state.sqrt_max_price, true), maxA = (inventory.a * 10050n + 9999n) / 10000n, maxB = (inventory.b * 10050n + 9999n) / 10000n;
  async function http<T>(url: string, body?: unknown): Promise<T> { const r = await fetcher(url, { method: body ? "POST" : "GET", redirect: "error", headers: { ...(body ? { "content-type": "application/json" } : {}), ...(apiKey ? { "x-api-key": apiKey } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) }); assert(r.ok, "Quote source unavailable"); return r.json() as Promise<T>; }
  const quote = await http<Quote>("https://api.jup.ag/swap/v1/quote?" + new URLSearchParams({ inputMint: DAMM.usdc, outputMint: DAMM.sol, amount: String(maxA), swapMode: "ExactOut", slippageBps: "50", onlyDirectRoutes: "true", maxAccounts: "32", dexes: "Whirlpool" }));
  const upstream = await http<{ error?: unknown; swapInstruction: RpcInstruction; setupInstructions?: unknown[]; otherInstructions?: unknown[]; tokenLedgerInstruction?: unknown; cleanupInstruction?: unknown; tipInstruction?: unknown; addressLookupTableAddresses?: string[] }>("https://api.jup.ag/swap/v1/swap-instructions", { quoteResponse: quote, userPublicKey: m.wallet, wrapAndUnwrapSol: false, useSharedAccounts: false, dynamicComputeUnitLimit: false, computeUnitPriceMicroLamports: 0, asLegacyTransaction: false });
  assert(!upstream.error && !upstream.cleanupInstruction && !upstream.tokenLedgerInstruction && !upstream.tipInstruction); assert.equal(upstream.setupInstructions?.length ?? 0, 0); assert.equal(upstream.otherInstructions?.length ?? 0, 0);
  const maxSwap = checkMeteoraRoute(upstream.swapInstruction, quote, m.usdc, m.wsol, await routeAccounts(rpc, quote)); assert.equal(BigInt(quote.outAmount), maxA); const cash = capDammBudget(maxSwap, maxB);
  const lutKeys = upstream.addressLookupTableAddresses ?? []; assert(lutKeys.length <= 8); const lutAccounts = await accounts(rpc, lutKeys), tables: Record<string, k.Address[]> = {};
  lutAccounts.forEach((a, i) => { assert(a && a.owner === "AddressLookupTab1e1111111111111111111111111" && !a.executable); const b = Buffer.from(a.data[0]!, "base64"); assert(b.length >= 56 && (b.length - 56) % 32 === 0 && b.readUInt32LE(0) === 1 && b.readBigUInt64LE(4) === (1n << 64n) - 1n); tables[lutKeys[i]!] = Array.from({ length: (b.length - 56) / 32 }, (_, j) => k.getAddressDecoder().decode(b.subarray(56 + j * 32, 88 + j * 32))); });
  const pda = async (seeds: (Uint8Array | k.ReadonlyUint8Array)[]) => (await k.getProgramDerivedAddress({ programAddress: k.address(DAMM.program), seeds }))[0], enc = k.getAddressEncoder();
  const position = await pda([Buffer.from("position"), enc.encode(k.address(input.mint))]), nft = await pda([Buffer.from("position_nft_account"), enc.encode(k.address(input.mint))]), event = await pda([Buffer.from("__event_authority")]);
  const a = { owner: m.wallet, signer: m.wallet, payer: m.wallet, pool: DAMM.pool, position, position_nft_mint: input.mint, position_nft_account: nft, pool_authority: DAMM.authority, token_program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", system_program: "11111111111111111111111111111111", event_authority: event, program: DAMM.program, token_a_account: m.wsol, token_b_account: m.usdc, token_a_vault: DAMM.vaultA, token_b_vault: DAMM.vaultB, token_a_mint: DAMM.sol, token_b_mint: DAMM.usdc, token_a_program: DAMM.token, token_b_program: DAMM.token };
  const cu = Buffer.alloc(5); cu[0] = 2; cu.writeUInt32LE(1000000, 1); const priority = Buffer.alloc(9); priority[0] = 3; priority.writeBigUInt64LE(1000n, 1);
  const swap = upstream.swapInstruction;
  const instructions: k.Instruction[] = [{ programAddress: k.address("ComputeBudget111111111111111111111111111111"), data: cu }, { programAddress: k.address("ComputeBudget111111111111111111111111111111"), data: priority }, { programAddress: k.address(swap.programId), data: Buffer.from(swap.data, "base64"), accounts: swap.accounts.map(a => ({ address: k.address(a.pubkey), role: a.isSigner ? a.isWritable ? 3 : 2 : a.isWritable ? 1 : 0 })) }, dammInstruction("create_position", a), dammInstruction("add_liquidity", a, [lo, maxA, maxB])];
  const latest = (await rpc<{ value: { blockhash: k.Blockhash; lastValidBlockHeight: bigint } }>("getLatestBlockhash", [{ commitment: "confirmed" }])).value;
  const msg = k.pipe(k.createTransactionMessage({ version: 0 }), t => k.setTransactionMessageFeePayer(k.address(m.wallet), t), t => k.setTransactionMessageLifetimeUsingBlockhash({ blockhash: latest.blockhash, lastValidBlockHeight: BigInt(latest.lastValidBlockHeight) }, t), t => k.appendTransactionMessageInstructions(instructions, t));
  const compiled = k.compileTransactionMessage(k.compressTransactionMessageUsingAddressLookupTables(msg, tables)), bytes = Buffer.from(k.getCompiledTransactionMessageEncoder().encode(compiled));
  assert.equal(compiled.header.numSignerAccounts, 2); assert.deepEqual(new Set(compiled.staticAccounts.slice(0, 2)), new Set([m.wallet, input.mint])); assert.equal(compiled.staticAccounts[0], m.wallet);
  const wire = Buffer.concat([Buffer.from([2]), Buffer.alloc(128), bytes]); assert(wire.length <= 1232);
  const fee = (await rpc<{ value: number }>("getFeeForMessage", [bytes.toString("base64"), { commitment: "confirmed" }])).value; assert(Number.isSafeInteger(fee) && fee <= 12000 && fee >= 10000);
  const sim = await rpc<{ context: { slot: number }; value: { err: unknown; accounts: DammAccount[]; logs: string[] } }>("simulateTransaction", [wire.toString("base64"), { encoding: "base64", commitment: "confirmed", sigVerify: false, replaceRecentBlockhash: false, innerInstructions: true, accounts: { encoding: "base64", addresses: [m.wallet, m.usdc, m.wsol, position, input.mint, nft] } }]);
  assert.equal(sim.value.err, null, "Entry simulation failed"); const post = sim.value.accounts, spent = stable - tokenAtoms(post[1]!, DAMM.usdc, m.wallet), residual = tokenAtoms(post[2]!, DAMM.sol, m.wallet) - wrapped;
  assert(spent > 0n && spent <= maxSwap + maxB && spent <= 10000000n && residual >= 0n && residual <= maxA);
  const ps = decodeDamm<{ pool: string; nft_mint: string; unlocked_liquidity: bigint; vested_liquidity: bigint; permanent_locked_liquidity: bigint }>("Position", post[3]!);
  assert.equal(ps.pool, DAMM.pool); assert.equal(ps.nft_mint, input.mint); assert.equal(ps.unlocked_liquidity, lo); assert.equal(ps.vested_liquidity, 0n); assert.equal(ps.permanent_locked_liquidity, 0n);
  assert.equal(tokenAtoms(post[5]!, input.mint, m.wallet, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"), 1n);
  const rent = post.slice(3).reduce((n, a) => n + BigInt(a.lamports), 0n); assert.equal(rent, 7223760n); assert.equal(native - BigInt(post[0]!.lamports), rent + BigInt(fee)); assert(operatingAvailable - rent - BigInt(fee) >= 10000000n);
  const allow = new Set<string>([DAMM.program, ROUTER, WHIRLPOOL, DAMM.token, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "11111111111111111111111111111111", "ComputeBudget111111111111111111111111111111", "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"]);
  for (const log of sim.value.logs) { const id = /^Program (\w+) invoke/.exec(log)?.[1]; if (id) assert(allow.has(id), "Unexpected invoked program"); }
  const blockTime = await rpc<number>("getBlockTime", [sim.context.slot]); assert(Math.abs(Date.now() / 1000 - blockTime) <= 90); assert(Date.now() - started <= 45000, "Quote preparation took too long");
  const now = new Date().toISOString(), usdPrice = (q: bigint) => new Decimal(q.toString()).pow(2).div(new Decimal(2).pow(128)).mul(1000).toFixed(6);
  return { wallet: m.wallet, stationId: 5, pool: DAMM.pool, mint: input.mint, position, nft, messageBase64: bytes.toString("base64"), wireBase64: wire.toString("base64"), messageHash: createHash("sha256").update(bytes).digest("hex"), blockhash: latest.blockhash, lastValidBlockHeight: Number(latest.lastValidBlockHeight), preparedAt: now, expiresAt: new Date(started + 50000).toISOString(), slot: sim.context.slot, lookupTables: tables, liquidity: String(lo), maxSolAtoms: String(maxA), maxSpendUsdcAtoms: String(maxSwap + maxB), maxSwapUsdcAtoms: String(maxSwap), maxDepositUsdcAtoms: String(maxB), simulatedSpendUsdcAtoms: String(spent), principalSolAtoms: String(inventory.a), principalUsdcAtoms: String(inventory.b), residualWsolAtoms: String(residual), rentLamports: String(rent), feeLamports: String(fee), feePoolBeforeLamports: String(operatingAvailable), feePoolAfterLamports: String(operatingAvailable - rent - BigInt(fee)), beforeUsdcAtoms: String(stable), beforeWsolAtoms: String(wrapped), beforeNativeLamports: String(native), lowerPrice: usdPrice(state.sqrt_min_price), upperPrice: usdPrice(state.sqrt_max_price), minimumCashUsdcAtoms: String(cash) };
}
