# Kamino direct USDC preparation

Approved scope: prepare and simulate the cheaper direct USDC lending route, capped at 10 USDC, and prepare screen tracking. No signing, submission or execution activation.

- [x] Build bounded unsigned direct deposit/redeem probes from pinned official instruction layouts; validate mainnet, identities, budget, account effects and unchanged real balances. Simulate entry and atomic entry/redemption/ATA closure to prove the exit path without inventing a funded position.
- [x] Add tested read-only receipt-token valuation with exact mint/owner checks, fail-closed freshness and attribution. Keep proposed deposits separate from actual assets and P&L.
- [x] Show prepared amount, observed receipt tokens/value, rate and disabled state on Kamino's monitor and position details. No fake live performance.
- [x] Verify targeted tests/types/build/browser, independently review, deploy the read-only sync and verify public state plus disabled execution.

Use existing active-position reader, SecurityRpc, lending-layout parser and unsigned simulation pattern. Reject the standard obligation route because it creates unnecessary account capital for this $10 deposit. Preserve SOL/Orca accounting, fee-pool boundaries and Ript pending. A confirmed public entry receipt is required for future allocation/P&L attribution.

Validation and production release evidence: docs/integrations/kamino-direct-review-2026-10-21.md and artifacts/kamino/2026-10-21/direct/. Release 4156d5f5-a75b-4903-84c6-4c70ad21a381 reached SUCCESS; fresh public API verification confirms prepared state and unchanged allocations/fee pool.
