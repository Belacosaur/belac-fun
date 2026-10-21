# Meteora $10 liquidity preparation — 21 October 2026

Research snapshot approximately 10:30–10:40 AWST (02:30–02:40 UTC). **Preparation only. Execution remains disabled. No private keys read, no assets swapped and no liquidity deposited.** The unsigned DAMM account probes left the real wallet unchanged. Existing SOL, Orca and Kamino positions were not changed; Ript stays pending.

Recommendation: shortlist **DAMM v2 SOL/USDC**, pool `8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie`, for a complete capped entry/exit simulation and tracking work. It fits the current SOL fee pool and provides a broad fixed range. This is not a funding-ready recommendation: expected fee income is small relative to SOL inventory risk, and funded liquidity execution, exact lifecycle costs and DAMM tracking remain unverified. Compact DLMM requires additional account capital; canonical USDT/USDC DAMM currently earns very little.

## Options on a normalized $10 inventory

| Option | 7-day fee scenario | 30-day fee scenario | New account rent | Fee-pool fit |
|---|---:|---:|---:|---|
| DAMM v2 SOL/USDC, fixed $70–$440 pool range | $0.01820 | $0.08109 | 0.00722376 SOL (about $0.77) | Yes, before remaining transaction costs |
| DAMM v2 USDT/USDC, fixed 0.98–1.02 pool range | $0.000578 | $0.009273 | 0.00871220 SOL (about $0.93), including new USDT ATA | Yes, before remaining transaction costs |
| DLMM SOL/USDC step 20, approximately ±5%, 52 bins | Not reliably attributable | Not reliably attributable | 0.04189984 SOL (about $4.45) | No |
| DLMM SOL/USDC step 10, approximately ±3%, 62 bins | Not reliably attributable | Not reliably attributable | 0.04189984 SOL | No |

These are gross **fee-only scenarios**, not guaranteed profits or wallet backtests. DAMM scenarios keep today's $10 share of the pool's protocol liquidity fixed and apply the reported fees from the latest 7 or 30 complete UTC daily buckets ending October 20. They assume those fee totals repeat, unchanged liquidity, no price change, no incentives and no reinvestment. Costs, impermanent loss, depegs, exploits and other principal losses are excluded. The 7-day and 30-day columns are different observed windows, not one forecast curve.

DAMM's fixed pool-wide price bounds allow the proportional-liquidity model; we derive principal/token requirements using official SDK formulas and current decoded sqrt prices/liquidity, rather than assigning a new custom range. SOL/USDC had about $1.567m protocol principal, $2,851.61 reported LP fees over seven complete days and $12,704.47 over thirty. Its annualized fee-only scenario is roughly 9.5–9.9%, with no compounding. At the latest 24-hour pace, the 30-day scenario is $0.0775 instead of $0.0811. USDT/USDC's latest-24-hour pace gives $0.00404 over 30 days, lower than its 30-day-window scenario.

The DLMM step-20 pool reports approximately $3,394 in rolling-24-hour fees on $2.33m TVL. Scaling that aggregate ratio to $10 and repeating 30 times gives about $0.44, **but this is not our position's fee estimate**. Our custom bins receive fees only when swapped through, according to their per-bin shares. Historical bin liquidity and swap path are absent, so this number cannot rank expected position profitability. The API field named `apr` equals its 24-hour fee/TVL percentage here (about 0.146%); it is not blindly treated as annual APR. Its compounded headline APY is likewise not used as a promised personal return.

## Principal exposure and downside

DAMM SOL/USDC starts near $106.20/SOL. A normalized $10 inventory is approximately **0.06874220 SOL plus 2.699675 USDC**, or **73% SOL value / 27% USDC**. The broad $70–$440 range is set by the pool, not adjustable per position. It requires less range maintenance but is not a neutral or 50:50 holding.

| SOL move | Modeled LP inventory, no fees | Matching initial token hold | LP minus hold |
|---|---:|---:|---:|
| −20% | $8.38 | $8.54 | −$0.16 |
| +20% | $11.33 | $11.46 | −$0.13 |

A 20% SOL fall loses about **$1.62 of the initial $10** before fees, far more than the roughly eight-cent monthly fee scenario. Much of that is SOL price exposure; the difference from matching hold isolates the additional inventory effect. These are deterministic monotonic-arbitrage stress scenarios, not forecasts. USDC is valued at $1. SOL directional exposure already exists in the hold and Orca stations, so adding this increases aggregate SOL sensitivity.

The selected DAMM SOL pool stayed within its current bounds in the latest 30 complete daily candles (observed price approximately $100.36–$124.88). That is not a guarantee about future range coverage. The selected USDT/USDC pool traded roughly 0.99569–1.00530 over those candles; its tight fixed range leaves risk if either stablecoin loses its peg. A concentrated pool can accumulate the weakening token during a depeg. Both stablecoin issuers can freeze tokens; protocol and liquidity risks also apply. Its low fee income makes swap and lifecycle costs particularly important.

For DLMM step20 ±5%, a hypothetical range anchored at the first open of the latest 30 complete days had 22/30 closes outside and 26/30 candles with some trading outside. The separately anchored seven-day sample had zero closes outside but two candles with some outside trading. These are different anchors and daily candle counts, not time-in-range measurements or future probabilities. Rebalancing costs, adverse selection and losses can exceed fees. Out-of-range custom liquidity stops earning trading fees until relevant bins trade again.

## Account capital and transaction costs

The current separate operating pool is **0.019859400 SOL**, with 70 USDC still unallocated. Existing WSOL and USDC ATAs are present, so their rent is not charged again. Strategy token principal must be acquired from this station's USDC allocation; the SOL fee pool and the SOL hold allocation are not liquidity funding.

DAMM unsigned creation probes passed for both selected pools using zero-signature placeholders. Position accounts use **408 bytes / 2,722,880 lamports**; the metadata-bearing position NFT mint uses **465 bytes / 3,012,440 lamports**; its NFT account uses **165 bytes / 1,488,440 lamports**. Total: **7,223,760 lamports**. The creation message's current base fee was **10,000 lamports (0.000010 SOL)**, with two required signatures and an explicit compute limit but no priority price. Creating then closing an empty position in one unsigned simulation returned all account capital; real wallet balances stayed unchanged.

This proves **empty account setup/closure only**. A future funded exit still requires liquidity removal, collecting fees/rewards, and successful closure. Do not treat refundable rent as a consumed trading fee, or assume it returns before exit conditions are met. The stablecoin option additionally needs a USDT ATA: 1,488,440 lamports. SOL/USDC setup plus the quoted creation fee would leave approximately 0.01262564 SOL before swaps, add-liquidity/exit network fees and priority fees. No additional funding is requested now.

Fresh compact DLMM unsigned LP messages price entry at **10,000 lamports** and withdraw/claim/close at **5,000 lamports**, excluding the preparatory swap and priority/compute/chunk changes. Step20 ±5% has 52 bins and fits a diagnostic 1,142-byte entry message without added compute-budget instructions. Both boundary bin arrays already exist, so no shared-bin-array creation is priced. Compact position rent exceeds the current fee pool by **0.02204044 SOL before network fees**. Step10 ±5% expands to 102 bins and costs 0.06010656 SOL; small-step wide ranges are much more expensive. Any new shared bin arrays are not assumed recoverable by us.

## Budgeted token preparation quotes

A diagnostic target of **$9.90 inventory** leaves room for conversion/slippage within the $10 capital ceiling. Token maxima include a 0.5% allocation cushion; Jupiter ExactOut quotes use a 0.5% swap tolerance. Quotes are unsigned, temporary and not a simulated LP entry.

- DAMM SOL/USDC: maximum purchase **0.068395055 WSOL**, swap input cap **7.297598 USDC**, LP USDC cap **2.686043 USDC**. Combined USDC cap **9.983641**, leaving at least **0.016359 USDC** under these quotes. Route: Whirlpool.
- DAMM USDT/USDC: maximum purchase **5.146986 USDT**, swap input cap **5.168444 USDC**, LP USDC cap **4.807031 USDC**. Combined cap **9.975475 USDC**. Route: PancakeSwap; that route is not yet an approved/executable adapter.

These quotes do not include validation of a combined buy-and-deposit transaction or a future unwind. A $9.90 deposit would have proportionately slightly lower fee income than the normalized $10 comparison. Exact future network/priority fees, exit conversion costs, price-bound movement and final encoded caps must be validated before approval. Stablecoin conversion plus lifecycle fees could consume much of its modeled income.

## What remains before funding

1. Choose the exact DAMM or DLMM pool and accept its exposure/range/exit rules.
2. For the shortlisted DAMM route, implement and test position-NFT ownership, principal, pending-fee and residual-token tracking. The current Meteora station reader covers DLMM portfolio data; it does not yet attribute DAMM v2 positions.
3. Build a capped <=10-USDC asset-preparation and add-liquidity plan; simulate entry and a funded withdrawal/claim/close path. Refresh state and quotes together and validate slippage guards.
4. Price the complete lifecycle and verify the separate SOL reserve remains adequate. Obtain a separate execution instruction after review.

Execution service verified **2026-10-21T02:40:42.835Z**: enabled=false; sign=false; submit=false; claimJobs=false. No deployments or execution settings were changed. LP inventory math tests passed (5/5).

## Evidence and primary sources

- [Machine-readable scenarios](../../artifacts/meteora/2026-10-21/research-summary.json)
- [DAMM on-chain checks and unsigned account simulations](../../artifacts/meteora/2026-10-21/damm-review.json)
- [DLMM current accounts, ranges, rent and history](../../artifacts/meteora/2026-10-21/lp-validation.json)
- [DLMM unsigned message fee reads](../../artifacts/meteora/2026-10-21/lp-meteora-unsigned-previews.json)
- [DAMM v2 concentrated-liquidity rules](https://docs.meteora.ag/core-products/damm-v2/concentrated-liquidity)
- [DAMM v2 NFT ownership and locks](https://docs.meteora.ag/core-products/damm-v2/nft-positions)
- [DLMM range/fee/rent documentation](https://docs.meteora.ag/user-guides/how-to-use-dlmm/dynamic-terminal)
- [Official SDK source](https://github.com/MeteoraAg/cp-amm-sdk)
- [Official DAMM API schema](https://damm-v2.datapi.meteora.ag/swagger-ui/)

Scope: canonical SOL/USDC and USDT/USDC only; this is not a comprehensive all-token/best-yield search. Actual mint pairs were checked locally because name searches can return lookalike tokens and the API filters did not consistently enforce minimum TVL. DLMM account owner/layout/mints/vault identities and current arrays were checked; DAMM pool owner/layout/mints/vault authority/status and account-cost simulations passed. No current full audit/deployed-bytecode equivalence or security clearance is claimed. Pool API indexing, protocol state and quotes have distinct observation times. Raw sources and source-content hashes are retained alongside the report. Earlier research is preserved.
