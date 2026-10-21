# Owner-approved wallet recovery

The old experiment wallet is being retired after its import key appeared in a diagnostic. The owner approved closing positions, converting recovered USDC to SOL, reclaiming eligible account capital and sweeping SOL to the new wallet. No private key is read by recovery code or requested by the frontend.

- Source: `HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j`.
- Fixed destination: `3nJzqZMc4WsGhCmD7vG2SmUzHDyD3Q58vxLbWUvUjSLX`.
- Frontend: `/recover`, using Wallet Standard with the old source account selected until the sweep is finalized.
- Production API must have `RECOVERY_MODE=true`. Both Meteora preparation and new signing claims are rejected. The execution service retains `EXECUTION_ENABLED=false` and `METEORA_PREPARATION_ENABLED=false`.

## Checkpoints

1. Close Orca through its protocol instructions, withdrawing liquidity and fees and closing the position, NFT and Token-2022 mint.
2. Redeem all direct Kamino collateral receipts to USDC and close the empty receipt account. This is the direct receipt-token route, not an obligation or leveraged position.
3. Quote and simulate an ExactIn conversion of the entire current USDC balance through the existing Orca SOL/USDC pool, with 50 bps slippage. Output remains WSOL until cleanup.
4. Scan both SPL token programs, reject unsupported non-empty accounts or different authorities, unwrap WSOL and close eligible accounts. Both backend and browser pin scans to recent slots and check the full owner account set.
5. Scan again and sweep the entire remaining native SOL balance minus its freshly priced base fee to the fixed destination. No priority fee or other instruction is included in the sweep.

Each non-sweep transaction has a 500,000 CU limit and 1,000 micro-lamports/CU price. Current simulations price its one-signature network fee at 5,500 lamports; the sweep is priced independently. Fees and recovered rent are recorded separately. WSOL rent uses its native rent reserve so unsynced SOL deposits are not misclassified as rent.

## Authorization and retries

The existing origin-bound, source-wallet login grants access to unsigned preparation. It does not authorize a transaction. The browser validates instructions, recipients, amounts, bounds and mainnet ownership, runs an independent simulation, and asks Solflare to sign. It verifies the signature and message, records the public signature in PostgreSQL, then broadcasts from the browser with preflight enabled. The server has no signing or submission method.

During the 21 October checks Publicnode returned a slot number from `getBlockHeight`; the official mainnet RPC returned the correct height. Recovery expiry decisions therefore use the official endpoint. That endpoint rejects direct browser requests, so an owner-authenticated `/v1/recovery/read` route relays only `getBlockHeight` and slot-pinned `getTokenAccountsByOwner` for the fixed source wallet and the two supported token programs. It accepts no URL override or transaction method. Other browser account checks and unsigned simulations remain direct independent reads.

One database reservation protects each pending attempt. Signing/submitted attempts remain reserved until a finalized receipt is verified or the blockhash has expired with no chain status. No financial transaction is automatically retried. Abandoned preparation leases expire after two minutes. A preparation lasts 45 seconds for user review; if it expires while Solflare is open the browser does not submit it.

The read-only sync reconciles saved signatures, removes closed positions and stale P&L, and follows the new wallet after a verified sweep. The original transaction history and strategy attribution remain archived. Recovered SOL includes strategy capital and operating capital; it is not labelled as strategy profit.

## Evidence and boundaries

Captured public fixtures replay unsigned mainnet Orca closure, direct Kamino redemption and USDC-to-SOL swap simulations. The latter two are explicitly diagnostic previews on the pre-withdrawal balances and cannot pass the browser's action-order check. Each executable later step is refreshed and simulated only after the previous step finalizes. No claim that cleanup/sweep has happened is made from a simulation.

Tests cover fixed source/destination, phase order, message tampering, rejected signatures, signature-before-broadcast ordering, stale token scans, slot chaining, concurrent signing claims, abandoned preparation, expired reviews, sticky sweep confirmation and rent classification. Browser checks cover the desktop/mobile review route. Generated evidence lives under ignored `artifacts/recovery/`; fixtures contain public, unsigned data only.

Release checks on 21 October: all 231 workspace tests passed, including four disposable-Postgres recovery reservation cases; type checking, lint and both builds passed. The live browser independently validated and simulated the fresh Orca exit with no wallet connected. Independent code review found no remaining blockers. The API runs through the installed TS runtime, like the workers, so adapters resolve their pinned schema files relative to their source modules.
