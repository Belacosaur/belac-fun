import { CHALLENGE } from "../../../../packages/contracts/src/challenge.js";
import type { ResearchCandidate, StationResearch } from "../../../../packages/contracts/src/research.js";
import { LP_ASSETS, POLICY, SOL, USDC } from "./policy.js";

export type Row = Record<string, unknown>;
export const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
export const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(row) : [];
export const text = (v: unknown): string => typeof v === "string" ? v : "";
export function num(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === "string" && v.trim() === "" || typeof v === "boolean" || (typeof v !== "number" && typeof v !== "string")) return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}
const fixed = (n: number): number => Number(n.toFixed(8));
export function stale(v: unknown, now: number, maxAge: number): boolean {
  const t = typeof v === "number" ? v : Date.parse(text(v));
  return !Number.isFinite(t) || t > now + 60_000 || now - t > maxAge;
}

function candidate(id: string, label: string, assets: string[], sourceIds: string[], horizonDays: number, benchmark: string): ResearchCandidate {
  return { id, label, assets, sourceIds, disposition: "shortlist", rank: null, metrics: {}, reasons: [],
    blockers: ["Research rules are unvalidated; owner risk limits and entry approval are pending.", "Exact setup, exit, network fees and recoverable rent are not priced."],
    entryEligible: false,
    plan: { entry: "Recheck all source data and executable costs; no entry is authorized.", exit: "Owner-approved invalidation and loss rules required before entry.", horizonDays, benchmark } };
}
function reject(c: ResearchCandidate, condition: boolean, reason: string) {
  if (condition) { c.disposition = "rejected"; c.reasons.push(reason); }
}

export function screenToken(t: Row, now: number, pump = false): ResearchCandidate {
  const id = text(t.id), audit = row(t.audit), stats = row(t.stats24h);
  const c = candidate(id, `${text(t.symbol)} (${id})`, [id], ["tokens"], pump ? 7 : 30, "USDC cash and same-token hold; no positive-return claim");
  const liquidity = num(t.liquidity), organic = num(t.organicScore), top = num(audit.topHoldersPercentage);
  const buy = num(stats.buyVolume), sell = num(stats.sellVolume);
  const volume = buy !== null && sell !== null && buy >= 0 && sell >= 0 ? buy + sell : null;
  const age = (now - Date.parse(text(row(t.firstPool).createdAt) || text(t.createdAt))) / 86400000;
  c.metrics = { liquidityUsd: liquidity, volume24hUsd: volume, organicScore: organic, topHoldersPct: top,
    priceUsd: num(t.usdPrice), change24hPct: num(stats.priceChange), ageDays: Number.isFinite(age) ? fixed(age) : null,
    mint: id, decimals: num(t.decimals), tokenProgram: text(t.tokenProgram), netExpectedProfitUsd: null };
  reject(c, !id || !Number.isInteger(num(t.decimals)) || Number(num(t.decimals)) < 0 || Number(num(t.decimals)) > 18, "Missing identity or valid token decimals.");
  reject(c, stale(t.updatedAt, now, POLICY.maxTokenAgeMs), "Token data is missing a fresh source timestamp or is stale.");
  reject(c, liquidity === null || liquidity < POLICY.minTokenLiquidityUsd, "Insufficient verified token liquidity.");
  reject(c, volume === null || volume < POLICY.minTokenVolume24hUsd, "Insufficient 24h trading volume.");
  reject(c, organic === null || organic < POLICY.minOrganicScore, "Insufficient organic activity evidence; provider score is not proof against wash trading.");
  reject(c, top === null || top < 0 || top > POLICY.maxTopHoldersPct, "Missing or excessive holder concentration.");
  reject(c, !Number.isFinite(age) || age < (pump ? POLICY.minPumpAgeDays : POLICY.minTokenAgeDays), "Insufficient pool age history.");
  // Native wrapped SOL has a protocol-defined mint. Other assets require explicit evidence.
  reject(c, id !== SOL && audit.mintAuthorityDisabled !== true, "Mint authority is enabled or not verified disabled.");
  reject(c, id !== SOL && audit.freezeAuthorityDisabled !== true, "Freeze authority is enabled or not verified disabled.");
  reject(c, audit.isSus === true, "Provider audit marks token suspicious.");
  if (t.tokenProgram !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") c.blockers.push("Token-2022 extensions and transfer restrictions require on-chain inspection.");
  if (pump) {
    reject(c, t.launchpad !== "pump.fun", "Pump.fun origin is not verified; a mint suffix is not evidence.");
    reject(c, !text(t.graduatedPool) || !text(t.graduatedAt), "This policy requires verified graduation to an existing trading pool.");
    c.sourceIds = ["tokens", "pump-discovery"];
    c.blockers.push("Verify PumpSwap pool identity, transfer permissions, fee tier and independent holder/flow evidence.");
  }
  if (c.disposition === "shortlist") c.reasons.push("Passes preliminary liquidity, activity, age and reported authority/concentration filters.");
  c.blockers.push("Sustained price history and prospective paper validation required; reported token audits need on-chain confirmation.");
  return c;
}

export interface HistorySummary {
  bars: number; lastDay: string; trend: "up" | "down" | "mixed";
  close: number; sma20: number; sma50: number; change7dPct: number; change30dPct: number;
  dailyVolatilityPct: number; breakout20: boolean; breakdown20: boolean;
  backtest: { validation: "retrospective-unvalidated"; costBpsPerSide: number; days: number; roundTrips: number; endUsd: number; holdEndUsd: number; cashEndUsd: 10; maxDrawdownPct: number; stressedEndUsd: number } | null;
}

/** Coinbase candle format [time,low,high,open,close,volume]. Excludes incomplete UTC day. */
export function evaluateHistory(raw: unknown, now: number): HistorySummary {
  if (!Array.isArray(raw)) throw new Error("Invalid candles");
  const cutoff = Math.floor(now / 86400000) * 86400;
  const candles = raw.filter((v): v is unknown[] => Array.isArray(v) && Number(v[0]) < cutoff).map(v => {
    if (v.length < 6 || v.some(x => num(x) === null)) throw new Error("Invalid candle values");
    const [t, low, high, open, close, volume] = v.map(Number);
    if (!Number.isInteger(t) || t % 86400 || low <= 0 || high < low || open < low || open > high || close < low || close > high || volume < 0) throw new Error("Invalid candle prices");
    return { t, low, high, open, close };
  }).sort((a, b) => a.t - b.t);
  if (candles.length < 60 || candles.at(-1)!.t !== cutoff - 86400) throw new Error("Insufficient or stale daily history");
  if (candles.some((v, i) => i > 0 && v.t - candles[i - 1].t !== 86400)) throw new Error("Daily history gap or duplicate");
  const closes = candles.map(v => v.close), last = candles.at(-1)!;
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const sma20 = avg(closes.slice(-20)), sma50 = avg(closes.slice(-50));
  const returns = closes.slice(-30).map((v, i, arr) => i ? Math.log(v / arr[i - 1]) : 0).slice(1), mean = avg(returns);
  const diagnostic = (bps: number) => {
    let cash = 10, units = 0, peak = 10, dd = 0, roundTrips = 0;
    const fee = bps / 10000;
    for (let i = 51; i < candles.length; i++) {
      const signal = candles[i - 1], before = candles.slice(i - 21, i - 1);
      const ma50 = avg(closes.slice(i - 50, i)), ma20 = avg(closes.slice(i - 20, i));
      if (units && (signal.close < Math.min(...candles.slice(i - 11, i - 1).map(v => v.low)) || signal.close < ma20)) {
        cash = units * candles[i].open * (1 - fee); units = 0; roundTrips++;
      } else if (!units && signal.close > Math.max(...before.map(v => v.high)) && signal.close > ma50) {
        units = cash * (1 - fee) / candles[i].open; cash = 0;
      }
      const value = cash + units * candles[i].close;
      peak = Math.max(peak, value); dd = Math.max(dd, 1 - value / peak);
    }
    if (units) { cash = units * last.close * (1 - fee); roundTrips++; }
    dd = Math.max(dd, 1 - cash / peak);
    return { cash, roundTrips, dd };
  };
  const d = diagnostic(POLICY.diagnosticFeeBps);
  return { bars: candles.length, lastDay: new Date(last.t * 1000).toISOString(), close: last.close, sma20: fixed(sma20), sma50: fixed(sma50),
    trend: last.close > sma50 && sma20 > sma50 ? "up" : last.close < sma50 && sma20 < sma50 ? "down" : "mixed",
    change7dPct: fixed((last.close / closes.at(-8)! - 1) * 100), change30dPct: fixed((last.close / closes.at(-31)! - 1) * 100),
    dailyVolatilityPct: fixed(Math.sqrt(avg(returns.map(r => (r - mean) ** 2))) * 100),
    breakout20: last.close > Math.max(...candles.slice(-21, -1).map(v => v.high)),
    breakdown20: last.close < Math.min(...candles.slice(-21, -1).map(v => v.low)),
    backtest: { validation: "retrospective-unvalidated", costBpsPerSide: POLICY.diagnosticFeeBps, days: candles.length - 51,
      roundTrips: d.roundTrips, endUsd: fixed(d.cash), cashEndUsd: 10,
      holdEndUsd: fixed(10 * (1 - POLICY.diagnosticFeeBps / 10000) ** 2 * last.close / candles[51].open), maxDrawdownPct: fixed(d.dd * 100), stressedEndUsd: fixed(diagnostic(50).cash) } };
}

export function screenLending(r: Row, market: string, name: string): ResearchCandidate {
  const c = candidate(`${market}:${text(r.reserve)}`, `USDC — ${name}`, [USDC], [`kamino:${market}`], 7, "USDC cash; yield excludes incentives and operating expenses");
  const apy = num(r.supplyApy), supply = num(r.totalSupplyUsd), borrow = num(r.totalBorrowUsd);
  const utilization = supply !== null && supply > 0 && borrow !== null ? borrow / supply : null;
  c.metrics = { market, reserve: text(r.reserve), baseApyPct: apy === null ? null : fixed(apy * 100), supplyUsd: supply, borrowUsd: borrow,
    utilizationPct: utilization === null ? null : fixed(utilization * 100),
    grossSevenDayUsdConstantRate: apy !== null && apy >= 0 ? fixed(10 * ((1 + apy) ** (7 / 365) - 1)) : null,
    netSevenDayUsd: null, immediateWithdrawableUsd: null };
  reject(c, r.liquidityTokenMint !== USDC || !text(r.reserve), "Not an identified USDC lending reserve.");
  reject(c, apy === null || apy <= 0 || apy > 1, "Missing, zero or out-of-policy base APY.");
  reject(c, supply === null || supply < POLICY.minLendingSupplyUsd, "Insufficient reserve supply depth.");
  reject(c, utilization === null || utilization < 0 || utilization > POLICY.maxLendingUtilization, "Missing or excessive reserve utilization.");
  c.blockers.push("Current reserve state, deposit caps, available withdrawal liquidity and collateral risk require verification.", "APY persistence is unverified; constant-rate yield is a scenario, not a forecast.");
  if (c.disposition === "shortlist") c.reasons.push("Meets preliminary USDC depth, base-rate and utilization filters.");
  return c;
}

export function screenPool(p: Row, venue: "orca" | "meteora", now: number): ResearchCandidate {
  const orca = venue === "orca", a = row(orca ? p.tokenA : p.token_x), b = row(orca ? p.tokenB : p.token_y);
  const assets = [text(orca ? p.tokenMintA : a.address), text(orca ? p.tokenMintB : b.address)];
  const c = candidate(text(p.address), `${text(a.symbol)}/${text(b.symbol)}`, assets, [venue], 7, "Hold the same deposit assets at the same initial weights; also compare USDC cash");
  const stats = row(p.stats), day = row(stats["24h"]), week = row(stats["7d"]), month = row(stats["30d"]);
  const tvl = num(orca ? p.tvlUsdc : p.tvl), volume = num(orca ? day.volume : row(p.volume)["24h"]), fees = num(orca ? day.fees : row(p.fees)["24h"]);
  c.metrics = { pool: text(p.address), tokenA: assets[0], tokenB: assets[1], tvlUsd: tvl, volume24hUsd: volume,
    poolFees24hUsd: fees, poolFees7dUsd: orca ? num(week.fees) : null, poolFees30dUsd: orca ? num(month.fees) : null,
    poolFees24hToTvlPct: tvl && fees !== null ? fixed(fees / tvl * 100) : null,
    expectedPositionReturnUsd: null, binStep: orca ? null : num(row(p.pool_config).bin_step), tickSpacing: orca ? num(p.tickSpacing) : null };
  reject(c, !c.id || assets.some(a => !a), "Missing pool or mint identity.");
  reject(c, assets.some(a => !(LP_ASSETS as readonly string[]).includes(a)), "Outside the initial LP asset universe (exact SOL, USDC and USDT mints); requires separate asset due diligence.");
  reject(c, tvl === null || tvl < POLICY.minPoolTvlUsd, "Insufficient verified pool TVL.");
  reject(c, volume === null || volume < POLICY.minPoolVolume24hUsd || fees === null || fees < 0, "Insufficient volume or missing pool fee data.");
  reject(c, p.hasWarning === true || p.is_blacklisted === true, "Provider warning or blacklisted pool.");
  if (orca) reject(c, stale(p.updatedAt, now, POLICY.maxPoolAgeMs), "Pool state is stale or has no source timestamp.");
  else c.blockers.push("DLMM list has no state timestamp; freshness is retrieval-time only until on-chain state is verified.");
  c.blockers.push("Select and simulate the exact liquidity range and token split; inspect active ticks/bins and out-of-range scenarios.", "Confirm both token risks, stablecoin issuer freeze/depeg exposure and account rent; headline pool fees are not our position return.");
  if (!orca) c.blockers.push("DLMM 7d/30d fee and volume history not yet collected by this version.");
  if (c.disposition === "shortlist") c.reasons.push("Passes preliminary pool depth and activity filters; position economics remain unpriced.");
  return c;
}

export function finalizeStation(id: number, candidates: ResearchCandidate[], gaps: string[], rankingBasis = "Preliminary liquidity, then activity; not expected profit"): StationResearch {
  const station = CHALLENGE.find(s => s.id === id)!;
  const sorted = candidates.filter(c => c.disposition === "shortlist").sort((a, b) => {
    const value = (c: ResearchCandidate) => Number(c.metrics.liquidityUsd ?? c.metrics.tvlUsd ?? c.metrics.supplyUsd ?? c.metrics.volume24hUsd ?? 0);
    return value(b) - value(a) || a.id.localeCompare(b.id);
  });
  // Lending ranks base rate only after reserve safety/depth gates, never globally.
  if (id === 6) sorted.sort((a, b) => Number(b.metrics.baseApyPct) - Number(a.metrics.baseApyPct) || a.id.localeCompare(b.id));
  const shortlisted = sorted.slice(0, POLICY.shortlistLimit).map((c, i) => ({ ...c, rank: i + 1 }));
  const overflow = sorted.slice(POLICY.shortlistLimit).map(c => ({ ...c, disposition: "rejected" as const, reasons: [...c.reasons, "Outside bounded top-three research shortlist; not a safety rejection."] }));
  return { id, strategyKey: station.key, provider: station.provider, method: station.method, allocationUsd: "10.00", decision: id === 9 ? "PENDING" : "WAIT",
    comparison: "unbound", scanned: candidates.length, shortlisted, rejected: [...candidates.filter(c => c.disposition === "rejected"), ...overflow],
    rankingBasis, gaps: [...new Set(gaps)] };
}
