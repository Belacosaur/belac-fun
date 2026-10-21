# Live studio connections

Implemented 20 October 2026; active-position valuation added 21 October. Read-only; no trading or signing key is deployed.

## Deployment

Existing Railway project: `6e3aacfe-a828-4316-8f17-89ae4417fab6`, production environment.

| Service | ID | Role |
|---|---|---|
| belac-fun | dbf2411e-e2b8-4323-a287-86c5b531f0f5 | Public API |
| sync-worker | 9f2001e2-5f8b-40c8-b82d-e3ef41fdb767 | Private polling worker |
| execution-worker | 06d4455b-3a4f-42a8-94fa-bd0ceafa099a | Private, strictly disabled execution foundation |
| Postgres | f4e10be2-3ff2-43ca-9350-6d2c15b751c2 | Existing persistent database |

API: https://belac-fun-production-c49e.up.railway.app/v1/studio

Both app services use the root Dockerfile. `SERVICE_ROLE=sync-worker` selects the worker; the default selects the API. The worker has no public domain. Both expose `/health/live` for Railway health checks; the API also exposes `/health/ready` for Postgres connectivity.

The fourth service also uses the root Dockerfile with `SERVICE_ROLE=execution-worker`. It stays idle with `EXECUTION_ENABLED=false`; see [execution-service.md](execution-service.md). Funding does not activate it.

`DATABASE_URL=${{Postgres.DATABASE_URL}}` uses private networking. `EXPERIMENT_WALLET_ADDRESS` is the public address, never a private key. API production auth remains `AUTH_MODE=access`; this public read endpoint grants no trading/admin capabilities.

```powershell
railway up --project 6e3aacfe-a828-4316-8f17-89ae4417fab6 --environment production --service belac-fun --detach
railway up --project 6e3aacfe-a828-4316-8f17-89ae4417fab6 --environment production --service sync-worker --detach
railway deployment list --service sync-worker --environment production --json
railway logs --service sync-worker --lines 30
```

Always confirm deployment `SUCCESS` and a fresh `/v1/studio` response after uploading.

## Current coverage

| Station | Connection | Remaining work |
|---|---|---|
| 1 · Jupiter Swap / buy & hold | Finalized 10 USDC entry attributed to 0.093680067 native SOL; live pool mark and P&L | New transactions require explicit receipt reconciliation; automatic execution disabled |
| 2 · Raydium / active spot | Live Raydium quote API probe plus shared wallet balances | Select tokens; attribute fills and reinvestment to this strategy |
| 3 · Jupiter Perps / long | Public positions API, open longs only | Select market; funded equity/fee reconciliation; nonempty USD value stays unknown |
| 4 · Pacifica / short | Public positions + account equity when account exists | Select short market; reconcile deposits, funding and fees; account totals include all positions |
| Meteora | DLMM open portfolio, all-pool totals including unclaimed fees | Select pool; other Meteora products need separate adapters |
| 6 · Kamino / USDC lending | Portfolio API, strictly scoped to lending; other `KAMINO_PRODUCT` values rejected | Choose USDC reserve; current observation is lending product total, not USDC-only; rewards excluded |
| 7 · Pump.fun / existing coin | Mainnet Pump/PumpSwap executable program checks and shared wallet token balances | Select mint; tag trades separately from the launch strategy; execution adapter |
| 8 · Orca / concentrated LP | Verified NFT and liquidity; official SDK inventory/fee quote plus attributed residual cash and WSOL | New deposits, withdrawals or fee claims require reconciliation; automatic execution disabled |
| 9 · Ript / weekly pack | Pending by owner request; polling disabled | Owner builds custom challenge pack; production integration later |
| 10 · Pump.fun / own launch | Mainnet Pump/PumpSwap program reads and shared wallet reader; no token launched | Name, symbol, metadata, mint and budget; separate cost/proceeds attribution; creation adapter |

An unconfigured strategy never inherits the entire wallet balance. Stations 1 and 8 use public finalized entry receipts pinned in `apps/jobs/src/active-positions.ts`. Other platform observations remain account/product read scopes without attributed strategy P&L, and all execution remains disabled.

Public wallet: `HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j`.

The owner confirmed $100 strategy capital plus a separately accounted SOL pool for fees and account rent. See [funding-plan.md](funding-plan.md) for the exact remaining decisions and implementation tasks. Read connectivity does not mean a strategy is configured or execution is implemented.

## Data semantics

- API reads Postgres only; the browser never calls upstream providers or receives secrets.
- Worker uses bounded requests, per-source failure isolation, a Postgres advisory lock, transactional snapshot writes and automatic next-cycle retries.
- `studio_snapshots` holds the latest observation. `studio_sync_history` keeps 90 days of observations. Migration `0007_live_sync.sql` is additive and idempotent; the worker bootstraps these tables on startup without touching existing campaign/ledger data.
- Failed reads retain the last successful source value and timestamp with `unavailable` status. The browser marks network failures and snapshots older than three minutes stale.
- `packages/contracts/src/challenge.ts` is the shared active lineup. Each observation carries a stable `strategyKey`. Worker fallback requires the same wallet, network, station, provider and strategy; the browser ignores legacy/mismatched strategy observations. Old history is retained without relabelling it as new strategies.
- `PlatformBalance.connection` records the verified read scope (quotes, positions, portfolio or program accounts), independently of position/setup status. An unavailable or stale observation never advertises a current connection. Ript has no connection claim while pending.
- Ript's earlier catalog investigation is preserved as history. Current polling is disabled; no inventory, quote or expected value is treated as a challenge holding.
- The active Orca position includes verified NFT ownership, pool, exact liquidity and tick bounds. A single mainnet account batch reads wallet inventory, position, pool and boundary ticks; official core quotes compute LP principal and uncheckpointed swap fees. Incentive rewards without supported valuation fail closed. Pump program reads remain deduplicated across stations 7/10.
- On-chain reads verify the full mainnet genesis hash. Orca RPC calls are restricted to reads with a 20-second overall deadline. An optional `JUPITER_API_KEY` is accepted only by the private worker.
- An unindexed or incomplete Kamino response is unknown, not zero. Its indexed position and price timestamps must be within 15 minutes.
- Wallet quantities are decimal strings. Scope oracle prices value supported assets only when fresh (maximum five minutes, further bounded by the feed's max age). Unknown assets or a price failure make the complete wallet USD total unavailable; quantities remain visible. USD marks are estimates, not realized returns.
- Raw wallet USD excludes platform accounts and may include unpriced position NFTs. Challenge equity instead sums attributed SOL hold, Orca inventory/accrued fees/residuals and the unallocated 80 USDC. Position NFTs are proof of ownership, not another asset value to add.
- Recent activity contains the latest 25 wallet signatures, not a complete accounting ledger.
- Strategy P&L compares each active equity to its 10 USDC starting allocation. SOL is marked from the current SOL/USDC pool state; USDC is marked at $1. These are marks, not guaranteed liquidation proceeds. Future exit costs are excluded.
- The operating SOL reserve, network fees and account capital are separate from strategy equity/P&L. Sender-funded USDC account capital and the 0.000100 USDC funding surplus are also reported separately. Additional deposits are unassigned, never automatic trading profit. Inventory shortfalls or changed NFT ownership/liquidity/range require reconciliation.
- A batch context must have a chain timestamp within 90 seconds (at most 30 seconds future tolerance). A later observation must advance the context slot; stuck or regressed slots are stale. Failed valuations retain prior data with its last-success timestamp and no new history point. At most 120 measured samples per active strategy are retained in each snapshot; no illustrative chart values are generated.
- The browser polls every 30 seconds; the worker waits at least 60 seconds between sync cycles. Public Solana RPC is the initial endpoint; `SOLANA_RPC_URL` supports switching to a dedicated endpoint if rate limits become an issue.
- No deposits, swaps, orders, approvals, or wallet authorizations are performed.

## Verified official sources

- [Solana RPC](https://solana.com/docs/rpc/http/gettokenaccountsbyowner)
- [Pacifica positions](https://docs.pacifica.fi/api-documentation/api/rest-api/account/get-positions), [account equity](https://docs.pacifica.fi/api-documentation/api/rest-api/account/get-account-info)
- [Jupiter Perps API](https://perps-api.jup.ag/v1/docs)
- [Raydium Trade API](https://docs.raydium.io/sdk-api/trade-api)
- [Orca SDK documentation](https://docs.orca.so)
- [Ript public pack catalog](https://ript-backend-production.up.railway.app/opening/packs), [local investigation](ript-packs.md)
- [Meteora OpenAPI](https://dlmm.datapi.meteora.ag/swagger-ui/)
- [Kamino portfolio](https://kamino.com/docs/build/developers/portfolio), [response semantics](https://kamino.com/docs/build/developers/portfolio/response), [Scope prices](https://kamino.com/docs/build/developers/oracle/data/prices)

## Frontend

`/station` consumes `/v1/studio` via `VITE_API_BASE_URL`, defaulting to the deployed API above. API CORS permits the existing Pages origins and local ports 5186/4173. This rollout updates the local studio and Railway; publish the web build separately when ready.

## Validation

Focused backend/frontend tests cover empty balances, decimal precision, stale oracle prices, unknown/unindexed data, retained values after failures, and API snapshot freshness. Browser checks cover the actual deployed feed and camera controls.

Updated lineup deployed to `sync-worker` as `a6b68140-105f-4986-9c84-a7fb08f4d4e7` on 20 October 2026; Railway reported `SUCCESS`. The public API returned a fresh snapshot with all ten new strategy keys, no open Jupiter longs, and `Catalog: devnet · 3 packs from $25` for Ript. The execution service configuration still reports `EXECUTION_ENABLED=false`. Worker tests, frontend feed/room tests, type checks, lint and web build passed; the browser's deployed-feed check verified the new rows and captured Ript and Orca screens.

The subsequent read-scope release `04d958f0-d995-4289-a98c-0432da06d6bf` also reported `SUCCESS`. It adds quote probes, Orca SDK position discovery, Pump program reads and explicit connection scope, and disables Ript catalog polling. Two fresh public snapshots confirmed nine active successful read scopes, Ript `pending`, Kamino `not_indexed`, and an unfunded wallet. Evidence: `artifacts/deployed-platform-check-20261020.json`. All 24 focused worker/execution tests, four frontend feed tests, workspace typecheck, lint and web build passed. The browser live-feed test also passed and visually verified the new scope/setup labels. The execution service remains explicitly disabled.

The repository's Postgres Testcontainers suites require Docker. On this machine the full test command cannot complete without a working container runtime. Affected suites: `packages/db/src/db.test.ts`, `apps/jobs/src/lock.test.ts`, `apps/jobs/src/persist.test.ts`, and the seeded section of `apps/api/src/api.test.ts`. The runnable tests pass; deployed database readiness and successive persisted sync timestamps are checked separately.
