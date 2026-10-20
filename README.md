# Belac.fun — Build package

Version 1.0 · 20 October 2026

- `architecture.md`: 21-section end-to-end architecture blueprint. Backend on Node.js/Fastify + Railway/PostgreSQL, frontend Vite/React on Cloudflare Pages, optional R2, auditable financial accounting, API/contracts, ingestion and reconciliation, release plan and security.
- `uiux_design.md`: 25-section responsive product design blueprint. All public/admin routes, wireframe, user journeys, interaction and component specs, visual tokens, accessibility, content operations, analytics, QA and handoff.

## Build order
1. Agree ten legal/operational providers and data collection method, campaign rules and wallet boundaries. Still open (ADR-009).
2. pnpm monorepo exists (FND-01). Staging Railway and Cloudflare are not created.
3. Postgres schema and illustrative seed exist (DB-01 through DB-07). Apply them on a host port that reaches the compose database.
4. Deterministic calculator and fixture adapters exist (FIN-01, FIN-02, INT-01, INT-03). They are not yet the public display path.
5. Read-only website, homepage, leaderboard, strategy proof pages, and methodology are not built yet. The route shell exists (FND-02, WEB-01 partial).
6. Admin auth, reconciliation, and editorial tools are not built. Anonymous admin HTTP returns 401.
7. Episodes and social previews are not built.
8. Threat-model, performance, responsive, and calculation QA are not finished. Finance fixtures pass. No launch.

## Guardrails
No custodial accounts, wallet private keys, auto-trading or visitor wallets in MVP. All public figures clearly labelled by source, freshness, price basis and uncertainty. No claim of Australian availability for proposed providers without due diligence.

## Source of truth
The architecture governs calculations, API and data. The UX spec governs presentation and user behavior. In conflicts involving reported financial figures, use architecture.
