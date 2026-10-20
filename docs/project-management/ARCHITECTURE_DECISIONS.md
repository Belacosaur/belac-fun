# Architecture Decision Register

Status key: **Approved** (fixed by source specs or non-material engineering choice) · **Recommended — awaiting approval** (changes security, cost, financial meaning, or product behaviour).

Implementation has not changed these decisions. ADR-003, ADR-004, ADR-005, ADR-007, ADR-008, ADR-009, ADR-010, and ADR-016 are still awaiting approval.

Conflict rule from `README.md`: architecture governs calculations, API, and data. UX governs presentation. Reported figures follow architecture.

---

## ADR-001 — Repository layout

- **Problem:** Where code lives.
- **Alternatives:** Single app; separate repos; pnpm monorepo from architecture §4.
- **Recommended approach:** pnpm workspaces exactly as architecture §4: `apps/web`, `apps/api`, `apps/jobs`, `packages/contracts`, `packages/db`, `packages/finance`, `packages/ui`, `packages/config`, `infra`, `docs`.
- **Justification:** Shared Zod contracts and one finance engine prevent UI/API drift.
- **Consequences:** Root scripts must typecheck and test all packages.
- **Approval:** Approved (architecture §4).

## ADR-002 — Styling

- **Problem:** Architecture allows Tailwind or vanilla CSS, one strategy only.
- **Alternatives:** Tailwind; vanilla CSS modules.
- **Recommended approach:** Tailwind v4 with CSS variables bound to UX tokens in `uiux_design.md` §6. Dark theme only for MVP. No remote font CDN; system font stack until a licensed font is approved.
- **Justification:** Tokens map cleanly to utilities; one strategy avoids mixed styling.
- **Consequences:** Light theme is out of scope.
- **Approval:** Approved as engineering choice (does not change product behaviour).

## ADR-003 — Public rendering and Open Graph

- **Problem:** A client-only Vite SPA does not give X/TikTok reliable per-route titles or OG tags (architecture §15, UX §4 and §17).
- **Alternatives:** Full SSR (breaks “Pages + SPA” simplicity); Cloudflare Worker in front of Pages; build-time prerender of known routes plus a meta endpoint.
- **Recommended approach:** Vite multi-page or prerender of public routes (`/`, `/challenge`, `/leaderboard`, `/methodology`, `/about`, `/status`, `/privacy`, `/terms`, `/episodes`, and each known slug at build/publish time). Dynamic slugs: a small Cloudflare Pages Function reads published metadata from `GET /v1/...` at request time for HTML `<head>` only. Financial numbers in the shell must include `as of` and must come from the API, never from fixtures. Client still hydrates live data.
- **Justification:** Meets crawler requirements without moving the API off Railway.
- **Consequences:** Publish flow must invalidate or rebuild route metadata. Extra Pages Function is still on the approved Cloudflare Pages platform.
- **Approval:** **Recommended — awaiting approval** (product-visible metadata and a small extra runtime).

## ADR-004 — Admin authentication

- **Problem:** Admin writes must be authenticated, MFA, roles `owner` | `editor` | `viewer`, CSRF-safe (architecture §5, §14).
- **Alternatives:** Custom password auth (rejected: weaker, more code); third-party OIDC we operate (Auth0/Clerk — likely paid); Cloudflare Access in front of admin UI and `/v1/admin/*`.
- **Recommended approach:** Cloudflare Access (OIDC JWT) for MVP. API verifies `Cf-Access-Jwt-Assertion` with the team’s Access certs. Map Access groups to roles. No public user table population beyond admin identities. CSRF is reduced because browser session is Access-cookie on the protected hostname; still require `Origin` allowlist and no cookie-authenticated cross-site writes from `belac.fun`.
- **Justification:** MFA and identity stay with Cloudflare; no new paid IdP if Access free tier covers one operator.
- **Consequences:** Local dev uses a documented bypass **only** when `APP_ENV=local` and a static dev token that cannot be enabled in staging/production (boot validator must reject bypass outside local).
- **Approval:** **Recommended — awaiting approval** (security boundary).

## ADR-005 — Job cadence and worker shape

- **Problem:** Architecture wants 1–5 minute balance polls. Railway cron minimum interval is 5 minutes and may skip overlapping runs (architecture §20).
- **Alternatives:** Always-on worker (extra Railway service cost); 5-minute cron CLI that exits.
- **Recommended approach:** MVP jobs are cron-invoked CLIs in `apps/jobs`, UTC, idempotent, DB advisory lock, watermark in `job_runs`. Cadence: 5 min prices/balances, 15 min activity sync, hourly snapshots, daily close at **16:00 UTC** (00:00 Australia/Perth). No Redis, no queue, no SSE. Public UI polls every 60s.
- **Justification:** Matches verified Railway limits and cost control. Sub-minute freshness is not required for a documentary.
- **Consequences:** UI must not say “live” when snapshot age exceeds the SLA (propose SLA = 15 minutes for price-backed marks, 60 minutes for manual/grade C).
- **Approval:** **Recommended — awaiting approval** (freshness SLA and daily close timezone). Daily close at Perth midnight is an assumption.

## ADR-006 — Freshness labels

- **Problem:** Architecture quality gates vs UX copy.
- **Recommended approach:** Map snapshot age and source class to UX badges:
  - `verified_onchain` or `verified_provider` and age ≤ SLA → badge `Current`, never the word Live unless campaign state is `active` **and** this condition holds. Homepage eyebrow may say `LIVE EXPERIMENT` only for campaign lifecycle, not for data freshness.
  - Age > SLA → `Stale` / “Updated X ago”.
  - `manual_evidence` → “Manual evidence”.
  - Price-only or missing exit quote → `Estimated` / “indicative”.
  - Open reconciliation severity high → `Pending reconciliation`; do not recompute ROI from a partial mark.
  - Confirmed liquidation to zero → show `$0` and loss copy, not an em dash.
- **Approval:** Approved as reconciliation of architecture §8 and UX §9, §16. Campaign-lifecycle “LIVE EXPERIMENT” vs data “live” must stay distinct in copy.

## ADR-007 — SOL performance convention

- **Problem:** USD is canonical. SOL is a second view. Convention unspecified.
- **Recommended approach:** Store SOL quantities and SOL/USD price observations. SOL return for a challenge = change in SOL-denominated equity using the same cash-flow formula, converting USD external flows at the SOL/USD observation nearest the flow time (documented, not silent). Chart never plots USD and SOL on one axis. If SOL price is missing, hide the SOL series and say why.
- **Approval:** **Recommended — awaiting approval** (changes reported SOL returns).

## ADR-008 — Pricing source

- **Problem:** No vendor chosen (architecture §19).
- **Alternatives:** CoinGecko demo; Jupiter Price API v2 (Solana mints); Pyth; manual only.
- **Recommended approach:** Do not call a paid price API until approved. Implement the price port with a fixture adapter in tests. For Solana tokens, prefer a free public Jupiter price API as primary and a second free source as fallback once operator approves network egress. Stablecoins: flag deviation vs 1 USD beyond 50 bps. Illiquid: confidence low, UI warning, no implied exit.
- **Approval:** **Recommended — awaiting approval** before any external price calls in staging/production.

## ADR-009 — Ten providers and wallets

- **Problem:** Providers are not selected. Australia availability is a legal gate.
- **Recommended approach:** Schema and UI use records, not hardcoded venues. Seed only `isIllustrative: true` fixtures. Launch gate: each live challenge has provider grade A/B/C, availability note, fee/minimum notes, and an attribution account. No provider page published as real until operator marks it non-illustrative.
- **Approval:** **Blocked on operator** for the actual ten. Engineering proceeds with placeholders.

## ADR-010 — R2 and video

- **Problem:** UX media library assumes R2. Architecture says R2 is not a mandatory MVP dependency. Video is embedded.
- **Recommended approach:** P0 public site uses external video URLs and static files in the Pages build. R2 presigned upload lands in Phase 6 and stays feature-flagged until the operator approves the bucket. No malware-scanning vendor unless third-party uploads exist (they do not in MVP).
- **Approval:** **Recommended — awaiting approval** before creating an R2 bucket (cost is low but non-zero ops).

## ADR-011 — CSV export and newsletter

- **Problem:** UX §8 asks for public CSV export. Architecture lists controlled exports and newsletter as P1.
- **Recommended approach:** Public leaderboard CSV is P1. Newsletter and “follow challenge” accounts are P2 / out of MVP. Admin export of a frozen weekly snapshot is P1.
- **Approval:** Approved prioritisation (architecture §2 wins over UX convenience). Documented so it is not dropped.

## ADR-012 — Homepage chart vs comparison charts

- **Problem:** UX homepage includes “Portfolio vs original $100”. Architecture P1 says “event comparison charts”.
- **Recommended approach:** P0 chart is one USD equity series plus a $100 baseline. Multi-strategy overlay and event markers on the chart are P1. Transaction markers on the challenge chart are P1 if they slip the critical path; a table of events is P0.
- **Approval:** Approved prioritisation.

## ADR-013 — Money storage and API encoding

- **Problem:** Floats corrupt P&L.
- **Recommended approach:** PostgreSQL `NUMERIC` as in architecture §7. API decimal fields are strings. Finance package uses decimal arithmetic (no JS `number` for ledger math). Presentation rounding only in `packages/ui` Money component: 2 dp USD totals, up to 4–6 dp in fee detail, ROI 2 dp, `en-AU` grouping, negative zero shown as zero.
- **Approval:** Approved (architecture §8, §12, UX §15).

## ADR-014 — Corrections are reversals

- **Problem:** Silent overwrite would falsify history.
- **Recommended approach:** No UPDATE of amounts on `ledger_events` / `ledger_entries`. Corrections insert a new event with `reversal_of` and a public reason. Valuation snapshots are append-only per `(challenge, observed_at, calc_version)`.
- **Approval:** Approved (architecture §6, §8).

## ADR-015 — No Redis, no SSE, no wallet

- **Recommended approach:** Omit Redis, queues, microservices, public SSE, wallet connect, trading keys, and visitor accounts until a later approved ADR.
- **Approval:** Approved (architecture §1, §2, README guardrails).

## ADR-016 — Analytics

- **Problem:** Need social attribution without PII.
- **Recommended approach:** Cloudflare Web Analytics beacon if the operator enables it (no extra vendor). First-party event POST optional and P1. UTM params stored only as campaign/content strings, length-capped, no markup. Respect DNT by not loading optional analytics.
- **Approval:** **Recommended — awaiting approval** before enabling any analytics token in production.

## ADR-017 — Illustrative data flag

- **Problem:** Specs contain fake numbers (`$108.42`).
- **Recommended approach:** Every public DTO includes `isIllustrative`. Production boot refuses to serve illustrative campaigns if `APP_ENV=production`. Seed data exists only in local/test.
- **Approval:** Approved (architecture §12, developer rule 5).
