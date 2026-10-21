# Meteora wallet entry implementation plan

> Execute inline with the executing-plans skill; final independent review.

**Goal:** Owner connects the challenge wallet, reviews a fresh bounded Meteora entry, signs and submits in the frontend, and receives reconciled tracking.

**Spec:** docs/design/wallet-execution-architecture.md

**Constraints:** Station 5 only; principal <=10 USDC including acquisition; preserve existing SOL/Orca/Kamino inventory and distinct fee pool; no backend wallet keys, signing or broadcasts. Ript pending. No live trade during tests.

1. [x] Shared contracts and durable owner authentication/attempt storage. Add migration 0009, wallet challenge verification and API routes. Tests: replay, wrong wallet/origin, duplicate preparation, unsupported station.
2. [x] Reusable Meteora builder and preparation queue in the existing execution-worker. Reuse fixed-pool/route checks, simulate exact message, cap principal and fees, preserve residuals. Tests: budget, malformed route/message, simulation failures, no signing/send methods.
3. [x] Wallet Standard discovery, authentication, preparation and trade review drawer. Generate auxiliary mint signer in browser; validate exact message, user signs, register signature before browser broadcast. Tests: wrong wallet, expiry, mutation, rejection, submission uncertainty; browser fixture flow never uses real funds.
4. [x] Read-only receipt reconciliation and active Meteora valuation; update ledger/accounting and station after finality. Tests: receipt binding, token effects, preserved fee pool/residuals, duplicate receipts.
5. [x] Focused checks/build, independent review, deploy API/preparation/sync services, verify capabilities and local browser. No real wallet action by the agent.

Ruling: Reuse the existing dirty checkout because it contains all uncommitted platform infrastructure and prior finalized-entry attribution. A clean worktree would omit that required state. Preserve unrelated files; no commit requested.
