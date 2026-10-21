import { describe, expect, it } from 'vitest';
import { decodeLayout, historySummary, layoutSize, parseLayout, remainingWithdrawalCap } from './lending-layout.js';

describe('public Kamino generated layout decoding', () => {
  it('decodes signed caps, unsigned fractions and arrays without executing source', () => {
    const layout = parseLayout('class X { static layout() { return borsh.struct([borsh.i64("cap"), borsh.u128("sf"), borsh.array(borsh.u8(), 2, "flags")]); } }');
    const bytes = Buffer.alloc(26); bytes.writeBigInt64LE(-20n); bytes[8] = 5; bytes[24] = 1; bytes[25] = 2;
    expect(layoutSize(layout, {})).toBe(26);
    expect(decodeLayout(layout, bytes, {})).toEqual({ cap: '-20', sf: '5', flags: [1, 2] });
    expect(() => decodeLayout(layout, bytes.subarray(0, 8), {})).toThrow(/Truncated/);
  });
  it('rejects arbitrary source calls', () => {
    expect(() => parseLayout('class X { static layout() { return borsh.struct([process.exit()]); }}')).toThrow(/Unsupported/);
  });
});
describe('withdrawal cap source semantics', () => {
  const cap = { configCapacity: '10000000', currentTotal: '-2000000', lastIntervalStartTimestamp: '100', configIntervalLengthSeconds: '60' };
  it('credits prior deposits toward subsequent withdrawal headroom', () => {
    expect(remainingWithdrawalCap(cap, 120).remainingWithdrawBaseUnits).toBe('12000000');
  });
  it('treats interval zero as unlimited, but capacity zero as a real zero cap', () => {
    expect(remainingWithdrawalCap({ ...cap, configIntervalLengthSeconds: '0' }, 99)).toEqual({ resetDue: false, unlimited: true, remainingWithdrawBaseUnits: null });
    expect(remainingWithdrawalCap({ ...cap, configCapacity: '0', currentTotal: '0' }, 120).remainingWithdrawBaseUnits).toBe('0');
  });
  it('resets the net total exactly when the interval expires', () => {
    expect(remainingWithdrawalCap(cap, 160)).toEqual({ resetDue: true, unlimited: false, remainingWithdrawBaseUnits: '10000000' });
  });
  it('fails closed on a future interval timestamp', () => {
    expect(() => remainingWithdrawalCap(cap, 99)).toThrow(/after current/);
  });
});
describe('history validation', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ timestamp: new Date(Date.UTC(2026, 9, 13 + i)).toISOString(), metrics: { supplyInterestAPY: 0.05, actualAvailableLiquidity: 1000, status: 'Active' } }));
  it('interprets 0.05 as five percent and compounds fractions by elapsed days', () => {
    const result = historySummary(rows, '2026-10-20T00:00:00.000Z', 7);
    expect(result.tenUsdcGrossDailyMeanApyProxy).toBeCloseTo(10 * (1.05 ** (7 / 365) - 1), 12);
  });
  it('rejects missing and duplicate buckets', () => {
    expect(() => historySummary(rows.slice(1), '2026-10-20T00:00:00.000Z', 7)).toThrow(/Incomplete/);
    expect(() => historySummary([...rows.slice(1), rows[1]], '2026-10-20T00:00:00.000Z', 7)).toThrow(/Incomplete/);
  });
});
