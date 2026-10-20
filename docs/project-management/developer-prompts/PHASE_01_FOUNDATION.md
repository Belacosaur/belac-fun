# Phase 1 developer prompts

Read `architecture.md` §4–5 and `docs/project-management/ARCHITECTURE_DECISIONS.md` ADR-001, ADR-002, ADR-015, ADR-017. Do not implement later phases. Do not create Railway, Cloudflare, or paid accounts. Do not commit secrets.

Operating rules: read the repo before editing; one task id per session; leave typecheck and tests passing; no placeholder financial figures; report using the completion template at the bottom.

Approved stack: Node 22, pnpm, TypeScript, Vite, React, React Router, Tailwind, Fastify, Zod, Vitest, ESLint.

---

## Prompt FND-01

**Objective:** Create the pnpm workspace skeleton.

**Changes:** Private root package, `pnpm-workspace.yaml`, base tsconfig, `.nvmrc` (`22`), `.gitignore` (`node_modules`, `dist`, `.env`, `.env.*` except `.env.example`). Packages `@belac/web`, `@belac/api`, `@belac/jobs`, `@belac/contracts`, `@belac/db`, `@belac/finance`, `@belac/ui`, `@belac/config` with private package.json files and a `tsc --noEmit` typecheck script each. Shared ESLint and Prettier via `@belac/config`. Root scripts `typecheck`, `lint`, `test`. `docker-compose.yml` for Postgres 16 with user/password/db `belac` / `belac` / `belac` on port 5432, documented as local-only. `infra/README.md` says cloud resources are not provisioned.

**Boundaries:** No React routes, no Fastify routes, no Drizzle schema.

**Database:** Compose file only. Do not require a running database for typecheck.

**Security:** No secrets.

**Tests:** None.

**Commands:** `pnpm install && pnpm typecheck && pnpm lint`

**Done when:** those commands exit 0 and the directory list matches architecture §4.

**Report:** completion template.

---

## Prompt FND-02

**Objective:** Vite React TypeScript app with placeholder routes.

**Depends:** FND-01.

**Changes:** In `apps/web`, routes `/`, `/challenge`, `/challenge/:slug`, `/leaderboard`, `/episodes`, `/episodes/:slug`, `/methodology`, `/about`, `/status`, `/privacy`, `/terms`, `/admin`. Each shows an `h1` with the route name. Skip link “Skip to content”. Tailwind with CSS variables from `uiux_design.md` §6 (`--bg` through `--focus`). Dark canvas. Text wordmark “Belac.fun”. No API client. No wallet libraries.

**UI constraints:** System font stack. `font-variant-numeric: tabular-nums` on a utility class for later. Minimum tap target class of 44px available.

**Tests:** Vitest and Testing Library: memory router renders each path’s heading.

**Commands:** `pnpm --filter @belac/web test && pnpm --filter @belac/web build && pnpm typecheck`

**Done when:** build succeeds and tests pass.

---

## Prompt FND-03

**Objective:** Fastify health endpoints.

**Depends:** FND-01.

**Changes:** `apps/api` listens on `PORT` or 3000. `GET /health/live` → 200 and body `{data:{status:"ok"},meta:{requestId}}`. `GET /health/ready` → 200 when `APP_ENV=local` and `DATABASE_URL` is empty; if `DATABASE_URL` is set, run `select 1` and return 503 when it fails. JSON logs with request id. Do not connect to cloud databases.

**Tests:** Vitest inject: live 200; ready 503 with `DATABASE_URL=postgres://invalid:5432/none` and a short connection timeout.

**Commands:** `pnpm --filter @belac/api test && pnpm typecheck`

**Done when:** tests pass. Do not leave the server running as part of completion.

---

## Prompt FND-04

**Objective:** Zod environment parser in `@belac/config`.

**Depends:** FND-01.

**Schema:** `APP_ENV` local|staging|production. `DATABASE_URL` optional in local, required otherwise. `ALLOWED_ORIGINS` string. `PORT` optional. `SESSION_SECRET` required outside local. Optional `SOLANA_RPC_URL`, `PRICE_API_BASE`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. `AUTH_MODE` access|local_bypass. `ALLOW_ILLUSTRATIVE` boolean default false.

**Rejections to test:** `AUTH_MODE=local_bypass` with `APP_ENV=production`. `APP_ENV=production` and `ALLOW_ILLUSTRATIVE=true`. `APP_ENV=staging` without `DATABASE_URL`.

**Files:** `packages/config`, root `.env.example` with empty values.

**Security:** Example file has no real credentials.

**Commands:** `pnpm --filter @belac/config test && pnpm typecheck`

---

## Prompt FND-05

**Objective:** Shared Zod contracts.

**Depends:** FND-04.

**Changes:** Enums for campaign state (`draft|scheduled|active|frozen|closed`), challenge state (`planned|live|paused|closed|invalidated`), source status (`verified_onchain|verified_provider|manual_evidence|unverified`), ledger event types from architecture §6, roles (`owner|editor|viewer`). DTOs: error envelope, campaign summary, leaderboard row, challenge detail, transaction row, position row, content card, site status. Money fields are decimal strings. Every public financial DTO includes `isIllustrative` boolean and `asOf` ISO datetime. Quality field uses the source-status enum plus `estimated` where architecture §8 says indicative marks.

**Tests:** A payload with numeric `equityUsd` fails. A string equity payload passes. Illustrative flag required.

**Commands:** `pnpm --filter @belac/contracts test && pnpm typecheck`

**Done when:** API and web are not wired yet; contracts compile alone.

---

## Prompt FND-06

**Objective:** CI workflow without deploy.

**Depends:** FND-02, FND-03, FND-05.

**Changes:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` on push and pull_request. No deploy, no secrets.

**Commands:** Run those four locally. If lockfile was missing, commit-ready lockfile must exist after install (the human commits only when they ask).

**Done when:** local commands match the workflow steps and exit 0.

---

## Completion report (required after each task)

**Completed:**

**Files Changed:**

**Database Changes:**

**Tests:**

**Verification:**

**Issues:**

**Next Steps:** the next prompt in this file, or Phase 2 `DB-01` after FND-06.
