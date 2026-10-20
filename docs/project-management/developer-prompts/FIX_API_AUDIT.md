# FIX-01 — Repair public figures before more features

You are the Developer Agent for Belac.fun. This is one bounded task. Do not start API-05, the public homepage, admin screens, jobs, or deploys.

## Context

Phases 1 and 2 are accepted. Public and admin routes already exist in `apps/api/src/public-routes.ts`, `apps/api/src/queries.ts`, and `apps/api/src/admin-routes.ts`. An audit rejected them. `packages/finance` uses `decimal.js` and must stay the pattern for money. Architecture §5 and §8 win over any shortcut already in the API.

Read `architecture.md` §7, §8, §11, and §12, plus `docs/project-management/PROJECT_STATUS.md` known issues.

## Objective

Make the existing read API safe to build the website on.

## Required changes

1. **Decimal campaign math.** Replace `Number` addition and sort in `campaignEquity` and `rankRows` with `decimal.js`. Return equity, P&L, and return as decimal strings. Null equity stays null and is excluded from the sum, still counted in coverage. Tie ranks stay 1, 2, 2, 4 using decimal equality, not binary float equality.

2. **Stored illustrative flag.** Add `campaigns.is_illustrative boolean not null default false` in a new Drizzle migration. Set it true only in the `demo` seed. Read that column for campaign, leaderboard, challenge, timeline, and transaction payloads. Remove the slug `=== "demo"` helper and the challenge `startsWith("demo")` expression. Transaction rows use the parent campaign flag, never a hardcoded `true`.

3. **Redirect table.** Add `slug_redirects(from_slug text primary key, to_slug text not null, created_at timestamptz not null default now())` in the same migration. Keep the existing lookup. A missing challenge with no redirect returns 404, not a database error.

4. **Timeline.** `GET /v1/campaigns/:slug/timeline?granularity=hour|day` returns buckets of summed challenge equity from `valuation_snapshots`, using decimal addition. Do not return one latest row per challenge and label it a timeline. Omit a challenge from a bucket when its equity is null, and include a coverage count. `from`/`to` wider than 400 days returns 400. If the database is not configured, return 503, including content list and timeline. Do not return an empty 200 that looks like a real empty campaign.

5. **Site status.** Use `staleness` from `apps/jobs/src/prices.ts` (expected interval 15 minutes) for the latest `job_runs` row per `job_name`. Return each job’s name and freshness. Do not collapse every job into one timestamp.

6. **Admin honesty.** `POST /v1/admin/content/:id/publish` returns 404 when the post does not exist. On success, set `content_posts.status` to `published` and `published_at` to now, then write the audit row, then return the updated row. Keep the existing 409 when a high open reconciliation exists unless the caller is owner and `override` is true. `POST /v1/admin/jobs/:name/run` returns 501 with the error envelope. It must not return `accepted: true`. Leave media upload and ledger event at 501.

7. **Web shell.** Remove the unconditional unpriced sentence from `/challenge/:slug` in `apps/web/src/App.tsx`. That route stays a placeholder heading until WEB-05. Do not render “value unavailable” when no value was loaded.

## Out of scope

OpenAPI, homepage data, charts, Solana RPC, price vendors, Railway, Cloudflare, R2, new admin screens, and running jobs.

## Tests

Add API tests that fail on the old behavior:

- Two snapshot equities `10.10` and `10.20` sum to `20.30`, not a binary artifact.
- A campaign with `is_illustrative = false` returns `isIllustrative: false` on the summary and on a transaction.
- The demo seed still returns `isIllustrative: true`.
- Timeline with two hourly snapshots in different hours returns two buckets when granularity is `hour`.
- Missing database on timeline and content returns 503.
- Publish of an unknown id returns 404. Publish of a real draft sets `published`.
- Job run returns 501 for an owner.
- Leaderboard tie case 10.00, 10.00, 9.00 ranks 1, 1, 3.

## Commands

`pnpm --filter @belac/db test`

`pnpm --filter @belac/api test`

`pnpm --filter @belac/web test`

`pnpm typecheck`

`pnpm lint`

## Done when

Those commands exit 0, the known issues in `PROJECT_STATUS.md` that this prompt names are fixed, and you update that file: move FIX-01 to completed and set the next task to API-05.

## Completion report

**Completed:**

**Files Changed:**

**Database Changes:**

**Tests:**

**Verification:**

**Issues:**

**Next Steps:** API-05 only.
