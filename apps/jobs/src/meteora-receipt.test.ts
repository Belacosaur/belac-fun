import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import * as k from "@solana/kit";
import { verifyMeteoraReceipt, verifyFailedMeteoraFee, type ChainTransaction } from "./meteora-receipt.js";
import { METEORA_ACCOUNTS } from "./meteora-builder.js";
import { DAMM } from "./meteora-damm.js";
import type { TradeRpc } from "./trade-rpc.js";
const f = JSON.parse(await readFile(new URL("./fixtures/meteora-builder-mainnet.json", import.meta.url), "utf8"));
function chainFixture() {
  const p = f.plan, c = k.getCompiledTransactionMessageDecoder().decode(Buffer.from(p.messageBase64, "base64"));
  if (c.version !== 0) throw Error("fixture version");
  const writable = c.addressTableLookups?.flatMap(l => l.writableIndexes.map(i => p.lookupTables[l.lookupTableAddress][i])) ?? [], readonly = c.addressTableLookups?.flatMap(l => l.readonlyIndexes.map(i => p.lookupTables[l.lookupTableAddress][i])) ?? [];
  const keys = [...c.staticAccounts, ...writable, ...readonly];
  // Deliberately fabricated RPC transaction wrapper, not a real signature or broadcast.
  const wire = Buffer.from(p.wireBase64, "base64"); wire.fill(9, 1, 65); wire.fill(10, 65, 129);
  const signature = k.getSignatureFromTransaction(k.getTransactionDecoder().decode(wire));
  const post = f.calls.find((x: { request?: { method: string } }) => x.request?.method === "simulateTransaction").response.result.value.accounts;
  const beforeBalances = keys.map(() => 0), afterBalances = keys.map(() => 0);
  beforeBalances[0] = Number(p.beforeNativeLamports); afterBalances[0] = post[0].lamports;
  [p.position, p.mint, p.nft].forEach((key, i) => afterBalances[keys.indexOf(key)] = post[3 + i].lamports);
  const token = (key: string, mint: string, amount: string, decimals: number) => ({ accountIndex: keys.indexOf(key), mint, owner: p.wallet, uiTokenAmount: { amount, decimals } });
  const tx: ChainTransaction = { slot: p.slot, blockTime: Math.floor(Date.parse(p.preparedAt) / 1000), transaction: [wire.toString("base64"), "base64"], meta: { err: null, fee: Number(p.feeLamports), preBalances: beforeBalances, postBalances: afterBalances, loadedAddresses: { writable, readonly }, preTokenBalances: [token(METEORA_ACCOUNTS.usdc, DAMM.usdc, p.beforeUsdcAtoms, 6), token(METEORA_ACCOUNTS.wsol, DAMM.sol, p.beforeWsolAtoms, 9)], postTokenBalances: [token(METEORA_ACCOUNTS.usdc, DAMM.usdc, String(BigInt(p.beforeUsdcAtoms) - BigInt(p.simulatedSpendUsdcAtoms)), 6), token(METEORA_ACCOUNTS.wsol, DAMM.sol, String(BigInt(p.beforeWsolAtoms) + BigInt(p.residualWsolAtoms)), 9), token(p.nft, p.mint, "1", 0)] } };
  const rpc: TradeRpc = async <T>(method: string) => (method === "getTransaction" ? tx : { value: [post[3]] }) as T;
  return { tx, rpc, signature };
}
it("attributes a simulated finalized receipt from transaction deltas and exact message identity", async () => {
  const faked = chainFixture(), receipt = await verifyMeteoraReceipt(f.plan, faked.signature, faked.rpc);
  expect(receipt.spentUsdcAtoms).toBe(f.plan.simulatedSpendUsdcAtoms); expect(receipt.residualWsolAtoms).toBe(f.plan.residualWsolAtoms);
  expect(receipt.rentLamports).toBe("7223760"); expect(receipt.feeLamports).toBe("11000");
});
it("rejects mismatched messages, missing NFTs and excessive principal", async () => {
  const faked = chainFixture(); await expect(verifyMeteoraReceipt({ ...f.plan, messageHash: "bad" }, faked.signature, faked.rpc)).rejects.toThrow();
  faked.tx.meta.postTokenBalances.pop(); await expect(verifyMeteoraReceipt(f.plan, faked.signature, faked.rpc)).rejects.toThrow();
  const over = chainFixture(); over.tx.meta.postTokenBalances[0]!.uiTokenAmount.amount = String(BigInt(f.plan.beforeUsdcAtoms) - 10000001n);
  await expect(verifyMeteoraReceipt(f.plan, over.signature, over.rpc)).rejects.toThrow();
});
it("only charges a finalized failed fee when the attempt's exact message and signature match", () => {
  const faked = chainFixture(); faked.tx.meta.err = { InstructionError: [4, "Custom"] };
  expect(verifyFailedMeteoraFee(f.plan, faked.signature, faked.tx)).toBe(11000);
  expect(() => verifyFailedMeteoraFee({ ...f.plan, messageHash: "bad" }, faked.signature, faked.tx)).toThrow();
});
