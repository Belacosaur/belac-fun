import { getAddressDecoder } from '@solana/kit';

export type Layout = { kind: string; name?: string; count?: number; children?: Layout[] };

// Parse only the generated Borsh layout declaration. Downloaded SDK source is never executed.
export function parseLayout(source: string): Layout {
  const start = source.indexOf('borsh.struct', source.indexOf('static '));
  if (start < 0) throw new Error('No static generated struct');
  const a = source.indexOf('[', start);
  let depth = 1, end = a + 1;
  while (depth && end < source.length) { if (source[end] === '[') depth++; if (source[end] === ']') depth--; end++; }
  const tokens = source.slice(a, end).match(/"[^"\\]*"|\d+|[A-Za-z_][\w.]*|[()[\],]/g) ?? [];
  let cursor = 0;
  function read(): unknown {
    const token = tokens[cursor++];
    if (token === '[') {
      const values: unknown[] = [];
      while (tokens[cursor] !== ']') { values.push(read()); if (tokens[cursor] === ',') cursor++; }
      cursor++; return values;
    }
    if (token?.startsWith('"')) return JSON.parse(token);
    if (/^\d+$/.test(token ?? '')) return Number(token);
    if (!token || tokens[cursor++] !== '(') throw new Error(`Unsupported layout token: ${token}`);
    const args: unknown[] = [];
    while (tokens[cursor] !== ')') { args.push(read()); if (tokens[cursor] === ',') cursor++; }
    cursor++;
    if (token === 'borshAddress') return { kind: 'address', name: args[0] };
    if (token === 'borsh.array') return { kind: 'array', children: [args[0]], count: args[1], name: args[2] };
    if (/^borsh\.[ui](8|16|32|64|128)$/.test(token)) return { kind: token.slice(6), name: args[0] };
    const ref = /^types\.(\w+)\.layout$/.exec(token);
    if (ref) return { kind: `ref:${ref[1]}`, name: args[0] };
    throw new Error(`Unsupported generated Borsh expression: ${token}`);
  }
  return { kind: 'struct', children: read() as Layout[] };
}

export function layoutSize(layout: Layout, schemas: Record<string, Layout>): number {
  if (layout.kind === 'address') return 32;
  if (/^[ui]\d+$/.test(layout.kind)) return Number(layout.kind.slice(1)) / 8;
  if (layout.kind === 'array') return layout.count! * layoutSize(layout.children![0], schemas);
  if (layout.kind.startsWith('ref:')) return layoutSize(schemas[layout.kind.slice(4)], schemas);
  return layout.children!.reduce((sum, child) => sum + layoutSize(child, schemas), 0);
}

export function decodeLayout(layout: Layout, data: Buffer, schemas: Record<string, Layout>, offset = 0): unknown {
  let cursor = offset;
  function decode(node: Layout): unknown {
    if (node.kind.startsWith('ref:')) return decode(schemas[node.kind.slice(4)]);
    if (node.kind === 'address') { const value = getAddressDecoder().decode(data.subarray(cursor, cursor + 32)); cursor += 32; return value; }
    if (/^[ui]\d+$/.test(node.kind)) {
      const bytes = Number(node.kind.slice(1)) / 8;
      if (cursor + bytes > data.length) throw new Error('Truncated generated layout');
      let value = 0n;
      for (let i = 0; i < bytes; i++) value |= BigInt(data[cursor++]) << BigInt(i * 8);
      if (node.kind.startsWith('i') && value >= (1n << BigInt(bytes * 8 - 1))) value -= 1n << BigInt(bytes * 8);
      return bytes <= 4 ? Number(value) : value.toString();
    }
    if (node.kind === 'array') return Array.from({ length: node.count! }, () => decode(node.children![0]));
    return Object.fromEntries(node.children!.map(child => [child.name!, decode(child)]));
  }
  return decode(layout);
}

export function historySummary(history: { timestamp: string; metrics: Record<string, unknown> }[], end: string, days: number) {
  const endMs = Date.parse(end), start = endMs - days * 86_400_000;
  const rows = history.filter(row => Date.parse(row.timestamp) >= start && Date.parse(row.timestamp) < endMs);
  const unique = new Set(rows.map(row => row.timestamp));
  const rates = rows.map(row => Number(row.metrics.supplyInterestAPY));
  if (rows.length !== days || unique.size !== days || rates.some(r => !Number.isFinite(r) || r <= -1)) throw new Error('Incomplete or invalid daily APY history');
  for (let i = 0; i < days; i++) if (!rows.some(row => Date.parse(row.timestamp) === start + i * 86_400_000)) throw new Error('History contains a day gap');
  const meanApy = rates.reduce((sum, rate) => sum + rate, 0) / days;
  const cumulativeReturn = Math.expm1(rates.reduce((sum, rate) => sum + Math.log1p(rate) / 365, 0));
  return { days, buckets: rows.length, start: new Date(start).toISOString(), end, meanApyFraction: meanApy,
    minApyFraction: Math.min(...rates), maxApyFraction: Math.max(...rates), cumulativeDailyMeanApyProxy: cumulativeReturn,
    tenUsdcGrossDailyMeanApyProxy: 10 * cumulativeReturn,
    minDailyMeanAvailableUsdc: Math.min(...rows.map(row => Number(row.metrics.actualAvailableLiquidity))),
    nonActiveBuckets: rows.filter(row => row.metrics.status !== 'Active').length,
    deprecatedBuckets: rows.filter(row => row.metrics.isUIDeprecated === true).length };
}

export interface WithdrawalCapState { configCapacity: string; currentTotal: string; lastIntervalStartTimestamp: string; configIntervalLengthSeconds: string }

/** Mirrors remaining_withdrawal_caps_amount plus the operation's future-timestamp guard. */
export function remainingWithdrawalCap(cap: WithdrawalCapState, unixSeconds: number) {
  const capacity = BigInt(cap.configCapacity), current = BigInt(cap.currentTotal);
  const start = BigInt(cap.lastIntervalStartTimestamp), interval = BigInt(cap.configIntervalLengthSeconds), now = BigInt(unixSeconds);
  if (interval === 0n) return { resetDue: false, unlimited: true, remainingWithdrawBaseUnits: null };
  if (now < start) throw new Error('Cap interval starts after current timestamp');
  const resetDue = now - start >= interval;
  const total = resetDue ? 0n : current;
  return { resetDue, unlimited: false,
    remainingWithdrawBaseUnits: (capacity < 0n || total > capacity ? 0n : capacity - total).toString() };
}
