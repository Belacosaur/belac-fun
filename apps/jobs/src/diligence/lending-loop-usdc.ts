import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeLayout, layoutSize, parseLayout, remainingWithdrawalCap, type Layout, type WithdrawalCapState } from './lending-layout.js';
import type { LendingValidation } from './lending-collect.js';

const out = new URL('../../../../artifacts/diligence/', import.meta.url);
const saved: LendingValidation = JSON.parse(await readFile(new URL('lending-validation.json', out), 'utf8'));
const PYUSD = '2gc9Dm1eB6UgVYFBUN9bWks6Kes9PbWSaPaa9DqyvEiN';
const PROGRAM = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD';
type R = LendingValidation['reports'][number]['reserveState'];
type Reserve = R & { config: R['config'] & { borrowFactorPct: string; fees: { originationFeeSf: string; flashLoanFeeSf: string }; borrowLimitOutsideElevationGroup: string; debtWithdrawalCap: WithdrawalCapState } };
interface Elevation { id: number; ltvPct: number; liquidationThresholdPct: number; allowNewLoans: number; debtReserve: string; maxReservesAsCollateral: number }
type Market = LendingValidation['reports'][number]['marketState'] & { elevationGroups: Elevation[] };
interface Account { owner: string; data: [string, string] }
interface Metrics { reserve: string; liquidityToken: string; liquidityTokenMint: string; supplyApy: string; borrowApy: string }
const evidence: { file: string; url: string; method: string; fetchedAt: string; sha256: string }[] = [];
async function capture(file: string, url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Public loop read HTTP ${response.status}`);
  await writeFile(new URL(file, out), text);
  evidence.push({ file, url, method: init?.method ?? 'GET', fetchedAt: new Date().toISOString(), sha256: createHash('sha256').update(text).digest('hex') });
  return text;
}
const schemas: Record<string, Layout> = {};
async function schema(name: string, category = 'types'): Promise<void> {
  if (schemas[name]) return;
  schemas[name] = parseLayout(await readFile(new URL(`lending-sdk-${category}-${name}.ts.txt`, out), 'utf8'));
  async function refs(node: Layout): Promise<void> {
    if (node.kind.startsWith('ref:')) await schema(node.kind.slice(4));
    for (const child of node.children ?? []) await refs(child);
  }
  await refs(schemas[name]);
}
await schema('Reserve', 'accounts'); await schema('LendingMarket', 'accounts');
const addresses = [...saved.reports.map(r => r.reserve), PYUSD, ...saved.reports.map(r => r.market)];
const request = { jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [addresses, { encoding: 'base64', commitment: 'finalized' }] };
const rpc: { result: { context: { slot: number }; value: (Account | null)[] }; error?: unknown } = JSON.parse(await capture('lending-loop-rpc.json', saved.publicRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }));
if (rpc.error || rpc.result?.value?.length !== addresses.length) throw new Error('Invalid bounded account snapshot');
function decode<T>(index: number, name: string): T {
  const info = rpc.result.value[index];
  if (!info || info.owner !== PROGRAM) throw new Error('Missing/wrong program owner');
  const bytes = Buffer.from(info.data[0], 'base64');
  if (bytes.length !== layoutSize(schemas[name], schemas) + 8 || !bytes.subarray(0, 8).equals(createHash('sha256').update(`account:${name}`).digest().subarray(0, 8))) throw new Error('Account layout mismatch');
  return decodeLayout(schemas[name], bytes, schemas, 8) as T;
}
const reserves = [decode<Reserve>(0, 'Reserve'), decode<Reserve>(1, 'Reserve'), decode<Reserve>(2, 'Reserve')];
const markets = [decode<Market>(3, 'LendingMarket'), decode<Market>(4, 'LendingMarket')];
const allMetrics: Metrics[][] = [];
for (let i = 0; i < saved.reports.length; i++) allMetrics.push(JSON.parse(await capture(`lending-loop-${i === 0 ? 'jlp' : 'solbtc'}-metrics.json`, `https://api.kamino.finance/kamino-market/${saved.reports[i].market}/reserves/metrics`)));
const metrics = [...saved.reports.map((r, i) => allMetrics[i].find(m => m.reserve === r.reserve)), allMetrics[1].find(m => m.reserve === PYUSD)];
if (metrics.some(m => !m || !Number.isFinite(Number(m.supplyApy)) || !Number.isFinite(Number(m.borrowApy)))) throw new Error('Missing exact reserve metrics');
function reserveView(index: number) {
  const r = reserves[index], m = metrics[index]!;
  if (r.liquidity.mintPubkey !== m.liquidityTokenMint || r.lendingMarket !== saved.reports[index === 0 ? 0 : 1].market) throw new Error('Reserve/market identity mismatch');
  const decimals = Number(r.liquidity.mintDecimals);
  return { reserve: addresses[index], mint: m.liquidityTokenMint, symbol: m.liquidityToken, supplyApyFraction: Number(m.supplyApy), borrowApyFraction: Number(m.borrowApy),
    status: r.config.status, normalLtvPct: r.config.loanToValuePct, normalLiquidationThresholdPct: r.config.liquidationThresholdPct,
    borrowFactorPct: r.config.borrowFactorPct, disableCollateralOutsideEmode: r.config.disableUsageAsCollOutsideEmode,
    elevationGroupIds: r.config.elevationGroups.filter(id => id > 0), borrowLimitOutsideElevationGroupBase: r.config.borrowLimitOutsideElevationGroup,
    creditedAvailableTokens: Number(r.liquidity.totalAvailableAmount) / 10 ** decimals,
    queuedCollateralBaseUnits: r.withdrawQueue.queuedCollateralAmount,
    freelyAvailableTokensIfNoQueue: r.withdrawQueue.queuedCollateralAmount === '0' ? Number(r.liquidity.totalAvailableAmount) / 10 ** decimals : null,
    debtFlowCap: remainingWithdrawalCap(r.config.debtWithdrawalCap, Math.floor(Date.now() / 1000)),
    originationFeeFraction: Number(BigInt(r.config.fees.originationFeeSf)) / 2 ** 60,
    flashLoanFeeFraction: Number(BigInt(r.config.fees.flashLoanFeeSf)) / 2 ** 60,
    reserveEmergencyMode: r.config.emergencyMode, permissionedOps: r.config.permissionedOps };
}
const views = [reserveView(0), reserveView(1), reserveView(2)];
const group8 = markets[1].elevationGroups.find(g => g.id === 8);
if (!group8 || group8.debtReserve !== PYUSD || !views[1].elevationGroupIds.includes(8) || !views[2].elevationGroupIds.includes(8)) throw new Error('Official pair/group mismatch');
const supply = views[1].supplyApyFraction;
function scenario(leverage: number, borrowApy: number, liquidationThreshold: number) {
  const collateral = 10 * leverage, debt = 10 * (leverage - 1), ltv = debt / collateral;
  const annualGross = collateral * supply - debt * borrowApy;
  return { leverage, initialEquityUsd: 10, initialCollateralUsd: collateral, initialDebtUsd: debt, initialLtv: ltv,
    staticOneYearGrossUsd: annualGross, staticOneYearGrossReturnOnInitialEquity: annualGross / 10,
    unleveredOneYearGrossUsd: 10 * supply, incrementalOneYearGrossVsUnleveredUsd: annualGross - 10 * supply,
    netNegativeBorrowApyThreshold: leverage * supply / (leverage - 1),
    horizonGrossUsd: [7, 30, 90].map(days => ({ days, grossUsd: collateral * Math.expm1(Math.log1p(supply) * days / 365) - debt * Math.expm1(Math.log1p(borrowApy) * days / 365) })),
    liquidationThresholdLtv: liquidationThreshold,
    debtToCollateralOraclePriceRatioIncreaseToLiquidation: liquidationThreshold / ltv - 1,
    collateralOraclePriceDeclineToLiquidationIfDebtPriceFixed: 1 - ltv / liquidationThreshold };
}
const result = { generatedAt: new Date().toISOString(), executionEnabled: false, mainnetSlot: rpc.result.context.slot,
  scope: 'Only shortlisted JLP USDC, SOL/BTC USDC, and the exact official USDC/PYUSD debt reserve; no borrow, funded mock, signing or transaction submission.',
  reserves: views, marketBorrowDisabled: markets.map(m => m.borrowDisabled),
  sameUsdc: { jlp: { status: 'not_collateral_eligible_for_this_loop', ltvPct: views[0].normalLtvPct, elevationGroups: views[0].elevationGroupIds },
    solBtc: { status: 'normal_mode_config_compatible_but_not_execution_validated', normalLtvPct: views[1].normalLtvPct, normalLiquidationThresholdPct: views[1].normalLiquidationThresholdPct,
      sameReserveEmode: 'Prohibited: refresh_obligation_deposits rejects collateral reserve equal to the elevation group debt reserve (ElevationGroupDebtReserveAsCollateral). Groups 1 and 6 naming this USDC debt reserve do not allow it as its own eMode collateral.',
      noSameReserveBlanketProhibitionFoundOutsideEmode: true, marginalApySpread: supply - views[1].borrowApyFraction,
      scenariosUnverifiedFeasibility: [2, 3].map(l => scenario(l, views[1].borrowApyFraction, views[1].normalLiquidationThresholdPct / 100)) } },
  usdcPyusd: { officialProductUrl: `https://kamino.com/multiply/${saved.reports[1].market}/${saved.reports[1].reserve}/${PYUSD}`,
    group: group8, marginalApySpread: supply - views[2].borrowApyFraction, noIncrementalCarryAdvantageAtSnapshot: views[2].borrowApyFraction > supply,
    scenarios: [2, 3].map(l => scenario(l, views[2].borrowApyFraction, group8.liquidationThresholdPct / 100)),
    maxLeverageBoundaryFromGroupLtv: 1 / (1 - group8.ltvPct / 100),
    maxLeverageIsNotRecommended: true, slippageAndRoundTripSwapCostUsd: null, flashLoanAmountAndExactFeeUsd: null,
    limitations: ['USDC/PYUSD exchange rate assumed 1:1 only for the illustrative model; exact size quotes are absent.', 'Supply/borrow APYs, utilization, pegs and liquidation parameters can change.', 'Negative marginal carry can reduce a positive total return; it does not by itself imply total negative equity APY.', 'No detailed entry/exit rent, swaps, liquidation path or flash-loan principal preview is validated for this leveraged route.'] },
  modeling: 'Static initial dollar notionals with constant current effective annual supply/borrow rates, 365-day scaling, both stablecoins pegged to $1, no rebalancing, incentives, swap/flash/network/setup costs or principal loss. A scenario, not an executable quote or predicted profit.',
  verdict: 'Do not loop either shortlisted reserve to improve base carry at this snapshot. JLP USDC has no collateral LTV; SOL/BTC self-loop is unvalidated and has a negative incremental spread; the supported USDC/PYUSD pair also has negative incremental spread before costs.',
  sourceRevision: { sdk: saved.sdkCommit, klend: (JSON.parse(await readFile(new URL('lending-recovery-klend-revision.json', out), 'utf8')) as { sha: string }).sha }, evidence };
await writeFile(new URL('lending-loop-usdc-feasibility.json', out), JSON.stringify(result, null, 2));
const pct = (n: number) => `${(n * 100).toFixed(4)}%`;
const md = ['# USDC loop feasibility — bounded read-only check', '', `**Verdict: no base-carry improvement from looping these choices at this snapshot.** Slot ${result.mainnetSlot}; ${result.generatedAt}. Execution remains disabled.`, '',
  `- JLP USDC: ${views[0].normalLtvPct}% normal collateral LTV and no elevation-group membership. This supplied USDC cannot bootstrap the proposed self-loop.`,
  `- SOL/BTC USDC: normal LTV ${views[1].normalLtvPct}%, liquidation threshold ${views[1].normalLiquidationThresholdPct}%. Same-reserve borrowing is not established as an executable path. The source does explicitly forbid the eMode debt reserve from being its own collateral, so USDC-debt groups 1/6 cannot be used to lift this self-loop’s LTV.`,
  `- The official USDC/PYUSD Multiply pair is configured in group 8: ${group8.ltvPct}% max LTV / ${group8.liquidationThresholdPct}% liquidation threshold, new loans ${group8.allowNewLoans}. Its theoretical 10x boundary is not a suggested position.`, '',
  '| Asset/reserve | Current base supply APY | Borrow APY | Credited free liquidity when queue=0 |', '| --- | ---: | ---: | ---: |',
  ...views.map(v => `| ${v.symbol} / ${v.reserve} | ${pct(v.supplyApyFraction)} | ${pct(v.borrowApyFraction)} | ${v.freelyAvailableTokensIfNoQueue === null ? 'Unresolved' : v.freelyAvailableTokensIfNoQueue.toFixed(2)} ${v.symbol} |`), '',
  `USDC self-borrow marginal spread: ${pct(result.sameUsdc.solBtc.marginalApySpread)}. USDC collateral/PYUSD debt marginal spread: ${pct(result.usdcPyusd.marginalApySpread)}. Each additional borrowed dollar currently earns less supply yield than its borrowing cost.`, '',
  '| Route | Leverage | Initial collateral / debt on $10 equity | Annual gross scenario | Gross annual return on equity | Change versus unlevered USDC |', '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...[...result.sameUsdc.solBtc.scenariosUnverifiedFeasibility.map(s => ({ route: 'Same USDC, feasibility unverified', ...s })), ...result.usdcPyusd.scenarios.map(s => ({ route: 'USDC/PYUSD group 8', ...s }))].map(s => `| ${s.route} | ${s.leverage}x | $${s.initialCollateralUsd} / $${s.initialDebtUsd} | $${s.staticOneYearGrossUsd.toFixed(6)} | ${pct(s.staticOneYearGrossReturnOnInitialEquity)} | $${s.incrementalOneYearGrossVsUnleveredUsd.toFixed(6)} |`), '',
  'These may remain positive total gross scenarios while being worse than the unlevered deposit. Under the linear annual-rate comparison, total return turns negative only when borrowAPY exceeds leverage × supplyAPY / (leverage − 1). BorrowAPY > supplyAPY establishes a negative incremental spread, not necessarily negative total yield. All scenario costs and principal impairments are excluded.', '',
  `Both USD-stablecoin pegs are assumptions, not hedges against issuer failure. At 2x/3x in group 8, initial LTV is 50%/66.67%, below the 95% liquidation threshold; at the theoretical 10x boundary, only a ~5.26% collateral-oracle-value decline with debt unchanged would reach 95%, before interest. The exact oracle response to depeg and a liquidation exit are unvalidated.`, '',
  `On-chain origination fees: USDC ${pct(views[1].originationFeeFraction)}, PYUSD ${pct(views[2].originationFeeFraction)}; flash-loan fee fractions: USDC ${pct(views[1].flashLoanFeeFraction)}, PYUSD ${pct(views[2].flashLoanFeeFraction)}. A flash fee is charged on the actual flash amount, which this check does not quote. PYUSD/USDC swaps, round-trip slippage, priority fees, leveraged account setup and exact exit costs remain unpriced. These additional costs worsen the comparison.`, '',
  `Primary sources: [official pair](${result.usdcPyusd.officialProductUrl}), [pinned borrow/refresh rules](https://github.com/Kamino-Finance/klend/blob/${result.sourceRevision.klend}/programs/klend/src/lending_market/lending_operations.rs). Exact selected account controls, group 8, rate snapshots and source hashes are in lending-loop-usdc-feasibility.json and adjacent lending-loop-* evidence.`, ''];
await writeFile(new URL('lending-loop-usdc-feasibility.md', out), md.join('\n'));
console.log(JSON.stringify({ slot: result.mainnetSlot, rates: views.map(v => ({ symbol: v.symbol, supply: v.supplyApyFraction, borrow: v.borrowApyFraction })), verdict: result.verdict }, null, 2));
