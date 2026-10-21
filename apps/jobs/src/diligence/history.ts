export interface Candle { t: number; open: number; high: number; low: number; close: number; volume: number }
const DAY = 86400;
export function parseCandles(raw: unknown, format: "coinbase" | "gecko", cutoff: number): Candle[] {
  if (!Array.isArray(raw)) throw new Error("Invalid candle array");
  const out = raw.map((v: unknown) => {
    if (!Array.isArray(v) || v.length < 6 || v.some(x => typeof x !== "number" || !Number.isFinite(x))) throw new Error("Invalid candle numbers");
    const [t, a, b, c, d, volume] = v as number[];
    const [open, high, low, close] = format === "coinbase" ? [c, b, a, d] : [a, b, c, d];
    if (!Number.isInteger(t) || t! % DAY || low! <= 0 || high! < low! || open! < low! || open! > high! || close! < low! || close! > high! || volume! < 0) throw new Error("Invalid OHLC");
    return { t: t!, open: open!, high: high!, low: low!, close: close!, volume: volume! };
  }).filter(v => v.t < cutoff).sort((a, b) => a.t - b.t);
  out.forEach((v, i) => { if (i && v.t - out[i - 1]!.t !== DAY) throw new Error(v.t === out[i - 1]!.t ? "duplicate candle" : "daily gap"); });
  return out;
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
export function diagnostic(c: Candle[], start: number, end: number, bps: number, fixedCost = 0) {
  if (start < 51 || end > c.length || end <= start || bps < 0 || bps >= 10000 || fixedCost < 0) throw new Error("Invalid diagnostic interval or costs");
  const fee = bps / 10000;
  let cash = 10, units = 0, peak = 10, dd = 0, roundTrips = 0;
  const trades: { side: "buy" | "sell"; t: number; signalT: number; price: number; valueUsd: number }[] = [];
  const mark = (v: number) => { peak = Math.max(peak, v); dd = Math.max(dd, 1 - v / peak); };
  for (let i = start; i < end; i++) {
    const prev = c[i - 1]!, bar = c[i]!;
    const ma50 = avg(c.slice(i - 50, i).map(v => v.close));
    const ma20 = avg(c.slice(i - 20, i).map(v => v.close));
    if (units && (prev.close < ma20 || prev.close < Math.min(...c.slice(i - 11, i - 1).map(v => v.low)))) {
      cash = Math.max(0, units * bar.open * (1 - fee) - fixedCost); units = 0; roundTrips++;
      trades.push({ side: "sell", t: bar.t, signalT: prev.t, price: bar.open, valueUsd: cash });
    } else if (!units && cash > fixedCost && prev.close > ma50 && prev.close > Math.max(...c.slice(i - 21, i - 1).map(v => v.high))) {
      units = (cash - fixedCost) * (1 - fee) / bar.open; cash = 0;
      trades.push({ side: "buy", t: bar.t, signalT: prev.t, price: bar.open, valueUsd: units * bar.open });
    }
    mark(cash + units * bar.close);
  }
  const last = c[end - 1]!;
  const terminalMarkUsd = cash + units * last.close;
  const endUsd = units ? Math.max(0, units * last.close * (1 - fee) - fixedCost) : cash;
  mark(endUsd);
  const holdUnits = Math.max(0, 10 - fixedCost) * (1 - fee) / c[start]!.open;
  let holdPeak = 10, holdDrawdown = 0;
  for (let i = start; i < end; i++) { const v = holdUnits * c[i]!.close; holdPeak = Math.max(holdPeak, v); holdDrawdown = Math.max(holdDrawdown, 1 - v / holdPeak); }
  const holdEndUsd = Math.max(0, holdUnits * last.close * (1 - fee) - fixedCost);
  holdDrawdown = Math.max(holdDrawdown, 1 - holdEndUsd / holdPeak);
  return { startUtc: new Date(c[start]!.t * 1000).toISOString(), endUtc: new Date(last.t * 1000).toISOString(), observations: end - start, costBpsPerSide: bps, fixedCostUsdPerSide: fixedCost, endUsd, terminalMarkUsd, terminalOpenPosition: units > 0, completedRoundTrips: roundTrips, terminalLiquidations: units > 0 ? 1 : 0, tradeSides: trades.length, trades, cashEndUsd: 10, holdEndUsd, holdMaxDrawdownPct: holdDrawdown * 100, maxDrawdownPct: dd * 100 };
}
export function rollingHolds(c: Candle[], bps: number) {
  const values: number[] = [];
  for (let i = 0; i + 30 < c.length; i++) {
    if (c[i + 30]!.t - c[i]!.t !== 30 * DAY) throw new Error("30-day history gap");
    values.push((c[i + 30]!.open / c[i]!.open * (1 - bps / 10000) ** 2 - 1) * 100);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => sorted.length ? sorted[Math.floor((sorted.length - 1) * q)]! : null;
  return { count: values.length, costBpsPerSide: bps, minPct: quantile(0), p10Pct: quantile(.1), medianPct: quantile(.5), p90Pct: quantile(.9), maxPct: quantile(1), positiveWindows: values.filter(v => v > 0).length, nonOverlappingWindowCount: Math.floor((c.length - 1) / 30), interpretation: "Exploratory overlapping historical windows of today's selected survivors, not independent trials or a future probability estimate." };
}
