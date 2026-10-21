/** Read-only Kamino receipt valuation and unsigned instruction preparation. No keys or submission API. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { address, getAddressDecoder, getAddressEncoder, getProgramDerivedAddress, type Instruction } from "@solana/kit";
import { Decimal } from "decimal.js";
import { decodeLayout, layoutSize, type Layout } from "./diligence/lending-layout.js";
import { SecurityRpc } from "./diligence/security.js";
import type { PlatformBalance } from "../../../packages/contracts/src/studio.js";

export const KAMINO_DIRECT = {
  wallet: "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j",
  program: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
  market: "DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek",
  reserve: "Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp",
  authority: "B9spsrMK6pJicYtukaZzDyzsUQLgc3jbx5gHVwdDxb6y",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  usdcAta: "8DDPMR9LcM7YaHfwq41TteyGpnFi222gCgDEZUuy5PmE",
  collateralMint: "32XLsweyeQwWgLKRVAzS72nxHGU1JmmNQQZ3C3q6fBjJ",
  collateralAta: "Ezb8iGvPbVKFN2tF6wrRermeo47qDXTWXQWMiUYLeAYx",
  vault: "GENey8es3EgGiNTM8H8gzA3vf98haQF8LHiYFyErjgrv",
  tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  scope: "3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH",
} as const;
export interface KaminoEntry { signature: string; at: string; spentUsdcAtoms: string; receiptAtoms: string; networkFeeLamports: string; accountRentLamports: string }
/** Only a reviewed, finalized public receipt may be added here after a separately authorized entry. */
export const KAMINO_CONFIRMED_ENTRY: KaminoEntry | undefined = {
  "signature": "2Z3TQQy8ApF5K2jPit5G569C4recEXMRwVF2fPC55DGWnTXaZpYpRdpwH9TvCm8GwxRGVTsgoaG8xFPUjzdrQ9x5",
  "at": "2026-10-21T01:58:50.000Z",
  "spentUsdcAtoms": "10000000",
  "receiptAtoms": "8295955",
  "networkFeeLamports": "5400",
  "accountRentLamports": "1488440"
};
interface Account { owner: string; executable: boolean; data: string[] }
interface Reserve {
  lendingMarket: string; lastUpdate: { timestamp: number };
  liquidity: { mintPubkey: string; supplyVault: string; tokenProgram: string; mintDecimals: string; totalAvailableAmount: string; borrowedAmountSf: string; accumulatedProtocolFeesSf: string; accumulatedReferrerFeesSf: string; pendingReferrerFeesSf: string };
  collateral: { mintPubkey: string; mintTotalSupply: string };
  config: { status: number; emergencyMode: number; permissionedOps: string; blockCtokenUsage: number; depositLimit: string; tokenInfo: { scopeConfiguration: { priceFeed: string } } };
}
const schemaFile = JSON.parse(await readFile(new URL("./kamino-layouts.json", import.meta.url), "utf8")) as { sdkRevision: string; schemas: Record<string, Layout> };
const schemas = schemaFile.schemas, SF = 1n << 60n;
const preparation = JSON.parse(await readFile(new URL("./kamino-preparation.json", import.meta.url), "utf8")) as NonNullable<NonNullable<PlatformBalance["lending"]>["preparation"]>;
export async function readKaminoSupplyApy(): Promise<string | null> {
  try {
    const r = await fetch(`https://api.kamino.finance/kamino-market/${KAMINO_DIRECT.market}/reserves/metrics`, { signal: AbortSignal.timeout(8000) });
    assert(r.ok); const rows: unknown = await r.json(); assert(Array.isArray(rows));
    const metric = rows.map(obj).find(m => m.reserve === KAMINO_DIRECT.reserve && m.liquidityTokenMint === KAMINO_DIRECT.usdcMint);
    assert(metric && typeof metric.supplyApy === "string"); const apy = new Decimal(metric.supplyApy); assert(apy.isFinite() && apy.gte(0) && apy.lte(100)); return apy.toFixed();
  } catch { return null; } // A missing rate never conceals a verified receipt balance.
}
function bytes(a: Account | null, owner: string) { assert(a && a.owner === owner && a.executable === false, "Unexpected Kamino account owner"); assert.equal(a.data[1], "base64"); return Buffer.from(a.data[0]!, "base64"); }
function decoded<T>(a: Account | null, name: string): T {
  const b = bytes(a, KAMINO_DIRECT.program), layout = schemas[name]!;
  assert.equal(b.length, layoutSize(layout, schemas) + 8);
  assert(b.subarray(0, 8).equals(createHash("sha256").update(`account:${name}`).digest().subarray(0, 8)), "Invalid Kamino discriminator");
  return decodeLayout(layout, b, schemas, 8) as T;
}
export function decodeKaminoReserve(a: Account | null): Reserve {
  const r = decoded<Reserve>(a, "Reserve"), k = KAMINO_DIRECT;
  assert.equal(r.lendingMarket, k.market); assert.equal(r.liquidity.mintPubkey, k.usdcMint);
  assert.equal(r.liquidity.supplyVault, k.vault); assert.equal(r.liquidity.tokenProgram, k.tokenProgram);
  assert.equal(r.liquidity.mintDecimals, "6"); assert.equal(r.collateral.mintPubkey, k.collateralMint);
  assert.equal(r.config.tokenInfo.scopeConfiguration.priceFeed, k.scope);
  return r;
}
function supplySf(r: Reserve) {
  const l = r.liquidity;
  const supply = BigInt(l.totalAvailableAmount) * SF + BigInt(l.borrowedAmountSf) - BigInt(l.accumulatedProtocolFeesSf) - BigInt(l.accumulatedReferrerFeesSf) - BigInt(l.pendingReferrerFeesSf);
  assert(supply > 0n && BigInt(r.collateral.mintTotalSupply) > 0n); return supply;
}
export function receiptValueUsdcAtoms(r: Reserve, receipts: bigint): bigint {
  assert(receipts >= 0n && receipts <= BigInt(r.collateral.mintTotalSupply));
  return receipts * supplySf(r) / (BigInt(r.collateral.mintTotalSupply) * SF);
}
export async function buildKaminoDirectInstructions(r: Reserve, amount: bigint) {
  assert(amount > 0n && amount <= 10_000_000n, "Deposit must be within 10 USDC");
  assert.equal(r.config.status, 0); assert.equal(r.config.emergencyMode, 0); assert.equal(r.config.permissionedOps, "0"); assert.equal(r.config.blockCtokenUsage, 0);
  assert(supplySf(r) + amount * SF <= BigInt(r.config.depositLimit) * SF, "Deposit cap exceeded");
  const k = KAMINO_DIRECT, enc = getAddressEncoder();
  const authority = (await getProgramDerivedAddress({ programAddress: address(k.program), seeds: [Buffer.from("lma"), enc.encode(address(k.market))] }))[0];
  assert.equal(authority, k.authority);
  const meta = (a: string, role = 0) => ({ address: address(a), role: role as 0 | 1 | 2 | 3 });
  const refresh: Instruction = { programAddress: address(k.program), data: new Uint8Array([2, 218, 138, 235, 79, 201, 25, 102]), accounts: [meta(k.reserve, 1), meta(k.market), meta(k.program), meta(k.program), meta(k.program), meta(k.scope)] };
  const data = Buffer.alloc(16); Buffer.from([169, 201, 30, 126, 6, 205, 102, 68]).copy(data); data.writeBigUInt64LE(amount, 8);
  const deposit: Instruction = { programAddress: address(k.program), data, accounts: [meta(k.wallet, 2), meta(k.reserve, 1), meta(k.market), meta(k.authority), meta(k.usdcMint), meta(k.vault, 1), meta(k.collateralMint, 1), meta(k.usdcAta, 1), meta(k.collateralAta, 1), meta(k.tokenProgram), meta(k.tokenProgram), meta("Sysvar1nstructions1111111111111111111111111")] };
  function redeem(receipts: bigint): Instruction {
    assert(receipts > 0n && receipts <= 18_446_744_073_709_551_615n);
    const data = Buffer.alloc(16); Buffer.from([234, 117, 181, 125, 185, 142, 220, 29]).copy(data); data.writeBigUInt64LE(receipts, 8);
    return { programAddress: address(k.program), data, accounts: [meta(k.wallet, 2), meta(k.market), meta(k.reserve, 1), meta(k.authority), meta(k.usdcMint), meta(k.collateralMint, 1), meta(k.vault, 1), meta(k.collateralAta, 1), meta(k.usdcAta, 1), meta(k.tokenProgram), meta(k.tokenProgram), meta("Sysvar1nstructions1111111111111111111111111")] };
  }
  return { refresh, deposit, redeem };
}
interface Reader { call(method: string, params: unknown[]): Promise<unknown> }
const obj = (v: unknown) => { assert(v && typeof v === "object" && !Array.isArray(v)); return v as Record<string, unknown>; };
const usdc = (n: bigint) => new Decimal(n.toString()).div(1e6).toFixed(6);
function tokenAmount(a: Account | null, mint: string, owner: string) {
  const b = bytes(a, KAMINO_DIRECT.tokenProgram); assert.equal(b.length, 165);
  assert.equal(getAddressDecoder().decode(b.subarray(0, 32)), mint); assert.equal(getAddressDecoder().decode(b.subarray(32, 64)), owner);
  assert.equal(b[108], 1); assert.equal(b.readUInt32LE(72), 0); assert.equal(b.readUInt32LE(129), 0);
  return b.readBigUInt64LE(64);
}
export async function readKaminoDirect(wallet: string, rpcUrl: string, previous?: { slot: number; history?: { at: string; valueUsd: string }[] }, reader: Reader = new SecurityRpc(rpcUrl), now = new Date().toISOString(), entry?: KaminoEntry): Promise<PlatformBalance> {
  const k = KAMINO_DIRECT; assert.equal(wallet, k.wallet); assert(Number.isFinite(Date.parse(now)));
  assert.equal(await reader.call("getGenesisHash", []), "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  const batch = obj(await reader.call("getMultipleAccounts", [[k.reserve, k.market, k.collateralAta, k.collateralMint, k.vault], { encoding: "base64", commitment: "confirmed", ...(previous ? { minContextSlot: previous.slot } : {}) }]));
  const slot = obj(batch.context).slot; assert(typeof slot === "number" && Number.isSafeInteger(slot) && slot > 0);
  if (previous) assert(slot >= previous.slot, "Kamino slot regressed");
  const time = await reader.call("getBlockTime", [slot]); assert(typeof time === "number" && Number.isSafeInteger(time));
  const age = Date.parse(now) / 1000 - time; assert(age >= -30 && age <= 90, "Kamino chain context stale");
  assert(Array.isArray(batch.value) && batch.value.length === 5); const accounts = batch.value as (Account | null)[];
  const r = decodeKaminoReserve(accounts[0]!), market = decoded<{ emergencyMode: number; permissionedOps: string }>(accounts[1]!, "LendingMarket");
  assert.equal(market.emergencyMode, 0); assert.equal(market.permissionedOps, "0");
  assert.equal(r.config.status, 0); assert.equal(r.config.emergencyMode, 0); assert.equal(r.config.blockCtokenUsage, 0); assert.equal(r.config.permissionedOps, "0");
  const accruedAge = Date.parse(now) / 1000 - r.lastUpdate.timestamp; assert(accruedAge >= -30 && accruedAge <= 300, "Reserve accrual is stale");
  const mint = bytes(accounts[3]!, k.tokenProgram); assert.equal(mint.length, 82); assert.equal(mint[44], 6); assert.equal(mint[45], 1); assert.equal(mint.readUInt32LE(46), 0);
  // Protocol and SDK exchange rates use reserve.collateral.mintTotalSupply, not SPL mint supply.
  // Independent burns can reduce circulating SPL tokens without updating that denominator.
  assert(mint.readBigUInt64LE(36) <= BigInt(r.collateral.mintTotalSupply), "Unaccounted receipt issuance");
  assert(tokenAmount(accounts[4]!, k.usdcMint, k.authority) >= BigInt(r.liquidity.totalAvailableAmount));
  const receipts = accounts[2] ? tokenAmount(accounts[2], k.collateralMint, wallet) : 0n;
  const value = receiptValueUsdcAtoms(r, receipts); let pnl: string | null = null;
  if (entry) {
    assert(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(entry.signature)); assert(Number.isFinite(Date.parse(entry.at)) && entry.at <= now);
    assert(/^\d+$/.test(entry.spentUsdcAtoms) && /^\d+$/.test(entry.receiptAtoms));
    const cost = BigInt(entry.spentUsdcAtoms); assert(cost > 0n && cost <= 10_000_000n); assert(BigInt(entry.receiptAtoms) > 0n);
    assert.equal(receipts, BigInt(entry.receiptAtoms), "Kamino shares changed; reconcile entry first"); pnl = usdc(value - cost);
  }
  const state = entry ? "active" : receipts > 0n ? "unattributed" : "prepared";
  const history = receipts > 0n ? [...(previous?.history ?? []).filter(h => h.at < now), { at: now, valueUsd: usdc(value) }].slice(-120) : [];
  return { status: receipts > 0n ? "ready" : "needs_setup", valueUsd: usdc(value), positionCount: receipts > 0n ? 1 : 0, executionEnabled: false,
    detail: state === "prepared" ? "Prepared: up to 10 USDC direct lending · awaiting review · execution off" : state === "unattributed" ? "Receipt tokens observed · entry attribution required · execution off" : "USDC lending · receipt-token value · fee pool excluded · execution off",
    connection: { scope: "program_accounts", detail: "Direct USDC receipt tokens · on-chain reserve exchange rate · USDC=$1" },
    lending: { state, plannedUsdc: "10.000000", reserve: k.reserve, collateralMint: k.collateralMint, receiptAccount: k.collateralAta, receiptAtoms: receipts.toString(), redeemableUsdc: usdc(value), pnlUsd: pnl, supplyApy: null, slot, accruedAt: new Date(r.lastUpdate.timestamp * 1000).toISOString(), preparation, history,
      ...(entry ? { entry: { signature: entry.signature, at: entry.at, spentUsdc: usdc(BigInt(entry.spentUsdcAtoms)), accountRentSol: new Decimal(entry.accountRentLamports).div(1e9).toFixed(9), networkFeeSol: new Decimal(entry.networkFeeLamports).div(1e9).toFixed(9) } } : {}) } };
}
