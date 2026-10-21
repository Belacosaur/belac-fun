# Meteora DAMM v2 — prepared, execution disabled

Prepared 21 October 2026, 10:49:45 AWST. Quotes are a captured proposal and must be refreshed before a separately authorized deposit. No keys were accessed, no signatures produced, no transactions submitted, and no real positions created.

## Proposed entry

Pool: `8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie`, official DAMM v2 program `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`. Legacy WSOL/USDC, existing pool range $70–$440. Verified pool discriminator/layout, mints, vault identities, vault authority and enabled pool state against mainnet accounts. Official IDL and math pinned to SDK source revision `79ebbfe59a225e641a2f37cd03404f26de1b0c8e`.

| Item | Captured result |
|---|---:|
| Strategy ceiling, including preparatory swap | 10 USDC |
| Hard maximum combined USDC debit | 9.936462 USDC |
| Simulated combined USDC debit | 9.887111 USDC |
| Proposed LP inventory at captured pool price | 0.067686917 SOL + 2.660248 USDC |
| SOL acquisition cap | 0.068025352 WSOL |
| USDC deposit cap | 2.673550 USDC |
| Swap maximum input, including 0.5% slippage | 7.262912 USDC |
| Simulated station cash remainder | 0.112889 USDC |
| Simulated station WSOL remainder | 0.000338435 WSOL |
| Guaranteed unspent strategy cash under both caps | 0.063538 USDC |
| New position rent | 0.007223760 SOL |
| Entry network fee, no priority fee | 0.000010000 SOL |
| Standalone exit fee quote, no priority fee | 0.000005000 SOL |

All principal SOL is bought from the Meteora allocation using an ExactOut Jupiter route through a verified Whirlpool. The entry contains no native SOL transfer or wrap instruction. It preserves the existing 0.000209636 WSOL attributable to Orca, and native SOL decreases by exactly rent plus network fee. The native SOL hold of 0.093680067 is protected. The existing USDC/WSOL token accounts are reused and never closed.

The separate fee pool is currently 0.019859400 SOL. Captured entry costs would leave 0.012625640 SOL liquid in that pool, plus 0.007223760 SOL recoverable position rent. No additional funding is needed for this proposal. Actual priority fees must be rechecked before execution.

## Simulations and exit

Both zero-signature v0 messages passed mainnet `simulateTransaction`, with `sigVerify:false` and no broadcast capability in the preparation script:

1. USDC-to-WSOL swap, create the NFT position, deposit unlocked liquidity. 968 wire bytes, two required signatures represented only by zero-filled bytes.
2. The same entry followed by fee claim, full liquidity removal, and position closure. 1,073 wire bytes. This returned 0.067686916 SOL and 2.660247 USDC from the LP and recovered all three accounts' rent. One atom of each token was lost to deposit/withdrawal rounding. Existing Orca WSOL remained intact.

The standalone exit message is 721 bytes and requires only the wallet signature. Its 5,000-lamport fee was quoted separately; it was not independently simulated against an already-funded on-chain position, because none exists. The funded exit proof is the atomic roundtrip. It proves the current code path and available liquidity, not future prices, future withdrawal availability or profit.

The exit returns WSOL and USDC to the existing token accounts. Selling the returned WSOL for all-USDC is a separate conversion requiring a fresh quote and simulation; it is not included in the standalone withdrawal cost. Future withdrawal minimums must be recomputed from the then-current position, rather than reusing this snapshot's minimums.

No simulation persists changes. A second mainnet account read confirmed unchanged native SOL, USDC and WSOL, with all simulated position/NFT accounts absent.

## Tracking and verification

The deployed sync worker now reads the DAMM v2 pool and vaults instead of the unrelated DLMM portfolio. It checks mainnet genesis and fresh block time. The Meteora monitor shows the dated prepared proposal, range, live pool price, caps and separate SOL costs. It carries no strategy performance, owned-position count or equity. Old DLMM observations are not reused as DAMM data on a failed refresh.

The NFT inventory adapter is tested against returned simulation accounts: correct pool, mint, owner, unlocked liquidity and no locked/vested liquidity. Token amounts use integer rounding and pending trading fees use official Q128 growth, wrapping U256 subtraction and saturating U64 addition. Activation still needs a separately authorized finalized entry receipt and integration of its exact fills/residuals into challenge accounting. Simulation NFT addresses are placeholders without generated private keys, not executable mint keypairs.

Verification: 33 focused jobs tests, 7 web feed tests, jobs/web TypeScript checks, web production build, ESLint on touched source files, and the Meteora browser scenario passed. Independent code review found no important or critical issues.

Railway sync deployment `9c4389c5-9d9f-4187-abd4-261a6bdd31f2` reached SUCCESS. Public API verification retained 3 funded positions, 30 USDC allocated, 70 USDC unallocated and 0.019859400 SOL available in the separate fee pool. Execution service inspection at 10:56:55 AWST returned `enabled:false`, `sign:false`, `submit:false`, `claimJobs:false`. Ript remains pending.

Evidence:

- `artifacts/meteora/2026-10-21/damm-preview-2026-10-21T02-49-42.031Z/report.json`: complete RPC requests/responses, quotes, message hashes, logs and returned accounts.
- `artifacts/meteora/2026-10-21/exit-fee.json`: standalone exit fee quotation and limitations.
- `artifacts/meteora/2026-10-21/deployed-studio.json`: deployed API snapshot.
- `artifacts/meteora/2026-10-21/prepared-centre.png`: browser verification.

References: [official DAMM SDK](https://github.com/MeteoraAg/damm-v2-sdk), [Jupiter quote documentation](https://developers.jup.ag/docs/swap/v1/get-quote). Historical fee estimates and price/impermanent-loss scenarios remain in the earlier Meteora preparation report; none are presented as guaranteed returns.
