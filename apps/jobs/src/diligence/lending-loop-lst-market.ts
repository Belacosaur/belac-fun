import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { decodeLayout, layoutSize, parseLayout, remainingWithdrawalCap, type Layout, type WithdrawalCapState } from './lending-layout.js';
import type { LendingValidation } from './lending-collect.js';

const out = new URL('../../../../artifacts/diligence/', import.meta.url);
const saved: LendingValidation = JSON.parse(await readFile(new URL('lending-validation.json', out), 'utf8'));
const klendRevision: { sha: string } = JSON.parse(await readFile(new URL('lending-recovery-klend-revision.json', out), 'utf8'));
const mainMarket = saved.reports[1].market;
const jitoMarket = 'H6rHXmXoCQvq8Ue81MqNh7ow5ysPa1dSozwW3PU1dDH6';
const PROGRAM = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD';
const SOL = 'So11111111111111111111111111111111111111112';
const JITOSOL = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn';
const requested = ['MSOL', 'bSOL', 'JupSOL', 'dfdvSOL', 'adraSOL', 'JITOSOL'];
type Original = LendingValidation['reports'][number]['reserveState'];
type Reserve = Original & { config: Original['config'] & { borrowFactorPct: string; borrowLimitOutsideElevationGroup: string; borrowLimitAgainstThisCollateralInElevationGroup: string[];
  debtWithdrawalCap: WithdrawalCapState; fees: { originationFeeSf: string; flashLoanFeeSf: string }; utilizationLimitBlockBorrowingAbovePct: number; debtMaturityTimestamp: string; debtTermSeconds: string };
  borrowedAmountsAgainstThisReserveInElevationGroups: string[]; borrowedAmountOutsideElevationGroup: string };
interface ElevationGroup { id: number; ltvPct: number; liquidationThresholdPct: number; allowNewLoans: number; debtReserve: string; maxReservesAsCollateral: number; maxLiquidationBonusBps: number }
type Market = LendingValidation['reports'][number]['marketState'] & { elevationGroups: ElevationGroup[] };
interface Metrics { reserve: string; liquidityToken: string; liquidityTokenMint: string; supplyApy: string; borrowApy: string; totalSupply: string; totalBorrow: string }
interface Account { owner: string; data: [string, string] }
interface RpcBatch { context: { slot: number }; value: (Account | null)[] }
type Evidence = { file: string; url: string; method: string; fetchedAt: string; sha256: string };
const evidence: Evidence[] = [];
const priorEvidence: Evidence[] | null = process.argv.includes('--offline')
  ? (JSON.parse(await readFile(new URL('lending-loop-lst-market.json', out), 'utf8')) as { evidence: Evidence[] }).evidence : null;
async function capture(file: string, url: string, init?: RequestInit) {
  if (priorEvidence) {
    const previous = priorEvidence.find(row => row.file === file && row.url === url && row.method === (init?.method ?? 'GET'));
    if (!previous) throw new Error('Missing offline source provenance');
    const body = await readFile(new URL(file, out), 'utf8');
    if (createHash('sha256').update(body).digest('hex') !== previous.sha256) throw new Error('Offline source hash mismatch');
    evidence.push(previous); return body;
  }
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Bounded public LST read HTTP ${response.status}`);
  await writeFile(new URL(file, out), body);
  evidence.push({ file, url, method: init?.method ?? 'GET', fetchedAt: new Date().toISOString(), sha256: createHash('sha256').update(body).digest('hex') });
  return body;
}
const [mainMetrics, jitoMetrics]: Metrics[][] = await Promise.all([mainMarket, jitoMarket].map(async (market, i) => {
  const rows: Metrics[] = JSON.parse(await capture(`lending-loop-lst-market-${i ? 'jito' : 'main'}-metrics.json`, `https://api.kamino.finance/kamino-market/${market}/reserves/metrics`));
  if (!Array.isArray(rows) || rows.some(row => !row.reserve || !row.liquidityTokenMint)) throw new Error('Invalid market metrics');
  return rows;
}));
const catalog = saved.reports[1].collateralUniverse;
const mainCatalog = requested.map(symbol => {
  const found = catalog.find(row => row.symbol === symbol);
  if (!found) throw new Error(`Missing exact catalog token ${symbol}`);
  return found;
});
const mainSol = mainMetrics.find(row => row.liquidityTokenMint === SOL);
const jitoSol = jitoMetrics.find(row => row.liquidityTokenMint === SOL);
const jitoColl = jitoMetrics.find(row => row.liquidityTokenMint === JITOSOL);
if (!mainSol || !jitoSol || !jitoColl) throw new Error('Missing exact SOL/JitoSOL debt/collateral reserve');
const addresses = [mainMarket, ...mainCatalog.map(row => row.reserve), mainSol.reserve, jitoMarket, jitoColl.reserve, jitoSol.reserve];
if (new Set(addresses).size !== 11) throw new Error('Unexpected bounded account selection');
const accounts: (Account | null)[] = [], slots: number[] = [], requests = [];
for (let start = 0; start < addresses.length; start += 10) {
  const request = { jsonrpc: '2.0', id: start + 1, method: 'getMultipleAccounts', params: [addresses.slice(start, start + 10), { encoding: 'base64', commitment: 'finalized' }] };
  requests.push(request);
  const result: { result: RpcBatch; error?: unknown } = JSON.parse(await capture(`lending-loop-lst-market-rpc-${start}.json`, saved.publicRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }));
  if (result.error || !result.result?.value) throw new Error('Invalid finalized account batch');
  accounts.push(...result.result.value); slots.push(result.result.context.slot);
}
await writeFile(new URL('lending-loop-lst-market-rpc-requests.json', out), JSON.stringify(requests, null, 2));
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
function decode<T>(index: number, name: string): T {
  const info = accounts[index];
  if (!info || info.owner !== PROGRAM) throw new Error(`Absent/wrong owner ${addresses[index]}`);
  const bytes = Buffer.from(info.data[0], 'base64');
  if (bytes.length !== layoutSize(schemas[name], schemas) + 8 || !bytes.subarray(0, 8).equals(createHash('sha256').update(`account:${name}`).digest().subarray(0, 8))) throw new Error('SDK size/discriminator mismatch');
  return decodeLayout(schemas[name], bytes, schemas, 8) as T;
}
const mainState = decode<Market>(0, 'LendingMarket'), jitoState = decode<Market>(8, 'LendingMarket');
const mainDebt = decode<Reserve>(7, 'Reserve'), jitoDebt = decode<Reserve>(10, 'Reserve');
const observedUnixSeconds = Math.floor(Date.parse(evidence.find(row => row.file === 'lending-loop-lst-market-rpc-0.json')!.fetchedAt) / 1000);
const D = Decimal.clone({ precision: 40 }), SF = new D(2).pow(60);
function reserveSummary(index: number, state: Reserve, metrics: Metrics, market: string) {
  if (state.lendingMarket !== market || state.liquidity.mintPubkey !== metrics.liquidityTokenMint || metrics.reserve !== addresses[index]) throw new Error('Reserve/mint/market identity mismatch');
  const decimals = Number(state.liquidity.mintDecimals), scale = new D(10).pow(decimals);
  const borrowed = new D(state.liquidity.borrowedAmountSf).div(SF);
  const supply = new D(state.liquidity.totalAvailableAmount).plus(borrowed).minus(new D(state.liquidity.accumulatedProtocolFeesSf).div(SF))
    .minus(new D(state.liquidity.accumulatedReferrerFeesSf).div(SF)).minus(new D(state.liquidity.pendingReferrerFeesSf).div(SF));
  return { reserve: addresses[index], mint: metrics.liquidityTokenMint, symbol: metrics.liquidityToken, market,
    reserveStatus: ['Active', 'Obsolete', 'Hidden'][state.config.status], emergencyMode: state.config.emergencyMode, permissionedOps: state.config.permissionedOps,
    baseSupplyApyFraction: Number(metrics.supplyApy), borrowApyFraction: Number(metrics.borrowApy), baseSupplyApyIncludesUnderlyingStakingYield: false,
    normalLtvPct: state.config.loanToValuePct, normalLiquidationThresholdPct: state.config.liquidationThresholdPct, borrowFactorPct: state.config.borrowFactorPct,
    disableCollateralOutsideEmode: state.config.disableUsageAsCollOutsideEmode, elevationGroupIds: state.config.elevationGroups.filter(id => id > 0),
    depositCapTokens: new D(state.config.depositLimit).div(scale).toFixed(), depositHeadroomTokens: D.max(new D(state.config.depositLimit).minus(supply), 0).div(scale).toFixed(),
    creditedAvailableTokens: new D(state.liquidity.totalAvailableAmount).div(scale).toFixed(), queuedCollateralBaseUnits: state.withdrawQueue.queuedCollateralAmount,
    freelyAvailableTokensIfNoQueue: state.withdrawQueue.queuedCollateralAmount === '0' ? new D(state.liquidity.totalAvailableAmount).div(scale).toFixed() : null,
    borrowCapTokens: new D(state.config.borrowLimit).div(scale).toFixed(), borrowHeadroomTokens: D.max(new D(state.config.borrowLimit).minus(borrowed), 0).div(scale).toFixed(),
    borrowLimitOutsideElevationGroupBaseUnits: state.config.borrowLimitOutsideElevationGroup, borrowedOutsideElevationGroupBaseUnits: state.borrowedAmountOutsideElevationGroup,
    debtFlowCap: remainingWithdrawalCap(state.config.debtWithdrawalCap, observedUnixSeconds),
    utilizationFraction: supply.isZero() ? null : borrowed.div(supply).toNumber(), blockBorrowAboveUtilizationPct: state.config.utilizationLimitBlockBorrowingAbovePct,
    maxAdditionalBorrowBaseUnitsUnderUtilizationGuard: state.config.utilizationLimitBlockBorrowingAbovePct === 0 ? null
      : D.max(supply.mul(state.config.utilizationLimitBlockBorrowingAbovePct).div(100).minus(borrowed).minus(new D(1).div(SF)).floor(), 0).toFixed(0),
    originationFeeFraction: new D(state.config.fees.originationFeeSf).div(SF).toNumber(), flashLoanFeeFraction: new D(state.config.fees.flashLoanFeeSf).div(SF).toNumber(),
    debtMaturityTimestamp: state.config.debtMaturityTimestamp, debtTermSeconds: state.config.debtTermSeconds };
}
const debts = [reserveSummary(7, mainDebt, mainSol, mainMarket), reserveSummary(10, jitoDebt, jitoSol, jitoMarket)];
const verified = [...mainCatalog.map((row, i) => ({ index: i + 1, market: mainMarket, marketState: mainState, debt: mainDebt, debtSummary: debts[0], metric: mainMetrics.find(m => m.reserve === row.reserve) })),
  { index: 9, market: jitoMarket, marketState: jitoState, debt: jitoDebt, debtSummary: debts[1], metric: jitoColl }].map(entry => {
  if (!entry.metric) throw new Error('Missing selected collateral metrics');
  const state = decode<Reserve>(entry.index, 'Reserve');
  const collateral = reserveSummary(entry.index, state, entry.metric, entry.market);
  const groups = entry.marketState.elevationGroups.filter(g => g.id > 0 && g.debtReserve === entry.debtSummary.reserve
    && state.config.elevationGroups.includes(g.id) && entry.debt.config.elevationGroups.includes(g.id)).map(g => {
    const cap = state.config.borrowLimitAgainstThisCollateralInElevationGroup[g.id - 1], used = state.borrowedAmountsAgainstThisReserveInElevationGroups[g.id - 1];
    if (cap === undefined || used === undefined) throw new Error('Missing eMode pair cap');
    return { ...g, collateralAgainstDebtCapBaseUnits: cap, collateralAgainstDebtUsedBaseUnits: used,
      collateralAgainstDebtRemainingBaseUnits: (BigInt(cap) > BigInt(used) ? BigInt(cap) - BigInt(used) : 0n).toString(),
      maximumLeverageBoundary: 1 / (1 - g.ltvPct / 100), sameReserveCollateralAndDebt: collateral.reserve === g.debtReserve };
  });
  const blockers: string[] = [];
  if (collateral.reserveStatus !== 'Active' || entry.debtSummary.reserveStatus !== 'Active') blockers.push('Collateral/debt reserve is not Active');
  if (collateral.emergencyMode || entry.debtSummary.emergencyMode || entry.marketState.emergencyMode) blockers.push('Emergency mode set');
  if (entry.marketState.borrowDisabled) blockers.push('Market borrowing disabled');
  if (collateral.permissionedOps !== '0' || entry.debtSummary.permissionedOps !== '0' || entry.marketState.permissionedOps !== '0') blockers.push('Permissioned operations need separate authorization verification');
  if (!groups.some(g => g.allowNewLoans === 1 && !g.sameReserveCollateralAndDebt && BigInt(g.collateralAgainstDebtRemainingBaseUnits) > 0n)) blockers.push('No matching open SOL-debt elevation group with pair-cap headroom');
  if (new D(collateral.depositHeadroomTokens).lte(0)) blockers.push('Collateral deposit cap full');
  if (entry.debtSummary.freelyAvailableTokensIfNoQueue === null || new D(entry.debtSummary.freelyAvailableTokensIfNoQueue).lte(0)) blockers.push('SOL debt free liquidity unavailable');
  if (new D(entry.debtSummary.borrowHeadroomTokens).lte(0)) blockers.push('SOL reserve global borrow cap full');
  if (entry.debtSummary.debtFlowCap.remainingWithdrawBaseUnits === '0') blockers.push('SOL reserve debt-flow cap has no headroom');
  if (entry.debtSummary.blockBorrowAboveUtilizationPct > 0 && entry.debtSummary.utilizationFraction !== null && entry.debtSummary.utilizationFraction * 100 >= entry.debtSummary.blockBorrowAboveUtilizationPct) blockers.push('SOL reserve utilization borrowing guard reached');
  if (BigInt(entry.debtSummary.debtMaturityTimestamp) > 0n && BigInt(entry.debtSummary.debtMaturityTimestamp) <= BigInt(observedUnixSeconds)) blockers.push('SOL reserve debt maturity reached');
  return { collateral, debt: entry.debtSummary, marketEmergencyMode: entry.marketState.emergencyMode, marketBorrowDisabled: entry.marketState.borrowDisabled,
    matchingSolDebtGroups: groups, configurationScreen: blockers.length ? 'blocked_or_unknown' : 'compatible_on_current_configuration', configurationBlockers: blockers,
    underlyingStakingApy: null, totalCollateralYield: null, marginalCarry: null, profitabilityRank: null,
    missing: ['Underlying LST yield and its independent primary source are intentionally not collected here.', 'Size-specific swaps, flash amount, complete fees/rent, future exit and issuer/security review remain unverified.'] };
});
const discovery = catalog.filter(row => row.status === 'Active' && row.elevationGroups.includes(2) && row.mint !== SOL).map(row => {
  const current = mainMetrics.find(m => m.reserve === row.reserve && m.liquidityTokenMint === row.mint);
  return { symbol: row.symbol, mint: row.mint, market: mainMarket, reserve: row.reserve,
    baseSupplyApyFraction: current ? Number(current.supplyApy) : null, solDebtBorrowApyFraction: debts[0].borrowApyFraction,
    configurationSource: verified.some(v => v.collateral.reserve === row.reserve) ? 'fresh_RPC_above' : `prior_catalog_slot_${row.slot}_not_freshly_revalidated`,
    underlyingYield: null, securityCleared: false };
});
for (const row of jitoMetrics.filter(row => row.liquidityTokenMint !== SOL)) discovery.push({ symbol: row.liquidityToken, mint: row.liquidityTokenMint, market: jitoMarket, reserve: row.reserve,
  baseSupplyApyFraction: Number(row.supplyApy), solDebtBorrowApyFraction: debts[1].borrowApyFraction,
  configurationSource: row.reserve === jitoColl.reserve ? 'fresh_RPC_above' : 'API_discovery_only_not_RPC_eligibility_verified', underlyingYield: null, securityCleared: false });
const result = { generatedAt: new Date().toISOString(), observedUnixSeconds, executionEnabled: false, scope: { publicRpcAccountsRead: addresses.length, finalizedSlots: slots,
  mainMarketNamedLstTokensFreshlyChecked: requested, mainMarketDiscoveryPairs: discovery.filter(d => d.market === mainMarket).length,
  jitoMarketDiscoveryPairs: discovery.filter(d => d.market === jitoMarket).length, verifiedPairs: verified.length },
  sdkCommit: saved.sdkCommit, klendRevision: klendRevision.sha, debts, verified, discovery, evidence,
  interpretation: 'Configuration compatibility is a bounded read-only screen, not a successful borrow/swap/Multiply transaction or security clearance. Supply APYs are reserve borrow-interest yield, excluding the LST underlying staking yield. Do not rank total profitability without independently sourced underlying yield.',
  conclusion: 'Seven named market-pair configurations checked. Both SOL debt reserves are at/above their configured utilization borrowing limit at this snapshot, so the source-derived screen blocks incremental borrowing for all seven. adraSOL also has no deposit-cap headroom. Wider live-rate discovery retains explicit eligibility gaps. No best-overall or positive-carry claim is made.' };
await writeFile(new URL('lending-loop-lst-market.json', out), JSON.stringify(result, null, 2));
const pct = (value: number) => `${(value * 100).toFixed(5)}%`;
const lines = ['# SOL-LST/SOL live market screen', '', `Snapshot ${result.generatedAt}; finalized slots ${slots.join(', ')}. **Research only; execution disabled.** Exactly ${addresses.length} public accounts read.`, '',
  `**Current entry blocker:** both matched SOL debt reserves are already above the configured 90% utilization borrowing guard: SOL/BTC ${(debts[0].utilizationFraction! * 100).toFixed(5)}%, Jito isolated ${(debts[1].utilizationFraction! * 100).toFixed(5)}%. The pinned program rejects a new borrow whose post-borrow utilization is at or above the nonzero limit. Consequently all seven source-derived entry screens are blocked at this snapshot, even though their eMode memberships and free token liquidity exist. adraSOL also has no deposit-cap headroom. This is a configuration/source assessment; no executable borrowing simulation was performed.`, '',
  `${result.scope.mainMarketDiscoveryPairs} previously identified main-market SOL-debt candidates received fresh API rate observations. The six named main-market LSTs plus JitoSOL in the isolated Jito market received fresh RPC configuration checks (${verified.length} market pairs). Jito-market kySOL and ezSOL are API discoveries only. Other catalog memberships are older snapshots, explicitly not current eligibility clearance.`, '',
  '| Pair / market | Exact collateral mint | Reserve base supply APY | SOL borrow APY | Matched eMode max / liquidation LTV | Config screen |', '| --- | --- | ---: | ---: | --- | --- |',
  ...verified.map(v => `| ${v.collateral.symbol}/SOL — ${v.collateral.market === mainMarket ? 'SOL/BTC' : 'Jito isolated'} | ${v.collateral.mint} | ${pct(v.collateral.baseSupplyApyFraction)} | ${pct(v.debt.borrowApyFraction)} | ${v.matchingSolDebtGroups.map(g => `${g.id}: ${g.ltvPct}% / ${g.liquidationThresholdPct}%`).join('; ') || 'None'} | ${v.configurationScreen} |`), '',
  '**Underlying staking yield is deliberately absent.** Reserve base supply APY is not the LST’s total collateral yield. Combine only with independently verified LST staking yield, account for units/compounding, then compare against the matching market’s SOL borrow rate. Missing underlying yield remains unknown, not zero. No profitability ranking is produced.', '',
  '| SOL debt market | Exact SOL reserve | Current SOL borrow APY | Credited free SOL if queue=0 |', '| --- | --- | ---: | ---: |',
  ...debts.map(d => `| ${d.market === mainMarket ? 'SOL/BTC' : 'Jito isolated'} | ${d.reserve} | ${pct(d.borrowApyFraction)} | ${d.freelyAvailableTokensIfNoQueue ?? 'Unresolved'} |`), '',
  'Fresh configuration details in the JSON include status/emergency/permission flags, borrow factors, normal and elevation-group LTV/liquidation thresholds, allowed-new-loan flags, exact pair caps and current usage, debt liquidity/global caps, utilization guard, maturity/term and protocol fee fractions. These are current constraints, not a guarantee that a $10 route clears size, swaps, timing, oracle checks or monitoring requirements. The JSON deliberately distinguishes free SOL held in the pool from additional SOL that its utilization guard permits borrowing; the latter is currently zero.', '',
  `The main-market matched group is 2 (87% max LTV / 92% liquidation LTV). The isolated Jito group is 1 (92% / 95%), implying a theoretical 12.5x boundary rather than treating older 90%/10x prose as current configuration. This is not recommended leverage. Exact current source precedence matters. [Utilization guard implementation](https://github.com/Kamino-Finance/klend/blob/${klendRevision.sha}/programs/klend/src/lending_market/lending_operations.rs#L1448), [elevation-group index definition](https://github.com/Kamino-Finance/klend/blob/${klendRevision.sha}/programs/klend/src/state/lending_market.rs#L619).`, '',
  'Theoretical leverage boundaries implied by LTV are not suggested positions. LST issuer/staking loss, the actual oracle path, rate changes, liquidity, liquidation/deleveraging and transaction failure remain risks. Underlying yield collection, security clearance and funded or executable transaction tests are outside this screen.', '',
  'Raw API responses and finalized RPC responses/requests are adjacent lending-loop-lst-market-* artifacts. The JSON records SHA-256 provenance and the pinned SDK layout revision; every freshly decoded account passed owner, Anchor discriminator and exact layout-size checks.', ''];
await writeFile(new URL('lending-loop-lst-market.md', out), lines.join('\n'));
console.log(JSON.stringify({ scope: result.scope, debts: debts.map(d => ({ market: d.market, borrowApy: d.borrowApyFraction })), pairs: verified.map(v => ({ symbol: v.collateral.symbol, market: v.collateral.market, config: v.configurationScreen, groups: v.matchingSolDebtGroups.map(g => ({ id: g.id, ltv: g.ltvPct, liq: g.liquidationThresholdPct })) })) }, null, 2));
