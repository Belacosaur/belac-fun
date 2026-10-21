# Funding instructions — SOL hold and Orca

Prepared 21 October 2026, approximately 08:18 AWST. **Execution remains disabled. This document authorizes no swap, deposit, signature or transaction submission.**

## Amounts to receive

Send on **Solana mainnet** to this existing challenge wallet:

```text
HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j
```

| Asset | Net amount the wallet should receive | Purpose |
|---|---:|---|
| Native USDC on Solana | **20.000000 USDC** | 10 USDC for SOL buy-and-hold; 10 USDC for Orca, including its residual cash |
| Native SOL | **0.030000000 SOL** | Separate operating/account-capital pool for these two stations |

These are **net arrival amounts**. Sender/exchange withdrawal and transfer charges are additional and depend on the source. Use native Circle USDC on Solana, mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. [Circle's official mainnet addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).

The remaining **$80 strategy capital is outside this first funding request**, including Ript's reserved allocation. No additional investment SOL needs to be sent now: both strategies' SOL will be acquired later using their own USDC allocation. All 0.03 SOL above belongs to the operating pool, not either strategy's investment balance.

## Prepared positions

**Station 1, Jupiter SOL buy-and-hold:** reserve 10 USDC for a SOL purchase, then a 30-day holding experiment beginning at the eventual observed fill. Today's unsigned quote indicated 0.093766324 SOL, with a 0.093297493 SOL minimum under the preview's 50bps bound. These are expiring quote outputs, not promised future quantities. The current unsigned message fee was 5,000 lamports. Attribution must distinguish the purchased SOL from the operating SOL in the same wallet.

**Station 8, Orca SOL/USDC:** prepare the previously researched pool `Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE`, tick spacing 4, approximately ±20% around the refreshed market. The captured price was 106.645026 USDC/SOL, rounded range **85.308863–127.977961**, ticks **−24616…−20560**. Both boundary arrays existed.

The new SDK quote includes 50bps deposit input caps and preparation headroom rather than reusing yesterday's zero-slippage diagnostic:

- Estimated deposited assets: **0.041970799 SOL + 5.424520 USDC**, approximately 9.90 USDC in marked inventory.
- Maximum deposit inputs: **0.042180653 SOL + 5.451643 USDC**, marked value at most 9.95 USDC at the captured pool state.
- Exact-output preparation quote buys the maximum SOL input for **4.498557 USDC**, with maximum spend **4.521050 USDC**.
- Preparation maximum plus maximum stable deposit is **9.972693 USDC**, leaving at least **0.027307 USDC cash** under those quote bounds. Unused SOL and additional cash stay attributed to Orca, so the station retains its full 10 USDC starting allocation less actual costs.

The intended later order is the native-SOL hold purchase first, then Orca's retained-WSOL preparation and LP entry. A hold-swap cleanup must not close an ATA containing Orca's prepared SOL. Never add a second native-SOL funding transfer after the Orca preparation; investment SOL must not come from the operating pool.

## Separate SOL reserve

The conservative empty-wallet account-capital requirement is **0.010120400 SOL**:

| Component | SOL |
|---|---:|
| Position, metadata-free NFT mint/account and source-derived reserves | 0.007143520 |
| Shared USDC and WSOL token accounts | 0.002976880 |
| New tick arrays | 0 — both exist |
| **Total account capital** | **0.010120400** |

With a **0.030000000 SOL** operating pool, this leaves **0.019879600 SOL** before network fees for base fees, chosen priority fees, possible failed attempts and closing headroom. The reserve is intentionally larger than the current quoted base fees. It is not an estimate that 0.03 SOL will be spent, and it does not guarantee every future cost.

Account capital can be recovered only under its lifecycle conditions; unspent reserve remains owned capital. If the funding sender creates/pays for the USDC token account, record that contribution and skip charging that account rent again during setup. Sender-paid account rent and transfer fees must not appear as strategy profit or disappear from operating accounting.

## State and limits

Mainnet RPC at slot **459426384**, 08:18:33 AWST, found **0 SOL, 0 USDC and no token accounts**. The public production API independently reported the same configured wallet and a fresh snapshot. The private deployed execution status at 08:19:19 AWST reported `enabled=false`, `sign=false`, `submit=false`, and `claimJobs=false`.

Funding does not open either position. Quotes/ranges, account existence, complete instructions, fees and funded-state simulations must be refreshed before a later separately authorized entry. Strategy attribution and transaction reconciliation remain required. Ript stays pending.

Evidence: [fresh funding preview and raw public observations](../../artifacts/funding/2026-10-21/funding-preview.json). Reproduce the read-only preparation with `pnpm --filter @belac/jobs exec tsx src/diligence/funding-prepare.ts`. No private key is loaded by this collector.
