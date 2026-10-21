# Belac.fun

An orbital control room for the $100 challenge: ten platform stations, a portfolio overview, live position tracking and a separate SOL fee ledger.

## Current application

- Frontend: Vite/React/Three.js, published to [belac.fun](https://belac.fun/station) on Cloudflare Pages (`belac-fun`).
- Backend: Railway API, sync worker, research worker, preparation service and PostgreSQL. See [infra/README.md](infra/README.md).
- SOL, Orca and Kamino positions are tracked from chain data. Other stations remain disabled; Ript is pending.
- Meteora supports owner wallet connection, review and browser signing for an entry capped at 10 USDC. Preparation never signs or broadcasts on the server. Automated execution remains disabled.

## Development and release

Use Node 22+ and pnpm 10.18.2. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` and `pnpm test` (database integration tests require Docker). Build with `pnpm --filter @belac/web build` and run browser tests with `pnpm --filter @belac/web e2e`.

Publish only `apps/web/dist` using `npx wrangler@4 pages deploy apps/web/dist --project-name belac-fun --branch main`. Public API and RPC hosts are allowlisted in `apps/web/public/_headers`; update that policy if changing the frontend endpoints.

Wallet keypairs and import files stay in ignored `.secrets/`. Never put private keys in `VITE_*` variables, Git, frontend assets or deployment uploads. `.env.example` contains placeholders and safe defaults; automated execution defaults to `false`. Generated research reports and screenshots stay in ignored `artifacts/`; captured browser test inputs are versioned under `apps/web/e2e/fixtures/`.

## Original planning documents

- `architecture.md`: 21-section end-to-end architecture blueprint. Backend on Node.js/Fastify + Railway/PostgreSQL, frontend Vite/React on Cloudflare Pages, optional R2, auditable financial accounting, API/contracts, ingestion and reconciliation, release plan and security.
- `uiux_design.md`: 25-section responsive product design blueprint. All public/admin routes, wireframe, user journeys, interaction and component specs, visual tokens, accessibility, content operations, analytics, QA and handoff.

## Original build order (historical)
1. Agree ten legal/operational providers and data collection method, campaign rules and wallet boundaries. Still open (ADR-009).
2. pnpm monorepo exists (FND-01). Staging Railway and Cloudflare are not created.
3. Postgres schema and illustrative seed exist (DB-01 through DB-07). Apply them on a host port that reaches the compose database.
4. Deterministic calculator and fixture adapters exist (FIN-01, FIN-02, INT-01, INT-03). They are not yet the public display path.
5. Read-only website, homepage, leaderboard, strategy proof pages, and methodology are not built yet. The route shell exists (FND-02, WEB-01 partial).
6. Admin auth, reconciliation, and editorial tools are not built. Anonymous admin HTTP returns 401.
7. Episodes and social previews are not built.
8. Threat-model, performance, responsive, and calculation QA are not finished. Finance fixtures pass. No launch.

## Guardrails
Wallet private keys remain local to their owner. Server-side signing and automated execution are disabled. All public figures must be labelled by source, freshness, price basis and uncertainty. No claim of Australian availability for proposed providers without due diligence.

## Source of truth
The architecture governs calculations, API and data. The UX spec governs presentation and user behavior. In conflicts involving reported financial figures, use architecture.
