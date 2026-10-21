# Kamino direct USDC lending — review package

Prepared 21 October 2026. Execution remains disabled. No key was read and no transaction was signed or broadcast.

## Proposed position

- Station 6, Kamino JLP-market USDC lending (not a purchase of JLP).
- Deposit ceiling: **10.000000 USDC**. No borrowing, loop, swap or leverage.
- Reserve: `Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp`.
- Wallet receipt mint: `32XLsweyeQwWgLKRVAzS72nxHGU1JmmNQQZ3C3q6fBjJ`.
- Receipt ATA: `Ezb8iGvPbVKFN2tF6wrRermeo47qDXTWXQWMiUYLeAYx`.

## Unsigned simulation results

Both the entry and atomic deposit/redemption/receipt-account-close simulations returned `err=null`. They use all-zero signature placeholders, `sigVerify=false`, `replaceRecentBlockhash=true` and only bounded public read/simulation RPC methods. They cannot authorize or submit a transaction.

Entry simulation at approximately 09:41 AWST:

| Effect | Result |
|---|---:|
| USDC debited | 10.000000 USDC |
| Receipt tokens minted (base units, 6 decimals) | 8,295,967 |
| Immediate marked/redeemable principal | 9.999999 USDC |
| New account rent | 0.001488440 SOL |
| Quoted base network fee | 0.000005000 SOL |
| Combined separate SOL requirement | **0.001493440 SOL** |
| Operating pool after this simulated entry | **0.019859800 SOL** |

The existing SOL buy-and-hold allocation was untouched. The real wallet's native SOL, USDC account and absence of the new receipt ATA were identical before and after the probes. No further wallet funding is required for the simulated base costs.

The atomic round trip returned 9.999999 USDC, closed the newly created receipt ATA, returned all its rent to the same wallet and consumed only the quoted 0.000005 SOL network fee plus 0.000001 USDC rounding. This proves the current instruction path and current liquidity in a single transaction. It is not an exact quote for a separate future withdrawal, nor a guarantee that future caps, liquidity, rates, priority fees or account state will be unchanged. Entry and future exit are separate real transactions; do not treat the one-transaction probe's fee as a full real lifecycle fee.

The direct route creates no metadata, obligation, delegated farm account or lookup table. No farm rewards are assumed. Entry and redemption layouts were checked against official SDK revision `6a26d6f1b5afb29953ffd139ee8c0c4ca5f26ce6` and the deployed program accepted both simulations.

## Tracking and display

The read-only tracker validates mainnet, fresh RPC context, pinned reserve/market/mint/vault addresses, account owners and layouts, token ownership, token state, absence of delegation/close authority, and recent reserve accrual (maximum five minutes). Values use the protocol reserve's recorded collateral supply and underlying supply net of protocol/referrer fees, rounded down to USDC atoms. SPL circulating mint supply can be lower, so it is not substituted into Kamino's exchange-rate denominator. The source follows both the pinned SDK and protocol reserve calculation. USDC is marked at $1; market depeg risk is not removed.

Today the receipt ATA is absent. The monitor therefore shows **planned 10 USDC**, **simulated / awaiting review**, zero receipt tokens and **no active P&L**. Its APY comes from the current exact-reserve API response and remains variable. A fresh 09:45 AWST check showed about 4.57% APY, implying approximately $0.037 gross over 30 days on $10 if unchanged. Rate failure is shown as unavailable; it does not fabricate a zero yield.

A real finalized public receipt must be reconciled and added to the intentionally empty `KAMINO_CONFIRMED_ENTRY` after separately authorized execution. The prepared simulation is never used as that receipt. Tested future reconciliation removes deposited USDC from unallocated cash once, marks the verified receipt tokens once, and reduces the separate fee pool by actual network/rent costs. Changed receipt balances require reconciliation instead of becoming unexplained profits. Portfolio position count and allocations support the eventual third position. No manifest entry exists now, so only the existing SOL and Orca entries affect strategy totals.

## Validation

- 38 targeted jobs tests passed, including budget, receipt identity/value, stale sources, unattributed transfers, future accounting, and execution-disabled checks.
- 7 frontend feed tests passed; jobs and web type checks, API build, web build and scoped ESLint passed.
- Browser check passed: Kamino proposal/fees/zero receipts/no active P&L, unchanged separate fee pool and Ript pending. Captured screenshots are adjacent.
- Independent review and follow-up review found no remaining P1/P2 issues within this scope.
- Read-only worker release and final production/disabled-service checks are recorded in `release-verification.json` once complete.

## Evidence

- [Unsigned simulation report](../../artifacts/kamino/2026-10-21/direct/report.json)
- [Entry message and simulation](../../artifacts/kamino/2026-10-21/direct/entry.json)
- [Atomic round trip](../../artifacts/kamino/2026-10-21/direct/round-trip.json)
- [Screen preview](../../artifacts/kamino/2026-10-21/direct/centre.png)
- [Position details](../../artifacts/kamino/2026-10-21/direct/details.png)

Refresh and re-simulate before any eventual execution approval. This package is preparation only; execution, signing and submission remain disabled.
