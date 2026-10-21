/** Offline quote from the saved pool state. No RPC, wallet or transaction calls. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { parseLpReport } from './lp-types.js';
import type { LiquidityQuote, OrcaPool } from './lp-types.js';
const dir = fileURLToPath(new URL('../../../../artifacts/diligence/', import.meta.url));
Decimal.set({ precision: 60 });
const raw = await readFile(dir + 'lp-validation.json', 'utf8');
const report = parseLpReport(raw), pool = report.pools[3] as OrcaPool;
const range = pool.ranges.find(r => r.requestedWidthPct === 20);
if (!range) throw new Error('Saved Orca ±20% range missing');
const core = createRequire(createRequire(import.meta.url).resolve('@orca-so/whirlpools'))('@orca-so/whirlpools-core');
const sqrtPrice = BigInt(pool.decoded.sqrtPrice), q128 = 1n << 128n;
const targetMicroUsdc = 9950000n, totalMicroUsdc = 10000000n;
const valueNumerator = (q: LiquidityQuote) => q.tokenMaxA * sqrtPrice * sqrtPrice * 1000n + q.tokenMaxB * 1000n * q128;
const quoteAt = (liquidity: bigint) => core.increaseLiquidityQuote(liquidity, 0, sqrtPrice, range.lower, range.upper) as LiquidityQuote;
let low = 0n, high = 200000000n;
while (low < high) {
  const middle = (low + high + 1n) / 2n;
  if (valueNumerator(quoteAt(middle)) <= targetMicroUsdc * 1000n * q128) low = middle;
  else high = middle - 1n;
}
const quote = quoteAt(low), next = quoteAt(low + 1n);
if (valueNumerator(quote) > targetMicroUsdc * 1000n * q128 || valueNumerator(next) <= targetMicroUsdc * 1000n * q128) throw new Error('Budget boundary validation failed');
const valueUsd = new Decimal(valueNumerator(quote).toString()).div(new Decimal(q128.toString()).mul(1000000000));
const maxPrepInputAtoms = totalMicroUsdc - quote.tokenMaxB;
const output = {
  createdAt: new Date().toISOString(), offline: true, rpcCalls: 0, source: 'lp-validation.json', sourceSha256: createHash('sha256').update(raw).digest('hex'), sourceSnapshotAt: report.createdAt,
  pool: pool.id, sourceConfirmedSlot: pool.slot, sqrtPriceX64: sqrtPrice, lowerTick: range.lower, upperTick: range.upper, slippageToleranceBps: 0,
  strategyBudgetUsdcAtoms: totalMicroUsdc, targetDepositValueUsdcAtoms: targetMicroUsdc, quote,
  depositSol: new Decimal(quote.tokenMaxA.toString()).div(1e9).toFixed(9), depositUsdc: new Decimal(quote.tokenMaxB.toString()).div(1e6).toFixed(6),
  exactRationalValueUsdc: { numerator: valueNumerator(quote).toString(), denominator: (q128 * 1000000000n).toString() },
  depositValueUsdcAtSavedPrice: valueUsd.toFixed(18), residualBudgetUsdcAtSavedPrice: new Decimal(10).minus(valueUsd).toFixed(18),
  maximumPrepSwapUsdcInputAtomsToStayWithinStrategyBudget: maxPrepInputAtoms,
  maximumPrepSwapUsdcInput: new Decimal(maxPrepInputAtoms.toString()).div(1e6).toFixed(6),
  prepSwapRequiredSolOutputAtoms: quote.tokenMaxA,
  nextLiquidityUnitWouldExceedTarget: true,
  notes: ['Exact SDK quote uses the same saved sqrt price and rounded ticks; binary search maximizes liquidity while rounded token caps value <=9.95 USDC.', 'Budget assumes USDC=$1. The reserve is cash/price-friction capacity, not an additional token deposit.', 'Parent must obtain a fresh ExactOut prep quote for the stated SOL output. Its maximum USDC input plus deposit USDC atoms must be <=10000000.', 'Final cash after prep is 10000000 minus actual prep USDC input minus tokenMaxB; it is not guaranteed to equal 0.05 USDC.', 'SOL network fees, account rent and priority capital remain separate and are not included in the $10 strategy principal.', 'Zero-slippage deposit diagnostics are not signed, sent or successfully simulated; executable protection must be selected and refreshed before approval.'],
};
await writeFile(dir + 'lp-orca-budgeted-quote.json', JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
console.log(JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
