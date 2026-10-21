# Meteora refresh — 21 October 2026, 10:59 AWST

Entry and atomic entry/fee-claim/withdrawal/closure unsigned simulations passed again at 10:59:21 AWST. No transaction was signed or submitted and no Meteora allocation was created. The simulation NFT mint is a public placeholder with no generated keypair; the captured message is simulation evidence, not a wallet-signable entry package.

| Item | Refreshed result |
|---|---:|
| Combined simulated USDC debit | 9.884614 USDC |
| Combined maximum USDC debit | 9.934038 USDC |
| Proposed LP inventory | 0.067645597 SOL + 2.662075 USDC |
| Swap output cap | 0.067983825 WSOL |
| Swap maximum USDC input | 7.258652 USDC |
| Deposit maximum USDC input | 2.675386 USDC |
| Simulated residual strategy cash | 0.115386 USDC |
| Simulated residual strategy WSOL | 0.000338228 WSOL |
| Refundable rent | 0.007223760 SOL |
| Entry network fee, priority fee zero | 0.000010000 SOL |

Pool `8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie`; range $70–$440. Entry message 968 bytes, roundtrip 1,073 bytes. Withdrawal returned 0.067645596 SOL and 2.662074 USDC from the position, with full rent recovery inside the atomic simulation. A future withdrawal must be freshly quoted; the proof does not guarantee future availability or returns.

Balance invariants passed: native wallet 0.113539467 SOL unchanged, including the 0.093680067 SOL hold and 0.019859400 SOL fee pool; existing Orca WSOL 0.000209636 preserved. No simulated position accounts persisted. SOL strategy principal came from the bounded USDC conversion; only rent and network fees reduced native SOL in simulation.

All real entry actions require the owner to sign and submit through their own wallet. The Meteora monitor remains prepared, with no owned position, allocation or P&L attributed. Automated execution remains disabled.

Evidence: `artifacts/meteora/2026-10-21/damm-preview-2026-10-21T02-59-18.321Z/report.json`. The refresh passed 25 focused accounting, DAMM and studio-sync tests.
