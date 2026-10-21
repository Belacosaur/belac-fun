import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getAddressDecoder } from '@solana/kit';
import { decodeLayout, layoutSize, parseLayout, remainingWithdrawalCap, type Layout } from './lending-layout.js';
import type { LendingValidation } from './lending-collect.js';

const out = new URL('../../../../artifacts/diligence/', import.meta.url);
const saved: LendingValidation = JSON.parse(await readFile(new URL('lending-validation.json', out), 'utf8'));
const klendRevision: { sha: string } = JSON.parse(await readFile(new URL('lending-recovery-klend-revision.json', out), 'utf8'));
const farmsRevision: { sha: string } = JSON.parse(await readFile(new URL('lending-recovery-farms-revision.json', out), 'utf8'));
const lutRevision: { sha: string } = JSON.parse(await readFile(new URL('lending-recovery-lut-revision.json', out), 'utf8'));
const tokenRevision: { sha: string } = JSON.parse(await readFile(new URL('lending-recovery-token-revision.json', out), 'utf8'));
const PROGRAM = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD';
const FARMS = 'FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr';
interface EncodedAccount { owner: string; data: [string, string]; lamports: number }
interface Cap { configCapacity: string; currentTotal: string; lastIntervalStartTimestamp: string; configIntervalLengthSeconds: string }
type SavedReserve = LendingValidation['reports'][number]['reserveState'];
type Reserve = SavedReserve & { config: SavedReserve['config'] & { interestRateBasis: number; rewardsAmountPerAccrualUnit: string; depositWithdrawalCap: Cap }; liquidity: SavedReserve['liquidity'] & { rewardsAmountAvailable: string } };
type Market = LendingValidation['reports'][number]['marketState'] & { withdrawTicketIssuanceEnabled: number; withdrawTicketRedemptionEnabled: number; withdrawTicketCancellationEnabled: number; minWithdrawQueuedLiquidityValue: string };
const schemas: Record<string, Layout> = {};
async function loadSchema(name: string, category = 'types'): Promise<void> {
  if (schemas[name]) return;
  schemas[name] = parseLayout(await readFile(new URL(`lending-sdk-${category}-${name}.ts.txt`, out), 'utf8'));
  async function refs(node: Layout): Promise<void> {
    if (node.kind.startsWith('ref:')) await loadSchema(node.kind.slice(4));
    for (const child of node.children ?? []) await refs(child);
  }
  await refs(schemas[name]);
}
await loadSchema('Reserve', 'accounts'); await loadSchema('LendingMarket', 'accounts');
const previews = await Promise.all(saved.reports.map(async r => {
  const file = r.name === 'JLP' ? 'lending-preview-jlp.json' : 'lending-preview-solbtc.json';
  const value: { instructions: { accounts: { address: string }[] }[] } = JSON.parse(await readFile(new URL(file, out), 'utf8'));
  return value;
}));
const farms = saved.reports.map(r => r.reserveState.farmCollateral);
const addresses = [...farms, ...saved.reports.map(r => r.reserve), ...saved.reports.map(r => r.market)];
const request = { jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [addresses, { encoding: 'base64', commitment: 'finalized' }] };
let body: string, observedAt: string;
if (process.argv.includes('--offline')) {
  body = await readFile(new URL('lending-recovery-rpc.json', out), 'utf8');
  const prior: { rpcEvidence: { fetchedAt: string } } = JSON.parse(await readFile(new URL('lending-recovery.json', out), 'utf8'));
  observedAt = prior.rpcEvidence.fetchedAt;
} else {
  const response = await fetch(saved.publicRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(25_000) });
  body = await response.text();
  if (!response.ok) throw new Error(`Read-only recovery RPC HTTP ${response.status}`);
  observedAt = new Date().toISOString();
  await writeFile(new URL('lending-recovery-rpc.json', out), body);
}
const rpc: { result: { context: { slot: number }; value: (EncodedAccount | null)[] }; error?: unknown } = JSON.parse(body);
if (rpc.error || !rpc.result?.value || rpc.result.value.length !== addresses.length) throw new Error('Invalid account batch');
const now = Math.floor(Date.parse(observedAt) / 1000);
function account(index: number, program: string, accountType: string, size: number): Buffer {
  const info = rpc.result.value[index];
  if (!info || info.owner !== program) throw new Error(`${accountType}: wrong owner or absent`);
  const data = Buffer.from(info.data[0], 'base64');
  if (data.length !== size || !data.subarray(0, 8).equals(createHash('sha256').update(`account:${accountType}`).digest().subarray(0, 8))) throw new Error(`${accountType}: layout/discriminator mismatch`);
  return data;
}
function decode<T>(index: number, type: string): T {
  return decodeLayout(schemas[type], account(index, PROGRAM, type, layoutSize(schemas[type], schemas) + 8), schemas, 8) as T;
}
function capHeadroom(cap: Cap) {
  return { ...cap, observedUnixSeconds: now, ...remainingWithdrawalCap(cap, now),
    newTenUsdcDepositDecreasesAccumulatorBy: '10000000',
    sourceRule: 'Deposits subtract currentTotal; ordinary redemptions add currentTotal. intervalLength=0 disables cap enforcement; capacity=0 does not.' };
}
const findings = saved.reports.map((r, i) => {
  const bytes = account(i, FARMS, 'FarmState', 8336);
  // Source-derived fixed layout: 8 discriminator + 2 addresses + TokenInfo(120)
  // + 10 RewardInfo(704) + 3 u64 + 2 addresses + u64 + delegate address = 7360.
  const flagsOffset = 8 + 64 + 120 + 10 * 704 + 24 + 64 + 8 + 32;
  const addressAt = (offset: number) => getAddressDecoder().decode(bytes.subarray(offset, offset + 32));
  const reserve = decode<Reserve>(i + 2, 'Reserve'), market = decode<Market>(i + 4, 'LendingMarket');
  if (reserve.lendingMarket !== r.market || reserve.liquidity.mintPubkey !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') throw new Error('Reserve identity mismatch');
  const farm = { address: farms[i], bytes: bytes.length, farmAdmin: addressAt(8), delegateAuthority: addressAt(7328),
    timeUnit: bytes[flagsOffset], isFarmFrozen: bytes[flagsOffset + 1], isFarmDelegated: bytes[flagsOffset + 2],
    withdrawalCooldownPeriodSeconds: bytes.readUInt32LE(flagsOffset + 44),
    closeSigner: 'delegated authority', documentedRentReceiver: 'farm admin, not wallet',
    ownerRefundAssumed: false };
  if (farm.isFarmDelegated !== 1) throw new Error('Farm is unexpectedly not delegated');
  if (farm.delegateAuthority !== previews[i].instructions.at(-1)?.accounts[3]?.address) throw new Error('Farm delegate does not match preview market authority');
  const amount = 10;
  const phaseCosts = { standardUpfrontAccountLamports: 31_277_560, entryNetworkLamports: 5000,
    obligationAutomaticallyReturnedIfFullEmptyExitLamports: saved.rentLamports['3344'],
    usdcAtaReturnedOnlyAfterEmptyAccountCloseLamports: saved.rentLamports['165'],
    emptyLutReturnedOnlyAfterAuthorizedDeactivationAndCooldownLamports: saved.rentLamports['56'],
    metadataNoUserRefundPathVerifiedLamports: saved.rentLamports['1032'],
    delegatedFarmNoWalletRefundViaDocumentedCloseLamports: saved.rentLamports['920'],
    notOwnerRecoverableUnderVerifiedPathsLamports: saved.rentLamports['1032'] + saved.rentLamports['920'],
    repeatPilotReuse: 'SDK skips metadata init if existing; skips farm user init if the deterministic farm/obligation account exists. Same wallet/reserve/default-obligation cycles may reuse these balances, subject to compatibility and actual state; no second cycle simulated.' };
  const rows = r.history.map(h => {
    const gross = h.ctokenExchangeRateObservation.tenUsdcGross;
    const principalLossFractionErasingGross = gross / amount;
    const nonOwnerCapitalUsd = phaseCosts.notOwnerRecoverableUnderVerifiedPathsLamports / 1e9 * Number(saved.solOraclePrice!.price);
    return { days: h.days, observedTenUsdcGross: gross, annualizedObservedExchangeRateReturnFraction: Math.expm1(Math.log1p(gross / 10) * 365 / h.days),
      principalLossFractionErasingGross, nonOwnerRecoverableSetupCapitalUsdAtOriginalPrice: nonOwnerCapitalUsd,
      grossLessNonOwnerRecoverableSetupCapitalBeforeNetworkUsd: gross - nonOwnerCapitalUsd };
  });
  return { name: r.name, market: r.market, reserve: r.reserve, farm, phaseCosts, historySensitivity: rows,
    supplyBasis: { interestRateBasis: reserve.config.interestRateBasis, label: reserve.config.interestRateBasis === 1 ? 'TrueApr (wall-clock seconds)' : 'Legacy (slots)',
      rewardsAmountPerAccrualUnit: reserve.config.rewardsAmountPerAccrualUnit, rewardsAmountAvailable: reserve.liquidity.rewardsAmountAvailable },
    withdrawal: { cap: capHeadroom(reserve.config.depositWithdrawalCap), queueIssuanceEnabled: market.withdrawTicketIssuanceEnabled,
      queueRedemptionEnabled: market.withdrawTicketRedemptionEnabled, queueCancellationEnabled: market.withdrawTicketCancellationEnabled,
      minQueuedLiquidityValueRaw: market.minWithdrawQueuedLiquidityValue, noBorrowRequiredPriceStatus: 'NONE; reserve and obligation still need current-slot refresh',
      fullExitMustWithdrawAllCollateralUnits: true,
      fullExitWarning: 'Withdrawing only the original 10 USDC can leave interest-bearing collateral dust and prevent empty-obligation closure/refund.' } };
});
const result = { generatedAt: new Date().toISOString(), executionEnabled: false, slot: rpc.result.context.slot,
  sourceRevision: { klend: klendRevision.sha, klendSdk: saved.sdkCommit, farmsSdk: farmsRevision.sha, lookupTable: lutRevision.sha, splToken: tokenRevision.sha }, sourceStatus: 'Official source behavior and current account layouts; exact deployed ELF equivalence has not been established.',
  rpcEvidence: { file: 'lending-recovery-rpc.json', request, fetchedAt: observedAt, sha256: createHash('sha256').update(body).digest('hex') },
  findings, limitations: ['No borrower population enumeration or market stress test.', 'No signed transaction, deposit, submission, or simulated funded future position.', 'No proof of a wallet refund for metadata or delegated farm state.', 'Future withdrawal fees, availability and protocol configuration remain variable.'] };
await writeFile(new URL('lending-recovery.json', out), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ slot: result.slot, findings }, null, 2));
export type LendingRecovery = typeof result;
