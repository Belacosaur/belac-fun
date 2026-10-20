# Phase 4 developer prompts — ingestion and jobs

Context: The product must work with every provider at manual grade C. Do not call Solana, price vendors, or other networks in CI. Railway cron is not set up in this phase. Jobs are CLIs that exit. Advisory locks and `job_runs` rows are mandatory. SLA constant is 15 minutes (ADR-005, pending approval) as a single named constant.

Read architecture §9–10 and §20. Order: INT-01, INT-03, INT-04, INT-05, INT-06, INT-07. **INT-02 is P1** and runs after the P0 path, still with fixtures only.

### INT-01
`ProviderAdapter` in `apps/jobs/src/adapters/types.ts` matching architecture §9. Manual adapter emits `manual_evidence` only.

### INT-03
`PriceSource` interface and fixture adapter. Missing asset → null price, not 0. Observation older than the SLA constant → stale confidence.

### INT-04
`pnpm --filter @belac/jobs start <job>` for `snapshot` and `reconcile`. `pg_try_advisory_lock`. Concurrent second run writes skipped and exits 0. Unexpected errors exit non-zero.

### INT-05
Materialize `valuation_snapshots` from `packages/finance` replay. Idempotent on `(challenge_id, observed_at, calc_version)`. Quality is the worst input source. Second run does not insert a duplicate.

### INT-06
If reported equity and replay differ by more than **$0.05** (named constant), open one high-severity `reconciliation_issues` row. A second run does not duplicate an open issue of the same kind. $0.04 does not open an issue. Do not auto-resolve.

### INT-07
Pure staleness function: last success older than expected interval + 10 minutes → stale. Use it in `GET /v1/site/status`.

### INT-02 (P1, fixtures only)
Map a committed `getTransaction` JSON file to legs. No `fetch`. Unknown programs stay `unverified` with the signature kept. Deterministic reruns.

**Security:** no private keys, no RPC URL required for tests.

**Commands:** `pnpm --filter @belac/jobs test && pnpm --filter @belac/finance test && pnpm typecheck`.

**Done when:** a manual fixture deposit produces a snapshot equal to the finance fixture. Next: WEB-01.

Completion report required.
