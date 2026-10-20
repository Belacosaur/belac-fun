# Quality assurance plan

**Progress on 20 October 2026:** `pnpm typecheck` and `pnpm lint` pass. Finance fixtures cover the financial table below. Playwright, axe, and the browser matrix are not run.

## Command baseline (once the monorepo exists)

| Check | Command | When |
|---|---|---|
| Types | `pnpm typecheck` | Every task |
| Lint | `pnpm lint` | Every task |
| Unit | `pnpm test` | Every task that adds logic |
| Finance | `pnpm --filter @belac/finance test` | Any calculator or ledger change |
| API integration | `pnpm --filter @belac/api test` | Endpoint or SQL change |
| Migrations | `pnpm --filter @belac/db migrate` against empty local Postgres, then tests | Schema tasks |
| Web build | `pnpm --filter @belac/web build` | UI tasks |
| E2E smoke | `pnpm --filter @belac/web e2e` | Phase 8 and critical-flow changes |

A task is not done if typecheck fails. Do not add `any` to silence finance types.

## Test layers

1. **Finance unit / property tests** (`packages/finance`): pure functions, no network.
2. **Contract tests**: Zod schemas accept and reject fixture payloads; OpenAPI document generates.
3. **Adapter fixtures**: recorded JSON in `apps/jobs` mapped to normalized events; no live HTTP in CI.
4. **Postgres integration**: Testcontainers or docker-compose service. Assert unique `(challenge_id, external_key)`, reversal rows, and snapshot uniqueness.
5. **API tests**: Fastify `inject`. Envelope `{data, meta}` and `{error:{code,message,requestId}}`.
6. **UI tests**: Vitest + React Testing Library for Money, SourceBadge, empty/error/stale. Playwright smoke in Phase 8 for journeys 1–3 and 6 in UX §13.
7. **Accessibility**: keyboard focus, names on sort controls, chart table present, contrast of tokens against WCAG 2.2 AA before locking colors. Automated axe on home and challenge in Phase 8.
8. **Security**: admin routes 401 without identity; local bypass rejected when `APP_ENV` is staging or production; upload intent rejects wrong MIME; markdown stripped of script; CORS allowlist; ledger UPDATE of amounts denied for the app DB role.
9. **Build**: production web build contains no `VITE_` secret other than API base URL and public env name.
10. **Deploy smoke** (after infra exists): `/health/ready`, campaign summary, one challenge, 404, admin redirect to Access.

## Financial cases that must exist as named tests

| Case | Expectation |
|---|---|
| Opening $10 deposit | Starting equity 10; P&L 0 before marks |
| Swap with fee in a second token | Fee reduces equity; fee not also subtracted as a second USD haircut if already in balances |
| Partial fill | Only filled quantity changes position; remainder is not a balance |
| Realised vs unrealised | Closed leg books realised; open mark books unrealised; net P&L equals ending equity − start − external contributions |
| Missing price | No ROI update; quality indicates value unavailable; last good mark retained and labelled |
| Stale balance | Age > SLA → not `Current` |
| Liquidation | Equity 0 and confirmed flag; UI may show total loss of the $10 allocation |
| Manual reversal | Original row unchanged; new reversing event; rebuilt snapshot matches |
| Provider equity disagrees beyond tolerance | `reconciliation_issues` row; challenge not shown as Current |
| Double import of same signature | Second insert conflicts; balances unchanged |
| Token decimals | 6-decimal mint does not shift by 9 places |
| Collateral and notional | Perp equity uses account equity once, not collateral + unrealised twice |
| LP add/remove | Reserves and uncollected fees follow the adapter’s documented method; test states which method |
| Negative zero | Presentation is 0 |
| Illustrative campaign | API includes `isIllustrative: true`; production guard covered by a unit test on the env predicate |

Tolerance for the M1 gate: **$0.0001** on fixture equity unless a test names a coarser source.

## Data ingestion QA

- Idempotent rerun of a job window.
- Advisory lock: overlapping run records `skipped`.
- Watermark advances only after commit.
- Failed provider does not throw away the last snapshot.
- Source status never upgraded from manual to `verified_onchain` without a signature and parser result.

## Responsive and content QA

Viewports: 320, 375, 390, 768, 1280, 1440. States: pre-start, active, complete, stale, unpriced, liquidated, filter-empty, network error. Long provider names wrap. No horizontal page scroll at 320px.

## Completion evidence

Each task report lists commands and pass/fail. Financial tasks paste the fixture id and expected vs actual equity. UI tasks state which empty/error/stale state was rendered.
