/** Read-only primary-source LST yield collection; no staking, swap or account calls. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
interface Collateral { symbol: string; mint: string; reserve: string; status: string; elevationGroups: number[] }
interface Source { url: string; observedAt: string; httpStatus: number; headers: Record<string, string>; sha256: string; body: string; error?: string }
interface YieldRow { symbol: string; mint: string; requested: boolean; reserve: string; mintMatchedOfficialRegistry: boolean; apyFraction: number | null; apyPct: number | null; status: string; observedAt: string; sourceDataAsOf: string | null; sourceDataAgeSeconds: number | null; basis: string; sourceUrl: string; sourceSha256: string; sourceArtifact: string; freshness: string; limitations: string[]; sanctumRawApy: number | null; sanctumEpochDataAsOf: string | null; providerPayload?: unknown }
const dir = fileURLToPath(new URL('../../../../artifacts/diligence/', import.meta.url));
const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
function object(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected JSON object'); return v as Record<string, unknown>; }
function number(v: unknown): number { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Expected finite number'); return v; }
const requested = new Set(['jitosol', 'msol', 'bsol', 'jupsol', 'dfdvsol', 'adrasol']);
const lendingText = await readFile(dir + 'lending-validation.json', 'utf8');
const lending = JSON.parse(lendingText) as { reports: { collateralUniverse: Collateral[] }[] };
const universe = lending.reports[1].collateralUniverse.filter(c => c.status === 'Active' && c.elevationGroups.includes(2) && c.mint !== 'So11111111111111111111111111111111111111112');
if (new Set(universe.map(c => c.mint)).size !== universe.length || universe.filter(c => requested.has(c.symbol.toLowerCase())).length !== 6) throw new Error('Unexpected bounded collateral mint set');
const allowHosts = new Set(['kobe.mainnet.jito.network', 'api.marinade.finance', 'stake.solblaze.org', 'stake-docs.solblaze.org', 'docs.marinade.finance', 'learn.sanctum.so']);
async function get(name: string, url: string): Promise<Source> {
  if (!allowHosts.has(new URL(url).hostname) || !/^[a-z0-9-]+$/.test(name)) throw new Error('Source not allowlisted');
  let s: Source;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); const body = await r.text(); s = { url, observedAt: new Date().toISOString(), httpStatus: r.status, headers: Object.fromEntries(r.headers), sha256: sha256(body), body }; }
  catch (error) { s = { url, observedAt: new Date().toISOString(), httpStatus: 0, headers: {}, sha256: sha256(''), body: '', error: String(error) }; }
  await writeFile(dir + `loop-lst-yields-${name}.json`, JSON.stringify(s, null, 2)); return s;
}
const [jito, marinade, blaze] = await Promise.all([
  get('jito-api', 'https://kobe.mainnet.jito.network/api/v1/stake_pool_stats'),
  get('marinade-api', 'https://api.marinade.finance/msol/apy/30d'),
  get('blaze-api', 'https://stake.solblaze.org/api/v1/apy'),
]);
await Promise.all([
  get('blaze-docs', 'https://stake-docs.solblaze.org/developers/other-apis'),
  get('marinade-docs', 'https://docs.marinade.finance/marinade-protocol/protocol-overview/marinade-liquid/msol-token'),
  get('sanctum-api-docs', 'https://learn.sanctum.so/docs/for-developers/sanctum-api'),
]);
const latest = JSON.parse(await readFile(dir + 'loop-lst-yields-sanctum-latest.json', 'utf8')) as Source;
const epochSource = JSON.parse(await readFile(dir + 'loop-lst-yields-sanctum-epochs.json', 'utf8')) as Source;
const registrySource = JSON.parse(await readFile(dir + 'loop-lst-yields-sanctum-lsts.json', 'utf8')) as Source;
const apys = object(object(JSON.parse(latest.body)).apys), epochs = object(object(JSON.parse(epochSource.body)).apys);
const registry = object(JSON.parse(registrySource.body)).lsts;
if (!Array.isArray(registry)) throw new Error('Invalid official LST registry');
const registryMints = new Set(registry.map(v => String(object(v).mint)));
const rows: YieldRow[] = universe.map(c => {
  const raw = apys[c.mint], series = epochs[c.mint];
  const lastEpoch = Array.isArray(series) && series.length ? object(series.at(-1)) : null;
  return { symbol: c.symbol, mint: c.mint, requested: requested.has(c.symbol.toLowerCase()), reserve: c.reserve, mintMatchedOfficialRegistry: registryMints.has(c.mint), apyFraction: null, apyPct: null, status: typeof raw === 'number' ? 'unknown-suspect-zero-feed' : 'unknown-unsupported-feed', observedAt: latest.observedAt, sourceDataAsOf: null, sourceDataAgeSeconds: null, basis: 'Documented Sanctum latest APY: trimmed mean of 5 completed per-epoch APYs (remove highest/lowest, average remaining 3), fallback to inception when incomplete.', sourceUrl: latest.url, sourceSha256: latest.sha256, sourceArtifact: 'loop-lst-yields-sanctum-latest.json', freshness: 'unusable-rate: feed yields zero across all supported mints', limitations: ['Raw zero is retained for data-quality review and is not accepted as economic zero yield.', 'Newer documented Sanctum APY API requires an API key; no credentials were requested, read or bypassed.'], sanctumRawApy: typeof raw === 'number' ? raw : null, sanctumEpochDataAsOf: lastEpoch && typeof lastEpoch.end === 'number' ? new Date(lastEpoch.end * 1000).toISOString() : null };
});
function assign(symbol: string, source: Source, sourceArtifact: string, fraction: number, sourceDataAsOf: string | null, basis: string, limitations: string[], providerPayload: unknown) {
  const row = rows.find(r => r.symbol.toLowerCase() === symbol);
  if (!row || source.httpStatus !== 200 || !Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) throw new Error('Issuer APY validation failed for ' + symbol);
  Object.assign(row, { apyFraction: fraction, apyPct: fraction * 100, status: sourceDataAsOf ? 'issuer-rate-timestamped' : 'issuer-rate-retrieval-only', observedAt: source.observedAt, sourceDataAsOf, sourceDataAgeSeconds: sourceDataAsOf ? Math.max(0, (Date.parse(source.observedAt) - Date.parse(sourceDataAsOf)) / 1000) : null, basis, sourceUrl: source.url, sourceSha256: source.sha256, sourceArtifact, freshness: sourceDataAsOf ? 'provider data timestamp retained; compare age to the intended decision horizon' : 'retrieval fresh; provider measurement timestamp absent', limitations, providerPayload });
}
const parseFailures: string[] = [];
try {
  const payload = object(JSON.parse(jito.body));
  if (!Array.isArray(payload.apy) || !payload.apy.length) throw new Error('Jito APY series missing');
  const points = payload.apy.map(v => object(v)).sort((a, b) => Date.parse(String(a.date)) - Date.parse(String(b.date)));
  const point = points.at(-1)!;
  if (!Number.isFinite(Date.parse(String(point.date)))) throw new Error('Jito timestamp invalid');
  assign('jitosol', jito, 'loop-lst-yields-jito-api.json', number(point.data), String(point.date), 'Jito production stake_pool_stats reported APY snapshot, decimal fraction. The endpoint exposes daily observations; no additional averaging is applied here.', ['Underlying staking/MEV yield only; does not include Kamino lending supply rewards.', 'Issuer observations and other LST methodologies are different windows; avoid treating tiny yield differences as durable spreads.'], point);
} catch (e) { parseFailures.push('jitosol: ' + String(e)); }
try {
  const payload = object(JSON.parse(marinade.body));
  const value = number(payload.value), start = String(payload.start_time), end = String(payload.end_time);
  const seconds = (Date.parse(end) - Date.parse(start)) / 1000;
  const annualized = (number(payload.end_price) / number(payload.start_price)) ** (365 * 86400 / seconds) - 1;
  if (!(seconds > 0) || Math.abs(annualized - value) > 1e-12) throw new Error('mSOL APY cannot be reproduced from issuer price history');
  assign('msol', marinade, 'loop-lst-yields-marinade-api.json', value, end, '30-day mSOL/SOL price-return APY, compounded over a 365-day year; exactly reproduced from start/end prices and timestamps.', ['This API 30-day price APY differs from Marinade documentation describing its displayed 30-day SMA of 14-day APYs.', 'Return is denominated in SOL, not guaranteed USD return; excludes entry/exit costs and Kamino lending APY.'], { ...payload, reproducedApyFraction: annualized });
} catch (e) { parseFailures.push('msol: ' + String(e)); }
try {
  const payload = object(JSON.parse(blaze.body));
  if (payload.success !== true) throw new Error('Blaze API failure');
  const basePct = number(payload.base), apyPct = number(payload.apy);
  if (basePct !== apyPct || !(basePct > 0 && basePct < 100)) throw new Error('Blaze base/apy units disagree');
  assign('bsol', blaze, 'loop-lst-yields-blaze-api.json', basePct / 100, null, 'Issuer API documented as average staking APY over past few epochs; base=apy is percentage units (6.01 means 6.01%).', ['Issuer payload has no updatedAt/epoch/window boundaries; provider measurement freshness cannot be independently verified.', 'Only base/apy is used. BLZE, DeFi, lending and liquidity promotional fields are excluded.', 'Treat this as a provisional issuer observation, not a validated live looping rate.'], payload);
} catch (e) { parseFailures.push('bsol: ' + String(e)); }
const summary = { generatedAt: new Date().toISOString(), executionEnabled: false, signed: false, sent: false, ript: 'pending', scope: 'Bounded 24 active main-market SOL elevation-group collateral mints from the saved on-chain universe; minimum six requested mints highlighted. This is not a whole-Solana or global-best-yield search.', universeSource: { file: 'lending-validation.json', sha256: sha256(lendingText), reportIndex: 1, mintCount: universe.length }, rows, requestedRows: rows.filter(r => r.requested), parseFailures,
  dataQuality: { sanctumSchema: 'https://extra-api.sanctum.so/doc', sanctumLatestSupportedCount: Object.keys(apys).length, sanctumLatestNonzeroCount: Object.values(apys).filter(v => typeof v === 'number' && v !== 0).length, note: 'All23 supported latest rates and all observed last10 per-epoch rates are zero, contradicting timestamped/positive issuer observations for Jito/mSOL/bSOL. Raw Sanctum zero values are rejected as usable rates. stkeSOL is unsupported by this feed.', newerApi: 'https://learn.sanctum.so/docs/for-developers/sanctum-api requires apiKey.' }, limitations: ['Fresh retrieval does not prove a provider recomputed its APY recently. Timestamped rate data and retrieval-only observations are distinguished.', 'These are historical annualizations/reported snapshots. They do not guarantee future staking returns or positive incremental loop carry.', 'Issuer staking APY excludes Kamino collateral supply APY, variable SOL borrowing, loan origination, swaps, rent, slippage, liquidation and LST/SOL depeg costs.', 'Different provider windows are not perfectly comparable; no global-best or funding-ready conclusion is made.'] };
await writeFile(dir + 'loop-lst-yields-summary.json', JSON.stringify(summary, null, 2));
const files = (await readdir(dir)).filter(f => f.startsWith('loop-lst-yields-') && f !== 'loop-lst-yields-manifest.json');
const manifest = await Promise.all(files.map(async file => ({ file, sha256: sha256(await readFile(dir + file)) })));
await writeFile(dir + 'loop-lst-yields-manifest.json', JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2));
console.log(JSON.stringify({ requestedRows: summary.requestedRows, parseFailures }, null, 2));
