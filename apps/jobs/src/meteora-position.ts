import assert from "node:assert/strict";
import { Decimal } from "decimal.js";
import { DAMM, verifiedDammPool, dammPositionInventory, type DammAccount } from "./meteora-damm.js";
import { tradeRpc } from "./trade-rpc.js";
import type { MeteoraReceipt } from "../../../packages/contracts/src/trades.js";
import type { PlatformBalance, StrategyPerformance } from "../../../packages/contracts/src/studio.js";
export async function readMeteoraPosition(wallet: string, endpoint: string, entry: MeteoraReceipt, previous?: StrategyPerformance, now = new Date().toISOString()): Promise<PlatformBalance> {
  assert.equal(entry.wallet, wallet); assert.equal(entry.pool, DAMM.pool);
  assert(BigInt(entry.spentUsdcAtoms) > 0n && BigInt(entry.spentUsdcAtoms) <= 10000000n);
  const rpc = tradeRpc(endpoint); assert.equal(await rpc("getGenesisHash", []), "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  const raw = await rpc<{ context: { slot: number }; value: DammAccount[] }>("getMultipleAccounts", [[DAMM.pool, entry.position, entry.nft, entry.mint], { encoding: "base64", commitment: "confirmed", minContextSlot: entry.slot }]);
  const time = await rpc<number>("getBlockTime", [raw.context.slot]); assert(Math.abs(Date.parse(now) / 1000 - time) <= 90);
  const s = verifiedDammPool(raw.value[0]!), inventory = dammPositionInventory(s, raw.value[1]!, raw.value[2]!, wallet, { mint: entry.mint, liquidity: BigInt(entry.liquidity) });
  const mint = raw.value[3]!; assert.equal(mint.owner, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"); const b = Buffer.from(mint.data[0]!, "base64"); assert.equal(b.readBigUInt64LE(36), 1n); assert.equal(b[44], 0); assert.equal(b[45], 1);
  const sol = (n: bigint) => new Decimal(n.toString()).div(1e9), usdc = (n: bigint) => new Decimal(n.toString()).div(1e6);
  const price = new Decimal(s.sqrt_price.toString()).pow(2).div(new Decimal(2).pow(128)).mul(1000);
  const cash = 10000000n - BigInt(entry.spentUsdcAtoms), residual = BigInt(entry.residualWsolAtoms), totalSol = inventory.a + inventory.feeA + residual;
  const equity = sol(totalSol).mul(price).add(usdc(inventory.b + inventory.feeB + cash));
  const performance: StrategyPerformance = { stationId: 5, allocationUsd: "10", entryCostUsdc: usdc(BigInt(entry.spentUsdcAtoms)).toFixed(6), equityUsd: equity.toFixed(12), pnlUsd: equity.sub(10).toFixed(12), pnlPct: equity.sub(10).mul(10).toFixed(8), solAmount: sol(totalSol).toFixed(9), cashUsdc: usdc(cash).toFixed(6), entryAt: entry.at, entrySignature: entry.signature, executionEnabled: false, history: [...(previous?.history ?? []).filter(h => h.at < now), { at: now, valueUsd: equity.toFixed(12) }].slice(-120), principalSol: sol(inventory.a).toFixed(9), principalUsdc: usdc(inventory.b).toFixed(6), residualSol: sol(residual).toFixed(9), accruedFeesSol: sol(inventory.feeA).toFixed(9), accruedFeesUsdc: usdc(inventory.feeB).toFixed(6), accruedFeesUsd: sol(inventory.feeA).mul(price).add(usdc(inventory.feeB)).toFixed(12), positionAddress: entry.position, lowerPrice: new Decimal(s.sqrt_min_price.toString()).pow(2).div(new Decimal(2).pow(128)).mul(1000).toFixed(6), upperPrice: new Decimal(s.sqrt_max_price.toString()).pow(2).div(new Decimal(2).pow(128)).mul(1000).toFixed(6), inRange: s.sqrt_price > s.sqrt_min_price && s.sqrt_price < s.sqrt_max_price };
  return { status: "ready", valueUsd: performance.equityUsd, positionCount: 1, executionEnabled: false, performance, connection: { scope: "positions", detail: "Finalized wallet-approved Meteora receipt + current NFT-owned inventory" }, detail: "DAMM v2 SOL/USDC · principal + accrued fees + attributed residuals · automated execution off" };
}
