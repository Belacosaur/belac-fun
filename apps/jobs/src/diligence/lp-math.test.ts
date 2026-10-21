import { describe, expect, it } from 'vitest';
import { concentratedPosition, discretePosition, dynamicPositionSizes, roundedRange } from './lp-math.js';

describe('LP range and inventory scenarios', () => {
  it('rounds negative bin indices outward and includes both boundary bins', () => {
    const r = roundedRange(107.5, 0.1, 20);
    expect(r.lowerPrice).toBeLessThanOrEqual(107.5 * 0.9);
    expect(r.upperPrice).toBeGreaterThanOrEqual(107.5 * 1.1);
    expect(r.count).toBe(r.upper - r.lower + 1);
    expect(r.lower).toBeLessThan(0);
  });
  it('accounts for the 1400-bin dynamic-position limit and 70 inline bins', () => {
    expect(dynamicPositionSizes(1550, 8120, 112)).toEqual([8120 + 1330 * 112, 8120 + 80 * 112]);
    expect(dynamicPositionSizes(50, 8120, 112)).toEqual([8120]);
  });
  it('bounds atomic deposits by the $10 budget and preserves zero-change inventory', () => {
    const r = roundedRange(107.5, 0.2, 20);
    const active = Math.floor(Math.log(107.5 / 1000) / Math.log(1.002));
    const p = discretePosition(107.5, active, 20, r.lower, r.upper);
    expect(p.deployedUsd).toBeLessThanOrEqual(10);
    expect(p.idleDustUsd).toBeGreaterThanOrEqual(0);
    const zero = p.scenarios.find(s => s.change === 0)!;
    expect(zero.valueUsd).toBeCloseTo(10, 10);
    expect(zero.differenceVsHoldUsd).toBeCloseTo(0, 10);
    expect(p.bins.every(b => Number.isInteger(b.solAtoms) && Number.isInteger(b.usdcAtoms))).toBe(true);
    expect(p.bins.reduce((n, b) => n + b.distributionXBps, 0)).toBe(10000);
    expect(p.bins.reduce((n, b) => n + b.distributionYBps, 0)).toBe(10000);
  });
  it('converts a DLMM range entirely into USDC above it and SOL below it', () => {
    const active = -1117, price = 1.002 ** active * 1000;
    const r = roundedRange(price, 0.1, 20);
    const p = discretePosition(price, active, 20, r.lower, r.upper);
    expect(p.scenarios.at(-1)!.sol).toBe(0);
    expect(p.scenarios[0]!.usdc).toBe(0);
    expect(p.scenarios.at(-1)!.inRange).toBe(false);
    expect(p.scenarios[0]!.inRange).toBe(false);
  });
  it('concentrated inventory is worth $10 at entry and underperforms matching hold out of range', () => {
    const p = concentratedPosition(100, 90, 110);
    expect(p.x * 100 + p.y).toBeCloseTo(10, 12);
    expect(p.scenarios.find(s => s.change === 0)!.valueUsd).toBeCloseTo(10, 12);
    expect(p.scenarios[0]!.usdc).toBeCloseTo(0, 12);
    expect(p.scenarios.at(-1)!.sol).toBeCloseTo(0, 12);
    expect(p.scenarios[0]!.differenceVsHoldUsd).toBeLessThan(0);
    expect(p.scenarios.at(-1)!.differenceVsHoldUsd).toBeLessThan(0);
  });
});
