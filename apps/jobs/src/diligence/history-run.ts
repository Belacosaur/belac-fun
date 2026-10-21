/** Read-only bounded historical research. Run from repo root with pnpm --filter @belac/jobs exec tsx src/diligence/history-run.ts --live.
 * Without --live, reconstructs the exact report from saved raw responses; no credentials or RPC transaction methods are used. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { diagnostic, parseCandles, rollingHolds, type Candle } from "./history.js";

type Row = Record<string, unknown>;
const object = (v: unknown): Row => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected JSON object"); return v as Row; };
const array = (v: unknown): unknown[] => { if (!Array.isArray(v)) throw new Error("Expected JSON array"); return v; };
const string = (v: unknown): string => { if (typeof v !== "string") throw new Error("Expected JSON string"); return v; };
const numeric = (v: unknown): number => { if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Expected finite JSON number"); return v; };
function candleRows(v: unknown): number[][] { return array(v).map(row => array(row).map(numeric)); }
type Diagnostic = ReturnType<typeof diagnostic>;
interface Interval { name: string; scenarios: Diagnostic[]; fixedCostStress: Diagnostic }
interface Assessment {
  bars: number; status: string; firstUtc?: string; lastUtc?: string; stale?: boolean;
  hold30Day?: ReturnType<typeof rollingHolds>[]; reason?: string; diagnostics?: Interval[];
  adequacy?: { minimumHistoryBars: number; minimumValidationDays: number; minimumValidationCompletedRoundTrips: number };
}
interface Candidate { symbol: string; mint: string; meme: boolean; quoteRoundTripLossPct: number | null }
interface Pool {
  attributes: { address: string; pool_created_at: string; reserve_in_usd: string | null };
  relationships: { base_token: { data: { id: string } }; quote_token: { data: { id: string } }; dex: { data: { id: string } } };
}
function poolRow(v: unknown): Pool {
  const p = object(v), a = object(p.attributes), r = object(p.relationships);
  const id = (key: string) => ({ data: { id: string(object(object(r[key]).data).id) } });
  return { attributes: { address: string(a.address), pool_created_at: string(a.pool_created_at), reserve_in_usd: a.reserve_in_usd === null ? null : string(a.reserve_in_usd) }, relationships: { base_token: id("base_token"), quote_token: id("quote_token"), dex: id("dex") } };
}
interface Result extends Candidate {
  entryEligible: false; errors: string[]; decision: string;
  coinbaseIdentity?: { currency: string; exactMintVerified: boolean; nativeSolToWrappedSolProxy: boolean; product: string; source: string };
  coinbase?: Assessment & { historyStop: string; basis: string };
  pool?: Assessment & { address: string; dex: string; baseMint: string; quoteMint: string; createdAt: string; discardedCreationDayPartialBars: number; ohlcvMetadataMintVerified: boolean; currentReserveUsd: string; basis: string };
}

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const dir = `${root}artifacts/diligence`;
const DAY = 86400;
const ruleData = object(JSON.parse(await readFile(`${dir}/history-rules.json`, "utf8")));
const rules = { ...ruleData,
  maximumRequests: numeric(ruleData.maximumRequests), requestTimeoutMs: numeric(ruleData.requestTimeoutMs),
  earliestRequestedUtc: string(ruleData.earliestRequestedUtc), coinbasePageDays: numeric(ruleData.coinbasePageDays),
  maxCoinbasePagesPerAsset: numeric(ruleData.maxCoinbasePagesPerAsset), costScenariosBpsPerSide: array(ruleData.costScenariosBpsPerSide).map(numeric),
  minimumDescriptiveHistoryDays: numeric(ruleData.minimumDescriptiveHistoryDays), minimumRetrospectiveValidationDays: numeric(ruleData.minimumRetrospectiveValidationDays),
  minimumValidationRoundTripsForDescription: numeric(ruleData.minimumValidationRoundTripsForDescription), additionalFixedCostStressUsdPerSide: numeric(ruleData.additionalFixedCostStressUsdPerSide),
};
const retryFailed = process.argv.includes("--retry-failed");
const live = process.argv.includes("--live") || retryFailed;
const capturedAt = live && !retryFailed ? new Date().toISOString() : string(object(JSON.parse(await readFile(`${dir}/history-capture.json`, "utf8"))).capturedAt);
const cutoff = Math.floor(Date.parse(capturedAt) / 86400000) * DAY;
const evidence: { url: string; observedAt: string; status: number | null; sha256: string; file: string; error?: string }[] = [];
let calls = 0;
let networkRequests = 0;
await mkdir(`${dir}/history-raw`, { recursive: true });
async function get(url: string): Promise<unknown> {
  const hash = createHash("sha256").update(url).digest("hex");
  const path = `${dir}/history-raw/${hash}.json`;
  if (++calls > rules.maximumRequests) throw new Error("Research request cap reached");
  let record: { url: string; observedAt: string; status: number | null; body: string; error?: string };
  let cached: typeof record | undefined;
  if (retryFailed) { try { cached = JSON.parse(await readFile(path, "utf8")); } catch { /* New URL after previously failed discovery. */ } }
  if (live && cached?.status !== 200) {
    networkRequests++;
    if (cached) await writeFile(`${dir}/history-raw/${hash}-prior-${Date.parse(cached.observedAt)}.json`, JSON.stringify(cached));
    const observedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { method: "GET", headers: { accept: "application/json", "user-agent": "Belac-read-only-history/1" }, signal: AbortSignal.timeout(rules.requestTimeoutMs) });
      record = { url, observedAt, status: response.status, body: await response.text() };
    } catch (e) { record = { url, observedAt, status: null, body: "", error: String(e) }; }
    await writeFile(path, JSON.stringify(record));
    // Stay below GeckoTerminal's published public request limit; sequential and bounded.
    if (url.includes("geckoterminal")) await new Promise(resolve => setTimeout(resolve, retryFailed ? 12000 : 2200));
  } else record = cached ?? JSON.parse(await readFile(path, "utf8"));
  evidence.push({ url, observedAt: record.observedAt, status: record.status, sha256: createHash("sha256").update(record.body).digest("hex"), file: `artifacts/diligence/history-raw/${hash}.json`, ...(record.error ? { error: record.error } : {}) });
  if (record.status !== 200) throw new Error(`HTTP ${record.status}: ${url} ${record.body.slice(0, 160)} ${record.error ?? ""}`);
  return JSON.parse(record.body);
}
const prod = object(JSON.parse(await readFile(`${root}artifacts/research/62211178-1953-4a04-909b-4e85883a43e8.production.json`, "utf8")));
const candidates: Candidate[] = array(prod.stations).map(object).filter(s => s.id === 1 || s.id === 7).flatMap(s => array(s.shortlisted).map(object).map(c => ({ symbol: string(c.label).split(" ")[0]!, mint: string(c.id), meme: s.id === 7, quoteRoundTripLossPct: object(c.metrics).quoteRoundTripLossPct === undefined ? null : numeric(object(c.metrics).quoteRoundTripLossPct) })));
const currencies: Record<string, string> = { SOL: "SOL", JUP: "JUPITER", MET: "MET" };
const results: Result[] = [];
function assess(c: Candle[]): Assessment {
  if (!c.length) return { bars: 0, status: "INSUFFICIENT_HISTORY" };
  const base = { bars: c.length, firstUtc: new Date(c[0]!.t * 1000).toISOString(), lastUtc: new Date(c.at(-1)!.t * 1000).toISOString(), stale: c.at(-1)!.t !== cutoff - DAY, hold30Day: rules.costScenariosBpsPerSide.map((bps: number) => rollingHolds(c, bps)) };
  if (c.length <= 51) return { ...base, status: "INSUFFICIENT_HISTORY", reason: "Fewer than 52 complete daily candles; no rule diagnostic possible." };
  const split = 51 + Math.floor((c.length - 51) * .7);
  const intervals = [{ name: "full-retrospective", start: 51, end: c.length }, { name: "development-retrospective", start: 51, end: split }, { name: "validation-retrospective-not-untouched", start: split, end: c.length }].filter(v => v.end > v.start);
  const diagnostics = intervals.map(v => ({ name: v.name, scenarios: rules.costScenariosBpsPerSide.map((bps: number) => diagnostic(c, v.start, v.end, bps)), fixedCostStress: diagnostic(c, v.start, v.end, 50, rules.additionalFixedCostStressUsdPerSide) }));
  const validation = diagnostics.find(v => v.name.startsWith("validation"))?.scenarios.find(v => v.costBpsPerSide === 25);
  const adequate = c.length >= rules.minimumDescriptiveHistoryDays && !base.stale && validation && validation.observations >= rules.minimumRetrospectiveValidationDays && validation.completedRoundTrips >= rules.minimumValidationRoundTripsForDescription;
  return { ...base, status: adequate ? "RETROSPECTIVE_ONLY_NO_EDGE_ESTABLISHED" : "INSUFFICIENT_VALIDATION", adequacy: { minimumHistoryBars: rules.minimumDescriptiveHistoryDays, minimumValidationDays: rules.minimumRetrospectiveValidationDays, minimumValidationCompletedRoundTrips: rules.minimumValidationRoundTripsForDescription }, diagnostics };
}
for (const asset of candidates) {
  const result: Result = { ...asset, entryEligible: false, errors: [], decision: "" };
  if (!asset.meme) {
    try {
      const currency = currencies[asset.symbol]!;
      const identity = object(await get(`https://api.exchange.coinbase.com/currencies/${currency}`));
      const product = object(await get(`https://api.exchange.coinbase.com/products/${currency}-USD`));
      if (product.base_currency !== currency || product.quote_currency !== "USD") throw new Error("Product identity mismatch");
      const exactMint = array(identity.supported_networks).map(object).some(n => n.id === "solana" && n.contract_address === asset.mint);
      const nativeSol = asset.symbol === "SOL" && identity.id === "SOL" && identity.default_network === "solana";
      if (!exactMint && !nativeSol) throw new Error("Coinbase exact-mint identity not verified");
      result.coinbaseIdentity = { currency, exactMintVerified: !!exactMint, nativeSolToWrappedSolProxy: nativeSol, product: string(product.id), source: `https://api.exchange.coinbase.com/currencies/${currency}` };
      const candleMap = new Map<number, number[]>();
      let end = cutoff;
      let stopped = "page cap";
      for (let page = 0; page < rules.maxCoinbasePagesPerAsset; page++) {
        const start = Math.max(Date.parse(rules.earliestRequestedUtc) / 1000, end - rules.coinbasePageDays * DAY);
        const url = new URL(`https://api.exchange.coinbase.com/products/${currency}-USD/candles`);
        url.searchParams.set("granularity", "86400"); url.searchParams.set("start", new Date(start * 1000).toISOString()); url.searchParams.set("end", new Date(end * 1000).toISOString());
        const raw = candleRows(await get(url.href));
        const within = raw.filter((v: number[]) => v[0]! >= start && v[0]! < end && v[0]! < cutoff);
        within.forEach((v: number[]) => candleMap.set(v[0]!, v));
        if (!within.length) { stopped = "empty preceding page; exchange listing boundary, not token genesis"; break; }
        if (start === Date.parse(rules.earliestRequestedUtc) / 1000) { stopped = "requested floor"; break; }
        end = start;
      }
      const c = parseCandles([...candleMap.values()], "coinbase", cutoff);
      result.coinbase = { ...assess(c), historyStop: stopped, basis: "Exact mapped asset Coinbase USD daily proxy; not Solana USDC execution. Native SOL additionally differs from wrapped SOL by wrapping/account costs." };
      await writeFile(`${dir}/history-${asset.symbol}-coinbase-candles.json`, JSON.stringify(c));
    } catch (e) { result.errors.push(`Coinbase: ${String(e)}`); }
  }
  try {
    const pools = object(await get(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${asset.mint}/pools`));
    const matching = array(pools.data).map(poolRow).filter(p => p.attributes.reserve_in_usd !== null && Number.isFinite(Number(p.attributes.reserve_in_usd)) && Number(p.attributes.reserve_in_usd) > 0 && [p.relationships.base_token.data.id, p.relationships.quote_token.data.id].includes(`solana_${asset.mint}`));
    const preferred = asset.meme && matching.some(p => p.relationships.dex.data.id === "pumpswap") ? matching.filter(p => p.relationships.dex.data.id === "pumpswap") : matching;
    preferred.sort((a, b) => Number(b.attributes.reserve_in_usd) - Number(a.attributes.reserve_in_usd) || a.attributes.address.localeCompare(b.attributes.address));
    const pool = preferred[0]; if (!pool) throw new Error("No exact-mint pool discovered");
    const id = pool.attributes.address;
    const raw = object(await get(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${id}/ohlcv/day?aggregate=1&before_timestamp=${cutoff}&limit=1000&currency=usd&token=${asset.mint}`));
    const list = candleRows(object(object(raw.data).attributes).ohlcv_list);
    const meta = object(raw.meta);
    if (![object(meta.base).address, object(meta.quote).address].includes(asset.mint)) throw new Error("OHLCV response metadata exact mint mismatch");
    const creationDay = Math.floor(Date.parse(pool.attributes.pool_created_at) / 86400000) * DAY;
    if (!Number.isFinite(creationDay) || list.some((v: number[]) => v[0]! < creationDay)) throw new Error("OHLCV predates reported pool creation day");
    const firstComplete = Math.ceil(Date.parse(pool.attributes.pool_created_at) / 86400000) * DAY;
    const c = parseCandles(list.filter((v: number[]) => v[0]! >= firstComplete), "gecko", cutoff);
    result.pool = { address: id, dex: pool.relationships.dex.data.id, baseMint: pool.relationships.base_token.data.id, quoteMint: pool.relationships.quote_token.data.id, createdAt: pool.attributes.pool_created_at, discardedCreationDayPartialBars: list.filter((v: number[]) => v[0]! < firstComplete).length, ohlcvMetadataMintVerified: true, currentReserveUsd: string(pool.attributes.reserve_in_usd), basis: "Single currently liquid exact-mint pool USD OHLCV; excludes migration/pre-pool history, historical executable liquidity and USDC basis.", ...assess(c) };
    await writeFile(`${dir}/history-${asset.symbol}-pool-candles.json`, JSON.stringify(c));
  } catch (e) { result.errors.push(`GeckoTerminal: ${String(e)}`); }
  result.decision = asset.meme ? "REJECT_FOR_LIVE_ENTRY_INSUFFICIENT_HISTORY_OR_PROSPECTIVE_VALIDATION" : "WAIT_NO_PROSPECTIVE_EDGE_OR_EXECUTION_COST_VALIDATION";
  results.push(result);
  console.log(`${asset.symbol}: Coinbase ${result.coinbase?.bars ?? "unavailable"}, pool ${result.pool?.bars ?? "unavailable"}; ${result.decision}`);
}
const report = { capturedAt, rebuiltAt: new Date().toISOString(), executionEnabled: false, ript: "pending; not polled", rules, priorJupDiagnostic: "Production raw history:JUP source URL already uses JUPITER-USD. Displayed historyProxy JUP-USD was a label bug; do not infer wrong production data from the label.", results, evidence, requests: calls, networkRequestsThisInvocation: networkRequests, conclusion: "Retrospective descriptive evidence only. No candidate is authorized for entry. Fixed sensitivity costs are assumptions, not verified historical execution costs. Today's survivors and selected pools exclude delisted/failed candidates; no probability estimate or proven edge.", sources: ["https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles", "https://api.geckoterminal.com/docs/index.html", "https://www.coingecko.com/learn/dex-data-api"] };
const currentExecutionCostSnapshot = await (async () => {
  try {
    const snapshot = object(JSON.parse(await readFile(`${dir}/swap-costs.json`, "utf8")));
    return { source: "artifacts/diligence/swap-costs.json", observedAt: string(snapshot.observedAt),
      interpretation: "Separate current unsigned-message and sequential-quote snapshot; not substituted for historical fees or used to change frozen rules.",
      costs: array(snapshot.costs).map(object).map(c => ({ mint: string(c.mint), label: string(c.label), observedAt: string(c.observedAt),
        roundTripQuoteLossUsdc: string(c.currentRoundTripQuoteLossUsdc), buyMessageFeeLamports: string(object(c.buyNetwork).lamports), sellMessageFeeLamports: string(object(c.sellNetwork).lamports),
        networkRoundTripUsdAtSnapshot: string(object(c.costs).networkRoundTripUsdAtSnapshot), recoverableRentSol: string(object(c.costs).recoverableRentSol), rentCountedAsExpense: false })) };
  } catch (e) { return { source: "artifacts/diligence/swap-costs.json", unavailable: String(e) }; }
})();
Object.assign(report, { currentExecutionCostSnapshot });
await writeFile(`${dir}/history-capture.json`, JSON.stringify({ capturedAt, cutoffUtc: new Date(cutoff * 1000).toISOString() }, null, 2));
await writeFile(`${dir}/history-report.json`, JSON.stringify(report, null, 2));
const fmt = (n: unknown) => typeof n === "number" ? n.toFixed(2) : "—";
const md = [
  `# Historical diagnostics`,
  ``,
  `Daily cutoff: ${new Date(cutoff * 1000).toISOString()}; first capture: ${capturedAt}. Execution disabled; Ript pending and not polled.`,
  ``,
  `Fixed rules were recorded before these historical results. The breakout/MA family was already seen in previous diagnostics; the final 30% chronological interval is retrospective validation, **not an untouched holdout**. Each interval restarts with $10 cash, retains prior candles for indicators, and fills completed-day signals at the next daily open. Terminal open positions are marked at the last close and separately costed for estimated liquidation; no executable closing fill is claimed. Drawdowns use daily closing marks and can understate intraday risk.`,
  ``,
  `Full-history diagnostic at hypothetical 25bps per side, after the 51-day warmup:`,
  ``,
  `| Asset/source | Complete bars | First day | End $ | Hold $ | Cash $ | Max DD % | Completed round trips |`,
  `|---|---:|---|---:|---:|---:|---:|---:|`,
];
for (const r of results) for (const [source, data] of [["Coinbase", r.coinbase], ["exact-mint pool", r.pool]] as const) {
  if (!data) continue;
  const d = data.diagnostics?.find(v => v.name === "full-retrospective")?.scenarios.find(v => v.costBpsPerSide === 25);
  md.push(`| ${r.symbol}/${source} | ${data.bars} | ${data.firstUtc?.slice(0, 10)} | ${fmt(d?.endUsd)} | ${fmt(d?.holdEndUsd)} | 10.00 | ${fmt(d?.maxDrawdownPct)} | ${d?.completedRoundTrips ?? "—"} |`);
}
md.push(``, `Final 30% retrospective interval; sensitivity in bps per side (all figures end dollars from $10):`, ``, `| Asset/source | Dates | Days | 0bps | 25bps | 50bps | 100bps | 50bps + $0.01/side | Hold 25bps | Completed RT |`, `|---|---|---:|---:|---:|---:|---:|---:|---:|---:|`);
for (const r of results) for (const [source, data] of [["Coinbase", r.coinbase], ["pool", r.pool]] as const) {
  const v = data?.diagnostics?.find(d => d.name.startsWith("validation")); if (!v) continue;
  const d = v.scenarios[1]!;
  md.push(`| ${r.symbol}/${source} | ${d.startUtc.slice(0, 10)}–${d.endUtc.slice(0, 10)} | ${d.observations} | ${v.scenarios.map(s => fmt(s.endUsd)).join(" | ")} | ${fmt(v.fixedCostStress.endUsd)} | ${fmt(d.holdEndUsd)} | ${d.completedRoundTrips} |`);
}
md.push(``, `Exploratory 30-calendar-day open-to-open hold windows, 25bps per side. Overlapping windows are dependent; current survivors/pools exclude failed, delisted and unselected tokens. These are distributions within observed history, **not future success probabilities**.`, ``, `| Asset/source | Windows | Nonoverlapping count | Worst % | P10 % | Median % | P90 % | Best % |`, `|---|---:|---:|---:|---:|---:|---:|---:|`);
for (const r of results) for (const [source, data] of [["Coinbase", r.coinbase], ["pool", r.pool]] as const) {
  const h = data?.hold30Day?.find(v => v.costBpsPerSide === 25); if (!h) continue;
  md.push(`| ${r.symbol}/${source} | ${h.count} | ${h.nonOverlappingWindowCount} | ${fmt(h.minPct)} | ${fmt(h.p10Pct)} | ${fmt(h.medianPct)} | ${fmt(h.p90Pct)} | ${fmt(h.maxPct)} |`);
}
md.push(``, `CATE, baton and CLAUDIA are rejected for live entry: short or insufficient validation history; their present liquidity is not evidence of survival through future regimes. JUP/MET remain WAIT. SOL's long-history result includes earlier market regimes and present-survivor selection; its final retrospective interval's small 25bps surplus over cash disappears under the 50bps stress. None establishes a deployable edge.`, ``, `Coinbase products are checked against the currencies endpoint's Solana contract address (JUPITER, MET). Native SOL is an additional wrapped-SOL proxy. The production JUP raw URL already used JUPITER-USD; its JUP-USD display label was inaccurate. Public GeckoTerminal data spans at most about six months here. Pool relationships and OHLCV metadata must match the exact mint; candles before pool creation are rejected, and the initial partial creation day is discarded.`, ``, `Costs are sensitivity assumptions, not verified historical execution. USD/USDC basis, historical liquidity, spreads, slippage, dynamic Pump fee tiers, Token-2022 transfer behavior, setup/rent and network costs remain outside the backtest. Current quotes or fee estimates cannot reconstruct historical fills. Rent is locked capital if recoverable, not automatically a fee.`, ``, `Raw GET responses, UTC retrieval times, body SHA256 and exact URLs are in history-report.json and history-raw/. Earlier 429 responses are retained as prior-attempt files. Run without --live to replay saved evidence; --retry-failed only refetches failed/missing endpoints at a slower pace.`, ``, `Sources: [Coinbase candle schema and missing-tick caveat](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles), [GeckoTerminal endpoints](https://api.geckoterminal.com/docs/index.html), [CoinGecko public history access](https://www.coingecko.com/learn/dex-data-api).`, ``);
if ("costs" in currentExecutionCostSnapshot && currentExecutionCostSnapshot.costs) {
  md.push(`Current execution snapshot from [swap-costs.json](swap-costs.json), observed ${currentExecutionCostSnapshot.observedAt}. Sequential quotes can include market movement. Priority price was zero for the referenced unsigned-message preview; future landing cost is not guaranteed. These current figures do not reconstruct historical execution costs or alter the frozen sensitivity assumptions.`, ``,
    `| Asset | Current round-trip quote loss USDC | Buy message lamports | Sell message lamports | Round-trip network USD | Recoverable rent SOL |`,
    `|---|---:|---:|---:|---:|---:|`);
  for (const c of currentExecutionCostSnapshot.costs) md.push(`| ${c.label.split(" ")[0]} | ${c.roundTripQuoteLossUsdc} | ${c.buyMessageFeeLamports} | ${c.sellMessageFeeLamports} | ${c.networkRoundTripUsdAtSnapshot} | ${c.recoverableRentSol} |`);
  md.push(``, `Recoverable rent is separately funded locked capital, excluded from expenses. Negative sequential quote loss is not evidence of arbitrage or expected profit.`, ``);
}
await writeFile(`${dir}/history-report.md`, md.join("\n"));
