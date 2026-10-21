# Kamino looping review — 20 October 2026

**Yes, Kamino supports looping through Multiply. The current rates we checked do not justify switching our $10 station into it yet.** Execution remains disabled; no strategy configuration changed and no debt was opened.

**The wider LST check also found a current opening constraint:** at finalized slots 459280304/459280307, the main SOL reserve was **90.54165% utilized** and the isolated Jito SOL reserve **90.10341%**, above their configured **90% new-borrowing guard**. The pinned source checks projected utilization for ordinary permanent borrowing, including eMode. All seven freshly checked LST/SOL routes therefore hit that guard in an ordinary unchanged-state opening; adraSOL also had no deposit-cap headroom. This can change as liquidity/parameters change. It does not establish that every Kamino Multiply product is unavailable. [Configuration, source and raw RPC evidence](../../artifacts/diligence/lending-loop-lst-market.md).

A loop supplies collateral, borrows another asset, swaps the borrowed funds into more collateral and supplies again. At 3x, $10 equity starts with approximately $30 collateral and $20 debt. Kamino can assemble this atomically using a flash loan; the ongoing debt remains after the flash loan is repaid within the opening transaction. This is a different position from plain USDC lending. [Official mechanics](https://kamino.com/docs/products/multiply/how-it-works.md).

The useful question is the **additional return for taking the borrowing risk**, after complete opening/closing costs. A larger supplied balance is not free profit.

| Compared route | Current observations | Modeled comparison before all costs |
|---|---|---|
| USDC collateral / PYUSD debt, SOL/BTC market | USDC supply **4.6008%**, PYUSD borrow **4.7126%**, captured 15:20 UTC | Approximate annual carry: **4.4891% at 2x**, **4.3773% at 3x**, versus **4.6008%** plain supply. Each extra borrowed dollar reduces the yield. |
| JitoSOL collateral / SOL debt, isolated Jito market | Jito-reported asset APY **4.7554%** at 14:05 UTC; tiny lending APY brings assumed collateral yield to **4.7558%**. SOL borrow **4.7072%**, fetched later that afternoon | Approximate annual carry **4.8044% at 2x / 4.8530% at 3x**. At 3x, the constant-rate, flat-SOL/USD model adds only **$0.000766 over 30 days** versus unlevered JitoSOL on $10, before all setup/trading costs. |

These are snapshot arithmetic, not forecasts or guaranteed executable APYs. The Jito inputs have different timestamps, and the tiny positive spread is smaller than ordinary rate uncertainty. The model holds rates and SOL/USD constant; collateral and debt grow separately from the modeled yield, without additional market/depeg moves. No incentives, liquidation or unknown costs are credited. JitoSOL is SOL exposure, so its USD return is not directly comparable to stablecoin lending without considering SOL's price.

## Wider LST comparison

Live rate discovery covered **24 main-market candidates and three additional Jito-market candidates**. Fresh on-chain configuration checks covered six named main-market LSTs and JitoSOL in its isolated market: seven pairs. Underlying issuer-yield fallbacks were available for JitoSOL, mSOL and bSOL; JupSOL, dfdvSOL and adraSOL stayed unknown.

| Pair | Gross 3x annual carry approximation | Extra 30-day gross vs holding/lending the same collateral, $10 | Current opening status |
|---|---:|---:|---|
| mSOL/SOL, main | 4.5583% | −$0.004672 | SOL borrowing guard |
| bSOL/SOL, main | 7.2649% | +$0.009435 | SOL borrowing guard; underlying yield timestamp missing |
| JitoSOL/SOL, main | 3.3632% | −$0.010936 | SOL borrowing guard |
| JitoSOL/SOL, isolated | 4.8537% | +$0.000772 | SOL borrowing guard |
| JupSOL / dfdvSOL / adraSOL | Unknown | Unknown | Borrowing guard; adraSOL also deposit-cap bound |

The bSOL arithmetic is the largest modeled improvement among these four priced pairs, about **one cent over a month before costs**, and remains provisional. This is not a global best-loop ranking or historical validation. The underlying sources use different periods: mSOL's trailing 30-day annualization, Jito's reported snapshot, and bSOL's recent-epochs average with no measurement timestamp. The exact mint and matching SOL-debt market are retained in the [combined comparison](../../artifacts/diligence/loop-lst-comparison.md).

Data quality matters here: Sanctum's older documented public feed returned zero for all 23 supported assets and their last ten individual epochs, contradicting positive issuer readings. Those values were rejected as suspect; they were not silently used as genuine zero yields. Its newer documented API requires an API key. Unknown yield stays unknown rather than creating a misleading ranking. [Yield sources and normalized values](../../artifacts/diligence/loop-lst-yields-summary.json).

The current stable pair's 90% maximum LTV and 95% liquidation threshold were independently decoded. Those values do not suggest using the theoretical 10x boundary. At 10x, a roughly 5.26% collateral-oracle-value decline with debt unchanged reaches that threshold before interest and penalties. At 2x/3x the starting LTV is 50%/66.67%; depegs, debt growth and exits still matter. Same-reserve USDC self-borrowing was not established as an executable route, and the JLP market's USDC has zero collateral LTV. [Exact stable-pair checks](../../artifacts/diligence/lending-loop-usdc-feasibility.md).

There is an important math distinction: borrowing above the collateral yield makes the **incremental borrowed leg** unattractive; it does not necessarily make the entire position's return negative. The common approximate annual equation is `L × collateral yield − (L − 1) × borrow rate`. Total carry reaches zero at `borrow rate = L × collateral yield / (L − 1)`. Parts of the narrative docs blur these two conditions; the tested model keeps them separate.

LST stake-rate oracles can prevent a temporary secondary-market discount from changing the protocol's collateral mark. They do not remove staking-protocol failure, oracle/control, withdrawal-liquidity, borrowing-rate or USD exposure risks. A peg assumption does not remove stablecoin issuer/default/freeze risk. RWA and JLP loops may show higher headline yields, but add credit/redemption or directional-market exposure and have not been cleared by this review. [Kamino strategy descriptions](https://kamino.com/docs/products/multiply/strategies.md), [Jito's official APY API documentation](https://www.jito.network/docs/jitosol/jitosol-liquid-staking/for-developers/stake-pool-api/).

**Research conclusion:** keep looping on the watchlist rather than borrow now. Reconsider when a supported pair has a durable positive spread that survives higher borrowing rates and covers measured setup, swap, flash-loan and exit costs over our holding period. Then examine modest leverage before any higher setting. A rate spike of three percentage points already turns this example's 3x Jito carry negative in the model.

The previous standard lending account quote must not be reused as an exact Multiply setup quote. Leverage can add a debt farm, different obligation type, swaps and flash loans. The current Kamino reader is scoped to lending; Multiply needs verified product attribution, collateral/debt valuation and continuous health monitoring before use.

Evidence: [Jito scenarios, source hashes and limitations](../../artifacts/diligence/loop-jito-assessment.json), [USDC/PYUSD configuration, fees and rates](../../artifacts/diligence/lending-loop-usdc-feasibility.json), [seven-pair comparison and stress models](../../artifacts/diligence/loop-lst-comparison.json), [saved product documentation sources](../../artifacts/diligence/loop-doc-sources.json). Reproduce saved calculations offline with `pnpm --filter @belac/jobs exec tsx src/diligence/loop-jito-report.ts` and `pnpm --filter @belac/jobs exec tsx src/diligence/loop-lst-compare.ts`; regression tests are in `loop.test.ts`.
