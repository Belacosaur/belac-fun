# Owner approval queue — 21 October 2026

Wallet: `3nJzqZMc4WsGhCmD7vG2SmUzHDyD3Q58vxLbWUvUjSLX`.
The owner connects Solflare and approves every transaction. No owner key, signed transaction or standing trade permission is sent to the API. Automated execution stays disabled.

## Station scope

| Station | State | Proposed entry |
| --- | --- | --- |
| 1 Jupiter Swap | Owner review available | 10 USDC exact-in SOL purchase, retained as WSOL |
| 2 Raydium | Proposal only / WAIT | No qualifying entry in the latest scan; entry and exit rules still need review |
| 3 Jupiter Perps | Proposal only / WAIT | No qualifying long; market, leverage, liquidation buffer, funding and exit rules still need review |
| 4 Pacifica | Proposal only / WAIT | No qualifying short; market, leverage, liquidation buffer, funding and exit rules still need review |
| 5 Meteora | Already active | Preserve its LP, residual WSOL and allocation cash; no duplicate entry |
| 6 Kamino | Owner review available | Direct 10 USDC lending, no borrowing or looping |
| 7 Pump.fun existing coin | Paused | User instruction |
| 8 Orca | Owner review available | Atomic SOL acquisition and SOL/USDC concentrated liquidity, approximately ±20% range |
| 9 Ript | Pending | User is building a custom pack |
| 10 Pump.fun launch | Paused | User instruction |

Research run `8c28753d-edc3-4f4e-b6a3-8731f1236a7a` completed against the new wallet: 59 sources, zero failed sources. It found no qualifying Raydium, Jupiter Perps or Pacifica candidate. The chosen SOL benchmark, lending and liquidity experiments do not establish a trading edge or guaranteed return.

## Fresh unsigned verification

Mainnet RPC reads and simulations only. These previews did not move funds. Amounts change on refresh.

| Entry | Simulated USDC spend | Maximum USDC spend | Network fee SOL | Recoverable rent SOL |
| --- | ---: | ---: | ---: | ---: |
| SOL, slot 459547596 | 10.000000 | 10.000000 | 0.000006000 | 0 |
| Kamino, slot 459546953 | 10.000000 | 10.000000 | 0.000005000 | 0.001488440 |
| Orca, slot 459547611 | 9.824943 | 9.874067 | 0.000010000 | 0.007143520 |

All three also passed independent browser-side semantic checks and fresh unsigned simulations. Each preview starts from the same unchanged wallet, so its fee-pool-after figure is not a cumulative forecast. At those costs, all three together would leave approximately 0.012293221 native SOL from the observed 0.020946181 SOL pool. Final costs must be refreshed sequentially.

SOL is retained as WSOL to separate investment exposure from native operating SOL and preserve Meteora's existing shared token account. Direct Kamino yield is variable (observed approximately 4.576% annualized); smart-contract, USDC and withdrawal-liquidity risks remain. Orca can suffer impermanent loss and stop earning fees outside its range. Rent is locked account capital, separate from strategy return and network fees.

## Protocol and persistence

- `GET /v1/entries` returns the owner-authenticated queue and proposals.
- `POST /v1/entries/prepare` accepts only station 1, 6 or 8, exactly a 10 USDC budget, and an Orca mint public key generated in the browser. The API performs public reads and unsigned simulation, then persists one immutable message for review.
- `/:id/begin` atomically claims the exact message hash. `/:id/signature` records the public signature before the browser broadcasts. There is no execute endpoint.
- Wallet login reuses the existing origin-bound, one-time message challenge. The backend never receives owner signatures as transaction bytes or ephemeral mint secrets.
- PostgreSQL migration `0011_station_entries` reserves one potentially signed entry across the wallet and one confirmed entry per station. The existing Meteora queue shares the advisory lock in both directions.
- Unsigned expired reviews can be replaced. Potentially signed or unknown outcomes keep their reservation until finalized receipt verification or verified chain expiry. An unexplained balance change remains blocked for manual reconciliation.
- Before publishing another allocation, subtract cash already assigned to all confirmed stations, including Meteora. Preserve all starting WSOL and use native SOL for reviewed fees/rent only, with at least 0.01 SOL remaining.
- Browser validation checks message bytes, programs/accounts, cap, signer set, fresh source balances, actual lookup-table contents, mainnet height, network fee and simulation. It verifies the returned owner signature and rechecks expiry/account connection immediately before sending.
- Only finalized transactions with the reviewed message, owner, principal deltas, account rent and network fee become receipts. Failed transaction fees are recorded once, separately.
- Sync reads each receipt's inventory and preserves position history. Pending or simulated allocations never become live screen P&L. USDC is valued at $1; SOL is priced from a checked SOL/USDC pool.

`STATION_PREPARATION_ENABLED=true` enables these unsigned review routes. `EXECUTION_ENABLED=false` remains unchanged. Meteora preparation can be disabled now that its one challenge position is active. Entries are prepared on demand by the API; the sync worker independently reconciles and tracks them. The background execution worker has no signing or broadcasting capability.

Reference protocols: [Jupiter owner signing and confirmation](https://developers.jup.ag/docs/swap/v1/send-swap-transaction), [Orca documentation](https://docs.orca.so/), and the pinned Kamino/Orca program layouts used in the adapters.

## Release status

Implementation commit `89af23f` is pushed to `main`. Final verification: 339 unit/integration tests, the real-browser queue check, typechecks, lint and both builds passed. Independent review findings for stale Orca valuations and orphaned unsigned preparations were fixed and regression tested.

The release is **not deployed yet**. At 07:46 UTC on 21 October, Railway rejected the API upload with `Deploys have been paused temporarily`; its [official status page](https://status.railway.com/) reported builds paused from 07:24 UTC across all build regions. Flag updates were also rejected and must be verified when service resumes. No replacement deployment ID was created. The Cloudflare production frontend was deliberately kept on its existing release so it does not expose controls against an older API.

The existing public snapshot remains healthy on the new wallet with only Meteora active. No new transactions were signed or submitted. Resume by setting the API's unsigned-preparation flag, deploying API and sync-worker, verifying their exact successful deployment IDs and disabled execution state, then publishing the verified frontend. Disable old Meteora preparation on API/execution-worker; leave `EXECUTION_ENABLED=false` everywhere. Never treat an upload request or a pending build as successful publication.
