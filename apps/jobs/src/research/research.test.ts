import { describe, expect, it } from "vitest";
import { screenToken, evaluateHistory, screenLending, screenPool, finalizeStation } from "./evaluate.js";
import { ResearchClient } from "./transport.js";
import { buildReport } from "./run.js";
import { nextResearchDelay, researchInterval } from "./schedule.js";
import type { ResearchSource } from "../../../../packages/contracts/src/research.js";

const now = Date.parse("2026-10-20T14:00:00Z");
const token = { id: "mint", symbol: "TOKEN", decimals: 6, liquidity: 2e6, organicScore: 90,
  createdAt: "2025-01-01T00:00:00Z", updatedAt: new Date(now).toISOString(), tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  stats24h: { buyVolume: 2e5, sellVolume: 2e5, priceChange: 5 },
  audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 10 } };

describe("research policy gates", () => {
  it("rejects stale and incomplete token data even if momentum and volume look attractive", () => {
    expect(screenToken(token, now).disposition).toBe("shortlist");
    const bad = screenToken({ ...token, updatedAt: "2020-01-01", audit: {} }, now);
    expect(bad.disposition).toBe("rejected");
    expect(bad.reasons.join(" ")).toMatch(/stale|fresh/i);
    expect(bad.reasons.join(" ")).toMatch(/authority|concentration/i);
    expect(bad.entryEligible).toBe(false);
  });
  it("requires positive evidence that a memecoin came from Pump; mint suffix is insufficient", () => {
    expect(screenToken({ ...token, id: "looks-like-pump" }, now, true).disposition).toBe("rejected");
    expect(screenToken({ ...token, launchpad: "pump.fun", graduatedPool: "pool", graduatedAt: "2025-02-01" }, now, true).disposition).toBe("shortlist");
  });
  it("does not interpret nulls as zero or permissive security flags", () => {
    expect(screenToken({ ...token, liquidity: null }, now).disposition).toBe("rejected");
    expect(screenToken({ ...token, audit: { ...token.audit, topHoldersPercentage: null } }, now).disposition).toBe("rejected");
    expect(screenToken({ ...token, tokenProgram: "Token2022" }, now).blockers.join(" ")).toMatch(/extension/i);
  });
  it("uses completed contiguous daily candles and rejects missing days and invalid prices", () => {
    const end = Math.floor(now / 86400000) * 86400;
    const candles = Array.from({ length: 100 }, (_, i) => [end - (100 - i) * 86400, 90 + i, 110 + i, 100 + i, 101 + i, 1000]);
    const h = evaluateHistory(candles, now);
    expect(h.bars).toBe(100);
    expect(h.trend).toBe("up");
    expect(h.backtest?.costBpsPerSide).toBe(25);
    expect(h.backtest?.validation).toBe("retrospective-unvalidated");
    expect(evaluateHistory([...candles, [end, 1, 9e9, 1, 9e9, 1]], now)).toEqual(h);
    expect(() => evaluateHistory(candles.filter((_, i) => i !== 70), now)).toThrow(/gap/);
    expect(() => evaluateHistory([[end - 86400, 0, 1, 0, 0, 1]], now)).toThrow();
  });
  it("treats lending APY as a fraction and excludes rewards and unknown setup costs", () => {
    const c = screenLending({ reserve: "reserve", liquidityTokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", supplyApy: "0.05", totalSupply: "2000000", totalBorrow: "1000000", totalSupplyUsd: "2000000", totalBorrowUsd: "1000000" }, "market", "Test market");
    expect(c.metrics.baseApyPct).toBe(5);
    expect(Number(c.metrics.grossSevenDayUsdConstantRate)).toBeCloseTo(0.00936, 4);
    expect(c.metrics.netSevenDayUsd).toBeNull();
    expect(c.entryEligible).toBe(false);
    expect(screenLending({ supplyApy: null }, "market", "Test").disposition).toBe("rejected");
  });
  it("never turns a pool's headline fees into the return on our concentrated position", () => {
    const c = screenPool({ address: "pool", tokenMintA: "a", tokenMintB: "b", tokenA: { symbol: "A" }, tokenB: { symbol: "B" }, tvlUsdc: "1000000", updatedAt: new Date(now).toISOString(), stats: { "24h": { volume: "500000", fees: "1000" }, "7d": { fees: "7000" } } }, "orca", now);
    expect(c.metrics.expectedPositionReturnUsd).toBeNull();
    expect(c.blockers.join(" ")).toMatch(/range/);
    expect(screenPool({ address: "bad", tvlUsdc: "NaN" }, "orca", now).disposition).toBe("rejected");
  });
  it("ranks only within a station and retains all rejected candidates", () => {
    const c = screenToken(token, now);
    const s = finalizeStation(1, [c, screenToken({ ...token, id: "bad", liquidity: 1 }, now)], []);
    expect(s.decision).toBe("WAIT");
    expect(s.shortlisted[0]?.rank).toBe(1);
    expect(s.rejected).toHaveLength(1);
  });
});

describe("bounded read-only research", () => {
  it("allowlists exact GET endpoints, caches duplicate reads and does not follow redirects", async () => {
    const requests: RequestInit[] = [];
    const client = new ResearchClient(async (_url, init) => { requests.push(init!); return new Response('[{"id":"x"}]'); });
    await Promise.all([client.get("tokens", "https://api.jup.ag/tokens/v2/toptraded/24h?limit=100"), client.get("tokens", "https://api.jup.ag/tokens/v2/toptraded/24h?limit=100")]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "GET", redirect: "error" });
    await expect(client.get("bad", "https://api.jup.ag/swap/v2/execute")).rejects.toThrow(/allow/);
    await expect(client.get("ript", "https://ript.fun/play")).rejects.toThrow(/allow/);
    await expect(client.get("bad", "http://127.0.0.1:3000")).rejects.toThrow(/allow/);
  });
  it("records sanitized failures, missing scopes, ten station decisions and pending Ript", () => {
    const sources: ResearchSource[] = [{ id: "tokens", url: "https://api.jup.ag/tokens/v2/toptraded/24h?limit=100", fetchedAt: new Date(now).toISOString(), status: "unavailable", payload: null, sha256: null, error: "HTTP 429" }];
    const r = buildReport(sources, "public-wallet", now, now);
    expect(r.stations.map(s => s.id)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(r.stations[8]).toMatchObject({ decision: "PENDING", scanned: 0, shortlisted: [] });
    expect(r.stations[0]?.gaps.join(" ")).toMatch(/tokens/);
    expect(r.status).toBe("partial");
    expect(r.executionEnabled).toBe(false);
    expect(r.stations.every(s => [...s.shortlisted, ...s.rejected].every(c => !c.entryEligible))).toBe(true);
  });
  it("rejects an active strategy when fresh metadata exists but required history does not", () => {
    const sources: ResearchSource[] = [
      { id: "tokens", url: "https://api.jup.ag/tokens/v2/toptraded/24h", fetchedAt: new Date(now).toISOString(), status: "ok", sha256: "hash", error: null, payload: [{ ...token, id: "So11111111111111111111111111111111111111112", symbol: "SOL" }] },
      { id: "jupiter-perps:SOL", url: "https://perps-api.jup.ag/v1/market-stats", fetchedAt: new Date(now).toISOString(), status: "ok", sha256: "hash", error: null, payload: { price: "100", volume: "1000000" } },
    ];
    const r = buildReport(sources, "wallet", now, now);
    expect(r.stations[1].shortlisted).toHaveLength(0);
    expect(r.stations[2].shortlisted).toHaveLength(0);
    expect(r.stations[2].rejected[0].reasons.join(" ")).toMatch(/history|signal/);
  });
  it("does not call a transport-successful malformed provider dataset complete", () => {
    const ids = ["tokens", "core-tokens", "orca", "meteora", "kamino-markets", "pacifica-markets", "pacifica-prices", "jupiter-perps:SOL", "jupiter-perps:BTC", "jupiter-perps:ETH"];
    const sources: ResearchSource[] = ids.map(id => ({ id, url: "https://example.org", fetchedAt: new Date(now).toISOString(), status: "ok", sha256: "hash", error: null, payload: { error: "invalid upstream response" } }));
    const r = buildReport(sources, "wallet", now, now);
    expect(r.status).toBe("partial");
    expect(r.stations[7].gaps.join(" ")).toMatch(/orca/);
    expect(r.warnings.join(" ")).toMatch(/schema|invalid/i);
  });
  it("schedules the remaining cadence after a restart and rejects invalid intervals", () => {
    const day = 86400000;
    expect(nextResearchDelay(day, now - 23 * 3600000, now, 0)).toBe(3600000);
    expect(nextResearchDelay(day, now - 25 * 3600000, now, 0)).toBe(1000);
    expect(nextResearchDelay(day, now, now, 1)).toBe(300000);
    expect(researchInterval("Infinity")).toBe(day);
    expect(researchInterval("0")).toBe(day);
  });
  it("does not redate stale lending observations into a fresh shortlist", () => {
    const market = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
    const sources: ResearchSource[] = [
      { id: "kamino-markets", url: "https://api.kamino.finance/v2/kamino-market", fetchedAt: new Date(now).toISOString(), status: "ok", sha256: "x", error: null, payload: [{ lendingMarket: market, name: "Test", isCurated: false }] },
      { id: `kamino:${market}`, url: "https://api.kamino.finance", fetchedAt: "2020-01-01", status: "ok", sha256: "x", error: null, payload: [{ reserve: "reserve", liquidityTokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", supplyApy: "0.05", totalSupplyUsd: "2000000", totalBorrowUsd: "1000000" }] },
    ];
    const r = buildReport(sources, "wallet", now, now);
    expect(r.stations[5].shortlisted).toHaveLength(0);
    expect(r.status).toBe("partial");
    expect(r.warnings.join(" ")).toMatch(/stale.*kamino/i);
    expect(r.sources).toEqual(sources);
  });
  it("converts Jupiter decimal price-impact ratios to percentages before the cap", () => {
    const s = (id: string, payload: unknown): ResearchSource => ({ id, payload, url: "https://api.jup.ag", fetchedAt: new Date(now).toISOString(), status: "ok", sha256: "x", error: null });
    const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const sources = [s("tokens", [token]), s("quote:jupiter:mint:buy", { inputMint: usdc, outputMint: "mint", inAmount: "10000000", outAmount: "200", priceImpactPct: "0.02", routePlan: [{}] }),
      s("quote:jupiter:mint:sell", { inputMint: "mint", outputMint: usdc, inAmount: "200", outAmount: "9990000", priceImpactPct: "0", routePlan: [{}] })];
    const report = buildReport(sources, "wallet", now, now);
    expect(report.stations[0].shortlisted).toHaveLength(0);
    expect(report.stations[0].rejected[0].metrics.maxReportedPriceImpactPct).toBe(2);
  });
});
