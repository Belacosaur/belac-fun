import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { validateMeteoraPlan, finishWalletSignature, verifyLivePlanContext } from "./trade-wallet";
import type { MeteoraPlan } from "../../../../packages/contracts/src/trades";
import * as k from "@solana/kit";
import {CHALLENGE_WALLET} from "../../../../packages/contracts/src/trades";
const fixture = JSON.parse(await readFile("../jobs/src/fixtures/meteora-new-wallet-synthetic.json", "utf8"));
const fresh = (): MeteoraPlan => ({ ...fixture.plan, expiresAt: new Date(Date.now() + 50000).toISOString() });
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
afterEach(() => vi.unstubAllGlobals());
describe("Meteora frontend transaction validation", () => {
  it("rejects retired-wallet messages even if their displayed plan wallet is relabelled",async()=>{
    const old=JSON.parse(await readFile("../jobs/src/fixtures/meteora-builder-mainnet.json","utf8"));
    await expect(validateMeteoraPlan({...old.plan,expiresAt:new Date(Date.now()+50000).toISOString()},old.plan.mint)).rejects.toThrow();
    await expect(validateMeteoraPlan({...old.plan,wallet:CHALLENGE_WALLET,expiresAt:new Date(Date.now()+50000).toISOString()},old.plan.mint)).rejects.toThrow();
  });
  it("accepts the actual decoded five-instruction unsigned simulation message", async () => { const p = fresh(); expect((await validateMeteoraPlan(p, p.mint)).tables.length).toBeGreaterThan(0); });
  it("rejects over-budget, expired, altered, wrong-wallet and wrong-mint plans", async () => {
    const p = fresh();
    for (const update of [{ maxSpendUsdcAtoms: "10000001" }, { expiresAt: "2020-01-01" }, { messageHash: "0".repeat(64) }, { wallet: p.mint }, { maxDepositUsdcAtoms: "9999999" }, { feeLamports: "1000000" }]) await expect(validateMeteoraPlan({ ...p, ...update }, p.mint)).rejects.toThrow();
    await expect(validateMeteoraPlan(p, p.wallet)).rejects.toThrow();
  });
  it("never accepts an unsigned wallet result as an executable transaction", async () => { const p = fresh(); const mint = await k.generateKeyPairSigner(); await expect(finishWalletSignature(p, Uint8Array.from(Buffer.from(p.wireBase64, "base64")), {...mint,address:k.address(p.mint)})).rejects.toThrow("Wallet signature missing"); });
  it("independently checks on-chain lookup tables, Whirlpool mint/vault layout and tick-array PDAs", async () => {
    const map = new Map<string, unknown>();
    for (const call of fixture.calls) if (call.request?.method === "getMultipleAccounts") call.request.params[0].forEach((key: string, i: number) => map.set(key, call.response.result.value[i]));
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const req = JSON.parse(init.body as string);
      expect(req.method).not.toBe("sendTransaction");
      const result = req.method === "getGenesisHash" ? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" : req.method === "getBlockHeight" ? fixture.plan.lastValidBlockHeight - 50 : { value: req.params[0].map((key: string) => map.get(key)) };
      return new Response(JSON.stringify({ result }));
    }));
    await expect(verifyLivePlanContext(fresh())).resolves.toBeUndefined();
    const poolKey = fixture.calls.find((call: { request?: { method: string; params: string[][] } }) => call.request?.method === "getMultipleAccounts" && call.request.params[0].length === 1).request.params[0][0];
    const original = map.get(poolKey) as { owner: string }; map.set(poolKey, { ...original, owner: "wrong" });
    await expect(verifyLivePlanContext(fresh())).rejects.toThrow();
  });
});
