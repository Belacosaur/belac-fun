import { afterEach, expect, it, vi } from "vitest";
import { checkMeteoraInput } from "./meteora-builder.js";
import { buildMeteoraEntry } from "./meteora-builder.js";
import { readFile } from "node:fs/promises";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
afterEach(() => vi.restoreAllMocks());
it("only prepares station five with a distinct valid mint and the fixed challenge budget", () => {
  expect(() => checkMeteoraInput({ wallet: CHALLENGE_WALLET, station: 8, mint: CHALLENGE_WALLET })).toThrow();
  expect(() => checkMeteoraInput({ wallet: "wrong", station: 5, mint: CHALLENGE_WALLET })).toThrow();
  expect(() => checkMeteoraInput({ wallet: CHALLENGE_WALLET, station: 5, mint: CHALLENGE_WALLET })).toThrow();
});
it("replays the full captured unsigned builder and preserves principal/fee separation", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/meteora-new-wallet-synthetic.json", import.meta.url), "utf8"));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(fixture.plan.preparedAt));
  const calls: string[] = [], queue = [...fixture.calls];
  const fetcher = (async (url: string, init: RequestInit) => {
    const request = init.body ? JSON.parse(init.body as string) : null;
    const item = queue.shift(); expect(String(url)).toBe(item.url);
    if (request?.method) { calls.push(request.method); expect(request.method).toBe(item.request.method); }
    if (request?.method === "simulateTransaction") { expect(request.params[1].sigVerify).toBe(false); expect(request.params[1].replaceRecentBlockhash).toBe(false); }
    return new Response(JSON.stringify(item.response), { status: item.status });
  }) as typeof fetch;
  const plan = await buildMeteoraEntry({ wallet: CHALLENGE_WALLET, station: 5, mint: fixture.plan.mint }, "https://solana-rpc.publicnode.com", undefined, fetcher);
  expect(plan.messageHash).toBe(fixture.plan.messageHash);
  expect(BigInt(plan.maxSpendUsdcAtoms)).toBeLessThanOrEqual(10000000n);
  expect(plan.feeLamports).toBe("11000"); expect(plan.rentLamports).toBe("7223760");
  expect(plan.feePoolAfterLamports).toBe("12624640");
  expect(calls).not.toContain("sendTransaction"); expect(queue).toHaveLength(0);
});
