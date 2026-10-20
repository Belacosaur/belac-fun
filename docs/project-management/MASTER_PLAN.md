# Belac.fun — Master project execution plan

**Version:** 1.0 · **Date:** 20 October 2026 · **Status:** Phase 1 and Phase 2 implemented. Later phases partial. See `PROJECT_STATUS.md`.

## 1. Scope

Belac.fun is a public, read-only record of a 30-day experiment: **$100 USD** split into **ten $10** strategy allocations on ten venues. The site explains the experiment, shows portfolio and per-strategy results with provenance, and publishes video episodes. It does not custody funds, hold trading keys, connect visitor wallets, or execute trades.

In scope: public dashboard, leaderboard, strategy pages, P&L history, proof links, charts with table fallbacks, episodes, methodology and legal pages, admin for ledger corrections, reconciliation, and publishing, ingestion jobs that tolerate missing provider APIs.

Out of scope until a new approved decision: trading, wallet signing, reader accounts, paid membership, reader leaderboards, gambling flows, social scraping, affiliate programs, automated social posting, newsletter, Redis, SSE, microservices.

## 2. Source of truth

| Topic | Document |
|---|---|
| Calculations, schema, API, security, jobs | `architecture.md` |
| Routes, layout, copy, components, a11y, analytics events | `uiux_design.md` |
| Conflicts on reported figures | Architecture wins (`README.md`) |
| This plan’s choices | `ARCHITECTURE_DECISIONS.md` |

Repository audit (Phase 0): the workspace originally contained `README.md`, `architecture.md`, and `uiux_design.md` only. Application code now exists. Do not overwrite those three source specs.

## 3. Functional requirements (summary)

See `REQUIREMENTS_MATRIX.md` for IDs, priority, and task links.

P0: campaign of ten challenges, USD equity and net P&L, separate SOL view when priced, append-only ledger, source grades, snapshots, public routes in UX §4 except features marked P1, manual intake, stale and empty states, admin auth and corrections, basic SEO shell, health endpoints, illustrative-data guard.

P1: automated connectors per provider, CSV export, richer comparison charts, referral analytics dashboard, subtitles pipeline, newsletter consent, status incident history, weekly frozen export.

P2: reader follow, Postiz, SSE, light theme, always-on sub-5-minute worker, malware scanning vendor.

## 4. Non-functional requirements

- WCAG 2.2 AA target; 320px layout; reduced motion; charts have tables.
- LCP < 2.5s, CLS < 0.1, INP < 200ms on a representative mobile profile (measure in Phase 8, do not block foundation on lab numbers).
- API availability target **99.5%** as the launch SLO example in architecture §14 (assumption until operator confirms).
- Ledger math uses decimals; API money is strings; UTC storage; Australia/Perth display default.
- Secrets only in environment. No private keys in repo, DB, or frontend.
- Public pages remain up when one provider fails; totals show coverage, not invented prices.
- Migrations are versioned and backwards-compatible (expand/contract).

## 5. Technical constraints

Approved stack only: Vite, React, TypeScript, Cloudflare Pages, Fastify on Railway, PostgreSQL, Drizzle, optional R2, pnpm monorepo. No new paid service without approval. Railway cron ≥ 5 minutes, UTC. Jobs must exit, lock, and be idempotent.

## 6. Milestones

| Milestone | Exit gate |
|---|---|
| M0 Foundation | `pnpm typecheck` and `pnpm test` pass; API `/health/live` local; web shell routes render |
| M1 Accounting | Fixture campaign reproduces expected equity within $0.0001; duplicate import does not double balances |
| M2 Read API | OpenAPI matches implemented public routes; illustrative flag present |
| M3 Manual ingest | Operator-shaped fixture flows source → ledger → snapshot → public DTO |
| M4 Public site | Home, leaderboard, challenge, methodology match UX states; no wallet UI |
| M5 Admin | Audited manual event and reversal; severe reconciliation blocks publish unless owner override with warning |
| M6 Launch readiness | Production refuses illustrative data; backup runbook written; smoke checklist passed on staging **after** infra approval |

Architecture milestones M0–M5 map to these gates. Campaign operations (weekly freeze, closure export) are P1 inside M6 follow-on, not the first public deploy.

## 7. Phases

| Phase | Prompt file | Intent |
|---|---|---|
| 0 | This plan | Audit only. Done. |
| 1 | `developer-prompts/PHASE_01_FOUNDATION.md` | Tooling and empty apps |
| 2 | `PHASE_02_DATABASE.md` | Schema, migrations, finance engine |
| 3 | `PHASE_03_API.md` | Public read API and admin write contracts |
| 4 | `PHASE_04_INTEGRATIONS.md` | Adapters, jobs, reconcile |
| 5 | `PHASE_05_FRONTEND.md` | Public UI |
| 6 | `PHASE_06_ADMIN.md` | Protected operator UI |
| 7 | `PHASE_07_SOCIAL.md` | Sharing, sitemap, analytics hooks |
| 8 | `PHASE_08_PRODUCTION.md` | Hardening and launch checklist |

## 8. Testing requirements

Finance cases are mandatory before public UI shows numbers: fees, partial fills, realised vs unrealised, missing prices, stale balances, liquidations, manual reversals, inconsistent provider equity, decimals, duplicate imports. Detail in `QA_PLAN.md`.

## 9. Deployment requirements

Not part of early tasks. When approved: isolated local, staging, production databases; boot-time env validation; GitHub Actions lint/typecheck/test; migrate then deploy; Pages after API health. Rollback the app without assuming down migrations.

## 10. Definition of Done (project)

- All P0 requirements in the matrix have a passing test or a recorded waiver.
- No task marked done without the completion report in `PROJECT_STATUS.md` format.
- Pending ADRs either approved or explicitly descoped.
- A stranger can trace a public dollar figure to ledger events and a source grade.

## 11. Definition of Done (task)

Acceptance criteria met, commands in the task recorded, typecheck clean, no secrets committed, status file updated, next task named.

## 12. Reconciliation notes (audit)

| Topic | Resolution |
|---|---|
| UX `/status` vs architecture P1 “status page” | P0 thin page from `GET /v1/site/status`. Incident timeline is P1. |
| UX CSV vs architecture P1 exports | CSV is P1 (ADR-011). |
| Homepage chart vs P1 comparison charts | Single series + $100 baseline is P0 (ADR-012). |
| “LIVE” copy | Campaign eyebrow only when `active`. Data freshness uses Current/Stale/Estimated (ADR-006). |
| Sample dollars in UX wireframes | Illustrative only (ADR-017). |
| Admin routes | Implement UX §4 admin map. Architecture screen list is the same set under slightly different names (`/admin/prices`, `/admin/social`, `/admin/settings` included). |
| SOL toggle | P0 display when prices exist; convention awaits ADR-007. |
| Prerender | ADR-003, Phase 7, not Phase 1. |
| Auth | ADR-004 before production admin. |
| 1-minute jobs | Not available on Railway cron. ADR-005. |

## 13. Decisions requiring operator approval

ADR-003 prerender/Pages Function, ADR-004 Cloudflare Access, ADR-005 close time and SLA, ADR-007 SOL convention, ADR-008 price vendor, ADR-009 the ten providers and wallets, ADR-010 R2, ADR-016 analytics, plus DNS ownership and Railway region before any cloud spend.

## 14. Next executable task

**FIX-01** in `developer-prompts/FIX_API_AUDIT.md`. Repair decimal totals, the illustrative flag, the missing redirect table, the timeline, and the admin success responses before API-05 or any public page work. Phase 1 and Phase 2 are done. Track partial work in `PROJECT_STATUS.md`.
