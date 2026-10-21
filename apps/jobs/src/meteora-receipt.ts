import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as k from "@solana/kit";
import type { MeteoraPlan, MeteoraReceipt } from "../../../packages/contracts/src/trades.js";
import { DAMM, type DammAccount, decodeDamm } from "./meteora-damm.js";
import { METEORA_ACCOUNTS } from "./meteora-builder.js";
import type { TradeRpc } from "./trade-rpc.js";
export interface ChainTransaction {
  slot: number; blockTime: number; transaction: [string, string];
  meta: { err: unknown; fee: number; preBalances: number[]; postBalances: number[]; loadedAddresses?: { writable: string[]; readonly: string[] }; preTokenBalances: TokenRow[]; postTokenBalances: TokenRow[] };
}
interface TokenRow { accountIndex: number; mint: string; owner: string; uiTokenAmount: { amount: string; decimals: number } }
export async function verifyMeteoraReceipt(plan: MeteoraPlan, signature: string, rpc: TradeRpc): Promise<MeteoraReceipt> {
  const tx = await rpc<ChainTransaction | null>("getTransaction", [signature, { encoding: "base64", commitment: "finalized", maxSupportedTransactionVersion: 0 }]); assert(tx && !tx.meta.err && tx.blockTime, "Finalized transaction unavailable");
  const decoded = k.getTransactionDecoder().decode(Buffer.from(tx.transaction[0], "base64"));
  assert.equal(k.getSignatureFromTransaction(decoded), signature); assert.equal(createHash("sha256").update(Buffer.from(decoded.messageBytes)).digest("hex"), plan.messageHash);
  const compiled = k.getCompiledTransactionMessageDecoder().decode(decoded.messageBytes), keys: string[] = [...compiled.staticAccounts, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  assert.equal(keys[0], plan.wallet); const m = tx.meta;
  const amount = (rows: TokenRow[], key: string, mint: string, required = true) => { const r = rows.find(r => r.accountIndex === keys.indexOf(key)); if (!r) { assert(!required); return 0n; } assert.equal(r.owner, plan.wallet); assert.equal(r.mint, mint); assert(/^\d+$/.test(r.uiTokenAmount.amount)); return BigInt(r.uiTokenAmount.amount); };
  const beforeUsdc = amount(m.preTokenBalances, METEORA_ACCOUNTS.usdc, DAMM.usdc), afterUsdc = amount(m.postTokenBalances, METEORA_ACCOUNTS.usdc, DAMM.usdc);
  const beforeWsol = amount(m.preTokenBalances, METEORA_ACCOUNTS.wsol, DAMM.sol), afterWsol = amount(m.postTokenBalances, METEORA_ACCOUNTS.wsol, DAMM.sol);
  const spent = beforeUsdc - afterUsdc, residual = afterWsol - beforeWsol;
  assert(spent > 0n && spent <= 10000000n && spent <= BigInt(plan.maxSpendUsdcAtoms)); assert(residual >= 0n); assert(beforeWsol >= METEORA_ACCOUNTS.orcaWsol);
  assert.equal(amount(m.postTokenBalances, plan.nft, plan.mint), 1n);
  assert(Number.isSafeInteger(m.fee) && m.fee > 0 && BigInt(m.fee) <= BigInt(plan.feeLamports));
  const rent = BigInt(m.preBalances[0]!) - BigInt(m.postBalances[0]!) - BigInt(m.fee); assert.equal(rent, BigInt(plan.rentLamports));
  for (const key of [plan.position, plan.mint, plan.nft]) { const i = keys.indexOf(key); assert(i >= 0 && m.preBalances[i] === 0 && m.postBalances[i]! > 0); }
  const position = (await rpc<{ value: DammAccount[] }>("getMultipleAccounts", [[plan.position], { encoding: "base64", commitment: "finalized", minContextSlot: tx.slot }])).value[0]!;
  const p = decodeDamm<{ pool: string; nft_mint: string; unlocked_liquidity: bigint }>("Position", position); assert.equal(p.pool, plan.pool); assert.equal(p.nft_mint, plan.mint); assert.equal(p.unlocked_liquidity, BigInt(plan.liquidity));
  return { signature, at: new Date(tx.blockTime * 1000).toISOString(), slot: tx.slot, wallet: plan.wallet, pool: plan.pool, position: plan.position, mint: plan.mint, nft: plan.nft, liquidity: plan.liquidity, spentUsdcAtoms: String(spent), residualWsolAtoms: String(residual), rentLamports: String(rent), feeLamports: String(m.fee) };
}
export function verifyFailedMeteoraFee(plan: MeteoraPlan, signature: string, tx: ChainTransaction): number {
  assert(tx.meta.err && tx.blockTime);
  const decoded = k.getTransactionDecoder().decode(Buffer.from(tx.transaction[0], "base64"));
  assert.equal(k.getSignatureFromTransaction(decoded), signature);
  assert.equal(createHash("sha256").update(Buffer.from(decoded.messageBytes)).digest("hex"), plan.messageHash);
  assert(Number.isSafeInteger(tx.meta.fee) && tx.meta.fee > 0 && BigInt(tx.meta.fee) <= BigInt(plan.feeLamports));
  return tx.meta.fee;
}
