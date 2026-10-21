# Read-only challenge research worker

## Goal and authorization

Build and deploy a private research worker in the existing Railway project, run the first complete ten-station dry run, preserve Ript as pending, and keep execution disabled. The owner approved the pipeline and requested implementation on 20 October 2026.

## Approach

Use shared, bounded public GET collectors and deterministic station-specific evaluators. Persist immutable source observations, policy version, candidates, rejection reasons, data gaps and the complete report in Postgres. Reuse the API to expose saved reports. Do not put history collection in the wallet sync loop or create one service per platform.

The first version is a research screener, not a validated trading system. It must never turn missing security, history, cost, funding, range or risk inputs into entry approval. WAIT is legitimate. Ript is pending without network calls. Own-token launch is a readiness assessment, not a purchased candidate. No signer, transaction builder, submission, deposit or execution queue access.

## Files and sequence

1. Add shared report types in `packages/contracts/src/research.ts`.
2. Write focused failing tests for screening, stale/malformed/missing inputs, costs, station coverage, pending Ript and read-only transport.
3. Add `apps/jobs/src/research/` collectors, policy/evaluators, report rendering and persistence; add one-shot CLI and service entrypoint following `sync-worker.ts` health/lock/shutdown conventions.
4. Add additive migration `0008_research.sql`, register it, and add read-only latest/history report API routes with tests, following `studio-routes.ts`.
5. Add research role to `infra/start.mjs`; document configuration and repeat-run command. Do not modify approved station aesthetics.
6. Run local live collection and save JSON/Markdown artifacts. Check source freshness and station coverage. Fix real adapter failures where feasible; report remaining gaps honestly.
7. Deploy research-worker and API, verify exact deployments, saved report retrieval, and execution-worker's disabled configuration/status. No public worker domain.

## Validation

Focused Vitest tests, jobs/API typecheck, lint and API build. Live dry run against current official sources plus persisted production report retrieval. Verify no Ript polling, no provider writes, no signing material, all ten station identities, source failures explicit, and no candidate marked executable. Initial policy is versioned and unvalidated; no performance claim from one run.

## Limits

No funding, positions, launch, trading adapters, changes to execution flags, automatic strategy activation, invented P&L, historical LP return estimates from headline APR, or automatic weekly capital replenishment. Separate SOL fees/rent are tracked as unknown estimates until priced. Existing-position comparisons require future strategy attribution, so reports cannot claim KEEP/REPLACE without a binding.
