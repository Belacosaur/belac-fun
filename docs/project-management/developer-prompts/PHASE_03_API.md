# Phase 3 developer prompts — public and admin HTTP

Context: API is the only financial source of truth. Envelope `{data, meta:{asOf, quality, requestId}}`. Errors `{error:{code,message,requestId}}`. Decimal strings. `isIllustrative: true` on the demo seed. Unknown challenge valuations are omitted from campaign equity and counted in coverage (see `RISK_REGISTER.md` assumption 3). Ties on the leaderboard share a rank and skip (1, 2, 2, 4).

Read architecture §11–12 and backlog API-01..API-07. Admin routes fail closed with 401 until ADM-01; you may add the plugin interface now and implement JWT verification in Phase 6, but do not leave admin routes open.

The routes below already exist and are not accepted. Execute `FIX_API_AUDIT.md` before API-05. Do not add OpenAPI or new admin features in that fix.

Order after the fix: API-05, then the remaining API-07 behavior. API-01, API-02, API-03, API-04, and API-06 stay open until FIX-01 passes.

### API-01
CORS allowlist from `ALLOWED_ORIGINS`. Zod errors use the error envelope. Rate limit default 60 requests per minute per IP, configurable. Baseline security headers. Tests via `app.inject`.

### API-02
`GET /v1/campaigns/current`, `/v1/campaigns/:slug/summary`, `/v1/campaigns/:slug/leaderboard?metric=pnl_usd|return_pct`. Read latest `valuation_snapshots`. Integration test on seeded Postgres. Demo responses include `isIllustrative: true`.

### API-03
`GET /v1/challenges/:slug` plus `/snapshots`, `/transactions`, `/positions`, `/sources`. Transaction cursor is keyset `(effective_at, id)`. `pageSize` max 100. Snapshot range over 400 days returns 400.

### API-04
`GET /v1/campaigns/:slug/timeline?granularity=hour|day`, `/v1/content`, `/v1/content/:slug`, `/v1/providers/:slug`, `/v1/site/status`. Empty lists are `{data:[]}` with 200. No SSE.

### API-05
OpenAPI via `@fastify/swagger`. Disable UI when `APP_ENV=production`. Spec includes every route you implemented.

### API-06
ETag and `Cache-Control: public, max-age=30` on summary and leaderboard. `If-None-Match` returns 304. Admin paths, when added, use `private, no-store`.

### API-07
Admin routes in architecture §11. Ledger writes are inserts. Publish returns 409 if a severe reconciliation issue is open, unless `{override:true}` and role `owner`, with an audit row. Media routes return 501. Job run is owner-only. Tests: 401 anonymous, 409 publish, reversal does not mutate prior amounts.

**Database:** FIX-01 adds `campaigns.is_illustrative` and `slug_redirects` because the API already depends on them. Further admin tables stay in ADM-02.

**Commands:** `pnpm --filter @belac/api test && pnpm typecheck`.

**Done when:** OpenAPI lists the public routes and illustrative seed is never returned without the flag. Next: INT-01.

Completion report required.
