# Kamino station 6 — finalized entry, 21 October 2026

The owner explicitly approved a fresh simulation followed by a deposit of up to 10 USDC. Exactly one local entry was submitted. Unattended execution, signing and job claiming on the deployed execution service remain disabled for all stations.

## Actual finalized position

- Confirmed at **2026-10-21 01:58:50 UTC / 09:58:50 AWST**, finalized slot **459454208**.
- Deposited **10.000000 USDC** into the JLP-market USDC lending reserve. No JLP purchase, borrowing, looping or leverage.
- Received **8.295955 receipt tokens**, or **8,295,955 base units**.
- Reserve: `Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp`.
- Receipt mint: `32XLsweyeQwWgLKRVAzS72nxHGU1JmmNQQZ3C3q6fBjJ`.
- Wallet receipt account: `Ezb8iGvPbVKFN2tF6wrRermeo47qDXTWXQWMiUYLeAYx`.
- [Finalized transaction](https://solscan.io/tx/2Z3TQQy8ApF5K2jPit5G569C4recEXMRwVF2fPC55DGWnTXaZpYpRdpwH9TvCm8GwxRGVTsgoaG8xFPUjzdrQ9x5).

| Separate SOL accounting | Actual |
|---|---:|
| New receipt account rent | 0.001488440 SOL |
| Network fee, including bounded priority fee | 0.000005400 SOL |
| Total SOL debit | **0.001493840 SOL** |
| Operating fee pool remaining | **0.019859400 SOL** |
| Existing SOL buy-and-hold allocation | 0.093680067 SOL, unchanged |

Wallet native SOL is 0.113539467 SOL: the hold allocation plus the remaining operating pool. The wallet has 70.077648 USDC: 70 USDC unallocated challenge capital, 0.077548 Orca residual cash and 0.000100 funding surplus. Strategy capital is now $30 allocated across SOL, Orca and Kamino, plus $70 unallocated. Fee-pool and account-rent capital are excluded from strategy equity/P&L.

## Safety and reconciliation evidence

Fresh unsigned entry and atomic deposit/redemption/account-close probes passed before execution, with balances unchanged by those probes. The local one-time adapter then rebuilt current instructions and blockhash, verified sole wallet signer/program allowlist/10 USDC budget, and passed unsigned and cryptographically verified signed simulations. It read the owner key only inside the local process after checks; no keys or signed executable wire were uploaded or emitted.

Before submission it created an exclusive station-6 first-entry lock and durably recorded the signature and message hash. It attempted one submission with preflight enabled. A submission/finality uncertainty path cannot build another entry automatically. The transaction reached finalized; getTransaction metadata independently confirmed the exact USDC debit, receipt tokens, rent and network fee. Current wallet-owned receipt tokens matched the finalized transaction.

Actual public receipt attribution is now embedded in the read-only tracker. It values receipt shares using the protocol's recorded supply net of fees, records measured history, and fails closed on ownership, amount, freshness or attribution mismatches. The monitor shows live allocation, receipt balance, variable APY, actual costs, P&L and transaction link. Tiny P&L uses up to six decimal places rather than being rounded to zero. Prepared-only values cannot create an allocation.

The rate snapshot near entry was approximately **4.5676% APY**, variable. At 02:03 UTC the protocol mark was 10.000002 USDC / +0.000002 USDC before operating costs. This is an observation, not a guaranteed future yield or executable exit quote. USDC is marked at $1. Direct lending retains issuer/depeg, protocol and liquidity/withdrawal-cap risks.

## Release and checks

- Read-only sync deployment **93325f0a-dcde-4f45-a26d-a42eb510d0e0** reached **SUCCESS**.
- Production API confirmed active station 6, $30 allocated, $70 unallocated and the exact remaining fee pool.
- Execution service checked at **02:03:35 UTC**: enabled=false; sign=false; submit=false; claimJobs=false.
- Other station execution remained disabled. Existing SOL/Orca positions were preserved. Ript remains pending.
- 38 targeted backend tests and 7 frontend tests passed; jobs/web type checks, scoped ESLint and web production build passed.
- Entry policy tests passed (2). Independent pre-entry and post-entry reviews found no blocking P1/P2 issues.
- Captured-data browser check passed; final deployed-feed Kamino and existing-position screen checks are recorded in the associated release evidence.

Public evidence:

- [Finalized receipt](../../artifacts/execution/2026-10-21/station-6-receipt.json)
- [Actual transaction, simulations and reconciliation](../../artifacts/execution/2026-10-21/entry-6-live-2026-10-21T01-58-46.842Z/report.json)
- [Live API snapshot](../../artifacts/execution/2026-10-21/kamino-production-studio.json)
- [Release verification](../../artifacts/execution/2026-10-21/kamino-release-verification.json)
- [Kamino screen](../../artifacts/execution/2026-10-21/kamino-live-centre.png)

No further deposits or automatic execution are authorized by this record. Any future position change requires a new instruction and reconciliation.
