# Task backlog

**60 tasks** (53 P0, 7 P1). Execute in the order below unless a dependency says otherwise. P1 tasks are scheduled after the P0 critical path and must not be dropped from the backlog.

**Progress on 20 October 2026**

Done: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, FIN-01, FIN-02.

Partial: API-01, API-02, API-03, API-04, API-06, API-07, INT-01, INT-02, INT-03, INT-05, INT-06, INT-07, WEB-01, WEB-02, WEB-09, WEB-10, ADM-01, PRD-01, PRD-02, PRD-05.

Not started: API-05, INT-04, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, ADM-02 through ADM-08, SOC-01 through SOC-05, P1-01, P1-02, P1-03, PRD-03, PRD-04.

Audit remediation **FIX-01** is the next task. It is not one of the 60. Spec: `developer-prompts/FIX_API_AUDIT.md`. Do not mark API-02, API-03, API-04, or API-07 done until that prompt’s tests pass.

The task text below is still the specification. Status lives in this list and in `PROJECT_STATUS.md`.

Shared definition of done for every task:

- Acceptance criteria checked.
- `pnpm typecheck` and `pnpm lint` pass (once those scripts exist; FND-01 creates them).
- Tests named in the task pass.
- No secrets, no live paid services, no illustrative numbers presented as real.
- Completion report appended to the developer’s hand-back (see `PROJECT_STATUS.md`).

Stack for every task: TypeScript, pnpm, packages in architecture §4. Drizzle for SQL. Zod for contracts. Fastify for HTTP. React + Vite for UI.

---

## Phase 1

### FND-01 — pnpm monorepo skeleton

- **Priority:** P0. **Depends:** none. **Requirements:** NFR-06, architecture §4.
- **Objective:** Create the workspace layout without business features.
- **Description:** Add `package.json` (private), `pnpm-workspace.yaml`, root `tsconfig` base, `.nvmrc` set to Node 22, `.gitignore` for env files, `node_modules`, dist. Create empty package manifests for `apps/web`, `apps/api`, `apps/jobs`, `packages/contracts`, `packages/db`, `packages/finance`, `packages/ui`, `packages/config`. Package names `@belac/web`, `@belac/api`, `@belac/jobs`, `@belac/contracts`, `@belac/db`, `@belac/finance`, `@belac/ui`, `@belac/config`. Root scripts: `typecheck`, `lint`, `test` that recurse. ESLint flat config and Prettier in `packages/config`. Add `infra/README.md` stating cloud resources are not created yet. Add `docker-compose.yml` with Postgres 16 only, credentials for local use documented as local-only.
- **Files:** repo root, `packages/config`, `infra/README.md`.
- **Architecture:** §4, §5. **UX:** none.
- **Acceptance:** `pnpm install` and `pnpm typecheck` succeed. No application routes yet.
- **Tests:** none beyond typecheck.
- **Verify:** `pnpm install && pnpm typecheck && pnpm lint`.
- **Done:** workspace graph matches architecture §4.

### FND-02 — web shell

- **Priority:** P0. **Depends:** FND-01. **Requirements:** FR-25.
- **Objective:** Vite + React + React Router + TypeScript app that builds.
- **Description:** Routes render placeholder titles only: `/`, `/challenge`, `/challenge/:slug`, `/leaderboard`, `/episodes`, `/episodes/:slug`, `/methodology`, `/about`, `/status`, `/privacy`, `/terms`, `/admin`. Include a skip link. No data fetching. Tailwind installed per ADR-002 with tokens from UX §6 as CSS variables. Dark background. Wordmark text “Belac.fun”.
- **Files:** `apps/web`.
- **Acceptance:** `pnpm --filter @belac/web build` succeeds. Each route returns the placeholder in dev.
- **Tests:** router smoke that each path matches a route.
- **Verify:** filter build and test.

### FND-03 — API process and health

- **Priority:** P0. **Depends:** FND-01. **Requirements:** FR-28.
- **Objective:** Fastify server with live and ready endpoints.
- **Description:** `GET /health/live` returns 200 `{data:{status:"ok"},meta:{requestId}}`. `GET /health/ready` returns 200 when `APP_ENV=local` even if `DATABASE_URL` is unset, and 503 if `DATABASE_URL` is set but a `select 1` fails. Request IDs on every response. Structured JSON logs. Listen port from `PORT` default 3000.
- **Files:** `apps/api`.
- **Acceptance:** inject tests cover live 200 and ready 503 when URL is set to an invalid host.
- **Tests:** Vitest + `app.inject`.
- **Verify:** `pnpm --filter @belac/api test`.

### FND-04 — environment schema

- **Priority:** P0. **Depends:** FND-01. **Requirements:** FR-29.
- **Objective:** One Zod env parser shared by API and jobs.
- **Description:** Validate `APP_ENV` (`local|staging|production`), `DATABASE_URL` optional in local, required otherwise, `ALLOWED_ORIGINS`, `SESSION_SECRET` required outside local, `SOLANA_RPC_URL`, `PRICE_API_BASE` optional, `R2_*` optional, `AUTH_MODE` (`access|local_bypass`). Parser throws if `AUTH_MODE=local_bypass` and `APP_ENV!=local`. Parser throws if production and a flag `ALLOW_ILLUSTRATIVE=true`. Document variables in `.env.example` with blanks, no real secrets.
- **Files:** `packages/config`.
- **Acceptance:** unit tests for the three rejection cases.
- **Tests:** Vitest.

### FND-05 — shared contracts

- **Priority:** P0. **Depends:** FND-04. **Requirements:** FR-16, NFR-01.
- **Objective:** Zod enums and public DTOs.
- **Description:** Enums: campaign state, challenge state, source status (`verified_onchain|verified_provider|manual_evidence|unverified`), event types from architecture §6, quality labels, roles. DTOs for campaign summary, leaderboard row, challenge detail, transaction, position, content card, site status, error envelope. Money fields `z.string()` regex for decimals. Include `isIllustrative: z.boolean()` and `asOf` datetime. Export types via `z.infer`.
- **Files:** `packages/contracts`.
- **Acceptance:** fixtures in tests parse; a number-typed equity field is rejected.
- **Tests:** schema tests.
- **Architecture:** §11–12. **UX:** money semantics §15.

### FND-06 — CI workflow

- **Priority:** P0. **Depends:** FND-02, FND-03, FND-05. **Requirements:** NFR-06.
- **Objective:** GitHub Actions workflow that installs, typechecks, lints, and tests.
- **Description:** `.github/workflows/ci.yml` on pull_request and push. pnpm cache. No deploy steps. Postgres service optional and unused until DB-07.
- **Acceptance:** workflow YAML is valid and scripts it calls exist.
- **Tests:** CI itself is the check when a remote exists; locally run the same scripts.

---

## Phase 2

### DB-01 — campaign, provider, challenge, account, asset

- **Priority:** P0. **Depends:** FND-01, local Postgres. **Requirements:** architecture §6–7.
- **Objective:** First migration for identity tables.
- **Description:** Drizzle schema and SQL migration. Numeric `allocation_usd`. Unique slugs. Checks: allocation ≥ 0. FKs. Timestamps `timestamptz`.
- **Files:** `packages/db`.
- **Acceptance:** migration applies to empty local database and is generated into the repo.
- **Tests:** DB-07 covers apply; this task runs migrate once locally.
- **Verify:** `pnpm --filter @belac/db migrate`.

### DB-02 — sources and ledger

- **Priority:** P0. **Depends:** DB-01. **Requirements:** FR-11, NFR-01.
- **Objective:** Append-only events and balanced legs.
- **Description:** Tables `source_records`, `ledger_events`, `ledger_entries` per architecture §7. Unique `(source_type, external_id)` and `(challenge_id, external_key)`. `reversal_of` self-FK. Amounts `NUMERIC(38,18)`, values `NUMERIC(24,10)`. Comment in SQL: application role must not be granted UPDATE on amount columns (enforced in DB-05).
- **Acceptance:** migration applies after DB-01.

### DB-03 — positions, prices, valuations, issues

- **Priority:** P0. **Depends:** DB-02. **Requirements:** FR-14.
- **Objective:** Snapshot tables.
- **Description:** `positions`, `position_snapshots`, `price_observations`, `valuation_snapshots`, `reconciliation_issues`. Unique `(challenge_id, observed_at, calc_version)` on valuations.
- **Acceptance:** migration applies.

### DB-04 — content, media, social, audit, jobs, users

- **Priority:** P0. **Depends:** DB-01. **Requirements:** FR-07, FR-19, FR-42 field only.
- **Objective:** Editorial and ops tables.
- **Description:** Tables in architecture §7 from `content_posts` through `job_runs`, including `users`. `body_md` is text. `media_assets.r2_key` nullable until R2 exists so external poster URLs can live on `content_posts` via a `poster_url` text column (assumption: external posters do not require R2).
- **Acceptance:** migration applies. Document the `poster_url` assumption in the package README.

### DB-05 — indexes and role notes

- **Priority:** P0. **Depends:** DB-02, DB-03, DB-04. **Requirements:** architecture §7, R4.
- **Objective:** Indexes listed in architecture §7 and a SQL comment plus a `GRANT` script for a least-privilege `belac_app` role that can INSERT ledger rows and SELECT, but not UPDATE `signed_amount`, `value_usd`, or `cost_usd`.
- **Acceptance:** integration test in DB-07 proves UPDATE of `signed_amount` fails for `belac_app` when the role exists. If local superuser is used in dev, the test creates the role.
- **Tests:** included in DB-07.

### DB-06 — illustrative seed

- **Priority:** P0. **Depends:** DB-05, FND-05. **Requirements:** FR-22.
- **Objective:** Seed a campaign flagged illustrative.
- **Description:** Seed script inserts campaign `demo`, two challenges, one deposit event, one snapshot. All public projections must be able to set `isIllustrative: true`. Script refuses to run when `APP_ENV=production`.
- **Acceptance:** running twice does not duplicate slugs (upsert or exit 0 with “already seeded”).
- **Tests:** second run idempotent.

### DB-07 — migration test

- **Priority:** P0. **Depends:** DB-06. **Requirements:** QA plan.
- **Objective:** Prove migrations and the grant.
- **Description:** Vitest starts compose Postgres or uses `DATABASE_URL`. Applies migrations, runs seed twice, asserts role restriction.
- **Verify:** `pnpm --filter @belac/db test`.

### FIN-01 — accounting engine

- **Priority:** P0. **Depends:** FND-05. **Requirements:** FR-09, FR-10, NFR-01.
- **Objective:** Pure functions, no I/O.
- **Description:** Implement `equityUsd`, `netPnlUsd`, `returnPct` exactly as architecture §8. Inputs are decimal strings. External contributions tracked separately. Function rejects non-decimal input. SOL helper isolated and documented as ADR-007 pending; USD tests do not depend on SOL. Rounding helper for display lives in UI later; this package does not round to 2 dp internally.
- **Files:** `packages/finance`.
- **Acceptance:** unit tests for formula: end 10.74, start 10, contributions 0 → pnl 0.74 and return 7.40 as strings.
- **Tests:** Vitest.

### FIN-02 — difficult-case fixtures

- **Priority:** P0. **Depends:** FIN-01, DB-07. **Requirements:** QA financial table.
- **Objective:** Named fixtures for every row in `QA_PLAN.md` financial cases.
- **Description:** JSON fixtures plus expected equity. Build a function `replay(events) -> equity` used by tests. Include duplicate-key rejection at the replay layer (caller supplies already-deduped events; a separate test shows the DB unique constraint). Perp double-count fixture. Liquidation to zero. Missing price returns `{equity: null, reason: "unpriced"}` without inventing a number.
- **Acceptance:** all named cases pass within 0.0001 USD where a number is expected.
- **Verify:** `pnpm --filter @belac/finance test`.

---

## Phase 3

### API-01 — HTTP platform

- **Priority:** P0. **Depends:** FND-03, FND-04, FND-05. **Requirements:** FR-16, NFR-04.
- **Objective:** CORS allowlist, Zod error mapping, rate limit plugin, security headers baseline, illustrative production guard helper.
- **Description:** Map validation errors to `{error:{code,message,requestId}}`. CORS reflects only `ALLOWED_ORIGINS`. Rate limit public reads (sensible default 60/min/IP, configurable). Do not log secrets.
- **Acceptance:** disallowed origin is not reflected; bad payload returns the error envelope.
- **Tests:** inject tests.

### API-02 — campaign summary and leaderboard

- **Priority:** P0. **Depends:** API-01, FIN-02, DB-06. **Requirements:** FR-01, FR-02.
- **Objective:** `GET /v1/campaigns/current`, `GET /v1/campaigns/:slug/summary`, `GET /v1/campaigns/:slug/leaderboard`.
- **Description:** Read latest valuation per challenge. Sort by `pnl_usd` or `return_pct`. Ties share rank and skip the next rank (1, 2, 2, 4). Include quality, asOf, isIllustrative. Unknown valuations excluded from the sum and reflected in coverage counts (assumption in `RISK_REGISTER.md`).
- **Acceptance:** seed data returns illustrative true and stable ordering.
- **Tests:** API integration against Postgres.

### API-03 — challenge reads

- **Priority:** P0. **Depends:** API-02. **Requirements:** FR-03, FR-04.
- **Objective:** `GET /v1/challenges/:slug`, snapshots, transactions, positions, sources.
- **Description:** Keyset pagination on transactions using `(effective_at, id)` cursor. Cap `pageSize` at 100. Snapshots require `from` and `to` and reject ranges over 400 days.
- **Acceptance:** page 2 does not repeat page 1; oversized range returns 400.

### API-04 — timeline, content, providers, status

- **Priority:** P0. **Depends:** API-02, DB-04. **Requirements:** FR-05, FR-07, FR-08.
- **Objective:** Remaining public GETs in architecture §11 except admin.
- **Description:** Timeline granularity `hour|day`. Content list filters. Provider by slug. Site status returns last job run per name and worst open reconciliation severity. No SSE.
- **Acceptance:** empty content returns `{data:[]}` not 500.

### API-05 — OpenAPI

- **Priority:** P0. **Depends:** API-04. **Requirements:** FR-16.
- **Objective:** `@fastify/swagger` at `/docs` disabled when `APP_ENV=production` (assumption: hide docs in production). JSON spec committed or generated in CI.
- **Acceptance:** spec lists every public route implemented.

### API-06 — cache headers

- **Priority:** P0. **Depends:** API-04. **Requirements:** architecture §11.
- **Objective:** ETag on campaign summary and leaderboard. `Cache-Control: public, max-age=30` for those GETs. `private, no-store` later for admin.
- **Acceptance:** repeated identical payload returns the same ETag; `If-None-Match` yields 304.

### API-07 — admin write contracts

- **Priority:** P0. **Depends:** API-01, ADM-01 can follow; stub auth dependency. **Requirements:** FR-11, FR-17.
- **Objective:** Implement admin routes from architecture §11 as handlers that call services.
- **Description:** All `/v1/admin/*` require the auth plugin from ADM-01. If ADM-01 is not merged, land the routes behind a plugin interface and a failing-closed default (401). Endpoints: challenge create/patch, source import, ledger event (append-only), reconciliation resolve, content create/patch/publish, job run (owner), audit list, jobs list, quality list. Media upload routes return 501 until ADM-06. Publish returns 409 when a severe open reconciliation exists unless body `{override:true}` and role is owner, and the audit row records the override.
- **Acceptance:** 401 without identity; 409 on publish with severe issue; ledger insert does not update old amounts.
- **Tests:** integration tests.

---

## Phase 4

### INT-01 — manual adapter

- **Priority:** P0. **Depends:** FIN-02, DB-02. **Requirements:** FR-13.
- **Objective:** `ProviderAdapter` interface and a manual adapter that accepts already-normalized operator input.
- **Description:** Place interface in `apps/jobs/src/adapters/types.ts` exactly as architecture §9. Manual adapter validates with Zod and returns activities. It never labels them `verified_onchain`.
- **Acceptance:** fixture manual deposit becomes one normalized activity with status `manual_evidence`.

### INT-02 — Solana fixture parser

- **Priority:** P1. **Depends:** INT-01. **Requirements:** FR-30.
- **Objective:** Map a checked-in `getTransaction` JSON fixture to ledger legs.
- **Description:** No network calls. Parser reads token balance deltas and fee. Unknown programs become an `unverified` source with the signature preserved. Document pagination policy for a future live caller (`getSignaturesForAddress`) without implementing live calls.
- **Acceptance:** fixture signature maps to expected legs; rerunning the mapper is deterministic.

### INT-03 — price port

- **Priority:** P0. **Depends:** DB-03. **Requirements:** ADR-008.
- **Objective:** Interface `PriceSource` with a fixture implementation.
- **Description:** No HTTP client to a vendor. Fixture returns prices and timestamps. Freshness function marks confidence stale past the SLA constant (15 minutes), which is a named constant easy to change after ADR-005.
- **Acceptance:** stale fixture flagged; missing asset returns null price, not zero.

### INT-04 — job runner

- **Priority:** P0. **Depends:** DB-04, FND-04. **Requirements:** FR-15.
- **Objective:** CLI entry `pnpm --filter @belac/jobs start <job>`.
- **Description:** Jobs: `sync-manual` (no-op until invoked with a file), `snapshot`, `reconcile`. Advisory lock via `pg_try_advisory_lock`. Insert `job_runs`. Exit non-zero on unexpected throw. Second concurrent run records skipped and exits 0.
- **Acceptance:** test with two parallel attempts; one skipped.

### INT-05 — snapshot materializer

- **Priority:** P0. **Depends:** INT-04, FIN-02. **Requirements:** FR-14.
- **Objective:** Write `valuation_snapshots` from ledger replay.
- **Description:** Idempotent on `(challenge, observed_at, calc_version)`. Does not delete prior versions. Sets quality from the worst source used.
- **Acceptance:** running twice inserts one row; equity matches FIN-02 fixture.

### INT-06 — reconciliation

- **Priority:** P0. **Depends:** INT-05. **Requirements:** FR-14, FR-18.
- **Objective:** Compare an optional reported equity to replayed equity.
- **Description:** Tolerance constant `0.05` USD (assumption, document in code). Beyond tolerance, open a `reconciliation_issues` row severity high. Do not auto-close on later success; insert a resolution only through the admin action.
- **Acceptance:** 10.00 vs 10.04 stays closed; 10.00 vs 10.20 opens an issue; duplicate runs do not open two open issues of the same kind.

### INT-07 — staleness heartbeat

- **Priority:** P0. **Depends:** INT-04. **Requirements:** FR-15, ADR-006.
- **Objective:** Site status query marks a job stale if the last success is older than its expected interval plus 10 minutes.
- **Description:** Pure function plus a test. Wire into `GET /v1/site/status`.
- **Acceptance:** a job_run completed 2 hours ago for a 5-minute job is stale.

---

## Phase 5

### WEB-01 — chrome

- **Priority:** P0. **Depends:** FND-02. **Requirements:** FR-25.
- **Objective:** Header, footer, mobile menu, skip link, max width 1280, 44px targets.
- **Description:** Nav items from UX §5. Campaign pill is static “Not started” until API wiring. Focus styles use `--focus`. No wallet button.
- **Acceptance:** at 320px the menu opens and all four links are reachable by keyboard.
- **Tests:** Testing Library.

### WEB-02 — money and badges

- **Priority:** P0. **Depends:** FND-05, WEB-01. **Requirements:** FR-26, NFR-01.
- **Objective:** `Money`, `SourceBadge`, `UpdateBadge`, `KPIBlock`, `EmptyState`.
- **Description:** `en-AU` grouping, USD, signs, negative zero as zero, unknown state not rendered as $0. Badges have text, not color alone. Tooltips are buttons with descriptions.
- **Acceptance:** tests cover positive, negative, zero, unknown, each source grade.
- **UX:** §14–16.

### WEB-03 — homepage

- **Priority:** P0. **Depends:** WEB-02, API-02. **Requirements:** FR-01.
- **Objective:** First viewport and rankings zone.
- **Description:** TanStack Query to campaign summary and leaderboard. Copy structure from UX §7 without hardcoded dollar amounts. Eyebrow uses campaign state (ADR-006). Disclaimer links to methodology. Pre-start empty copy from UX §16.
- **Acceptance:** loading, error, pre-start, and illustrative banner states. Illustrative banner text: “Sample data. Not a real result.”
- **Tests:** MSW or injected query client.

### WEB-04 — leaderboard page

- **Priority:** P0. **Depends:** WEB-03. **Requirements:** FR-02.
- **Objective:** `/leaderboard` controls.
- **Description:** Metric sort, status filter, source filter, search, reset. Timeframe control shows 7D and 24H disabled with explanation until snapshots support them (assumption: disabled in MVP rather than faking ranges). Desktop table and mobile cards. Note “Risk and time in market differ”. No CSV button (P1-01).
- **Acceptance:** filter empty state copy matches UX §16; sort is announced.

### WEB-05 — challenge detail

- **Priority:** P0. **Depends:** WEB-04, API-03. **Requirements:** FR-03, FR-04.
- **Objective:** `/challenge/:slug` sections.
- **Description:** Breadcrumb, non-endorsement line, value block, risk panel, proof list, fee list, rules anchor. Sticky section nav. Proof row shows signature link only if URL is http(s). Correction reason visible. Do not show account secrets. Liquidation copy from UX §16 when confirmed.
- **Acceptance:** unpriced challenge shows value unavailable and does not show a recomputed ROI.

### WEB-06 — trust pages

- **Priority:** P0. **Depends:** WEB-01, API-04. **Requirements:** FR-06, FR-08.
- **Objective:** Methodology, about, privacy, terms, status.
- **Description:** Methodology includes formula in prose, grades, no-advice, method version string `v1` matching `calc_version`. Privacy states no visitor account and no required cookies for reading. Status lists job freshness. These pages must be readable without the API except status, which has an error state.
- **Acceptance:** methodology contains the net P&L definition and a link from home.

### WEB-07 — episodes

- **Priority:** P0. **Depends:** API-04, WEB-02. **Requirements:** FR-07.
- **Objective:** `/episodes` and `/episodes/:slug`.
- **Description:** Cards 16:9. Embed iframe only after a user activates “Play” (no autoplay). Allowlist hosts `youtube.com`, `youtube-nocookie.com`, `www.tiktok.com`, `x.com`. Others render an external link. Transcript is plain text.
- **Acceptance:** untrusted embed URL does not become an iframe.

### WEB-08 — chart

- **Priority:** P0. **Depends:** WEB-03, API-04. **Requirements:** FR-05, FR-26.
- **Objective:** One USD equity line and a $100 baseline, plus a data table with the same points.
- **Description:** Gaps when quality is missing; do not interpolate across nulls. Reduced motion disables path animation. One chart library only.
- **Acceptance:** table row count equals non-null points; nulls appear as a gap label in the table.

### WEB-09 — failure states

- **Priority:** P0. **Depends:** WEB-03, WEB-05. **Requirements:** FR-27.
- **Objective:** Central copy map for UX §16 strings.
- **Description:** Network error with retry. Provider stale. Partial coverage on the homepage total. Confirmed wipeout. No `NaN` in the tree (test queries the document text).
- **Acceptance:** each string has a rendering test.

### WEB-10 — route regression

- **Priority:** P0. **Depends:** WEB-06, WEB-07, WEB-09. **Requirements:** FR-25.
- **Objective:** Test that public routes render and `/admin` does not show ledger controls when logged out.
- **Description:** Admin path shows “Sign-in required” and no forms.
- **Acceptance:** test passes at the jsdom layer; viewport CSS checked by a 320px comment and a style assertion on the nav button min-height.

---

## Phase 6

### ADM-01 — auth plugin

- **Priority:** P0. **Depends:** FND-04. **Requirements:** FR-20.
- **Objective:** Fail closed.
- **Description:** `AUTH_MODE=access` verifies Cloudflare Access JWT using certs from env (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`). Map groups to roles. `local_bypass` accepts header `x-belac-dev-user` only in local and assigns role from `x-belac-dev-role`. Tests: production config object with bypass is rejected by env parser (already in FND-04) and plugin returns 401 when JWT missing.
- **Acceptance:** viewer cannot call job run; owner can. Enforce in API-07 tests.
- **Note:** Do not invent a password store.

### ADM-02 — challenge and provider admin

- **Priority:** P0. **Depends:** API-07, ADM-01. **Requirements:** FR-17.
- **Objective:** Create and patch metadata. Slug change writes a redirect row.
- **Description:** Add `slug_redirects(from_slug PK, to_slug, created_at)` migration. Allocation patch rejected after any ledger event exists (409) unless a separate audited amendment endpoint is used: `POST /v1/admin/challenges/:id/amend-allocation` owner only with reason. Public site honors redirects.
- **Acceptance:** slug change resolves old URL; allocation lock tested.

### ADM-03 — ledger wizard API

- **Priority:** P0. **Depends:** ADM-02, INT-01. **Requirements:** FR-11, FR-13.
- **Objective:** Manual event create and reversal.
- **Description:** Body matches event types. Requires reason, source grade, amounts as strings. Preview endpoint `POST /v1/admin/ledger/preview` returns equity delta and does not write. Commit writes event, entries, source, audit.
- **Acceptance:** preview has no DB insert; reversal restores fixture equity; original amount unchanged.

### ADM-04 — reconciliation inbox

- **Priority:** P0. **Depends:** INT-06, ADM-01. **Requirements:** FR-18.
- **Objective:** List and resolve issues.
- **Description:** Resolve requires note. State becomes `resolved`. Audit row stored.
- **Acceptance:** editor can resolve; viewer cannot.

### ADM-05 — content publish

- **Priority:** P0. **Depends:** ADM-04, API-07. **Requirements:** FR-18, UX §12.D.
- **Objective:** Draft, preview, publish.
- **Description:** Publish requires title, disclosure flag, and either a linked challenge event id or `editorialOnly: true`. Scheduled time stored UTC. Response includes Perth preview string. Blocks on severe reconciliation unless owner override.
- **Acceptance:** missing disclosure → 400; stale challenge snapshot does not block editorial-only posts; financial posts (editorialOnly false) 409 if latest snapshot older than SLA.

### ADM-06 — media upload

- **Priority:** P1. **Depends:** ADR-010 approval, ADM-05. **Requirements:** FR-37.
- **Objective:** Presigned upload intent when R2 env is present.
- **Description:** If R2 env missing, routes stay 501. When present: MIME allowlist image/png, image/jpeg, image/webp; max 5 MB; key is content hash; complete endpoint records `media_assets`. No delete of referenced assets. Do not enable until operator approves the bucket.
- **Acceptance:** oversized and disallowed MIME rejected in unit tests without calling R2 (mock signer).

### ADM-07 — audit read

- **Priority:** P0. **Depends:** ADM-03. **Requirements:** FR-19.
- **Objective:** `GET /v1/admin/audit` filter by actor, type, date. Keyset pagination.
- **Acceptance:** ledger commit appears in the list.

### ADM-08 — admin UI

- **Priority:** P0. **Depends:** ADM-05, ADM-07, WEB-10. **Requirements:** UX §12.
- **Objective:** Screens under `/admin/*` from UX §4.
- **Description:** Overview queues, transaction review, challenge form, episode form, audit table, settings read-only campaign dates. Prices page lists price observations and stale flags (read-only). Social page lists posts (create URL form is P1 with SOC-05; show read-only empty state in P0). Desktop-first forms. Mobile can load overview and show a note that corrections need a wide screen, but do not remove keyboard access.
- **Acceptance:** logged-out test still shows no forms; local bypass header in tests renders overview.
- **UX:** §12.

---

## Phase 7

### SOC-01 — crawler metadata

- **Priority:** P0 for public launch. **Depends:** ADR-003 approval, WEB-06. **Requirements:** FR-23.
- **Objective:** Unique title and description per public route in initial HTML.
- **Description:** Implement the approved ADR-003 option only. Until approval, add static titles for non-dynamic routes and a documented gap for challenge/episode unfurls. Do not fake OG images with sample P&L.
- **Acceptance:** built HTML for `/methodology` contains a unique `<title>` without executing React. Dynamic routes follow ADR-003 once approved.

### SOC-02 — analytics hooks

- **Priority:** P1. **Depends:** ADR-016, WEB-04. **Requirements:** FR-36.
- **Objective:** Typed event function matching UX §20. No network if analytics id is empty or DNT is set.
- **Acceptance:** unit test: DNT suppresses the call; properties omit emails and wallet keys.

### SOC-03 — share

- **Priority:** P0. **Depends:** WEB-05, WEB-07. **Requirements:** FR-24.
- **Objective:** Copy link button with “Copied” confirmation. Native share when `navigator.share` exists.
- **Acceptance:** click writes the canonical URL; no prefilled hype text beyond the document title.

### SOC-04 — sitemap and robots

- **Priority:** P0. **Depends:** API-04. **Requirements:** FR-23.
- **Objective:** `robots.txt` allows public routes and disallows `/admin`. Sitemap lists published challenges and episodes from the API at build time, and is empty of illustrative slugs when `APP_ENV=production`.
- **Acceptance:** production build fixture excludes `demo`.

### SOC-05 — social metrics entry

- **Priority:** P1. **Depends:** ADM-08. **Requirements:** FR-35.
- **Objective:** Admin form to attach a post URL and manual metric snapshot with `provenance=manual`.
- **Acceptance:** public episode page does not show view counts unless provenance is present. No scraper.

### P1-01 — leaderboard CSV

- **Priority:** P1. **Depends:** API-02. **Requirements:** FR-32.
- **Objective:** `GET /v1/campaigns/:slug/leaderboard.csv` with metric version, as-of, and source grade columns.
- **Acceptance:** content-type csv; illustrative campaigns still labelled.

### P1-02 — comparison chart

- **Priority:** P1. **Depends:** WEB-08. **Requirements:** FR-33.
- **Objective:** Optional per-challenge series and transaction markers, still with a table fallback and no dual axis.
- **Acceptance:** disabled series are omitted; gaps remain gaps.

### P1-03 — weekly freeze

- **Priority:** P1. **Depends:** INT-05. **Requirements:** FR-34.
- **Objective:** Job writes a frozen leaderboard revision row set that later snapshot recalculations do not overwrite.
- **Description:** New table `leaderboard_revisions` in a migration. Public API can request `?revision=`.
- **Acceptance:** rerun of the same week is idempotent.

---

## Phase 8

### PRD-01 — security headers and CSP

- **Priority:** P0. **Depends:** WEB-07, API-01. **Requirements:** NFR-04.
- **Objective:** CSP allowlists API origin and embed hosts only. Frame public pages as appropriate. Admin no-store.
- **Acceptance:** a test or documented curl check shows `content-security-policy` on the web host config in `infra/` (Pages `_headers` file).

### PRD-02 — backup runbook

- **Priority:** P0. **Depends:** DB-07. **Requirements:** NFR-05.
- **Objective:** `docs/runbooks/backup-restore.md` describing Railway Postgres backup/PITR steps to execute later, RPO/RTO targets (proposal: RPO 24h, RTO 8h) marked as recommendations, and a local `pg_dump` / restore drill command.
- **Acceptance:** local dump and restore of the seed database is executed and noted. No Railway account is required for the local drill.

### PRD-03 — Playwright smokes

- **Priority:** P0. **Depends:** WEB-10, API-04. **Requirements:** UX §13 journeys 1–3 and 6.
- **Objective:** Smoke tests against local API + web.
- **Description:** Journey: open challenge from leaderboard, see a source badge, open home pre-start or illustrative banner, failed provider does not show the word NaN. No visual-pixel snapshot requirement.
- **Acceptance:** `pnpm --filter @belac/web e2e` passes locally.

### PRD-04 — a11y and performance notes

- **Priority:** P0. **Depends:** PRD-03. **Requirements:** NFR-02, NFR-03.
- **Objective:** axe on home and challenge; record contrast of the token pairs; fix any AA text failure by adjusting tokens. Record Lighthouse only if Chrome is available; otherwise document the gap.
- **Acceptance:** axe reports no serious violations on those two routes in the test run.

### PRD-05 — launch checklist

- **Priority:** P0. **Depends:** PRD-01, PRD-02, SOC-04, FND-04. **Requirements:** FR-22, FR-29.
- **Objective:** `docs/runbooks/launch-checklist.md` enumerating env vars, illustrative guard, migration order, health URLs, admin Access, and a “do not launch” box until ADR-009 provider list is signed.
- **Acceptance:** checklist exists and a unit test still proves production rejects illustrative mode. No production deploy is performed.

---

## Traceability

Every FR/NFR P0 row in `REQUIREMENTS_MATRIX.md` names at least one task above. P2 rows have no task on purpose.
