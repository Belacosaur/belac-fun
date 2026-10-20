# Requirements matrix

Priorities: **P0** launch, **P1** soon after, **P2** later. Nothing here is deleted. Tasks are defined in `TASK_BACKLOG.md`.

Implementation on 20 October 2026: FR-09, FR-28, and FR-29 have their listed tasks done (FIN-01, FIN-02, FND-03, FND-04). FR-11 and FR-14 have the database half done and the admin or job half still open. FR-16 and FR-22 are not done: public routes exist, but campaign totals use binary floats, illustrative is inferred from the slug, and transaction rows are always marked illustrative. See `PROJECT_STATUS.md`.

| ID | Requirement | Pri | Tasks | Source |
|---|---|---|---|---|
| FR-01 | Public home shows experiment, portfolio USD, net P&L, as-of, coverage | P0 | WEB-03, API-02 | UX §7; arch §2 |
| FR-02 | Leaderboard of 10 challenges, sort by return and USD P&L, ties, grades | P0 | WEB-04, API-02 | UX §8; arch §11 |
| FR-03 | Challenge page: identity, value, risk, proof, fees, rules | P0 | WEB-05, API-03 | UX §9 |
| FR-04 | Transactions with explorer or evidence links and source grade | P0 | WEB-05, API-03 | UX §9 |
| FR-05 | Timeline of campaign equity, hourly/daily | P0 | API-04, WEB-08 | arch §11 |
| FR-06 | Methodology, about, privacy, terms | P0 | WEB-06 | UX §4, §11 |
| FR-07 | Episodes index and detail, lazy embed, transcript field | P0 | WEB-07, API-04 | UX §10 |
| FR-08 | Status page of freshness and job health | P0 | WEB-06, API-04 | UX §4; arch `GET /v1/site/status` |
| FR-09 | USD net P&L formula and single-counted campaign equity | P0 | FIN-01, FIN-02 | arch §8 |
| FR-10 | SOL second view when prices exist | P0 | FIN-01, WEB-08 | arch §1, §8 |
| FR-11 | Append-only ledger and public reversals | P0 | DB-02, ADM-03 | arch §6 |
| FR-12 | Source grades A/B/C and labels | P0 | DB-02, WEB-02 | arch §9; UX §11 |
| FR-13 | Manual intake when no provider API | P0 | INT-01, ADM-03 | arch §9 |
| FR-14 | Snapshots, prices, reconciliation issues | P0 | DB-03, INT-05, INT-06 | arch §6–8 |
| FR-15 | Jobs idempotent, locked, watermarked | P0 | INT-04, INT-07 | arch §10, §20 |
| FR-16 | Public REST `/v1` envelope, pagination, OpenAPI | P0 | API-01, API-05, API-06 | arch §11 |
| FR-17 | Admin campaign, providers, challenges | P0 | ADM-02 | arch §13; UX §12 |
| FR-18 | Admin reconcile and publish block on severe issues | P0 | ADM-04, ADM-05 | arch §13 |
| FR-19 | Audit log | P0 | DB-04, ADM-07 | arch §6 |
| FR-20 | AuthN/Z owner, editor, viewer; MFA in production | P0 | ADM-01 | arch §5; ADR-004 |
| FR-21 | No trading, custody, or visitor wallets | P0 | WEB-01, PRD-01 | arch §2 |
| FR-22 | Illustrative data cannot ship as real | P0 | DB-06, API-01, PRD-05 | arch §12 |
| FR-23 | SEO titles, canonical, sitemap; crawler-visible head | P0 | SOC-01, SOC-04 | arch §15; UX §17 |
| FR-24 | Share / copy link | P0 | SOC-03 | UX §10 |
| FR-25 | Mobile-first responsive nav | P0 | WEB-01, WEB-10 | UX §5 |
| FR-26 | Accessible money, badges, chart table | P0 | WEB-02, WEB-08, PRD-04 | UX §14–15 |
| FR-27 | Empty, error, stale, unpriced, liquidated copy | P0 | WEB-09 | UX §16 |
| FR-28 | Health and ready checks | P0 | FND-03, API-01 | arch §11 |
| FR-29 | Env validation, no secrets in git | P0 | FND-04, PRD-05 | arch §17 |
| FR-30 | Solana activity parser | P1 | INT-02 | arch §9 |
| FR-31 | Automated venue connectors beyond manual | P1 | INT-01 interface; per-provider later | arch §2 P1 |
| FR-32 | Public CSV of leaderboard metrics | P1 | P1-01 | UX §8; ADR-011 |
| FR-33 | Multi-series comparison chart and tx markers | P1 | P1-02 | ADR-012 |
| FR-34 | Weekly frozen leaderboard revision and export | P1 | P1-03 | arch §10, §18 M5 |
| FR-35 | Social metric snapshots, manual method | P1 | SOC-05 | arch §6 |
| FR-36 | Analytics events, non-PII | P1 | SOC-02 | UX §20; ADR-016 |
| FR-37 | R2 media upload | P1 | ADM-06 | ADR-010 |
| FR-38 | Newsletter / follow | P2 | — | arch §2; UX §24 |
| FR-39 | SSE stream | P2 | — | arch §11 |
| FR-40 | Light theme | P2 | — | UX §6 |
| FR-41 | Postiz scheduling | P2 | — | arch §13 |
| FR-42 | Subtitles hosting pipeline | P1 | field on content in DB-04; file pipeline deferred | arch §2 P1 |
| NFR-01 | NUMERIC money, string DTOs | P0 | DB-02, FIN-01 | arch §5, §12 |
| NFR-02 | WCAG 2.2 AA target | P0 | PRD-04 | UX §18 |
| NFR-03 | Performance budgets | P0 | PRD-04 | UX §18 |
| NFR-04 | CSP, rate limit, CORS | P0 | API-01, PRD-01 | arch §14 |
| NFR-05 | Backups and restore drill documented | P0 | PRD-02 | arch §14 |
| NFR-06 | CI typecheck and test | P0 | FND-06 | arch §4 |

P2 rows stay in this matrix with no implementation task until a new ADR.
