# Kamino $10 preparation — 21 October 2026

Research snapshot: 09:26–09:32 AWST (01:26–01:32 UTC). Execution service independently checked at 01:30:29 UTC: enabled=false; sign=false; submit=false; claimJobs=false. No keys read, transactions signed/submitted, deposits made or loans opened. Ript remains pending; no station configuration changed.

Recommendation: shortlist plain USDC lending, conditional on validating the cheaper direct cToken route and integrating its valuation. Do not pay the standard first-use setup costs just to earn a few cents, and do not loop at these spreads. This is a preparation review, not approval to fund another position.

## Returns on $10

| Route | Current inputs | Modeled 7-day gross | Modeled 30-day gross |
|---|---|---:|---:|
| Plain USDC lending, JLP market | Supply APY 4.6460% | $0.00871 | $0.03740 |
| Plain USDC lending, SOL/BTC market | Supply APY 4.5589% | $0.00855 | $0.03671 |
| USDC/PYUSD loop, 2x | Supply 4.5643%; borrow 4.9550% | $0.00785 | $0.03367 |
| USDC/PYUSD loop, 3x | Same rates; $30 collateral/$20 debt | $0.00713 | $0.03060 |
| JitoSOL/SOL isolated loop, 2x | Collateral yield 4.8391%; borrow 4.6758% | $0.00937 | $0.04020 |
| JitoSOL/SOL isolated loop, 3x | Same rates; $30 collateral/$20 debt | $0.00967 | $0.04149 |

All figures exclude setup, network, swap/flash fees, slippage, losses and incentives. Rates are variable, fetched at slightly different times, and held constant in these scenarios. Effective annual supply/borrow rates are scaled separately: C*((1+s)^(days/365)-1) - D*((1+b)^(days/365)-1). LST total collateral yield combines staking and lending multiplicatively. JitoSOL rows assume flat SOL/USD; they retain SOL price exposure and are not stablecoin returns. A 20% SOL decline can cost approximately $2 of initial equity before carry even if LTV is unchanged.

USDC lending in the JLP market means lending USDC to that market, not buying JLP. Its slightly higher rate is not a security ranking. Over the latest available 30 daily exchange-rate buckets ending October 20, a hypothetical $10 supply earned $0.03966 in JLP-market USDC and $0.04571 in SOL/BTC USDC before costs. These sampled past reserve returns are not forecasts or our wallet performance.

The stable loop's marginal spread is negative: borrowing more reduces income. Unlevered JitoSOL at the same combined yield models $0.03892 over 30 days; the 3x loop adds only $0.00257 (about a quarter of one cent). Even 0.01% additional slippage on $30 is $0.003, exceeding that incremental yield.

## Current looping availability

Seven LST/SOL pairs were rechecked with finalized on-chain accounts, exact owner/discriminator/layout/mint/market validation, current rates, caps, eMode permissions and borrowing guards. Six main-market pairs remain blocked by SOL utilization 90.5492% against a 90% new-borrow guard; adraSOL additionally has no deposit-cap headroom. Jito isolated SOL is now 89.9971%, leaving approximately 5.6131 SOL of guard headroom in this snapshot. Thus it no longer fails this configuration screen, but capacity can disappear immediately; no size-specific swap/Multiply simulation or complete cost quote was obtained.

Fresh issuer observations: Jito 4.8387% at 01:26:06 UTC; mSOL trailing-30-day APY 4.9174% ending 01:24:53 UTC; bSOL API 6.01% with no measurement timestamp, retained as provisional. No invented yield is assigned to JupSOL, dfdvSOL or adraSOL. Current collateral/debt pair caps and liquidation thresholds are in the raw LST report. Isolated Jito decoded eMode is 92% max LTV/95% liquidation LTV; this is not a suggested leverage level.

## Costs and separate fee pool

At the observed $106.6406/SOL:

- Existing USDC ATA is present. The ordinary deposit previews both return unsigned $10 instructions; current getFeeForMessage is 5,000 lamports (0.000005 SOL, about $0.00053) before any added priority fee. This is a message fee, not a successful simulation or all-in cost.
- Standard first-use lending account capital: 0.02978912 SOL, approximately $3.18, plus network fees. The separate operating pool is 0.02135324 SOL, so this needs at least 0.00843588 additional SOL before fees. The SOL buy-and-hold allocation is excluded from that pool.
- Of that standard capital, 0.01121664 SOL (about $1.20) has no verified owner-refund path under the previously checked official source rules: metadata plus delegated farm user state. Obligation rent can return on a complete empty exit; LUT rent requires authorized deactivation, cooldown and closure. Do not label all setup capital a fee or assume it all returns.
- Direct cToken lending needs only a new collateral token account: 0.00148844 SOL (about $0.159), refundable if emptied and explicitly closed. Current blockCtokenUsage=0 and no permission/emergency flags were found for both selected reserves. This route avoids metadata, obligation, farm and LUT creation; no farm rewards assumed. It still requires entry/redemption simulation, mint-aware station valuation and accounting before it is usable.
- Direct-route 2–4 transaction / 0–20,000 priority-lamport round-trip scenarios imply 10,000–40,000 network lamports ($0.00107–$0.00427), excluding refundable rent. These are planning assumptions, not exact unsigned-message quotes for this route.
- Supply/withdraw protocol fee modeled as zero under checked source/docs. Standard withdrawal builder returns KLEND_OBLIGATION_NOT_FOUND because we have no lending obligation; an exact exit quote is unavailable. Loop-specific account setup, swaps, flash principal, slippage, priority and exit fees remain unpriced. Do not apply plain-lending setup as a validated looping total. Raw reserve flash/origination fees are retained per pair; docs' generic flash-fee statement is not used to override live reserve configuration.

## Risks and decision gates

Plain lending has USDC issuer/depeg, smart-contract, oracle, borrower insolvency and withdrawal liquidity/cap risks; it has no borrower liquidation risk when we take no debt. A 1% principal impairment costs $0.10, over twice the modeled monthly interest. Currently empty queues and ample liquidity are snapshots, not exit guarantees.

Loops add variable borrowing, liquidation, swap liquidity, collateral issuer/staking failure and monitoring requirements. Both stablecoin pegs can fail. Kamino documents stake-rate oracles for LST loops, reducing secondary-market depeg impact on LTV, but the actual chosen route's oracle behavior and underlying loss paths must be validated; SOL/USD exposure remains. Max leverage is not a recommendation.

Kamino also advertises credit/RWA Multiply products. No executable $10 quotes, issuer diligence or eligibility/cost validation was completed for them, so headline yields are not presented as fundable alternatives. This review covers the prior shortlist, not every Kamino product or the best yield globally.

Before any approval: choose ordinary USDC versus deliberate SOL exposure; validate/simulate direct deposit and redemption plus tracking if choosing the economical route; refresh configuration and complete entry/exit costs; separately review execution authorization. No additional funding is requested at this stage.

## Evidence

- [Machine-readable comparison](../../artifacts/kamino/2026-10-21/review-summary.json)
- [Fresh lending configuration/history/costs](../../artifacts/kamino/2026-10-21/lending-validation.json)
- [Stablecoin looping](../../artifacts/kamino/2026-10-21/lending-loop-usdc-feasibility.json)
- [Seven LST pair checks](../../artifacts/kamino/2026-10-21/lending-loop-lst-market.json)
- [Unsigned message fees](../../artifacts/kamino/2026-10-21/lending-message-costs.json)
- [Kamino mechanics](https://kamino.com/docs/products/multiply/how-it-works)
- [Kamino risks](https://kamino.com/docs/products/multiply/risks)
- [Kamino strategy categories](https://kamino.com/docs/products/multiply/strategies)
- [Official Jito yield endpoint](https://kobe.mainnet.jito.network/api/v1/stake_pool_stats)

Raw primary API/RPC snapshots, request provenance, source revisions and hashes are preserved alongside the comparison. SDK revision remains 6a26d6f1b5afb29953ffd139ee8c0c4ca5f26ce6; deployed bytecode equivalence was not established. Earlier dated research was preserved.
