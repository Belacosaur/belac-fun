# Research worker

The private `research-worker` service shares the existing Railway project's Postgres with the API and wallet sync worker. It cannot sign, build transactions, submit orders or activate execution. Ript is always pending with its $10 reserved and no Ript network requests.

## Running and retrieving research

From the repository root in PowerShell:

```powershell
$env:EXPERIMENT_WALLET_ADDRESS='HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j'
$env:EXECUTION_ENABLED='false'
node --import ./apps/jobs/node_modules/tsx/dist/loader.mjs apps/jobs/src/research-cli.ts --output artifacts/research
```

Each invocation writes UUID-named JSON and Markdown reports; it never trades. Add `--persist` with a configured database URL to save the run and source observations transactionally. Do not expose database credentials in commands or reports. The deployed worker performs the first scan at startup, then refreshes daily by default (`RESEARCH_INTERVAL_MS=86400000`, clamped to 1 hour–7 days). It resumes the remaining cadence after restarts and uses a wallet-scoped advisory lock to avoid overlapping service scans. Daily collection supports a human weekly review; it is not continuous risk monitoring or automatic weekly trading.

Read-only routes, protected by the existing admin authentication:

- `GET /v1/admin/research/latest` — full saved report, policy, raw public observations, freshness metadata.
- `GET /v1/admin/research/history` — latest 20 run summaries for the configured public wallet.

Private worker endpoints: `/health/live` and `/research/status`. No public domain is configured. For operators already connected through Railway SSH, `node --import ./apps/jobs/node_modules/tsx/dist/loader.mjs apps/jobs/src/research-export.ts` exports the latest persisted JSON; append `--markdown` for the human report. Exporting does not scan or change positions.

## What v1 actually evaluates

- Shared top-100 Jupiter token discovery plus exact core mint metadata. Preliminary filters: $500k liquidity, $100k 24h volume, provider organic score >=60, reported top-holder concentration <=30%, mint/freeze authority checks, and pool age >=30 days (7 days for graduated Pump tokens). These are screening heuristics, not demonstrated profitable thresholds. Token-2022 extension checks and independent on-chain audit remain entry blockers.
- $10 USDC buy and hypothetical output-quantity sell quotes on Jupiter and Raydium for a bounded shortlist. Identity/amount/route validation, price-impact and round-trip-loss caps. No transaction construction. Quotes exclude account rent/network costs and can reflect market movement between requests. Negative quote loss is not claimed arbitrage.
- Six completed daily Coinbase price series: SOL, BTC, ETH, Jupiter (`JUPITER-USD`, **not** the delisted unrelated `JUP-USD`), BONK and WIF. Exact spot mint-to-product mappings currently exist only for SOL and Jupiter. Perps can use documented market symbols as spot-price proxies, with venue/basis limitations stated. Assets without verified history fail active entry gates.
- A fixed 20-day-high/50-day-SMA long-entry and 10-day-low/20-day-SMA exit diagnostic, next-open fills, 25bps per side with 50bps sensitivity, cash and hold benchmarks, drawdown and round-trip counts. No optimization, holdout claim, short/perps backtest, liquidation simulation or proof of edge. Current-universe selection has survivorship bias. The daily series must be contiguous and reach yesterday's completed UTC candle.
- All listed Pacifica market metadata/prices, books for core plus two weak liquid markets. Short candidates need a completed-day 20-day downward breakout and downward trend. One-day weakness and positive funding alone do not qualify. No leverage, loss limit, stops or notional size is inferred from a minimum order.
- Three Jupiter Perps markets, with price/volume and historical signal screening. Borrow costs, collateral after fees and liquidation/setup previews remain pending.
- First 50 Orca and first 50 Meteora DLMM pools by TVL. Initial eligible assets are exact SOL/USDC/USDT mints. Pool-level fees are recorded as pool metrics; expected return on our concentrated position stays unknown. Range, active tick/bin distribution, issuer/depeg risks, costs and comparison against holding deposited assets remain entry blockers. Orca supplies 7d/30d fee metrics; DLMM history collection remains a gap.
- USDC reserves in the first 12 official non-curated Kamino markets, filtering supply depth >=$1m and utilization <=95%, then ranking current base APY. Constant-rate seven-day gross-dollar yield is a scenario, not a forecast; rewards, withdrawal liquidity, deposit caps, historical rates and setup costs remain separate/unknown.
- Own-token launch is a readiness assessment: owner metadata, distribution, demand and economics pending. No token is created.

All ten stations receive a decision. In v1 all active stations are **WAIT** and all candidates have `entryEligible=false`; Ript is **PENDING**. Shortlisted means worth further investigation. There is no strategy attribution yet, so KEEP/REPLACE cannot be derived from current wallet balances.

## Reliability and evidence

Only exact HTTPS GET endpoint patterns are allowed. Redirects are disabled; Ript, signing, transaction building and submission endpoints are absent. Requests share a three-request concurrency limit, Jupiter pacing, bounded retries/backoff, a 150-attempt budget, 12-second network deadline and 4MB decompressed response cap. Duplicate in-flight URLs share one read. API keys are optional private headers and are excluded from evidence/errors.

Every observation retains its retrieval timestamp, public URL, raw payload, SHA-256 response hash or sanitized failure. Invalid provider envelopes, missing/stale/future retrieval timestamps and failed calls make the report partial. Source retrieval age is limited to 15 minutes; quote age to 60 seconds during evaluation. Source-native timestamp checks and completed-candle checks also apply. Reports expire for review in 24 hours; every market input must still be refreshed before any separately approved action.

Runs and observations are inserted atomically in additive tables `research_runs` and `research_observations` (migration0008). Reports are not overwritten; the API only reads saved results. The first policy was `research-v1.0.0`; `research-v1.0.1` corrects Jupiter price-impact ratio-to-percent conversion and the JUPITER history display label. The original JUP history URL already used JUPITER-USD. Future changes must increment the version before comparing performance; never silently tune rules to make an old backtest win.

## Shortlist diligence

The separate, operator-run diligence modules in `apps/jobs/src/diligence/` add exact-mint authority/holder checks, longer fixed-rule history diagnostics, LP identity/range/rent checks and Kamino reserve/account lifecycle evidence. Their timestamped raw responses and reports live in `artifacts/diligence/`. They do not silently replace the immutable preliminary worker report or authorize a trade. Unlike the automated GET-only research pipeline, the cost diagnostics may call documented **unsigned instruction builders** and read-only `getFeeForMessage`; they have no signer or submission path.

Start with [the funding comparison](funding-review-2026-10-20.md). It distinguishes exact observed account/message quantities from future unknowns, recoverable capital from expenses, and a research preference from execution readiness. LP historical income, complete beneficial ownership and full deployed-code audit equivalence remain unverified. The new worker deployment `b957207d-bdb2-4fc9-b86b-4638cf83b973` reported SUCCESS; its first corrected production run is `ec943d55-1ecc-43c0-bd78-e3bd357e8167`.

## Sources

- [Jupiter token data](https://developers.jup.ag/docs/llms.txt)
- [Jupiter Perps API](https://perps-api.jup.ag/v1/docs)
- [Raydium Trade API](https://docs.raydium.io/raydium/traders/trade-api)
- [Pacifica market info](https://docs.pacifica.fi/api-documentation/api/rest-api/markets/get-market-info)
- [Orca API](https://docs.orca.so/api-reference/overview)
- [Meteora DLMM API](https://docs.meteora.ag/developer-guides/dlmm/api-reference/overview)
- [Kamino API index](https://kamino.com/docs/llms.txt)
- [Coinbase candle API](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles)
- [Pump official program documentation](https://github.com/pump-fun/pump-public-docs)
