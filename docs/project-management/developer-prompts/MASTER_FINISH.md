# MASTER FINISH — do not stop between tasks

You are the Developer Agent for Belac.fun. Finish every remaining local task in this prompt in one continuous session. Do not pause to ask whether to continue. Do not deploy. Do not create Railway, Cloudflare, R2, DNS, Sentry, or any paid account. Do not call a live Solana RPC or a price vendor. Do not commit secrets. Do not present illustrative numbers as real results.

Read `architecture.md`, `uiux_design.md`, and `docs/project-management/PROJECT_STATUS.md` before editing. Architecture wins on money and APIs. The UX spec wins on routes, copy, and states. Money math uses `decimal.js` or PostgreSQL `NUMERIC`. API money fields stay decimal strings. Ledger amounts are insert-only. Corrections are reversals.

## Already done — do not rebuild

Phases 1 and 2, FIX-01, OpenAPI JSON at `/openapi.json`, advisory-lock job skip rows, public read routes, admin preview/commit/reversal/allocation amend/reconciliation resolve/audit list, stored `campaigns.is_illustrative`, `slug_redirects`, homepage, leaderboard, challenge, methodology, episodes, chart-plus-table, copy link, and the Menu button. Extend this code. Do not replace the stack.

## Finish, in this order

1. **API-06 and API-07 tests.** `If-None-Match` returns 304 for summary and leaderboard. Integration tests for ledger preview (no insert), commit, reversal (original amount unchanged), allocation 409 after a ledger event, owner amend, reconciliation resolve, and publish 409/404/success. Job run and media upload stay 501 until the steps below say otherwise.

2. **INT-04 through INT-07 for real.** `snapshot` and `reconcile` CLIs write `valuation_snapshots` and `reconciliation_issues` in Postgres, idempotently, using `packages/finance`. A second open issue of the same kind is not inserted. Disagreement above $0.05 opens one high issue. $0.04 does not. Wire the manual adapter to that path. `POST /v1/admin/jobs/:name/run` for an owner enqueues nothing external: it runs the named local job once, writes `job_runs`, and returns that row. Unknown job names return 404. Viewer remains 403.

3. **Public UI gaps.** Status filter and source filter on the leaderboard. Proof list and fee list on the challenge page from `/transactions` and `/sources`. Show unpriced copy only when equity is null. Render transcript text on an episode when the API provides it. About and terms pages include the no-advice and experiment description from `uiux_design.md` §11 and §19, without sample dollar amounts. Desktop nav is visible without opening the menu; the Menu button remains for narrow layouts.

4. **ADM-08.** Routes `/admin/overview`, `/admin/challenges`, `/admin/transactions`, `/admin/prices`, `/admin/episodes`, `/admin/media`, `/admin/social`, `/admin/audit`, `/admin/settings`. Logged-out visitors see “Sign-in required” and no inputs. With `AUTH_MODE=local_bypass` and the local dev headers, the overview shows queues and the transaction screen can preview and commit a manual event. Media page states uploads are unavailable. No password form.

5. **SOC-04 already started.** Confirm `robots.txt` disallows `/admin` and the production sitemap excludes slug `demo`. Add unique static `<title>` tags for `/`, `/leaderboard`, `/methodology`, `/about`, `/privacy`, `/terms`, `/status`, and `/episodes`. Do not invent Open Graph images with fake P&L. Dynamic slug unfurls stay documented as blocked on ADR-003. Do not build the Pages Function.

6. **P1 local behavior.** `GET /v1/campaigns/:slug/leaderboard.csv` with as-of, calc version, and source grade. Weekly freeze job writes `leaderboard_revisions` idempotently for the same week. Optional chart series stays off unless data exists. No dual axis. `SOC-02` analytics helper sends nothing when the id is empty or Do Not Track is set. `SOC-05` admin form stores a manual social metric with `provenance=manual`. Public pages hide counts without provenance.

7. **PRD-02, PRD-03, PRD-04.** Run the local `pg_dump` and restore drill if Docker Postgres is reachable. If port 5432 is already taken on the host, run the drill on the compose network and record the exact command in `docs/runbooks/backup-restore.md`. Add Playwright smokes for home illustrative-or-not-started state, leaderboard to challenge, a source badge, and no `NaN` when one provider is missing. Add an axe check on home and one challenge with no serious violations. Fix contrast if the tokens fail WCAG 2.2 AA body text.

8. **Status.** After each numbered step, update `docs/project-management/PROJECT_STATUS.md` completed, partial, and next-task lines. Do not stop the session to wait for review.

## Hard stops (these are not permission to halt the rest)

Skip only the blocked action, write the skip in `PROJECT_STATUS.md`, and continue:

- No Railway, Cloudflare, R2 bucket, DNS, or paid vendor.
- No live RPC, no live price HTTP, no social scraping.
- No production deploy and no `ALLOW_ILLUSTRATIVE=true` in production.
- SOL returns stay `not_configured` until ADR-007 is approved. Do not invent a SOL percentage.
- R2 upload routes stay 501.

## Commands before you finish

`pnpm typecheck`

`pnpm lint`

`pnpm test`

`pnpm --filter @belac/web build`

Playwright if installed by step 7.

Fix failures and re-run. The session is not complete while typecheck, lint, or unit tests fail.

## Final report

**Completed:** every step above, or the skip reason.

**Files Changed:**

**Database Changes:**

**Tests:** commands and pass counts.

**Verification:**

**Issues:**

**Next Steps:** only operator decisions still blocked (ADR-003, ADR-004, ADR-007, ADR-008, ADR-009, ADR-010, ADR-016, DNS, Railway region). No further coding task if the list above is done.
