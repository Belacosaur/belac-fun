# Meteora wallet approved entry

The studio now provides a Meteora-only owner flow: connect a compatible Solana Wallet Standard wallet, authenticate with a message signature, prepare a fresh bounded entry, review its simulated effects, and explicitly sign and submit from the browser. Server-side signing and broadcast remain disabled. Other stations have no transaction controls; Ript remains pending.

## Owner workflow

1. Open `http://127.0.0.1:5186/station` in a browser with the wallet extension enabled. The embedded app browser may not expose extensions.
2. Select Meteora and choose **Review Meteora trade**.
3. Select the existing challenge account, `HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j`, and **Connect and authenticate**. The first signature is a domain-bound login message, not a spending transaction. The app never imports a private key or seed phrase.
4. Choose **Prepare $10 Meteora entry**. This creates a persisted preparation job and a new browser-local auxiliary mint keypair. Only the mint public key goes to the server. The worker refreshes the quote and returns an unsigned, simulated transaction.
5. Review maximum combined USDC spend, proposed LP inventory, rent, network/priority fee and remaining operating reserve. Quotes have a 50-second application TTL from preparation start; expired plans need refreshing.
6. Choose **Sign and execute in wallet** and review the wallet prompt. The wallet signs the exact reviewed message. The browser verifies its spending signature, adds the auxiliary mint signature locally, registers the public signature, rechecks expiry/context, and submits with preflight enabled.
7. Wait for chain verification. A confirmed transaction shows a pending state until finality and receipt reconciliation. The sync worker then updates allocation, residuals, inventory, accrued trading fees and P&L. This can take the next 60-second studio sync cycle.

If signing is rejected, no broadcast occurs. The reserved attempt remains locked until its blockhash expires and a finalized read verifies that the position was not created. This also handles a browser close during signing. An RPC timeout never automatically creates a second trade. Reopen the drawer and authenticate to recover the stored attempt.

Connecting another wallet does not grant control of the existing challenge funds or position NFTs. Importing the original account, if needed, happens exclusively in the wallet's trusted UI; changing the challenge wallet requires a separate migration.

## Enforced limits

- Station 5 entry only; fixed DAMM v2 pool `8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie` and SOL/USDC mints; no automated exits or other actions.
- ExactOut acquisition through a verified single Whirlpool route, plus deposit, in one atomic transaction. Combined maximum principal debit cannot exceed 10 USDC. Slippage is 50 bps.
- Existing SOL buy/hold, Orca residual WSOL and Kamino position stay attributed. Meteora's SOL principal comes from its own USDC conversion, without a native SOL wrap/transfer instruction.
- Position rent is 7,223,760 lamports for the supported layout. Entry fee is bounded to 12,000 lamports, with 1,000 micro-lamports per CU and a 1,000,000 CU limit. Keep at least 0.01 SOL operating reserve after entry costs. Prior verified failed-transaction fees reduce available operating funds.
- Frontend independently checks message hash, instructions, amounts, signers, destinations, fresh mainnet context, lookup tables, Whirlpool mints/vaults/tick-array PDAs and NFT-position PDAs. It verifies the actual wallet signature before any browser broadcast.
- One durable station reservation survives submitted/unknown states and remains held for the active position. A future exit/re-entry workflow must explicitly release it only after verified closure; that workflow is not enabled by this entry release.

## Services and persistence

The existing execution-worker now supports `METEORA_PREPARATION_ENABLED=true` while retaining `EXECUTION_ENABLED=false`. It claims preparation jobs and reads signature outcomes, but has no signer or sendTransaction method. Its status exposes preparation separately from execution. API routes provide wallet challenges/sessions and Meteora attempt preparation, status, begin, signature registration and unsigned cancellation. There is no server execute/sign/broadcast route.

`0009_wallet_trades.sql` adds one-time challenges, hashed bearer sessions, durable attempts/reservations and failed fee events. Only configured frontend origins and a challenge-wallet proof can access owner routes. Sessions remain in browser memory and expire after 30 minutes. Challenges expire after two minutes and are consumed under a row lock.

Finalized receipts are bound to the exact attempted message, public signature, owner wallet, pool, NFT and transaction token deltas. Failed gas costs are also bound to the exact attempt before recording. The read-only sync consumes these receipts without hardcoding a future Meteora fill. Successful residual cash and WSOL are included once in Meteora equity; gas and recoverable rent are in the separate operating ledger.

## Verification

Focused tests cover unsigned mainnet builder replay, independent frontend validation, wallet rejection and mocked explicit submission order, wrong-wallet/message/expiry/cap checks, receipt effects, failed fee binding and accounting. A disposable local PostgreSQL test verifies concurrent claim/begin behavior, permanent reservation, duplicate signature registration, one-time origin-bound sessions, lease recovery, expired plans and failed-fee idempotency. Browser checks verify the Meteora-only drawer and unchanged existing fee accounting.

The mainnet builder was probed only with a public placeholder mint and zero signatures. No real financial transaction was signed or submitted during development. Independent review found no blocking issue. Actual acceptance of the auxiliary signature flow by the owner's wallet is the owner's first live acceptance step; the simulated fixture is not a funded position.

Implementation plan: [Meteora wallet entry](../superpowers/plans/2026-10-21-meteora-wallet-entry.md). Architecture: [Wallet approved strategy execution](../design/wallet-execution-architecture.md).

## Deployed verification on 21 October 2026

Preparation deployment `8bc81d7c-5b80-489e-a311-8690682bf16d`, API deployment `eb721ca3-bffd-45fc-8502-9ccb293bf6a2`, and sync deployment `6286d536-f9ac-4590-a9bf-91d42807e31d` reached SUCCESS. Private status reported unsigned preparation enabled only for station 5, with server signing and broadcast false and zero accidental attempts. Live API checks verified allowed-origin challenges, rejected invalid signatures and unauthenticated access, and no server execution route.

The actual local station at port 5186 passed the browser review-drawer test against the deployed API. The existing three positions, 70 USDC unallocated capital and 0.019859400 SOL operating reserve were unchanged during those checks. Evidence (generated locally, excluded from Git): `artifacts/meteora/2026-10-21/wallet-api-verification.json` and `wallet-review-connect.png`.

The public frontend release uses Cloudflare Pages project `belac-fun`, production branch `main`, and uploads only `apps/web/dist`. Its security policy allows the production API and public browser RPC. The API allowlist includes `https://belac.fun`, `https://www.belac.fun` and `https://belac-fun.pages.dev`; wallet sessions remain bound to the requesting origin. Wallet keypairs and import files are excluded from both source control and the static upload. Release verification: 209 tests, workspace type checking, lint and the production build passed. The live execution status remained disabled with signing and broadcasting false.
