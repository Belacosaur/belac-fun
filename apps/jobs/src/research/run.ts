import { randomUUID } from "node:crypto";
import type { ResearchCandidate, ResearchReport, ResearchSource } from "../../../../packages/contracts/src/research.js";
import { collectResearch } from "./collect.js";
import { evaluateHistory, finalizeStation, num, row, rows, screenLending, screenPool, screenToken, stale, text, type HistorySummary } from "./evaluate.js";
import { CORE, POLICY, SPOT_HISTORY, USDC } from "./policy.js";
import { ResearchClient } from "./transport.js";

function addHistory(c: ResearchCandidate, h: HistorySummary | undefined, symbol: string, active: boolean) {
  if (!h) {
    c.blockers.push("Verified continuous price history for this exact asset is missing.");
    if (active) { c.disposition = "rejected"; c.reasons.push("Required historical entry signal cannot be evaluated."); }
    return;
  }
  c.sourceIds.push(`history:${symbol}`);
  Object.assign(c.metrics, { historyProxy: `Coinbase ${symbol === "JUP" ? "JUPITER" : symbol}-USD daily; USDC basis and venue differences excluded`, historyBars: h.bars,
    completedCandleDate: h.lastDay, trend: h.trend, change7dPct: h.change7dPct, change30dPct: h.change30dPct,
    dailyVolatilityPct: h.dailyVolatilityPct, breakout20: h.breakout20,
    diagnosticEndUsd: h.backtest?.endUsd ?? null, diagnosticHoldUsd: h.backtest?.holdEndUsd ?? null,
    diagnosticCashUsd: 10, diagnosticRoundTrips: h.backtest?.roundTrips ?? null, diagnosticMaxDrawdownPct: h.backtest?.maxDrawdownPct ?? null,
    diagnosticCostStressEndUsd: h.backtest?.stressedEndUsd ?? null });
  c.blockers.push("Retrospective diagnostic uses current survivor selection and CEX prices; no holdout or out-of-sample edge established.");
  if (active && (!h.breakout20 || h.trend !== "up")) {
    c.disposition = "rejected"; c.reasons.push("No completed-day 20-day breakout above the 50-day trend filter.");
  }
  if (active) {
    c.plan.horizonDays = 7;
    c.plan.entry = "Hypothesis: completed-day close above prior 20-day high and 50-day SMA; next-session entry only after fresh costs and approval.";
    c.plan.exit = "Hypothesis: next-session exit after close below prior 10-day low or 20-day SMA; independent approved loss limit also required.";
  }
}

function addQuotes(c: ResearchCandidate, sources: ResearchSource[], venue: "jupiter" | "raydium") {
  const buy = sources.find(s => s.id === `quote:${venue}:${c.id}:buy` && s.status === "ok"), sell = sources.find(s => s.id === `quote:${venue}:${c.id}:sell` && s.status === "ok");
  if (!buy || !sell) { c.blockers.push(`Both $10 buy and hypothetical sell ${venue} quotes are required.`); return; }
  c.sourceIds.push(buy.id, sell.id);
  const b = row(venue === "raydium" ? row(buy.payload).data : buy.payload), s = row(venue === "raydium" ? row(sell.payload).data : sell.payload);
  const input = text(venue === "raydium" ? b.inputAmount : b.inAmount), output = text(venue === "raydium" ? b.outputAmount : b.outAmount);
  const sellInput = text(venue === "raydium" ? s.inputAmount : s.inAmount), sellOutput = text(venue === "raydium" ? s.outputAmount : s.outAmount);
  const routeB = venue === "raydium" ? b.routePlan : b.routePlan, routeS = s.routePlan;
  const identity = b.inputMint === USDC && b.outputMint === c.id && s.inputMint === c.id && s.outputMint === USDC;
  const valid = identity && input === "10000000" && /^[1-9][0-9]*$/.test(output) && sellInput === output && /^[1-9][0-9]*$/.test(sellOutput)
    && Array.isArray(routeB) && routeB.length > 0 && Array.isArray(routeS) && routeS.length > 0
    && (venue !== "raydium" || row(buy.payload).success === true && row(sell.payload).success === true);
  if (!valid) { c.disposition = "rejected"; c.reasons.push("Quote identity, amount, route or response validation failed."); return; }
  const recovered = Number(BigInt(sellOutput)) / 1e6;
  const lossPct = (10 - recovered) * 10;
  c.metrics.quoteRoundTripReturnedUsdc = recovered;
  c.metrics.quoteRoundTripLossPct = Number(lossPct.toFixed(8));
  c.metrics.quoteIncludesNetworkFees = false;
  c.metrics.quoteObservedAt = sell.fetchedAt;
  // Jupiter documents a decimal ratio: 0.001 means 0.1%, not 0.001%.
  const impacts = [num(b.priceImpactPct), num(s.priceImpactPct)].map(v => v === null ? null : venue === "jupiter" ? v * 100 : v);
  c.metrics.maxReportedPriceImpactPct = impacts.every(v => v !== null) ? Math.max(...impacts.map(v => Math.abs(v!))) : null;
  if (lossPct > POLICY.maxQuoteRoundTripLossPct || impacts.some(v => v !== null && Math.abs(v) > POLICY.maxPriceImpactPct)) {
    c.disposition = "rejected"; c.reasons.push("Executable round-trip loss or reported price impact exceeds screening cap.");
  }
  c.blockers.push("Quotes are hypothetical and sequential, exclude network/rent, can include market movement, and must be refreshed immediately before any approved trade.");
}

export function buildReport(sources: ResearchSource[], walletAddress: string, started = Date.now(), now = Date.now()): ResearchReport {
  // Preserve raw evidence, but do not treat a 200 response as validated market data.
  const validSchema = (s: ResearchSource) => {
    const p = s.payload;
    if (["tokens", "core-tokens", "pump-discovery"].includes(s.id)) return Array.isArray(p) && p.length > 0 && p.every(t => typeof row(t).id === "string");
    if (["orca", "meteora"].includes(s.id)) return Array.isArray(row(p).data) && rows(row(p).data).length > 0 && rows(row(p).data).every(t => !!text(t.address));
    if (s.id === "kamino-markets") return Array.isArray(p) && p.length > 0 && rows(p).every(t => !!text(t.lendingMarket));
    if (s.id.startsWith("kamino:")) return Array.isArray(p) && rows(p).every(t => !!text(t.reserve) && !!text(t.liquidityTokenMint));
    if (["pacifica-markets", "pacifica-prices"].includes(s.id)) return row(p).success === true && Array.isArray(row(p).data) && rows(row(p).data).length > 0 && rows(row(p).data).every(t => !!text(t.symbol));
    if (s.id.startsWith("jupiter-perps:")) return num(row(p).price) !== null && Number(row(p).price) > 0 && num(row(p).volume) !== null;
    if (s.id === "raydium-pools") return row(p).success === true && Array.isArray(row(row(p).data).data);
    if (s.id === "pump-program-docs") return typeof p === "string" && p.length > 100;
    return true;
  };
  const invalidSources = sources.filter(s => s.status === "ok" && !validSchema(s)).map(s => s.id);
  const staleSources = sources.filter(s => s.status === "ok" && stale(s.fetchedAt, now, s.id.startsWith("quote:") ? POLICY.maxQuoteAgeMs : POLICY.maxSourceAgeMs)).map(s => s.id);
  const usableSources = sources.filter(s => s.status === "ok" && !invalidSources.includes(s.id) && !staleSources.includes(s.id));
  const source = (id: string) => usableSources.find(s => s.id === id);
  const payload = (id: string) => source(id)?.payload;
  const missing = (...ids: string[]) => ids.filter(id => !source(id)).map(id => `Source unavailable or missing: ${id}.`);
  const histories = new Map<string, HistorySummary>();
  const historyGaps: string[] = [];
  for (const s of usableSources.filter(s => s.id.startsWith("history:"))) {
    try { histories.set(s.id.slice(8), evaluateHistory(s.payload, now)); }
    catch { historyGaps.push(`Invalid, stale or discontinuous candles: ${s.id}.`); }
  }
  const tokens = [...new Map([...rows(payload("tokens")), ...rows(payload("core-tokens"))].map(t => [text(t.id), t])).values()].filter(t => text(t.id) && t.id !== USDC);
  const spot = (active: boolean) => tokens.map(t => {
    const c = screenToken(t, now), core = SPOT_HISTORY.find(m => m.mint === t.id);
    if (core) addHistory(c, histories.get(core.symbol), core.symbol, active);
    else c.blockers.push("Token-specific historical candles and exact historical symbol/mint mapping are pending.");
    if (active && !core) { c.disposition = "rejected"; c.reasons.push("Active-trading entry requires a validated asset-specific historical signal."); }
    c.sourceIds = [...new Set([...c.sourceIds.filter(id => source(id)), ...(rows(payload("core-tokens")).some(v => v.id === t.id) ? ["core-tokens"] : [])])];
    addQuotes(c, usableSources, active ? "raydium" : "jupiter");
    if (!active) { c.plan.entry = "Choose one eligible asset for a fixed 30-day hold after risk review; no market-timing edge claimed."; c.plan.exit = "Day-30 close, or explicit security/invalidation emergency policy agreed before entry."; }
    return c;
  });

  const longs = CORE.map(m => {
    const data = row(payload(`jupiter-perps:${m.symbol}`)), h = histories.get(m.symbol);
    const c = screenToken({ id: m.mint }, now);
    c.label = `${m.symbol} long`; c.disposition = "shortlist"; c.reasons = [];
    c.sourceIds = [`jupiter-perps:${m.symbol}`];
    c.metrics = { marketMint: m.mint, markPriceUsd: num(data.price), change24hPct: num(data.priceChange24H), volume24hUsd: num(data.volume),
      proposedNotionalUsd: null, leverage: null, borrowCostUsd: null, liquidationPriceUsd: null, minimumCollateralUsd: 10 };
    c.blockers = ["Leverage and maximum loss are not approved.", "Exact borrow carry, price impact, opening/closing fees, collateral minimum after fees, liquidation and setup rent need an unsigned preview.", "No out-of-sample strategy validation; execution disabled."];
    addHistory(c, h, m.symbol, true);
    if (!source(`jupiter-perps:${m.symbol}`) || num(data.price) === null || Number(data.price) <= 0) { c.disposition = "rejected"; c.reasons.push("No valid current Jupiter market price."); }
    c.plan = { entry: "Investigate only a qualifying long breakout; size from approved loss limit, never leverage to bypass minimum collateral.", exit: "Approved stop, time exit and liquidation buffer required; monitor between weekly reviews.", horizonDays: 7, benchmark: "USDC cash and unleveraged same-asset holding" };
    return c;
  });

  const prices = rows(row(payload("pacifica-prices")).data), markets = rows(row(payload("pacifica-markets")).data);
  const shorts = markets.map(m => {
    const symbol = text(m.symbol), p = prices.find(p => p.symbol === symbol) ?? {}, h = histories.get(symbol);
    const c = screenToken({ id: symbol }, now);
    c.label = `${symbol} short`; c.assets = [symbol]; c.disposition = "shortlist"; c.reasons = [];
    c.sourceIds = ["pacifica-markets", "pacifica-prices"];
    const mark = num(p.mark), yesterday = num(p.yesterday_price), funding = num(p.funding), volume = num(p.volume_24h);
    c.metrics = { market: symbol, markPriceUsd: mark, change24hPct: mark !== null && yesterday !== null && yesterday > 0 ? (mark / yesterday - 1) * 100 : null,
      volume24hUsd: volume, minOrderNotionalUsd: num(m.min_order_size), hourlyFundingFraction: funding,
      // Show funding input, not an extrapolated weekly earnings forecast.
      netExpectedProfitUsd: null, approvedLeverage: null, spreadBps: null, bookDepthBidUsd: null, bookDepthAskUsd: null };
    c.blockers = ["Approve isolated/cross margin mode, leverage, loss budget, stop and liquidation buffer.", "Deposit minimum is 10 USDC; funded collateral, fees and order lot rounding need validation.", "Historical funding and an actual size-specific close/open cost preview are missing."];
    if (stale(p.timestamp, now, POLICY.maxTokenAgeMs) || mark === null || mark <= 0 || volume === null || volume < 100_000 || m.instrument_type !== "perpetual") {
      c.disposition = "rejected"; c.reasons.push("Missing fresh supported-market price or insufficient activity.");
    }
    if (!h || h.trend !== "down" || !h.breakdown20) { c.disposition = "rejected"; c.reasons.push("No verified completed-day downward breakout signal; one-day weakness is insufficient."); }
    if (h) { c.sourceIds.push(`history:${symbol}`); Object.assign(c.metrics, { historyBars: h.bars, trend: h.trend, breakdown20: h.breakdown20, change30dPct: h.change30dPct }); }
    const bookSource = source(`pacifica-book:${symbol}`), book = row(row(bookSource?.payload).data);
    const levels = Array.isArray(book.l) ? book.l : [], bids = rows(levels[0]), asks = rows(levels[1]);
    const bid = num(bids[0]?.p), ask = num(asks[0]?.p);
    if (bookSource && book.s === symbol && !stale(book.t, now, POLICY.maxTokenAgeMs) && bid !== null && ask !== null && bid > 0 && ask >= bid) {
      c.sourceIds.push(bookSource.id);
      c.metrics.spreadBps = (ask - bid) / ((ask + bid) / 2) * 10000;
      c.metrics.bookDepthBidUsd = bids.reduce((a, b) => a + Number(b.p) * Number(b.a), 0);
      c.metrics.bookDepthAskUsd = asks.reduce((a, b) => a + Number(b.p) * Number(b.a), 0);
    } else c.blockers.push("Current verified order book was not collected for this market.");
    c.plan = { entry: "Investigate a downward breakout using completed candles and verified book depth; no trade from ranking alone.", exit: "Approved stop/time exit and monitoring required; a stop does not guarantee a fill or cap losses.", horizonDays: 7, benchmark: "USDC cash; do not treat a simultaneous long as a free hedge" };
    return c;
  });

  const kaminoMarkets = rows(payload("kamino-markets")), lending: ResearchCandidate[] = [];
  for (const market of kaminoMarkets) {
    const id = text(market.lendingMarket);
    for (const r of rows(payload(`kamino:${id}`)).filter(r => r.liquidityTokenMint === USDC)) lending.push(screenLending(r, id, text(market.name)));
  }
  const pumps = rows(payload("pump-discovery")).filter(t => t.launchpad === "pump.fun").map(t => {
    const c = screenToken(t, now, true); addQuotes(c, usableSources, "jupiter"); return c;
  });
  const orca = rows(row(payload("orca")).data).map(p => screenPool(p, "orca", now));
  const meteora = rows(row(payload("meteora")).data).map(p => screenPool(p, "meteora", now));
  const stations = [
    finalizeStation(1, spot(false), [...missing("tokens", "core-tokens"), ...historyGaps, "Broad discovery is bounded to current top-traded tokens; survivorship/selection bias applies."]),
    finalizeStation(2, spot(true), [...missing("tokens", "raydium-pools"), ...historyGaps, "Exact-token historical mapping is limited to the configured mint/product registry."]),
    finalizeStation(3, longs, [...missing(...CORE.map(m => `jupiter-perps:${m.symbol}`)), ...historyGaps]),
    finalizeStation(4, shorts, [...missing("pacifica-markets", "pacifica-prices"), "History coverage is limited to six Coinbase spot proxies; unsupported markets fail the signal gate."]),
    finalizeStation(5, meteora, [...missing("meteora"), "Top 50 pools by TVL only, limited to exact SOL/USDC/USDT assets; bin-level simulation, security review and multi-week history pending."]),
    finalizeStation(6, lending, [...missing("kamino-markets"), ...kaminoMarkets.filter(m => m.isCurated === false).slice(0, 12).flatMap(m => missing(`kamino:${text(m.lendingMarket)}`)),
      "Reserve metrics from the first 12 non-curated markets only; history, source-state timestamp and caps/withdrawability require verification."], "Descending current base APY after reserve supply/utilization gates; not risk-adjusted expected profit"),
    finalizeStation(7, pumps, [...missing("tokens", "pump-discovery"), "Existing graduated Pump tokens only; token-specific history, independent on-chain audits and venue fee verification pending."]),
    finalizeStation(8, orca, [...missing("orca"), "Top 50 pools by TVL only, limited to exact SOL/USDC/USDT assets; exact range simulation and token due diligence pending."]),
    finalizeStation(9, [], ["Owner custom pack pending; $10 reserved. Ript is intentionally not polled."], "Not evaluated"),
    finalizeStation(10, [], [...missing("pump-program-docs"), "One-off launch readiness: name/symbol, immutable metadata, distribution, audience demand, launch economics and account costs require owner input. No token created."], "Launch readiness, not token selection"),
  ];
  const required = ["tokens", "core-tokens", "orca", "meteora", "kamino-markets", "pacifica-markets", "pacifica-prices", ...CORE.map(m => `jupiter-perps:${m.symbol}`)];
  return { version: 1, runId: randomUUID(), policyVersion: POLICY.version, policy: POLICY, startedAt: new Date(started).toISOString(), completedAt: new Date(now).toISOString(),
    reviewBy: new Date(now + POLICY.reportLifetimeMs).toISOString(), mode: "dry-run", executionEnabled: false, walletAddress,
    status: sources.some(s => s.status === "unavailable") || invalidSources.length > 0 || staleSources.length > 0 || missing(...required).length > 0 || historyGaps.length > 0 ? "partial" : "complete",
    capital: { strategyUsd: "100.00", perStationUsd: "10.00", riptReservedUsd: "10.00", solFeePool: "separate-unpriced" }, stations, sources,
    warnings: [...invalidSources.map(id => `Invalid provider schema: ${id}. Raw evidence retained; dataset excluded from evaluation.`),
      ...staleSources.map(id => `Stale, invalid or future retrieval timestamp: ${id}. Raw evidence retained; dataset excluded from evaluation.`),
      "All outputs are preliminary research. No candidate is entry-eligible, no transaction is built, signed or submitted.",
      "All non-Ript decisions are WAIT. No strategy holdings are attributed, so KEEP/REPLACE cannot be inferred from wallet balances.",
      "Thresholds are screening heuristics fixed before this run, not proven profitable rules. Current-universe selection introduces survivorship bias.",
      "Shared assets across stations can concentrate exposure. Review aggregate asset, stablecoin issuer and protocol exposure before funding.",
      "Unknown fees/rent/withdrawability are blockers, not zero. Separate SOL fee capital does not pay collateral-denominated protocol costs automatically.",
      "This report expires in 24h for review; quotes and market data need a new read immediately before any approved action. Perps/LPs require monitoring between weekly reviews."] };
}

export async function runResearch(walletAddress: string, options: { fetcher?: typeof fetch; jupiterApiKey?: string } = {}): Promise<ResearchReport> {
  const started = Date.now();
  const client = new ResearchClient(options.fetcher, options.jupiterApiKey);
  const sources = await collectResearch(client, started);
  return buildReport(sources, walletAddress, started, Date.now());
}
