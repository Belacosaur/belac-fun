import { describe, expect, it } from "vitest";
import { diagnostic, parseCandles, rollingHolds, type Candle } from "./history.js";

const day = 86400;
const bars = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({ t: i * day, open: 10, high: 10, low: 10, close: 10, volume: 1 }));

describe("historical diagnostics", () => {
  it("rejects gaps, duplicates and invalid OHLC instead of fabricating daily fills", () => {
    expect(() => parseCandles([[0, 1, 2, 1, 1, 1], [2 * day, 1, 2, 1, 1, 1]], "coinbase", 3 * day)).toThrow(/gap/);
    expect(() => parseCandles([[0, 1, 2, 3, 1, 1]], "coinbase", day)).toThrow(/OHLC/);
    expect(() => parseCandles([[0, 1, 2, 1, 1, 1], [0, 1, 2, 1, 1, 1]], "coinbase", day)).toThrow(/duplicate/);
  });
  it("removes the incomplete day and translates Gecko OHLCV correctly", () => {
    expect(parseCandles([[day, 3, 4, 2, 3, 9], [0, 2, 3, 1, 2, 5]], "gecko", day)).toEqual([{ t: 0, open: 2, high: 3, low: 1, close: 2, volume: 5 }]);
  });
  it("uses completed-day signals and next-open prices, ignoring future closes", () => {
    const c = bars(54); c[50] = { ...c[50]!, open: 10, high: 20, close: 20 };
    c[51] = { ...c[51]!, open: 40, high: 100, low: 1, close: 1 };
    c[52] = { ...c[52]!, open: 20, high: 20, low: 10 };
    const result = diagnostic(c, 51, 54, 0);
    expect(result.trades[0]).toMatchObject({ side: "buy", t: 51 * day, price: 40, signalT: 50 * day });
    expect(result.trades[1]).toMatchObject({ side: "sell", t: 52 * day, price: 20, signalT: 51 * day });
    expect(result.endUsd).toBe(5);
    expect(result.maxDrawdownPct).toBe(97.5);
  });
  it("charges both sides and keeps cash baseline at ten", () => {
    const c = bars(53); c[50] = { ...c[50]!, high: 20, close: 20 };
    const r = diagnostic(c, 51, 53, 100);
    expect(r.endUsd).toBeCloseTo(10 * .99 * .99, 10);
    expect(r.holdEndUsd).toBeCloseTo(10 * .99 * .99, 10);
    expect(r.cashEndUsd).toBe(10);
  });
  it("30-day holds require exact elapsed days and use exit open after thirty days", () => {
    const c = bars(32); c[30] = { ...c[30]!, open: 20, high: 20 }; c[31] = { ...c[31]!, open: 5, low: 5 };
    const r = rollingHolds(c, 0);
    expect(r.count).toBe(2); expect(r.minPct).toBe(-50); expect(r.maxPct).toBe(100);
    expect(rollingHolds(c.slice(0, 30), 0).count).toBe(0);
  });
});
