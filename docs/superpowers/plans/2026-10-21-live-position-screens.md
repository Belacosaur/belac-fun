# Live SOL and Orca Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show the two finalized positions, $10 allocations and live marked P&L while accounting for operating SOL separately.

**Architecture:** Extend the existing read-only studio sync, snapshot contract and branded station displays. A public entry manifest pins the actual fills and Orca NFT; one mainnet RPC batch verifies ownership and reads pool, ticks and wallet inventory. Official Orca SDK quotes calculate LP inventory and accrued fees. Existing Postgres snapshots persist real valuation history.

**Tech Stack:** TypeScript, Solana RPC, Orca SDK, Decimal.js, React/Three canvas screens, Railway sync worker.

**Spec:** User request in this chat: update SOL and Orca screens with actual positions, allocations and live P&L; keep the fee pool separate; leave other stations disabled.

## Global Constraints

- Read only; no private keys, signing, submissions, execution flags or trading service changes.
- Station 1 has 0.093680067 native SOL at 10 USDC cost; station 8 owns the verified Orca NFT from the finalized receipt.
- Orca equity includes LP inventory, accrued swap fees, 0.077548 residual USDC and 0.000209636 residual WSOL.
- Eight other strategy allocations total 80 USDC and have no enabled execution.
- USDC is marked at $1; P&L is mark-to-market before future exit costs, with network fees tracked separately.
- Never display a failed, stale, missing or ownership-mismatched valuation as live zero/profit.

## Review Focus

- Wallet assets must cover attributed holdings; unrelated deposits must not become trading profit.
- Tick and pool accounts must be consistent, owned by the expected program and sampled in one RPC context.
- Fee growth must include uncheckpointed accrued fees; do not sum them twice with LP principal.
- Missing NFT, changed liquidity/range or transfers must invalidate attribution.
- Fee reserve, setup capital, unused allocations and strategy performance must not be double counted.

### Task 1: Read-only valuation and accounting

- [x] Add failing tests for marked performance, account validation, fee-pool separation and accounting gaps.
- [x] Add public finalized-entry manifest and batched mainnet valuation using official SDK quotes.
- [x] Extend snapshot contracts and wire into studio sync with stale retention and bounded measured history.
- [x] Run targeted jobs tests and typecheck.

### Task 2: Screens and overview

- [x] Add tests for active position presentation, actual allocation, P&L sign and stale behaviour.
- [x] Update branded SOL/Orca canvases, footer, all-positions table and overview accounting.
- [x] Show measured history only; other stations remain read-only/disabled.
- [x] Build and run browser checks, inspect centre views and overview screenshots.

### Task 3: Review and release

- [x] Request independent review; fix material findings.
- [x] Deploy only the read-only sync worker; frontend changes appear in the existing local app.
- [x] Verify production API accounting, on-chain ownership and disabled execution worker.
- [x] Save final test and screenshot evidence.

## Execution ledger

- Ruling: Work in the existing checkout because the approved running scene and live sync depend on the ongoing uncommitted project work; preserve unrelated files.
- Ruling: The user's explicit screen/accounting request authorizes this implementation and the necessary read-only sync deployment. No new trading authorization is inferred.

- Verified: 34 jobs tests, 6 frontend tests, live browser check in centre/bird’s-eye views, builds/typechecks/lint. Production sync deployment 1563edab-8144-463c-bc4e-27ac2eead35b is successful. Execution worker remains disabled.
- Review: fixed chain timestamp freshness and stuck-slot handling before release. Browser regression exposed and fixed the Drei Html context boundary for map labels.
- Evidence: artifacts/positions-release-verification.json and artifacts/active-{sol,orca}-centre.png.
