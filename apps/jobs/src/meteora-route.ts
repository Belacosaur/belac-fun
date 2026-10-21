import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import { DAMM } from "./meteora-damm.js";
export const ROUTER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", WHIRLPOOL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export interface RpcInstruction { programId: string; data: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[] }
export interface Quote { inputMint: string; outputMint: string; inAmount: string; outAmount: string; otherAmountThreshold: string; slippageBps: number; swapMode: string; platformFee?: unknown; contextSlot: number; routePlan: { percent: number; swapInfo: { label: string; ammKey: string; inputMint: string; outputMint: string; inAmount: string; outAmount: string } }[] }
export function checkMeteoraRoute(ix: RpcInstruction, q: Quote, source: string, dest: string, remaining: string[]) {
  assert.equal(ix.programId, ROUTER); assert.equal(q.inputMint, DAMM.usdc); assert.equal(q.outputMint, DAMM.sol); assert.equal(q.swapMode, "ExactOut");
  for (const v of [q.inAmount, q.outAmount, q.otherAmountThreshold]) assert(/^\d+$/.test(v));
  const input = BigInt(q.inAmount), output = BigInt(q.outAmount), maxInput = (input * 10050n + 9999n) / 10000n;
  assert(input > 0n && output > 0n && maxInput <= 10000000n); assert.equal(q.slippageBps, 50); assert(q.platformFee == null);
  assert.equal(q.routePlan.length, 1); const r = q.routePlan[0]!; assert.equal(r.percent, 100); assert.equal(r.swapInfo.label, "Whirlpool");
  assert.equal(r.swapInfo.inputMint, DAMM.usdc); assert.equal(r.swapInfo.outputMint, DAMM.sol); assert.equal(r.swapInfo.inAmount, q.inAmount); assert.equal(r.swapInfo.outAmount, q.outAmount);
  const b = Buffer.from(ix.data, "base64"); assert.equal(b.length, 36); assert(b.subarray(0, 8).equals(createHash("sha256").update("global:exact_out_route").digest().subarray(0, 8)));
  assert.equal(b.readUInt32LE(8), 1); assert.deepEqual([...b.subarray(12, 17)], [17, 0, 100, 0, 1]); assert.equal(b.readBigUInt64LE(17), output); assert.equal(b.readBigUInt64LE(25), input); assert.equal(b.readUInt16LE(33), 50); assert.equal(b[35], 0); assert.equal(BigInt(q.otherAmountThreshold), maxInput);
  assert.deepEqual(ix.accounts.map(a => a.pubkey), [DAMM.token, CHALLENGE_WALLET, source, dest, ROUTER, DAMM.usdc, DAMM.sol, ROUTER, ROUTER, "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf", ROUTER, ...remaining]);
  ix.accounts.forEach((a, i) => assert.equal(a.isSigner, i === 1)); assert(ix.accounts[2]!.isWritable && ix.accounts[3]!.isWritable);
  return maxInput;
}
