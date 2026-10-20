# Phase 2 developer prompts — database and finance

Context: Belac.fun records a $100 / 10-strategy experiment. Money is `NUMERIC` in Postgres and decimal strings in TypeScript. Ledger rows are append-only. Seed data is illustrative and must refuse `APP_ENV=production`.

Read architecture §6–8 and `TASK_BACKLOG.md` DB-01 through FIN-02. Read ADR-013 and ADR-014. Use Drizzle and SQL migrations in `packages/db`. Use `decimal.js` only inside `packages/finance`.

Local Postgres: `docker compose up -d` from FND-01. Do not provision Railway.

Execute one task per session in this order: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, FIN-01, FIN-02.

### DB-01
Migration for `campaigns`, `providers`, `challenges`, `accounts`, `assets` as architecture §7. `allocation_usd NUMERIC(24,8)` and a check `allocation_usd >= 0`. Unique slugs. `timestamptz` columns. Command: `pnpm --filter @belac/db migrate` against local `DATABASE_URL=postgres://belac:belac@localhost:5432/belac`.

### DB-02
`source_records`, `ledger_events`, `ledger_entries`. Uniques `(source_type, external_id)` and `(challenge_id, external_key)`. `reversal_of` self-FK. Amounts `NUMERIC(38,18)`. No update path in the query layer.

### DB-03
`positions`, `position_snapshots`, `price_observations`, `valuation_snapshots`, `reconciliation_issues`. Unique `(challenge_id, observed_at, calc_version)`.

### DB-04
Content, media, social, users, audit, job_runs from architecture §7. Add nullable `content_posts.poster_url` for external images (ADR-010). `r2_key` may be null.

### DB-05
Indexes from architecture §7. Create role `belac_app` granted INSERT/SELECT on ledger tables and revoked UPDATE on `signed_amount`, `value_usd`, `cost_usd`.

### DB-06
Idempotent seed for campaign slug `demo`, two challenges, one deposit, one snapshot. Sets up data that APIs must mark `isIllustrative: true`. Script exits with an error when `APP_ENV=production`.

### DB-07
Vitest applies migrations, runs seed twice, asserts the second seed does not duplicate, and asserts `belac_app` cannot update `signed_amount`. Command: `pnpm --filter @belac/db test`.

### FIN-01
Pure module. `net_pnl_usd = ending_equity_usd - starting_equity_usd - net_external_contributions_usd`. `return_pct = net_pnl_usd / starting_equity_usd * 100`. Equity definition from architecture §8, including the perp rule (account equity once). Reject invalid decimals. Do not round internally. Test: end `10.74`, start `10`, contributions `0` → pnl `0.74`, return `7.40` as strings. SOL helper may return `not_configured` until ADR-007 is approved; do not invent a SOL percentage in USD tests.

### FIN-02
Named fixtures for every case in `QA_PLAN.md` financial table. Missing price returns null equity and reason `unpriced`, never zero. Tolerance $0.0001 where a value is expected. Command: `pnpm --filter @belac/finance test`.

**Done when:** FIN-02 passes and `pnpm typecheck` is clean. Next phase is API-01. Do not build HTTP handlers in this phase.

Completion report fields: Completed, Files Changed, Database Changes, Tests, Verification, Issues, Next Steps.
