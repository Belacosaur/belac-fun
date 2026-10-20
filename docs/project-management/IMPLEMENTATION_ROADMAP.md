# Implementation roadmap

Sequential execution. One task at a time. Do not skip the finance gate.

**Progress on 20 October 2026:** Phase 1 and Phase 2 are done. Phase 3 has API-01, part of API-02, part of API-06, and the admin 401 from API-07. Phase 4 has fixture-level INT-01, INT-02, INT-03, INT-05, INT-06, and INT-07. Phase 5 has a shell, `Money`, and the UX §16 copy module. Phase 8 has the header file and two runbooks. Nothing is deployed. Detail is in `PROJECT_STATUS.md`.

## Phase 1 — Foundation (M0)

FND-01 workspace → FND-02 web shell → FND-03 API health → FND-04 env package → FND-05 contracts → FND-06 CI workflow file (no cloud deploy).

## Phase 2 — Database and finance (M1)

DB-01 identity tables → DB-02 ledger and sources → DB-03 positions, prices, valuations, reconciliation → DB-04 content, media, social, audit, jobs, users → DB-05 indexes and grants → DB-06 illustrative seed → DB-07 migration integration test → FIN-01 calculator → FIN-02 invariant fixtures.

## Phase 3 — API (M2)

API-01 platform middleware → API-02 read services for campaign and leaderboard → API-03 challenge resources → API-04 content, provider, status → API-05 OpenAPI → API-06 pagination and cache headers → API-07 admin write routes behind an auth interface.

## Phase 4 — Integration (M3)

INT-01 manual adapter → INT-02 Solana parser on fixtures only → INT-03 price port with fixture adapter → INT-04 job runner → INT-05 snapshot materializer → INT-06 reconciliation → INT-07 staleness and heartbeats.

## Phase 5 — Public website (M4)

WEB-01 shell and tokens → WEB-02 financial components → WEB-03 home → WEB-04 leaderboard → WEB-05 challenge detail → WEB-06 methodology, about, privacy, terms, status → WEB-07 episodes → WEB-08 chart → WEB-09 data states → WEB-10 route tests.

## Phase 6 — Admin (M5)

Blocked on ADR-004 for production. Local dev bypass allowed only in `APP_ENV=local`.

ADM-01 auth middleware → ADM-02 challenges and providers → ADM-03 ledger wizard API wiring → ADM-04 reconciliation inbox → ADM-05 content publish rules → ADM-06 media flag (no bucket until ADR-010) → ADM-07 audit viewer → ADM-08 admin screens.

## P1 after the critical path

`INT-02`, `ADM-06` (after ADR-010), `SOC-02`, `SOC-05`, `P1-01`, `P1-02`, `P1-03`.

## Phase 7 — Social (off critical path, P0 subset noted)

SOC-01 metadata/prerender (ADR-003) **P0 for credible sharing** → SOC-02 UTM and event map (P1 if no analytics vendor) → SOC-03 share buttons **P0** → SOC-04 sitemap and robots **P0** → SOC-05 manual social metrics **P1**.

Treat SOC-01, SOC-03, and SOC-04 as required before a public social launch. They can follow M4.

## Phase 8 — Production readiness (M6)

PRD-01 security headers and CSP → PRD-02 backup and restore runbook (no live restore until Railway exists) → PRD-03 Playwright smokes → PRD-04 a11y and performance pass → PRD-05 launch checklist.

## Suggested calendar (one developer agent, review between phases)

| Week | Focus |
|---|---|
| 1 | Phase 1–2 through FIN-02 |
| 2 | Phase 3 |
| 3 | Phase 4 and start of Phase 5 |
| 4 | Finish Phase 5 |
| 5 | Phase 6 |
| 6 | Phase 7–8 and operator sign-off |

This calendar is a planning aid, not a commitment. Provider legal review (ADR-009) runs in parallel with weeks 1–4 and gates real data, not the codebase.
