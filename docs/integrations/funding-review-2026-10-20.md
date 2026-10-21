# Funding review — 20 October 2026

**Execution is disabled. No money moved, no private key was read, and nothing was signed or submitted. Ript remains pending with its $10 reserved.**

The most defensible first experiments to consider are **SOL buy-and-hold as a benchmark** and **Orca SOL/USDC as an LP learning position**. Neither has a demonstrated profitable edge. Keep the other station allocations in cash until their evidence or setup improves; ten stations do not require ten immediate trades.

This review attaches to the immutable first shortlist, run `62211178-1953-4a04-909b-4e85883a43e8`. A corrected `research-v1.0.1` worker also completed run `ec943d55-1ecc-43c0-bd78-e3bd357e8167`; every active station still says WAIT and every candidate remains `entryEligible=false`. The original report was not rewritten. Numbers below are timestamped observations, not live executable quotes.

## What to consider funding

| Station | Research conclusion | Evidence and remaining decision |
|---|---|---|
| 1 · Jupiter Swap | Consider SOL as a simple 30-day benchmark | Lowest complexity of the shortlisted assets. Choose the exact entry/exit and cost-basis rules. JUP/MET remain deferred: concentrated supply and weak or insufficient retrospective strategy evidence. |
| 2 · Raydium active spot | Keep cash | No qualifying validated entry. The tested trend rule does not establish a robust edge after cost stress. |
| 3 · Jupiter Perps long | Keep cash | No qualifying entry. A chosen market, leverage/loss policy, net collateral minimum and funding/borrow/liquidation model remain absent. |
| 4 · Pacifica short | Keep cash | No qualifying entry. Deposit minimum and order minimum are separate; do not increase leverage merely to clear one. |
| 5 · Meteora | Optional later experiment; defer wider ranges | Compact step20 ±5% is the least account-intensive tested DLMM choice. It still needs a budget-safe preparation/deposit plan and active-bin protection. Wider ranges tie up excessive account capital relative to $10. |
| 6 · Kamino | Defer standard route; investigate a cheaper supported route | SOL/BTC USDC is the research preference of the two reserves. Its observed 30-day gross on $10 was only $0.045505. Account lifecycle costs, exact future exit and tracking matter more than the small APY difference. Current USDC/PYUSD looping reduces base carry; see the separate loop review below. |
| 7 · Pump existing coin | Do not fund the current shortlist on this evidence | CATE has only 85 complete daily bars; baton 40; CLAUDIA 12. Histories and current quote friction do not support a validated entry. CLAUDIA's observed buy impact also exceeded the 1% research cap after correcting Jupiter's ratio units. |
| 8 · Orca | Best LP candidate for selection review | SOL/USDC ±20%, exact rounded range 85.9940–129.0058 USDC/SOL. Budgeted deposit, preparation quote and message costs are checked below. Position fee income remains unknown. |
| 9 · Ript | Pending | Owner is building a custom pack. No Ript polling or integration action. |
| 10 · Pump own launch | Pending launch design | Name, symbol, metadata, distribution, demand and launch economics are not chosen. Creating a token is not evidence of a profitable strategy. |

“Consider” means choose whether the experiment is worth its risk. It is not an approval to enter, a trade signal or a claim that the implementation is ready to execute.

## Costs we can substantiate

Lamports are exact at their captured RPC snapshots. USD equivalents use SOL around $107.5 only to explain scale. Future price, priority requirements, routes and account state will change. These fee reads price **unsigned messages**, not successful execution simulations.

| Candidate / route | Separate SOL account capital from an empty wallet | Current base entry message | Current base exit diagnostic | Important exclusions |
|---|---:|---:|---:|---|
| Jupiter spot | Shared USDC ATA 0.001488440 SOL; target legacy ATA 0.001488440 if retained, or temporary WSOL capital when wrapped/unwrapped | 5,000 lamports | 5,000 lamports | Route friction, any intermediate accounts, funding transfers and priority. Native SOL vs retained WSOL changes account lifecycle. |
| Orca budgeted ±20% | **0.010120400 SOL** (~$1.09), including shared USDC+WSOL ATAs | **10,000 lamports**, plus **5,000** for the checked preparation swap | **5,000 lamports** to withdraw/claim/close position | Later conversion to USDC and priority; ordinary exit does not close both wallet ATAs. |
| Meteora step20 ±5% | **0.044876720 SOL** (~$4.82), including the same shared ATAs | **10,000 lamports** | **5,000 lamports** | Preparation, final bin-price protection, conversion and priority. The original near-$10 asset caps leave inadequate swap-friction headroom. |
| Kamino standard $10 deposit | **0.031277560 SOL** (~$3.36), including USDC ATA, metadata, obligation, farm user state and empty LUT | **5,000 lamports** | **Unresolved**: official builder requires an existing obligation | Some account capital has no verified wallet-refund path; exact exit and account cleanup fees, priority and funding transfer. |
| Kamino direct cToken supply | **0.002976880 SOL** (~$0.32) for two ATAs; only one new ATA if USDC ATA already funded | Not yet a complete final-route quote | Unresolved | Current station tracker would miss direct cTokens; mint-aware valuation and lifecycle previews needed first. |

**Shared account capital is counted once.** Orca-specific position/NFT/reserve capital is 7,143,520 lamports; Meteora-specific compact-position capital is 41,899,840. Their combined account requirement is therefore **52,020,240 lamports**, not the sum of two independently charged shared ATA pairs. The native SOL investment principal must also remain separate from the SOL operating pool in the ledger.

Account capital is not automatically a fee or loss. Orca position/NFT/reserve capital can return on a valid full close. USDC ATA rent remains locked while that account contains USDC; WSOL closure unwraps its balance and rent. Metadata, delegated farm and lookup-table recovery have different conditions; see the lending lifecycle report before treating them as recoverable by this wallet.

The Kamino follow-up verified **17,637,760 lamports** automatically return when an obligation is fully emptied. However, **11,216,640 lamports (~$1.21)** of metadata/delegated-farm funding have no verified wallet-refund path: the documented delegated-farm close pays its administrator. These accounts can have future reuse value, so this is not automatically a realized $1.21 loss. It still dominates the few cents of sampled 30-day yield in a one-cycle cash-recovery comparison. The empty LUT requires authorized deactivation and a delayed close. [Lifecycle evidence](../../artifacts/diligence/lending-recovery.json).

### Orca: a preparation example that actually fits $10

Saved pool state: 20 October 14:41:13 UTC, ticks **−24536…−20480**, metadata-free position NFT. The offline official SDK quote targets **$9.95 at that pool price**, leaving room for preparation friction:

- Deposit **0.041849442 WSOL + 5.451204 USDC**.
- Fresh preparation quote at **15:04:19 UTC** buys those exact WSOL units for **4.482527 USDC**, with maximum input **4.504940 USDC** at 50bps slippage.
- After that swap and the stable deposit, expected unspent cash is **0.066269 USDC**; minimum cash under that quote is **0.043856 USDC**.
- Preparation costs **5,000 base lamports**; LP entry costs **10,000**. Account capital plus these two current entry-message fees is **0.010135400 SOL**, before funding transfers or priority.
- The entry uses preacquired WSOL. It **does not also wrap another copy of SOL from the operating pool**. The older native-SOL-source diagnostic is a different route.

The preparation instruction's router, source/destination accounts and encoded amount/slippage fields were independently checked against the official Jupiter parser schema. Full route-plan/inner-venue decoding is not complete. The saved pool and swap quote are different snapshots, and the LP diagnostic uses zero slippage. Refresh both together and choose executable bounds before any future action. Expired blockhashes are retained as evidence, never reused to trade.

Sources: [budgeted deposit](../../artifacts/diligence/lp-orca-budgeted-quote.json), [preparation quote/instructions/fee](../../artifacts/diligence/costs-orca-budgeted-prep.json), [limited ABI check](../../artifacts/diligence/costs-orca-prep-abi-check.json), [WSOL-source entry/exit fees](../../artifacts/diligence/lp-orca-budgeted-unsigned-previews.json), [Jupiter instruction schema](https://github.com/jup-ag/instruction-parser/blob/main/src/idl/jupiter.ts).

## Security conclusions

Mainnet mint identity, token programs, initialized state, authorities and raw extension layouts were checked for SOL, JUP, MET, CATE, baton and CLAUDIA. Their mint/freeze authorities were disabled at capture. The three Pump mints had only metadata-pointer/token-metadata extensions, with disabled update authorities; no transfer-fee/hook extension was found. **These narrow checks do not establish token legitimacy, safe distribution or future liquidity.**

USDC intentionally retains issuer mint/freeze authority and depeg/custody exposure. Jupiter/Pump/PumpSwap and the LP programs remain upgradeable; a published audit does not prove the currently deployed binary equals its audited revision.

Holder RPC rate limits required a bounded discovery sample from a third-party index, followed by independent mainnet reads of those accounts and supply. It is not a complete beneficial-owner graph or guaranteed current top-account ranking. Before classification, sampled owner concentration is high for JUP and MET. Official treasury/vesting disclosures explain several large addresses; they must not all be called liquid whales, and a wallet label does not prove its current balance is locked. The token-specific source reports retain both confirmed labels and unknowns.

Official disclosure matches six sampled JUP owner wallets totaling **57.754884%** of observed mint supply; fourteen sampled owners remain unclassified. This explains custody purpose without establishing present locks or liquid float. The official Net-Zero vote succeeded, but implementation of its offsets and restrictions was not independently cleared. MET's docs distinguish the unlocked 5% Mercurial bucket from the vesting 34% Meteora reserve; inconsistent later captions are not proof that all reserve tokens are locked.

Evidence: [mint/account/program checks](../../artifacts/diligence/security.json), [JUP ownership and governance source review](../../artifacts/diligence/security-jup-assessment.md), [official MET tokenomics](https://docs.meteora.ag/protocol/met/tokenomics), [LP identity and authority checks](../../artifacts/diligence/lp-assessment.md).

## What historical validation actually established

Exact-mint metadata was matched to the histories. Rules were frozen before fetching these results; completed UTC candles, next-open fills, cash/hold benchmarks and several cost stresses were used. The final chronological interval is **retrospective**, not an untouched holdout: the rule family and current surviving assets were already known.

For SOL's final 570-day interval, $10 became **$10.14 at 25bps per side**, **$9.60 at 50bps**, and **$9.39 with 50bps plus $0.01 per side**. That is cost-fragile evidence, not proof of a repeatable trading edge. JUP and MET lacked strong validation; the Pump histories were especially short. SOL holding is a benchmark choice, not a forecast based on the long backtest's headline result.

Meteora's compact ±5% range had 20 of 30 daily closes outside a range anchored at the first day's open; 25 candles included outside-range trading. These counts describe one observed regime, not future probabilities or exact time in range. Historical fee income attributable to our LP positions cannot be reconstructed from pool fee/TVL totals alone.

The Orca original-$10 inventory-only stress case loses value without fee compensation: a 30% SOL fall gives about **$7.45 LP value versus $8.64 holding the matching deposited assets**. A 30% rise gives about **$10.43 LP versus $11.36 matching hold**. These exclude fees, execution, depegs and exploits; the $9.95 deposit scales those examples slightly.

Kamino reserve exchange-rate observations gave about **$0.039446 JLP / $0.045505 SOL/BTC gross per $10 over 30 days**. Those are sampled reserve changes, not a wallet return or a guaranteed future APY. Current rates were about 4.65% and 4.66%; available USDC and caps were sufficient at capture, but stress withdrawals and bad debt remain protocol risks.

Details: [history report and costs](../../artifacts/diligence/history-report.md), [LP ranges/return limitations](../../artifacts/diligence/lp-assessment.md), [lending history, risks and account lifecycle](../../artifacts/diligence/lending-validation.md), [current spot quote friction](../../artifacts/diligence/swap-costs.json).

### Follow-up: could Kamino looping improve the return?

Kamino supports Multiply, but the tested stable pair currently pays less on additional supply than it costs to borrow: latest USDC supply **4.6008%**, PYUSD borrowing **4.7126%**. Its approximate 2x carry is **4.4891% before costs**, below unlevered supply. A separate JitoSOL/SOL example has a very small positive snapshot spread; at 3x it adds less than **$0.001 over 30 days on $10** versus unlevered JitoSOL under flat rates and SOL/USD, before costs. Neither supports borrowing now. Multiply would change the station's strategy and require different attribution/health monitoring. [Full looping comparison](kamino-looping-review-2026-10-20.md).

The broader LST screen covered 27 live rate discoveries and seven fresh on-chain pair configurations. All seven currently hit the SOL new-borrowing utilization guard at capture. Among four pairs with issuer-yield observations, provisional bSOL arithmetic adds about one cent gross over 30 days at 3x on $10; it is still blocked and its yield measurement timestamp is absent. Three named underlying yields remain unknown after a suspect zero feed was rejected. This is a research screen, not a new position recommendation. [Detailed comparison and source limitations](../../artifacts/diligence/loop-lst-comparison.md).

## What remains before positions can go live

1. Choose which experiments justify funding and their entry, exit, range/rebalance and maximum-loss rules. Keep unselected allocations as cash; keep Ript's reserve intact.
2. Complete strategy attribution and fee/rent accounting. Shared wallet balances are not per-station P&L. Orca currently discovers positions but does not yet value nonempty positions and fees; direct Kamino cTokens need a different tracker.
3. Refresh chosen pool/market state, preparation amounts, protection bounds, account existence and fees together. Set a separate SOL allowance with a stated buffer; these snapshots do not guarantee future priority or failed-transaction costs.
4. Validate chosen complete instructions, funded-state simulations and reconciliation. API execution adapters are still implementation work. The disabled execution worker cannot become a trading engine merely by changing an environment variable.

No capital posting, holding, P&L or profit claim has been fabricated. Funding the wallet and authorizing trades remain separate actions.

## Verification and operating state

All **69 focused diligence/research/reader/sync/execution tests** passed after the final changes; workspace typecheck and lint passed. Independent review found no P1/P2 issue in the preparation-budget/encoded-amount checks, loop arithmetic or the bounded utilization-guard conclusion. This verifies the implemented checks, not investment profitability or full protocol security.

The corrected research-worker deployment `b957207d-bdb2-4fc9-b86b-4638cf83b973` reported SUCCESS and completed a `research-v1.0.1` run. New operator diligence/looping reports are local evidence; the daily preliminary worker has not been represented as automatically running this full investigation. [Saved runtime read-back](../../artifacts/diligence/runtime-status.json) shows execution has no signing, submission or job-claim capability. The public-wallet recheck at **15:23:25 UTC** found **0 SOL and no token accounts**. [Wallet evidence](../../artifacts/diligence/wallet-pre-funding-state.json).

Raw evidence and local report/code integrity hashes are indexed in [the evidence manifest](../../artifacts/diligence/evidence-manifest.json). Quotes, fees, rates and account controls are tied to their capture times and require refreshing before a future funded action.
