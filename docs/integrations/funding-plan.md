# Before funding the $100 challenge

Updated 21 October 2026. Ript is pending the owner's custom pack. No deposits, orders, swaps, launches or account authorizations have been performed. Execution remains disabled.

The owner has selected preparation of SOL buy-and-hold and Orca SOL/USDC first. The [dated funding instructions](first-two-funding-2026-10-21.md) request **20 USDC net plus 0.03 native SOL net** for these two stations; the other $80 of strategy capital is outside that first request. These are planned transfers, not observed funding or completed positions.

## Agreed capital policy

The first shortlist now has a [timestamped funding comparison](funding-review-2026-10-20.md) covering mint/holder checks, historical diagnostics, LP ranges and account recovery, lending lifecycle and unsigned message costs. A [separate looping review](kamino-looping-review-2026-10-20.md) compares the current stablecoin and JitoSOL/SOL carry. These reports narrow the choices; they do not mark a position execution-ready or replace the remaining attribution/adapters below. Execution remains disabled and Ript pending.

The owner confirmed **$100 of strategy capital, plus a separate SOL pool for network fees and account rent**. Ten planned allocations remain $10 each; Ript's $10 remains reserved while pending. The initial recommended operating pool is **0.03 SOL for the first two stations**; it includes account capital and a buffer. The full ten-station operating requirement has not been priced or selected.

The SOL pool can be a separate ledger allocation within the existing wallet; this does not require another keypair. SOL used as an investment or protocol collateral must belong to its strategy allocation. The raw wallet estimate includes all wallet assets and must not be presented as challenge equity or returns.

Accounting must retain transaction signature, strategy identity, exact lamports, fee type and a timestamped USD mark where available. Network/priority fees are expenses; refundable account rent is restricted/recoverable capital until recovered or proven unrecoverable. Rent refunds return to the SOL pool. Shared setup costs stay explicit rather than being charged arbitrarily to an agent. Show strategy performance and additional operating costs separately, with an after-cost result once reconciled. Never subtract fees twice when they are already reflected in venue equity.

Protocol trading/borrow/funding fees can be paid from collateral or trade proceeds in other tokens. A separate SOL pool does not eliminate those costs or change a venue's minimum net collateral requirement. The existing ledger supports fee events and exact asset quantities, but automated transaction attribution and this pool's postings are still to be implemented; no accounting entries have been fabricated.

## Connection and setup matrix

| Station | Read connection implemented and checked | Decisions or implementation still needed |
|---|---|---|
| 1 Jupiter Swap | Live SOL/USDC quote probe; shared SOL/SPL/Token-2022 wallet reader | Hold-token mint; entry allocation and cost basis; attribute fills to this strategy |
| 2 Raydium | Live Raydium quote probe; shared wallet reader | Trading tokens, entry/exit/reinvestment rules and limits; attribute each fill |
| 3 Jupiter Perps long | Public open-long positions; verified empty wallet | Market, collateral asset, leverage, size and TP/SL policy; reconcile raw USD units, net equity and fees; execution adapter |
| 4 Pacifica short | Public positions and account read; no account yet | Market, collateral, leverage and limits; account/deposit setup when approved; meet the documented 10 USDC deposit minimum and attribute whole-account equity |
| 5 Meteora | DLMM portfolio totals including unclaimed fees; verified empty | Choose DLMM pool, token split, bins/range and rebalance policy; other Meteora products require their own adapter |
| 6 Kamino | Lending portfolio API; wallet not indexed | Exact USDC reserve/market; scope valuation to that reserve; verify indexed position after approved setup; rewards excluded |
| 7 Pump.fun existing coin | Mainnet Pump/PumpSwap executable programs plus shared token-account reader | Existing token mint; determine bonding curve vs PumpSwap; separate cost basis/trade history from station 10 |
| 8 Orca | Official Whirlpools SDK discovers SPL/Token-2022 positions and bundles; verified empty | Pool, price range, token split and rebalance policy; position USD/fee valuation and transaction reconciliation |
| 9 Ript | Intentionally pending; no catalog polling | Owner supplies custom pack and production integration later; reserve allocation |
| 10 Pump.fun own coin | Mainnet Pump/PumpSwap program reads plus shared wallet reader | Name, symbol, metadata/art, token parameters and launch budget; distinguish inventory, proceeds and creator fees; creation/execution adapter |

Quote probes prove read access, not a funded swap. Program checks prove deployed program access, not a completed Pump SDK execution integration. Empty-account tests do not verify nonempty financial valuation. There is no aggregate strategy P&L until allocations and capital flows are reconciled.

## Remaining before funding / starting

1. **Select positions and operating rules.** Fill in the choices above. Provider names alone do not specify an executable position. Keep nine active strategies and the reserved Ript allocation distinct.
2. **Price exact setup and opening costs.** Check market minimums, rent, token accounts, priority fees and protocol fees for those choices. Jupiter's official CLI documentation states $10 minimum collateral for new positions; verify an opening preview with the chosen parameters so fees cannot push collateral below that threshold. Pacifica's official deposit guide specifies a 10 USDC minimum; its live market-info API also lists a $10 minimum order size for BTC/ETH. Deposit and order minimums are separate constraints; recheck the selected market and actual amount credited. Do not choose leverage solely to clear a minimum.
3. **Finish attribution and accounting.** Bind the real campaign/strategy records to mints, venue/position IDs and transaction signatures; post the initial capital and separate SOL pool only when observed. Add fee/rent reconciliation and supported price history. The current read snapshot is not an accounting ledger.
4. **Choose the funding composition and SOL allowance.** Confirm which mainnet assets to transfer and the required amounts from the setup estimates. The wallet currently has zero SOL and no token balances. Confirm the owner's recovery copy of the existing local keypair without sharing its private contents.
5. **Choose manual execution versus API execution per platform.** Manual transactions can be reconciled with evidence; API trading needs selected adapters, unsigned previews, transaction validation, limits, deduplication, confirmation, recovery and strategy-specific tests. Current execution-worker is an idle foundation, not a trading engine. These are implementation tasks, not missing API credentials alone.
6. **Activate separately after review.** Provision signing only to the execution service if automating; fund only after the plan is settled. Funding does not enable trading. This build rejects `EXECUTION_ENABLED=true`.

## Infrastructure and verification

Public read connections currently work without new API credentials. `JUPITER_API_KEY` is optionally supported on the private sync worker. `SOLANA_RPC_URL` can use a dedicated mainnet endpoint if public RPC becomes unreliable; the wallet and new on-chain readers reject a non-mainnet genesis hash. Orca's SDK is restricted to read RPC methods and a bounded deadline.

Local diagnostic: `node --import ./apps/jobs/node_modules/tsx/dist/loader.mjs apps/jobs/src/check-platforms.ts`. It loads no signing key, touches no database and performs no writes to providers. The result at `artifacts/platform-check-20261020.json` has nine successful read scopes, Ript pending, and an unfunded wallet. Live observations and empty-wallet reads still need verification with the eventual selected positions before execution.

Sources: [Jupiter Perps minimum collateral](https://github.com/jup-ag/cli/blob/main/docs/perps.md), [Pacifica deposits](https://docs.pacifica.fi/support/deposit-withdrawal), [Pacifica market info](https://docs.pacifica.fi/api-documentation/api/rest-api/markets/get-market-info), [Raydium quote API](https://docs.raydium.io/sdk-api/trade-api), [Orca position discovery](https://docs.orca.so/developers/sdks/positions/monitor-positions), [Pump official instructions](https://github.com/pump-fun/pump-public-docs).
