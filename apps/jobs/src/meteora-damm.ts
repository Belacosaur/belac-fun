/** Fixed-pool, read-only DAMM primitives. No key access, signing or broadcast capability. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { address, getAddressDecoder, type Instruction } from "@solana/kit";
import { Decimal } from "decimal.js";
import { SecurityRpc } from "./diligence/security.js";
import type { PlatformBalance } from "../../../packages/contracts/src/studio.js";
export const DAMM = {
  program: "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  pool: "8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie",
  authority: "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC",
  sol: "So11111111111111111111111111111111111111112",
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  vaultA: "sx8hCMCauCdbZ7sVBGSJmH7b7JmtuN8d8YwYmBpuPLH",
  vaultB: "8S8HjmPZr8tNNEmMj5pcqS5RN73uF6DmcUDEDaoUQ1Ei",
  token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
} as const;
type Field = string | { array: [Field, number] } | { defined: { name: string } };
interface Definition { name: string; type: Field }
const idl = JSON.parse(await readFile(new URL("./meteora-idl.json", import.meta.url), "utf8")) as {
  accounts: { name: string; discriminator: number[] }[];
  types: { name: string; type: { fields: Definition[] } }[];
  instructions: { name: string; discriminator: number[]; accounts: { name: string; address?: string; writable?: boolean; signer?: boolean }[] }[];
};
const types = Object.fromEntries(idl.types.map(t => [t.name, t.type.fields]));
function size(t: Field): number {
  if (typeof t === "string") { assert(/^(pubkey|bool|u(8|16|32|64|128))$/.test(t)); return t === "pubkey" ? 32 : t === "bool" ? 1 : Number(t.slice(1)) / 8; }
  if ("array" in t) return size(t.array[0]) * t.array[1];
  return types[t.defined.name]!.reduce((n, f) => n + size(f.type), 0);
}
export interface DammAccount { owner: string; executable: boolean; data: string[]; lamports: number }
export function decodeDamm<T>(name: "Pool" | "Position", account: DammAccount): T {
  assert(account.owner === DAMM.program && account.executable === false && account.data[1] === "base64");
  const b = Buffer.from(account.data[0]!, "base64"), def = idl.accounts.find(a => a.name === name)!;
  assert.equal(b.length, 8 + size({ defined: { name } })); assert(b.subarray(0, 8).equals(Buffer.from(def.discriminator)));
  let offset = 8;
  function decode(t: Field): unknown {
    if (typeof t !== "string") return "array" in t ? Array.from({ length: t.array[1] }, () => decode(t.array[0])) : Object.fromEntries(types[t.defined.name]!.map(f => [f.name, decode(f.type)]));
    const n = size(t), v = b.subarray(offset, offset + n); offset += n;
    if (t === "pubkey") return getAddressDecoder().decode(v);
    let x = 0n; for (let i = 0; i < n; i++) x += BigInt(v[i]!) << BigInt(8 * i);
    return n <= 4 ? Number(x) : x;
  }
  return Object.fromEntries(types[name]!.map(f => [f.name, decode(f.type)])) as T;
}
export interface DammPool {
  token_a_mint: string; token_b_mint: string; token_a_vault: string; token_b_vault: string;
  sqrt_price: bigint; sqrt_min_price: bigint; sqrt_max_price: bigint; liquidity: bigint;
  pool_status: number; collect_fee_mode: number; token_a_flag: number; token_b_flag: number;
  fee_a_per_liquidity: number[]; fee_b_per_liquidity: number[];
  layout_version: number; reward_infos: { initialized: number }[];
}
interface DammPosition {
  pool: string; nft_mint: string; unlocked_liquidity: bigint; vested_liquidity: bigint; permanent_locked_liquidity: bigint;
  fee_a_per_token_checkpoint: number[]; fee_b_per_token_checkpoint: number[]; fee_a_pending: bigint; fee_b_pending: bigint;
}
/** Receipt inventory adapter ready for a separately confirmed entry. Never values the whole wallet. */
export function dammPositionInventory(pool: DammPool, account: DammAccount, nft: DammAccount, wallet: string, expected: { mint: string; liquidity: bigint }) {
  const p = decodeDamm<DammPosition>("Position", account);
  assert.equal(p.pool, DAMM.pool); assert.equal(p.nft_mint, expected.mint);
  assert.equal(p.unlocked_liquidity, expected.liquidity); assert(expected.liquidity > 0n);
  assert.equal(p.vested_liquidity, 0n); assert.equal(p.permanent_locked_liquidity, 0n);
  assert(nft.owner === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" && nft.executable === false && nft.data[1] === "base64");
  const b = Buffer.from(nft.data[0]!, "base64"); assert.equal(b.length, 165);
  assert.equal(getAddressDecoder().decode(b.subarray(0, 32)), expected.mint);
  assert.equal(getAddressDecoder().decode(b.subarray(32, 64)), wallet); assert.equal(b.readBigUInt64LE(64), 1n);
  assert.equal(b[108], 1); // Simulated official create_position produces an initialized, unfrozen NFT.
  const u256 = (v: number[]) => { assert.equal(v.length, 32); return v.reduce((n, x, i) => { assert(Number.isInteger(x) && x >= 0 && x <= 255); return n + (BigInt(x) << BigInt(8 * i)); }, 0n); };
  const max = (1n << 64n) - 1n, mod = 1n << 256n;
  const fee = (growth: number[], checkpoint: number[], pending: bigint) => {
    const delta = (u256(growth) - u256(checkpoint) + mod) % mod;
    const total = pending + ((p.unlocked_liquidity * delta) >> 128n);
    return total > max ? max : total;
  };
  return { ...dammAmounts(p.unlocked_liquidity, pool.sqrt_price, pool.sqrt_min_price, pool.sqrt_max_price, false),
    feeA: fee(pool.fee_a_per_liquidity, p.fee_a_per_token_checkpoint, p.fee_a_pending),
    feeB: fee(pool.fee_b_per_liquidity, p.fee_b_per_token_checkpoint, p.fee_b_pending) };
}
export function verifiedDammPool(account: DammAccount): DammPool {
  const s = decodeDamm<DammPool>("Pool", account);
  assert.equal(s.token_a_mint, DAMM.sol); assert.equal(s.token_b_mint, DAMM.usdc);
  assert.equal(s.token_a_vault, DAMM.vaultA); assert.equal(s.token_b_vault, DAMM.vaultB);
  assert.equal(s.pool_status, 0); assert.equal(s.collect_fee_mode, 0);
  assert.equal(s.token_a_flag, 0); assert.equal(s.token_b_flag, 0);
  assert.equal(s.layout_version, 1); assert(s.reward_infos.every(r => r.initialized === 0), "Incentive rewards require a separate valuation adapter");
  assert(s.liquidity > 0n && s.sqrt_min_price > 0n && s.sqrt_max_price > s.sqrt_min_price);
  assert(s.sqrt_price >= s.sqrt_min_price && s.sqrt_price <= s.sqrt_max_price);
  return s;
}
export function dammAmounts(l: bigint, p: bigint, a: bigint, b: bigint, up: boolean) {
  assert(l >= 0n && a > 0n && b > a && p > 0n);
  p = p < a ? a : p > b ? b : p;
  const div = (n: bigint, d: bigint) => (n + (up ? d - 1n : 0n)) / d;
  return { a: div(l * (b - p), p * b), b: div(l * (p - a), 1n << 128n) };
}
export function capDammBudget(maxSwapUsdcAtoms: bigint, maxDepositUsdcAtoms: bigint) {
  assert(maxSwapUsdcAtoms > 0n && maxDepositUsdcAtoms >= 0n);
  const remaining = 10_000_000n - maxSwapUsdcAtoms - maxDepositUsdcAtoms;
  assert(remaining >= 0n, "Meteora strategy exceeds 10 USDC"); return remaining;
}
/** Encode only the five reviewed official instructions; caller supplies bounded integer arguments. */
export function dammInstruction(name: string, accounts: Record<string, string>, args: bigint[] = []): Instruction {
  const def = idl.instructions.find(i => i.name === name); assert(def);
  const widths = name === "add_liquidity" || name === "remove_liquidity" ? [16, 8, 8] : [];
  assert.equal(args.length, widths.length);
  const data = Buffer.alloc(8 + widths.reduce((n, w) => n + w, 0)); data.set(def.discriminator);
  let offset = 8;
  args.forEach((v, i) => { const w = widths[i]!; assert(v >= 0n && v < 1n << BigInt(w * 8)); for (let j = 0; j < w; j++) data[offset++] = Number(v >> BigInt(j * 8) & 255n); });
  return { programAddress: address(DAMM.program), data, accounts: def.accounts.map(a => ({ address: address(accounts[a.name] ?? a.address!), role: a.signer ? a.writable ? 3 : 2 : a.writable ? 1 : 0 })) };
}

const preparation = JSON.parse(await readFile(new URL("./meteora-preparation.json", import.meta.url), "utf8")) as NonNullable<PlatformBalance["damm"]>["preparation"] & { pool: string };
function tokenBalance(a: DammAccount, mint: string, owner: string) {
  assert(a.owner === DAMM.token && a.executable === false && a.data[1] === "base64");
  const b = Buffer.from(a.data[0]!, "base64"); assert.equal(b.length, 165);
  assert.equal(getAddressDecoder().decode(b.subarray(0, 32)), mint);
  assert.equal(getAddressDecoder().decode(b.subarray(32, 64)), owner); assert.equal(b[108], 1);
  return b.readBigUInt64LE(64);
}
/** A prepared proposal is never an owned position or part of challenge equity. */
export async function readMeteoraDamm(wallet: string, rpcUrl: string, fetcher: typeof fetch = fetch, now = new Date().toISOString()): Promise<PlatformBalance> {
  assert.equal(wallet, "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j");
  assert.equal(preparation.pool, DAMM.pool); assert.equal(preparation.budgetUsdc, "10.000000");
  assert(new Decimal(preparation.maxSpendUsdc).lte(10));
  const rpc = new SecurityRpc(rpcUrl, fetcher);
  const raw = await rpc.call("getMultipleAccounts", [[DAMM.pool, DAMM.vaultA, DAMM.vaultB, DAMM.sol, DAMM.usdc], { encoding: "base64", commitment: "confirmed" }]) as { context: { slot: number }; value: DammAccount[] };
  const slot = raw.context.slot; assert(Number.isSafeInteger(slot) && slot > 0); assert.equal(raw.value.length, 5);
  const blockTime = await rpc.call("getBlockTime", [slot]); assert(typeof blockTime === "number");
  const age = Date.parse(now) / 1000 - blockTime; assert(age >= -30 && age <= 90, "Stale DAMM pool context");
  const s = verifiedDammPool(raw.value[0]!);
  assert(tokenBalance(raw.value[1]!, DAMM.sol, DAMM.authority) > 0n);
  assert(tokenBalance(raw.value[2]!, DAMM.usdc, DAMM.authority) > 0n);
  for (let i = 0; i < 2; i++) {
    const a = raw.value[3 + i]!; assert(a.owner === DAMM.token && a.executable === false && a.data[1] === "base64");
    const b = Buffer.from(a.data[0]!, "base64"); assert.equal(b.length, 82); assert.equal(b[44], i ? 6 : 9); assert.equal(b[45], 1);
  }
  const price = (q: bigint) => new Decimal(q.toString()).div(new Decimal(2).pow(64)).pow(2).mul(1000).toFixed(6);
  return { status: "needs_setup", valueUsd: null, positionCount: null, executionEnabled: false,
    detail: "DAMM v2 SOL/USDC prepared · entry + withdrawal simulated · quote refresh required · execution off",
    connection: { scope: "program_accounts", detail: "Verified DAMM v2 pool and vaults · no confirmed Meteora allocation" },
    damm: { state: "prepared", pool: DAMM.pool, plannedUsdc: "10.000000", slot,
      poolPriceUsd: price(s.sqrt_price), lowerPriceUsd: price(s.sqrt_min_price), upperPriceUsd: price(s.sqrt_max_price), preparation } };
}
