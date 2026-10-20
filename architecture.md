# BELAC.FUN — END-TO-END TECHNICAL ARCHITECTURE
**Version:** 1.0 | **Date:** 20 October 2026 | **Status:** Implementation blueprint

## 1. Executive decision record
Belac.fun is a public, independently operated 30-day experiment: ten separate $10 USD strategy allocations, ten distinct DeFi venues, measurable net returns, and a parallel audience-growth campaign. It is NOT a custodial trading app, public investment product, recommendation engine, or automated execution service. The platform publishes verified outcomes, provenance, public editorial commentary and daily/weekly videos. A dedicated admin workspace records decisions, positions, overrides and content.

**Fixed infrastructure:** React + TypeScript + Vite on Cloudflare Pages; Node.js + TypeScript API on Railway; PostgreSQL on Railway; Cloudflare R2 only for uploaded creative assets. Suggested operational dependencies: Redis only if warranted by load; Cloudflare WAF/Turnstile; RPC/indexing and price sources selected by coverage and cost. Avoid introducing queues, microservices or realtime message infrastructure until necessary.

**Non-negotiable properties:** USD-based accounting with separate SOL return; explicit as-of times; inspectable source evidence; no invented live data; no secret keys in front end or database; admin writes audited; deterministic rebuild of metrics; accessible mobile-first pages; cacheable and SEO-friendly public content; controls against falsified balances; graceful outages.

## 2. Scope, personas, and release boundaries
### Public personas
- Casual visitor from X/TikTok: wants the experiment explained in under five seconds and immediately sees total P&L.
- Crypto-native trader: wants fees, sources, entry prices, snapshots, tx signatures and strategy mechanics.
- Protocol/community team: wants their featured page, provider mentions, performance context and correct attribution.
- Returning follower: wants what changed since their last visit and the newest recap.
- Site operator/editor: wants safe daily intake, data review, schedule and measured content outcomes.

### MVP P0
Home, 10-challenge leaderboard, challenge detail, timeline, methodology, proof links, USD and SOL accounting, manual/provider/on-chain intake, evidence records, pricing/snapshot jobs, CMS-lite media publishing, auth/admin, read APIs, basic SEO/analytics, error observability, responsive and accessible UI.

### P1
Event comparison charts, automated provider connectors, controlled exports, social referral attribution, richer metadata, newsletter opt-in with lawful consent, video subtitles/transcripts, status page.

### Excluded until deliberately approved
Trading or wallet-signing; custodial deposits; reader wallet connect; paid membership; public user portfolios; leaderboards for readers; programmatic gambling transactions; social scraping in breach of platform terms; referral/incentive schemes; affiliate monetisation without disclosures; automated social posting without review.

## 3. System context
```text
 Visitors / X / TikTok / Shorts
           |
     belac.fun (Cloudflare DNS/WAF)
           |
   Cloudflare Pages: Vite SPA + pre-rendered public routes
           | HTTPS JSON / SSE optional
    api.belac.fun -> Railway Node API (Fastify)
           |             |               |
       Postgres       Object links      RPC / Indexer / Price APIs
           |             |               |
    ledger + audit      R2 assets       Solana + partner integrations
           ^
 Railway scheduled reconciliation / snapshot job (UTC; >=5 min)
           ^
 Admin browser -> OIDC/session -> protected REST endpoints
```

**Deployment layout:** `belac.fun` Pages (production); `preview.belac.fun` optional; `api.belac.fun` via Cloudflare-proxied Railway custom domain; `cdn.belac.fun` only if a public R2 custom domain is needed. Prefer direct Pages assets for icons/logos and R2 for uploaded original video thumbnails/stills/OG images, not as a mandatory MVP dependency. Videos should be hosted on a suitable video platform and embedded; use R2 for small clips only after evaluating delivery and transformation requirements.

## 4. Recommended codebase layout
Monorepo with pnpm workspaces:
```text
/apps/web            Vite + React + TypeScript + React Router
/apps/api            Fastify + Zod + OpenAPI + logging
/apps/jobs           shared Node CLI: ingest/reconcile/snapshot
/packages/contracts  shared Zod DTOs, enums, units, API contracts
/packages/db         Drizzle schema, migrations, SQL, seed
/packages/finance    deterministic accounting, rounding, valuation
/packages/ui         components, tokens, icons, chart wrappers
/packages/config     eslint, tsconfig, environment validators
/infra               Railway/Cloudflare config + deployment notes
/docs                ADRs, runbooks, privacy, source definitions
```
Run tests and typecheck in CI; lock dependencies and only promote checked builds. Use explicit versions, no floating production dependencies.

## 5. Reference stack and deployment
- Web: React, TypeScript, Vite, React Router, TanStack Query; Zustand only if app complexity demands it; lightweight chart library with accessible data table fallback; CSS variables + Tailwind or vanilla CSS (one styling strategy).
- API: Fastify, TypeScript, Zod schema validation, `@fastify/swagger`/OpenAPI, structured logging, health checks, rate limits, explicit CORS allowlist; no secrets leaked to client.
- DB: PostgreSQL, Drizzle ORM and SQL migrations, connection pool sized for Railway resources. Use `NUMERIC` for monetary quantities, never IEEE floats for ledger values.
- Auth: single-admin OIDC or passkey-capable managed identity; session via secure HttpOnly cookie, CSRF controls, MFA, strict role `owner`/`editor`/`viewer`. No public accounts in MVP.
- Infra: Cloudflare Pages Git deploy + preview deployments; Railway persistent API service, Postgres, and one job service triggered by scheduler. Railway schedules are UTC; design jobs to exit, support reruns, and recover skipped intervals.
- Observability: request IDs, structured Railway logs, exception tracking, uptime check, cron heartbeat, stale-data alerts; API version header.
- Assets: R2 signed direct uploads from admin after API grants permission, MIME/type size validation, asynchronous malware scanning if third-party uploads ever allowed, immutable hashed filenames, CDN cache.

## 6. Canonical domain model
**Campaign** has start/end UTC, `USD` start budget of 100, reporting base currency, policy version and lifecycle (`draft`, `scheduled`, `active`, `frozen`, `closed`).

**Challenge** is exactly one platform-strategy experiment with `allocation_usd=10`, slug, editorial intro, order, constraints, provider, opening snapshot, state (`planned`, `live`, `paused`, `closed`, `invalidated`), and start/end. Each challenge has a dedicated wallet/account or an explicit attribution method; never double count assets that back another strategy.

**Provider** has name, official URL, verified public X handle, social URLs, on-chain program identifiers if known, jurisdiction/availability assessment, fee description, integration grade and last-reviewed timestamp. Provider assignment can change prelaunch; postlaunch changes become disclosed revisions.

**Account** records chain, wallet public address or anonymised off-chain account ID, ownership attestation, chain network and account type. An account may support multiple challenges only with ledger-level allocation tags and reconciliation rules.

**Ledger event** is immutable and append-only: `deposit`, `withdrawal`, `buy`, `sell`, `swap`, `fee`, `borrow`, `repay`, `interest`, `reward`, `funding`, `liquidation`, `lp_add`, `lp_remove`, `realized_pnl_adjustment`, `correction`. Model transaction legs in an associated entry table for precise assets, inflow/outflow, valuation and costs. No direct editing; corrections reverse earlier entries and explain why.

**Position** is derived from events where possible; external venue balances are reconciled as snapshots, not assumed to be on-chain. Fields: challenge, instrument/market, asset, quantity, cost basis, mark price, notional, collateral, debt, funding, liquidation price where available, realization state and last-sync time.

**Price observation**: asset ID, quote currency, oracle/source, observed timestamp, ingested timestamp, price, confidence/freshness flags and API response reference. **Valuation snapshot**: challenge, time bucket, total equity USD, starting capital, net external cash flow, realised/unrealised P&L, returns, source quality and calculation version.

**Source record** stores chain tx signature/slot, provider activity ID/API response pointer, explorer URL, manual screenshot proof, or operator attestation; classification `verified_onchain`, `verified_provider`, `manual_evidence`, `unverified`. Reconciliation results and conflicts must be first-class objects.

**Content** comprises daily update, weekly recap, provider story, short video and site note; has draft/published state, scheduled/published time, primary provider, thumbnails, captions, transcript, canonical URL, hashtags and social post links. **Social metrics** contain platform, post ID, observed_at, impressions/views/likes/reposts/comments/clicks/followers and `method` (official API, operator import, manual) with source freshness.

**Audit event** stores actor, action, object ID, prior/new diff or reference, time, IP fingerprint and reason for changes. **Job run** stores name, watermark, started/completed times, status, failures and record counts.

## 7. PostgreSQL logical schema
```text
campaigns(id PK, slug UQ, name, starts_at, ends_at, state, policy_version, base_currency)
providers(id PK, slug UQ, name, homepage_url, x_handle, status, verified_at)
challenges(id PK, campaign_id FK, provider_id FK, slug UQ, strategy_type, state,
           allocation_usd NUMERIC(24,8), begins_at, ends_at, published_at, rank_order)
accounts(id PK, challenge_id FK, chain, public_address, external_account_ref, visibility)
assets(id PK, chain, mint_or_symbol, symbol, decimals, pricing_key, UNIQUE(chain,mint_or_symbol))
source_records(id PK, challenge_id FK, source_type, external_id, external_url, status,
               observed_at, fetched_at, payload_hash, metadata_jsonb, UNIQUE(source_type,external_id))
ledger_events(id PK, challenge_id FK, source_id FK, event_type, effective_at, recorded_at,
              external_key, reversal_of, status, UNIQUE(challenge_id,external_key))
ledger_entries(id PK, event_id FK, asset_id FK, signed_amount NUMERIC(38,18),
               value_usd NUMERIC(24,10), cost_usd NUMERIC(24,10), leg_type)
positions(id PK, challenge_id FK, instrument_key, asset_id FK, state, opened_at, closed_at)
position_snapshots(id PK, position_id FK, observed_at, quantity, mark_usd, collateral_usd,
                   debt_usd, unrealized_pnl_usd, liquidation_usd, source_id FK)
price_observations(id PK, asset_id FK, source_name, observed_at, price_usd, confidence_jsonb)
valuation_snapshots(id PK, challenge_id FK, observed_at, equity_usd, pnl_usd, pnl_pct,
                    quality, calc_version, UNIQUE(challenge_id,observed_at,calc_version))
reconciliation_issues(id PK, challenge_id FK, severity, kind, detail_jsonb, state, opened_at)
content_posts(id PK, campaign_id FK, challenge_id FK NULL, slug UQ, content_type,
              title, body_md, status, scheduled_at, published_at, cover_asset_id)
media_assets(id PK, r2_key UQ, mime, bytes, sha256, width, height, alt_text, state)
social_posts(id PK, content_id FK, platform, url, remote_post_id, published_at)
social_metric_snapshots(id PK, social_post_id FK, measured_at, views, impressions,
                        reposts, likes, comments, profile_visits, clicks, provenance)
users(id PK, identity_provider_sub UQ, role, state)
audit_events(id PK, actor_id FK, action, target_type, target_id, reason, created_at, diff_jsonb)
job_runs(id PK, job_name, window_start, window_end, state, attempts, completed_at, metrics_jsonb)
```
Indexes: ledger `(challenge_id,effective_at DESC)`, prices `(asset_id,observed_at DESC)`, snapshot `(challenge_id,observed_at DESC)`, content `(status,published_at DESC)`, source `(external_id)`. Use JSONB for raw/provider-specific metadata only; never hide canonical ledger numbers in JSONB. Use DB constraints: nonnegative allocation, allowable enums, foreign keys, unique import keys, and integrity checks.

## 8. Accounting rules and difficult cases
**Definition:** `equity_usd = cash_usd + token_marks + LP_claim_value + venue_collateral + unsettled_realised_receivables - loans - liabilities`. Avoid counting both deposited collateral and the position's gross notional. For perp venues use provider-reported account equity when independently reconcilable, not collateral + unrealised P&L twice. For each challenge `net_pnl_usd = ending_equity_usd - starting_equity_usd - net_external_contributions_usd`. Net contributions are zero under normal challenge rules; external transfers are still recorded. `return_pct = net_pnl_usd / starting_equity_usd * 100`. Campaign total is sum challenge equity, once only.

Funding, borrow interest, gas, platform trade fees, exit fees and realized LP impermanent-loss exposure must be reflected. Show a separate gross vs net view if data supports it. Mark-to-market for illiquid tokens should show unreliable/exitability warnings, optional executable exit quotes for small positions, and never imply the last price guarantees exit proceeds. LP value includes both token reserves and earned-but-uncollected fees according to integration method. Derivatives may liquidate to zero and positions may exceed $10 notional; disclose leverage separately.

**USD comparability:** fix initial allocations using actual executed trades; retain token quantities and timestamps. Report SOL-denominated performance as a second view using a fixed, documented convention. Snapshot timing: 1–5 minutes if reliable, hourly history, daily close at a specified UTC timestamp. Display `as of` in the user’s local timezone; backend stores UTC. Distinguish `update delayed`, `awaiting confirmation`, `manual`, `stale`, and `disputed` snapshots. Late settlement produces historical correction events, never silent dashboard rewriting.

**Quality gates:** no showing `LIVE` if the latest verified snapshot exceeds the declared SLA; show `indicative` for manual/price-only valuations. Freeze challenge when reconciliations exceed tolerance; alert operator. Preserve provenance and original raw reference checksum. Exact dollars should use decimal formatting with 2 or 4 places depending on magnitude; round at presentation, not calculation.

## 9. Provider connector contract
Adapters in `/apps/jobs/src/adapters/{provider}` implement:
```ts
interface ProviderAdapter {
  id: string;
  capabilities: ('tx'|'positions'|'balances'|'fees'|'funding'|'market_data')[];
  fetchActivity(ctx: SyncContext): Promise<NormalizedActivity[]>;
  fetchEquity?(ctx: SyncContext): Promise<EquityObservation>;
  validate?(ctx: SyncContext): Promise<ReconciliationFinding[]>;
}
```
Three integration levels: **A** on-chain verifiable with tx links and reconstructed balances; **B** documented third-party API read data with evidence and periodic cross-checks; **C** manual import and attestation with explicit labels. Never falsely label API data as independently verified. Start each connector with a provider discovery document: supported network, public read access, ToS, minimum deposit/order, wallet attribution, realized fees, order semantics, edge cases, pagination, rate limits and legal availability in WA/Australia. No private-key collection; provider-required logins stay with operator in their own platform.

**Solana ingest:** use `getSignaturesForAddress` for discovered wallet activity and `getTransaction` for confirmed tx details, bounded pagination, commitment policy and indexer fallback; map instruction/program effects to normalized ledger events. Preserve raw tx signature, slot, instruction indices and token balance deltas; be cautious about a wallet hosting unrelated activity. Do not assume every CEX/perp deposit is fully observable after transfer. For derivatives, obtain periodic equity and funding from supported provider APIs or manually import auditable statements.

**Price adapter:** use at least one primary reliable market data API with a fallback and freshness threshold, chain/mint identity, duplicate symbol protection, cache and 429 handling. Pricing choices and liquidity confidence should be transparent.

## 10. Jobs, update cadence, and event processing
- Every 1–5 minutes (if supported): fetch current balances/prices for active challenges; upsert deduplicated observations; mark degraded if unavailable.
- Every 15 minutes: transaction sync by account and per-provider watermark; reconcile against expected positions.
- Hourly: materialize history bucket snapshots, compute drift, flag anomalies, update public cache.
- Daily UTC close: immutable close snapshot, social engagement import/review, new editorial prompt.
- Weekly: create a frozen leaderboard revision and generate export-ready recap dataset; never auto-publish editorial copy unreviewed.

Railway jobs: a standalone CLI job service invoked by Railway cron (which supports UTC schedules) or one lean always-on worker for sub-five-minute polling. Ensure concurrency locks through DB advisory lock, retry with exponential backoff, idempotent operations, and a resume watermark. Jobs must finish and exit if cron-based. Add job execution heartbeat and dead-run detection.

## 11. Public API specification (v1)
All endpoints under `/v1`; response envelope `{data, meta:{asOf, quality, requestId}}`, errors `{error:{code,message,requestId}}`. Only include real sources. Cache responses with ETags and CDN-safe public headers.
```text
GET /health/live ; GET /health/ready
GET /v1/campaigns/current
GET /v1/campaigns/:slug/summary
GET /v1/campaigns/:slug/leaderboard?metric=pnl_usd|return_pct&asOf=
GET /v1/campaigns/:slug/timeline?from=&to=&granularity=hour|day
GET /v1/challenges/:slug
GET /v1/challenges/:slug/snapshots?from=&to=&cursor=
GET /v1/challenges/:slug/transactions?cursor=&pageSize=
GET /v1/challenges/:slug/positions
GET /v1/challenges/:slug/sources
GET /v1/providers/:slug
GET /v1/content?type=&challenge=&cursor=
GET /v1/content/:slug
GET /v1/site/status
```
Admin operations, behind auth, MFA and CSRF:
```text
POST /v1/admin/challenges; PATCH /v1/admin/challenges/:id
POST /v1/admin/sources/import; POST /v1/admin/ledger/events
POST /v1/admin/reconciliations/:id/resolve
POST /v1/admin/media/upload-intent; POST /v1/admin/media/complete
POST /v1/admin/content; PATCH /v1/admin/content/:id; POST /v1/admin/content/:id/publish
POST /v1/admin/jobs/:name/run (owner only, rate limited)
GET /v1/admin/audit; GET /v1/admin/jobs; GET /v1/admin/quality
```
Use keyset pagination, avoid unrestricted date ranges, cap payload size; add per-route OpenAPI examples and generated typed client. Optional public SSE `/v1/campaigns/current/stream` only after data demand justifies it; polling at 60 seconds is fine initially.

## 12. Example read DTO
```json
{
  "data": {"slug":"spot-hold","provider":{"slug":"jupiter","name":"Jupiter"},
    "allocationUsd":"10.00","equityUsd":"10.74","netPnlUsd":"0.74",
    "returnPct":"7.40","asOf":"2026-10-20T02:00:00Z",
    "quality":"verified_onchain","status":"live", "isIllustrative":true},
  "meta":{"asOf":"2026-10-20T02:00:00Z","quality":"verified_onchain","requestId":"demo"}
}
```
Decimal financial values serialized as strings. Example numbers are fictional and must never be shown as real data.

## 13. Admin workflows and editorial pipeline
1. Configure campaign policy and ten placeholder challenges in draft.
2. Vet provider and min-size, T&Cs, geographic availability and data access; approve or replace.
3. Record `allocation` and trade execution with links/screenshots; require ownership and no duplicate allocations.
4. Reconcile source-derived balances against admin statements; show validation dashboard.
5. Publish challenge pages only after opening proof is present or mark clearly `not started`.
6. Produce daily video, upload thumb/alt/captions, write brief summary, tag verified official account, schedule externally via Postiz/manual channel.
7. Enter immutable social post URLs; import API statistics when legally accessible; otherwise clearly mark manually entered.
8. At weekly close generate frozen recap snapshot and publish editorial recap.
9. At challenge close, record liquidation or final mark policy, final export and corrections disclosure.

Admin screens: campaign setup, providers, challenges, asset/account mapping, reconciliation inbox, event importer, price coverage, content studio, media library, social metrics, audit log, system status. Prevent publishing while severe reconciliation issues remain unless owner explicitly overrides and publishes a warning.

## 14. Security, reliability, privacy and compliance
**Security:** public read-only site; no custody, private keys, seed phrases or wallet signing; origin CORS allowlist; admin OIDC + MFA; role checks on server; CSRF protection; signed URL uploads; input validation; rate limiting; service-to-service secret management; dependency scans; restrictive CSP with allowlisted embeds; database least privilege; no user-supplied HTML without sanitization; Secrets on Railway, not Vite env exposed to client. Backups and documented restoration tests. Access logs redact tokens and personal data.

**Reliability:** one availability target defined for API and dashboard (e.g. 99.5% launch SLO); recovery objectives defined and tested; Postgres scheduled backups/PITR capability checked against plan; 90-day snapshots retained or indefinitely while historical campaign remains public; original evidence retained per published retention policy. Daily restore-validation for critical data where affordable; protect against double-counting and source changes.

**Legal/editorial:** this is an educational personal experiment, not financial advice. Do not imply expected profits or solicit users to copy trades. Correctly disclose promotions, gifted access, sponsored features, affiliates and material conflicts. Gambling, prediction markets, leveraged perps and jurisdiction restrictions require an explicit legal availability gate before publishing a referral or transaction tutorial. Australia-specific restrictions are not bypassed. Publish methodology, complete losses, conflicts and corrections.

**Privacy/analytics:** privacy policy and cookie/consent requirements based on actual tracking tools; do not expose IP addresses, sensitive metadata or private exchange login identifiers. Cloudflare Web Analytics or privacy-respecting alternative as baseline; outbound UTM parameters and internal referral IDs should avoid personal data.

## 15. SEO and distribution architecture
A purely client-rendered Vite SPA may provide inconsistent social previews/search discoverability. Choose build-time prerender or an SSR/edge-render approach for home, provider, challenge and article routes, including fully resolved OG images, titles, descriptions, canonical URLs and structured data (Article, VideoObject, BreadcrumbList only when applicable). Dynamic numbers load client side, but HTML shell contains a timestamped summary with clear `as-of` label. Implement sitemap, robots, 404 and redirect management; route deep links correctly through Pages fallback.

OpenGraph asset generation: branded static templates and image capture in build/job, published immutable to R2 if necessary. Social links must remain canonical, and video embeds should load lazily with accessible poster/transcript. Coordinate X UTM attribution by provider/episode. Measure visitors, provider CTA taps, recap watches and return visits; no automated impersonation or unsupported claims about engagement.

## 16. Performance, accessibility and testing
Targets: LCP under 2.5 sec on typical mobile 4G, CLS under 0.1, INP under 200ms where feasible; visible numbers update no more often than cadence warrants. Ship initial route bundle lightweight; lazy-load charts/admin/media. Provide low-motion and data-table equivalents. Test WCAG 2.2 AA: contrast, keyboard navigation, focus, alt text, chart summaries, ARIA live regions not announcing every price tick, accessible error statuses, touch targets.

Testing pyramid: finance unit/property tests and invariant tests; contract/OpenAPI tests; provider adapter fixtures; PostgreSQL integration tests; end-to-end smoke/critical flows with Playwright; mobile visual snapshots; accessibility CI; security tests for auth, tenantless ACL, upload abuse, race conditions. Finance tests MUST cover partial fills, fees in another token, LP deposits/withdrawals, reorg/late transactions, liquidation, token decimals, negative balance, stale prices, unknown source, double spend/double counting and manual corrections.

## 17. Environment contract and CI/CD
Environments `local`, `staging`, `production` isolated databases/buckets. Frontend: `VITE_API_BASE_URL`, `VITE_APP_ENV`, public analytics ID only. Server: `DATABASE_URL`, `OIDC_*`, `SESSION_SECRET`, `SOLANA_RPC_URL`, `PRICE_API_*`, `R2_*`, `ALLOWED_ORIGINS`, `SENTRY_DSN`, `CRON_LOCK_NAMESPACE`. Validate at boot; no secrets in git. Feature flags for source connectors and public publishing.

GitHub Actions or equivalent: lint/typecheck/test -> build -> migrations checked -> staging deploy + smoke -> approval -> production API migration/deploy -> Pages build/deploy -> postdeploy health. Use backwards-compatible expand/contract migrations and backups before destructive changes. Roll back application release; do not assume database migrations reverse automatically.

## 18. Milestones and acceptance gates
**M0 Foundation:** repo, env, auth, schemas, CI, Pages/Railway integration, seeded synthetic campaign. Gate: reproducible staging release.
**M1 Accounting:** ledger, deterministic finance engine, sources, assets/prices, reconciliation, unit tests. Gate: fixed fixture balance within cents and no duplicate import.
**M2 Public website:** home/leaderboard/challenge/timeline/methodology/content, SEO, responsive design. Gate: passes accessibility/performance smoke.
**M3 Admin + content:** admin authoring, proof import, image R2, audit, video embeds, social links. Gate: end-to-end opening trade -> proof -> public snapshot -> social post trace.
**M4 Connectors + launch:** chain/venue adapters by feasibility, alerts, backups, monitoring, publication checks. Gate: every launched provider has known availability, fee/minimum and verifiability grade.
**M5 Campaign operations:** daily reports, frozen weekly rankings, exports, dispute handling and closure. Gate: complete reproducible final snapshot with cash-flow reconciliation.

## 19. Open decisions requiring explicit operator sign-off
- Exact ten providers/strategies and their Australian legal/service availability (research shortlist is not final approval).
- Which wallets/accounts will be dedicated to each strategy; whether any off-chain providers expose read-only data.
- Preferred schedule: launch date, 30-day day boundary, 1-min vs 5-min freshness, daily close timezone.
- Asset pricing source(s), stablecoin treatment, fees/exchange rates and illiquid asset valuation.
- Design brand palette and whether the operator wishes to use Belac Media visual marks.
- Social data ingestion permissions/quotas and content scheduling integration level with Postiz.
- Domain DNS ownership, Railway region, API custom domain, R2 necessity, expected traffic budget.

## 20. Operational notes verified 20 October 2026
- Railway cron schedules are evaluated in UTC, have a five-minute minimum interval, can run a few minutes late, and may skip the next invocation if a previous one is still running. Implement job idempotency, short-lived execution, persistent run logs, and alerting. Source: https://docs.railway.com/guides/cron-workers-queues
- Cloudflare Pages supports React single-page apps and deployments from Git; per-route Open Graph/social metadata requires prerendering or an appropriate rendering layer rather than relying exclusively on browser-side route changes. Source: https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- Cloudflare R2 supports server-generated presigned URLs for direct client upload; restrict object, content type, size, expiry and admin authorization. Source: https://developers.cloudflare.com/r2/objects/upload-objects/

## 21. Official implementation reference links
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Vite Pages deployment: https://vite.dev/guide/static-deploy.html
- Railway service model: https://docs.railway.com/services
- Railway PostgreSQL: https://docs.railway.com/databases/postgresql
- Railway worker/cron patterns: https://docs.railway.com/guides/cron-workers-queues
- Solana getTransaction: https://solana.com/docs/rpc/http/gettransaction
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/get-started/

**Design principle:** build a trusted publishing and accounting system before expanding into richer protocol coverage. A clear manual record is better than a misleading 'live' number.
