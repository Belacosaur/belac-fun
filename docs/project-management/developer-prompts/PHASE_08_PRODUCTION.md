# Phase 8 developer prompts — production readiness

Context: Do not deploy. Do not create Railway or Cloudflare resources. Do not enable paid error tracking. Write the checks and runbooks a later approved deploy would follow.

Read architecture §14–18 and `QA_PLAN.md`. Order: PRD-01, PRD-02, PRD-03, PRD-04, PRD-05.

### PRD-01
Add Cloudflare Pages `_headers` (or the project’s equivalent static headers file) with a CSP that allows the API origin and the embed hosts from WEB-07 only. `nosniff`, referrer policy, and frame policy documented in `infra/`. Admin responses remain `no-store` at the API.

### PRD-02
Author `docs/runbooks/backup-restore.md`. Recommend RPO 24h and RTO 8h as pending operator acceptance. Include a local `pg_dump` and restore of the Docker database. Execute that local drill and record the result in the completion report. Describe Railway PITR as steps to run later, not as steps you execute now.

### PRD-03
Playwright smokes for UX journeys 1, 2, 3, and 6 against local web + API: leaderboard to challenge, source badge visible, home shows illustrative or pre-start copy, a downed provider fixture does not render `NaN` and does not blank the whole portfolio. Command: `pnpm --filter @belac/web e2e`.

### PRD-04
axe serious-or-worse violations are zero on home and one challenge route in that e2e run. Check token contrast for `--text-primary` on `--bg` and `--text-secondary` on `--surface`; adjust tokens if they fail WCAG 2.2 AA body text. If Lighthouse cannot run, say so. Do not ignore a contrast failure.

### PRD-05
`docs/runbooks/launch-checklist.md` covering env vars, migration order, `/health/ready`, Access, illustrative guard, and a stop line: do not point `belac.fun` at the app until ADR-009 providers are signed and ADR-003/004 are approved. Keep the unit test that production rejects `ALLOW_ILLUSTRATIVE=true`.

**Commands:** `pnpm typecheck && pnpm test && pnpm --filter @belac/web build` plus e2e.

**Done when:** the checklist and backup runbook exist, local tests pass, and no cloud project was created.

Completion report required. After PRD-05, stop and return the status file to the operator. Do not start a deploy.
