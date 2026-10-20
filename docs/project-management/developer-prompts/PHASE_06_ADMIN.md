# Phase 6 developer prompts — administration

Context: One operator. Roles owner, editor, viewer. Production auth is Cloudflare Access JWT (ADR-004) if approved; until the operator approves, implement the verifier and keep `local_bypass` impossible outside `APP_ENV=local`. There is no password table. Ledger corrections are new reversing events with a public reason. Severe reconciliation blocks financial publish unless an owner override is audited.

Read UX §12 and architecture §13–14. Order: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-07, ADM-08. **ADM-06 is P1** and stays 501 until ADR-010 is approved. Do not create an R2 bucket.

### ADM-01
Plugin reads `Cf-Access-Jwt-Assertion` when `AUTH_MODE=access` using `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. Local bypass headers `x-belac-dev-user` and `x-belac-dev-role` only if env parser already allowed bypass. Missing identity → 401. Viewer cannot run jobs.

### ADM-02
Challenge and provider metadata. Migration `slug_redirects`. Public reads follow redirects. Allocation changes after a ledger event return 409. Owner endpoint `POST /v1/admin/challenges/:id/amend-allocation` with reason writes audit and a new allocation event rather than a silent column edit. Prefer an explicit `allocation_amendments` table if you need history beyond the audit diff.

### ADM-03
`POST /v1/admin/ledger/preview` writes nothing and returns the equity delta. Commit inserts source, event, entries, audit. Reversal sets `reversal_of` and restores fixture equity. Original `signed_amount` unchanged (DB-05 role still applies to the app user).

### ADM-04
List reconciliation issues. Editor resolve requires a note. Viewer 403.

### ADM-05
Content draft and publish. Require title and disclosure. Require a linked event or `editorialOnly: true`. Store UTC schedule; return an Australia/Perth preview. Financial publish 409 when the latest snapshot is older than the SLA or a severe issue is open. Owner override audited.

### ADM-07
Paginated audit read filters.

### ADM-08
UI routes from UX §4: overview, challenges, transactions, prices (read-only), episodes, media (explains uploads are unavailable), social (empty read-only), audit, settings. Wide-screen note for corrections. Keyboard accessible. Logged-out tests show no forms.

### ADM-06 (P1, after written approval)
Presign only if R2 env is complete. Allow image/png, image/jpeg, image/webp, max 5 MB. Otherwise 501. Mock the signer in tests. No virus-scanning vendor.

**Commands:** `pnpm --filter @belac/api test && pnpm --filter @belac/web test && pnpm typecheck`.

**Done when:** a local bypass owner can preview and commit a reversal and see it on the public challenge page and in the audit list. Next: SOC-04 then SOC-03 then SOC-01.

Completion report required.
