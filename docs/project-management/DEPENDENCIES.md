# Dependencies and critical path

**Progress on 20 October 2026:** the critical path is complete through FIN-02. The next link is API-01’s remaining OpenAPI work and API-02 through API-05. Local Postgres via Docker is running, but Windows Postgres owns host port 5432, so host migrate and seed commands do not reach the compose database.

## External systems

| Dependency | Needed for | MVP? | Cost note | Blocker? |
|---|---|---|---|---|
| GitHub repo | CI and deploys | Yes | Existing account | Repo exists as local files only until remote is created. Do not create remotes until asked. |
| Railway project, API service, Postgres, cron | API + jobs | Yes, at deploy time | Paid usage possible | **Do not provision until operator approves.** Local Postgres via Docker is the dev substitute. |
| Cloudflare Pages + DNS | `belac.fun` | Yes, at deploy time | Pages free tier typical | **Do not provision until operator approves.** Domain ownership unconfirmed. |
| Cloudflare Access | Admin MFA | Recommended | Free tier may suffice | ADR-004 |
| Cloudflare R2 | Admin uploads | Phase 6 flag | Storage + ops | ADR-010 |
| Public Solana RPC | Grade A ingest | When a Solana wallet is assigned | Public RPC rate limits; paid RPC needs approval | No wallet yet (ADR-009) |
| Price API | Marks | When operator names a source | No paid vendor | ADR-008 |
| OIDC / Access certs | Admin | Phase 6 | — | ADR-004 |
| Video hosts (YouTube, TikTok, X) | Embeds | Public episodes | Embed only, no scraping | Terms reviewed per platform |
| Sentry or equivalent | Errors | Optional P1 | Paid tiers exist | Structured logs are P0; Sentry DSN stays empty until approved |
| Postiz | Scheduling | P2 | Paid | Manual/external scheduling only |
| Email/newsletter vendor | P1/P2 | No | — | Not in MVP |

## Build-time libraries (approved stack only)

- pnpm, Node.js 22 LTS, TypeScript, Vite, React, React Router, TanStack Query, Tailwind, Fastify, Zod, `@fastify/swagger`, Drizzle ORM, `drizzle-kit`, a decimal library (prefer `decimal.js` inside `packages/finance` only), Playwright for smoke (Phase 8), Vitest for unit/integration.
- Chart library: one lightweight option with a data-table fallback (recommend `visx` or a thin SVG wrapper). Pick one in WEB-08 and do not add a second.
- Do not add Redis clients, wallet adapters, or trading SDKs.

## Task dependency graph (critical path)

```text
FND-01 → FND-02 → FND-03 → FND-04 → FND-05 → FND-06
                    ↓
                  DB-01 → DB-02 → DB-03 → DB-04 → DB-05 → DB-06 → DB-07
                    ↓
                  FIN-01 → FIN-02
                    ↓
                  API-01 → API-02 → API-03 → API-04 → API-05 → API-06
                    ↓
                  INT-01 → INT-04 → INT-05 → INT-06 → INT-07
                    ↓
                  WEB-01 → WEB-02 → WEB-03 → WEB-04 → WEB-05 → WEB-06 → WEB-10
                    ↓
                  ADM-01 → ADM-02 → ADM-03 → ADM-04 → ADM-08
                    ↓
                  SOC-04 → PRD-01 → PRD-03 → PRD-05
```

Parallel after API-06:

- INT-* can proceed beside WEB-01..02.
- WEB public pages need API-03..05.
- ADM needs API admin routes (API-07) and ADR-004 approval before production auth.
- SOC-01 (OG images) needs ADR-003 approval.
- INT-02 Solana adapter can be written against fixtures before a wallet exists; live RPC calls wait for ADR-008/009.

## Critical path narrative

The launch blocker sequence is:

1. Monorepo and contracts (Phase 1).
2. Immutable schema (Phase 2).
3. Deterministic finance tests on fixtures (FIN-01/02) **before any public number**.
4. Read APIs that expose quality and `asOf` (Phase 3).
5. Manual intake + snapshot job so a number can exist without provider APIs (INT-01, INT-04, INT-05).
6. Public home, leaderboard, challenge proof, methodology (Phase 5).
7. Admin correction and reconcile with audit (Phase 6) before real money is recorded.
8. Smoke, backup runbook, illustrative-data production guard (Phase 8).

Automated Solana/provider connectors, R2, OG image rendering, CSV, and analytics are off the critical path.

## Data dependencies

- Leaderboard rows require `valuation_snapshots` or an explicitly empty state. Do not compute ad hoc floats in the React layer.
- Public challenge pages require challenge, provider, latest snapshot, and source-quality. Transactions can be an empty list with copy from UX §16.
- Campaign totals sum challenge equity once (architecture §8). A failed provider contributes last valid snapshot plus a coverage warning, or is excluded from the total and listed as unknown. **Assumption:** unknown challenges are excluded from the summed total and the UI shows `n/10 current`. They are never treated as `$0` unless liquidation is confirmed.

## Deployment dependencies (later, not now)

Order when operator approves spend: staging Postgres → staging API → migration → staging Pages → smoke → production backup → production migration → API → Pages → DNS. Expand/contract migrations only. Cron after first successful snapshot job in staging.

## Integration levels (architecture §9)

Every provider is A (on-chain), B (venue API), or C (manual). The app must run with all ten at level C. Level A/B adapters are added per provider after a discovery note (fees, ToS, Australia availability, pagination, rate limits).
