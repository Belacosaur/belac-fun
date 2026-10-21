import { KAMINO_CONFIRMED_ENTRY } from "./kamino-direct.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeWallet, normalizeKamino, normalizeMeteora, observe, valueWallet, normalizeBulk, normalizeJupiterPerps, normalizeRiptCatalog, syncStudio } from "./studio-sync.js";
import { CHALLENGE } from "../../../packages/contracts/src/challenge.js";
import type { StudioSnapshot } from "../../../packages/contracts/src/studio.js";
import { readFile } from "node:fs/promises";
const dammFixture = JSON.parse(await readFile(new URL("./fixtures/meteora-damm-mainnet.json", import.meta.url), "utf8"));

afterEach(() => vi.unstubAllGlobals());

describe("live studio observations", () => {
  it("only counts Jupiter longs and leaves unverified equity unknown", () => {
    expect(normalizeJupiterPerps({ count: 0, dataList: [] })).toMatchObject({ positionCount: 0, valueUsd: "0", status: "empty" });
    expect(normalizeJupiterPerps({ count: 2, dataList: [{ side: "long", valueUsd: "120000000" }, { side: "short", valueUsd: "5000000" }] }))
      .toMatchObject({ positionCount: 1, valueUsd: null, status: "ready" });
    expect(() => normalizeJupiterPerps({ count: 2, dataList: [] })).toThrow();
    expect(() => normalizeJupiterPerps({ count: 1, dataList: [{}] })).toThrow();
  });
  it("never treats Ript catalog inventory or expected value as wallet equity", () => {
    const result = normalizeRiptCatalog({ chain: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      packs: [{ status: "available", available: 183, priceUsd: 25, expectedValueUsd: 27.75 }] });
    expect(result).toMatchObject({ valueUsd: null, positionCount: null, status: "needs_setup" });
    expect(result.detail).toContain("devnet");
    expect(result.detail).toContain("$25");
    expect(() => normalizeRiptCatalog({ packs: [] })).toThrow();
  });
  it("does not reuse a displaced provider or another wallet's observations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const address = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
    const observation = { status: "ready" as const, checkedAt: "2026-10-20T12:00:00Z", lastSuccessAt: "2026-10-20T12:00:00Z",
      message: "old", data: { status: "ready" as const, detail: "old", valueUsd: "99", positionCount: 1 } };
    const previous: StudioSnapshot = { version: 1, address, network: "mainnet-beta", generatedAt: observation.checkedAt,
      wallet: { ...observation, data: normalizeWallet(0, [], []) },
      platforms: [{ id: 3, provider: "Pacifica", source: "", observation },
        { id: 5, provider: "Meteora", strategyKey: CHALLENGE[4].key, source: "", observation }] };
    const next = await syncStudio(address, "https://rpc.example", previous);
    expect(next.platforms.map((p) => p.provider)).toEqual(CHALLENGE.map((s) => s.provider));
    expect(next.platforms[2]?.observation.data).toBeNull();
    expect(next.platforms[4]?.observation.data?.valueUsd).toBeNull();
    const differentWallet = await syncStudio(address, "https://rpc.example", { ...previous, address: "different" });
    expect(differentWallet.wallet.data).toBeNull();
    expect(differentWallet.platforms[4]?.observation.data?.valueUsd).toBeNull();
  });
  it("connects all nine active read scopes without calling Ript or any write endpoint", async () => {
    const urls: string[] = [], methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input, options) => {
      const url = String(input); urls.push(url);
      let result: unknown;
      if (url === "https://rpc.example") {
        const body = JSON.parse(options.body as string); methods.push(body.method);
        const responses: Record<string, unknown> = {
          getGenesisHash: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", getBalance: { context: { slot: 1 }, value: 0 },
          getTokenAccountsByOwner: { context: { slot: 1 }, value: [] }, getSignaturesForAddress: [],
          getMultipleAccounts: { context: { slot: 1 }, value: [{ executable: true }, { executable: true }] }, getBlockTime: Math.floor(Date.now()/1000),
        };
        if (!(body.method in responses)) throw new Error("Write RPC is forbidden");
        result = { jsonrpc: "2.0", id: body.id, result: responses[body.method] };
        if (body.method === "getMultipleAccounts" && body.params[0][0] === "8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie") result = { result: { context: dammFixture.raw.context, value: dammFixture.raw.value.slice(3) } };
      } else if (url.includes("/quote?")) result = { inputMint: "So11111111111111111111111111111111111111112", outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", inAmount: "10000000", outAmount: "1000000", routePlan: [{}] };
      else if (url.includes("swap-base-in")) result = { success: true, data: { inputMint: "So11111111111111111111111111111111111111112", outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", inputAmount: "10000000", outputAmount: "1000000", routePlan: [{}] } };
      else if (url.includes("perps-api")) result = { dataList: [], count: 0 };
      else if (url.includes("pacifica") && url.includes("/positions")) result = { success: true, data: [] };
      else if (url.includes("pacifica")) return new Response("{}", { status: 404 });
      else if (url.includes("meteora")) result = { totalPositions: 0, pools: [] };
      else if (url.includes("kamino")) result = { sections: { lending: { indexed: false } } };
      else throw new Error("Unexpected endpoint");
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }));
    const snapshot = await syncStudio("HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j", "https://rpc.example");
    expect(snapshot.platforms.filter((p) => p.observation.data?.connection)).toHaveLength(9);
    expect(snapshot.platforms[8]?.observation.status).toBe("pending");
    expect(snapshot.platforms[8]?.observation.lastSuccessAt).toBeNull();
    expect(urls.some((url) => url.includes("ript"))).toBe(false);
    expect(methods.filter((m) => m === "getMultipleAccounts")).toHaveLength(KAMINO_CONFIRMED_ENTRY ? 3 : 4);
    expect(snapshot.platforms[4]?.observation.data?.damm?.state).toBe("prepared");
    expect(urls.some(url=>url.includes("api.kamino.finance/portfolio"))).toBe(false);
    expect(snapshot.accounting?.status).toBe("unavailable");
    expect(snapshot.platforms[0]?.observation.data?.performance).toBeUndefined();
    expect(snapshot.platforms.every(p => p.observation.data?.executionEnabled === false)).toBe(true);
    expect(snapshot.platforms[6]?.observation.data?.valueUsd).toBeNull();
    expect(snapshot.platforms[9]?.observation.data?.valueUsd).toBeNull();
  });
  it("represents an unfunded wallet as real zero without inventing an allocation", () => {
    const wallet = normalizeWallet(0, [], []);
    expect(wallet.sol).toBe("0");
    expect(wallet.valueUsd).toBe("0");
    expect(wallet.unpricedAssets).toBe(0);
  });
  it("keeps exact token quantities and does not value unknown assets at zero", () => {
    const wallet = normalizeWallet(1_000_000_000, [{
      account: { data: { parsed: { info: { mint: "unknown", tokenAmount: { amount: "123456789012345678", decimals: 9 } } } } },
    }], []);
    expect(wallet.tokens[0]?.amount).toBe("123456789.012345678");
    expect(wallet.valueUsd).toBeNull();
    expect(wallet.unpricedAssets).toBe(2);
  });
  it("does not equate an unindexed Kamino account with a verified empty account", () => {
    expect(normalizeKamino({
      sections: { lending: { indexed: false, errors: [] }, earn: { indexed: false, errors: [] } },
      lending: [], earn: [],
    }).status).toBe("not_indexed");
  });
  it("reads the configured Kamino product without requiring an unrelated Earn account", () => {
    const now = new Date().toISOString();
    const result = normalizeKamino({
      sections: { lending: { indexed: true, errors: [], positionsRefreshedOn: now, pricesRefreshedOn: now }, earn: { indexed: false } },
      lending: [{ netValue: "10.67" }], earn: [],
    });
    expect(result.valueUsd).toBe("10.67");
    expect(result.positionCount).toBe(1);
  });
  it("accepts Meteora's documented empty response but rejects malformed data", () => {
    expect(normalizeMeteora({ totalPositions: 0, totalCount: 0, pools: [], hasNext: false }).valueUsd).toBe("0");
    expect(() => normalizeMeteora({})).toThrow();
  });
  it("retains the last successful value with an explicit unavailable state on failure", async () => {
    const previous = await observe(async () => ({ valueUsd: "10.12" }), undefined, "2026-10-20T12:00:00Z");
    const next = await observe(async () => { throw new Error("secret-bearing upstream URL"); }, previous, "2026-10-20T12:01:00Z");
    expect(next.status).toBe("unavailable");
    expect(next.data?.valueUsd).toBe("10.12");
    expect(next.lastSuccessAt).toBe(previous.lastSuccessAt);
    expect(JSON.stringify(next)).not.toContain("secret-bearing");
  });
  it("values known assets with fresh oracle prices and rejects stale quotes", () => {
    const wallet = normalizeWallet(1_000_000_000, [], []);
    const quote = { mint: "So11111111111111111111111111111111111111112", price: "103.91", timestamp: "1000", maxAgeInSeconds: "120" };
    expect(valueWallet(wallet, [quote], 1050).valueUsd).toBe("103.91");
    expect(valueWallet(wallet, [quote], 1201).valueUsd).toBeNull();
    expect(valueWallet(wallet, [{ ...quote, price: "NaN" }], 1050).valueUsd).toBeNull();
  });
  it("does not fabricate BULK equity from margin fields with different meanings", () => {
    const result = normalizeBulk([{ fullAccount: { positions: [], margin: { totalMargin: "50" } } }]);
    expect(result.positionCount).toBe(0);
    expect(result.valueUsd).toBeNull();
    expect(() => normalizeBulk([])).toThrow();
  });
});
