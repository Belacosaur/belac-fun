/** Bounded, offline review of saved rent/state and official lifecycle source. */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseLpReport, parseObject } from './lp-types.js';
import type { LpReport, OrcaPool, RpcAccount, RpcEnvelope } from './lp-types.js';
const dir = fileURLToPath(new URL('../../../../artifacts/diligence/', import.meta.url));
const reportText = await readFile(dir + 'lp-validation.json', 'utf8');
const report = parseLpReport(reportText), pool = report.pools[3] as OrcaPool;
const rents = parseObject<LpReport & { rentReads: Record<string, number> }>(reportText).rentReads;
const rentSource = await readFile(dir + 'lp-orca-rent.rs', 'utf8');
function constant(name: string) {
  const match = rentSource.match(new RegExp(`pub fn ${name}\\(\\)[\\s\\S]*?Ok\\(([\\d_]+)\\)`));
  if (!match) throw new Error('Official rent constant missing: ' + name);
  return Number(match[1].replaceAll('_', ''));
}
const tickReserve = constant('get_tick_rent_amount'), positionFloor = constant('get_position_minimum_rent_amount'), arrayFloor = constant('get_dynamic_tick_array_minimum_rent_amount');
const positionRent = Math.max(rents['216'], positionFloor), bothTicks = 2 * tickReserve;
const nftMint = rents['202'], nftAta = rents['170'], walletAta = rents['165'];
const positionRelated = positionRent + bothTicks + nftMint + nftAta;
const allAccountCapital = positionRelated + 2 * walletAta;
if (positionRelated !== 7143520 || allAccountCapital !== 10120400) throw new Error('Snapshot funding arithmetic changed; reassess figures');
const sdkRequire = createRequire(createRequire(import.meta.url).resolve('@orca-so/whirlpools'));
const sdkFile = createRequire(import.meta.url).resolve('@orca-so/whirlpools');
await copyFile(sdkFile, dir + 'lp-orca-installed-sdk-bundle.js.txt');
const client = sdkRequire('@orca-so/whirlpools-client');
interface RpcEvidence { request?: { method: string; params: unknown[] }; response?: RpcEnvelope<{ context: { slot: number }; value: (RpcAccount | null)[] }> }
const raw: unknown = JSON.parse(await readFile(dir + 'lp-live-raw.json', 'utf8'));
if (!Array.isArray(raw)) throw new Error('RPC evidence is not an array');
const entries = raw as RpcEvidence[];
const selected = pool.ranges.find(r => r.requestedWidthPct === 20);
if (!selected) throw new Error('Selected range missing');
const tickArrayKinds = selected.tickArrays.map(a => {
  const e = entries.find(e => e.request?.method === 'getMultipleAccounts' && Array.isArray(e.request.params[0]) && e.request.params[0].includes(a.address));
  if (!e?.request || !e.response || !Array.isArray(e.request.params[0])) throw new Error('Raw tick-array response missing');
  const account = e.response.result.value[e.request.params[0].indexOf(a.address)];
  if (!account) throw new Error('Tick array absent');
  const data = Buffer.from(account.data[0], 'base64'), discriminator = data.subarray(0, 8);
  const kind = discriminator.equals(Buffer.from(client.getFixedTickArrayDiscriminatorBytes())) ? 'fixed' : discriminator.equals(Buffer.from(client.getDynamicTickArrayDiscriminatorBytes())) ? 'dynamic' : 'unknown';
  if (kind === 'unknown') throw new Error('Unrecognized tick array discriminator');
  return { address: a.address, kind, bytes: data.length, discriminatorHex: discriminator.toString('hex'), confirmedSlot: e.response.result.context.slot };
});
const review = {
  createdAt: new Date().toISOString(), executionEnabled: false, sourcePoolSnapshotAt: report.createdAt, pool: pool.id,
  sourceHashes: { poolReportSha256: createHash('sha256').update(reportText).digest('hex'), officialRentSourceSha256: createHash('sha256').update(rentSource).digest('hex'), installedSdkBundleSha256: createHash('sha256').update(await readFile(sdkFile)).digest('hex'), newestAuditPdfSha256: createHash('sha256').update(await readFile(dir + 'lp-orca-audit-2026-09-30.pdf')).digest('hex'), rentAuditPdfSha256: createHash('sha256').update(await readFile(dir + 'lp-orca-audit-2026-08-18.pdf')).digest('hex') },
  chosenFlow: { prepSource: 'costs-orca-budgeted-prep.json', quoteSource: 'lp-orca-budgeted-quote.json', entryExitSource: 'lp-orca-budgeted-unsigned-previews.json', strategyCapitalUsd: 10, targetDepositValueUsd: 9.95, sourceAssetsAtEntry: 'already acquired WSOL and USDC in wallet ATAs', doNotUseNativeWrappingPreviewAfterPrep: true },
  accountFundingLamports: { rpcRent216BytePosition: rents['216'], sourceFallbackPositionFloor: positionFloor, actualSourceDerivedPositionBase: positionRent, fallbackTopUp: positionRent - rents['216'], twoTickReserve: bothTicks, nftMint202Bytes: nftMint, nftTokenAccount170Bytes: nftAta, positionRelatedTotal: positionRelated, walletWsolAta: walletAta, walletUsdcAta: walletAta, allAccountsTotal: allAccountCapital, selectedMissingArrayCount: 0, selectedIrrecoverableArrayFunding: 0, sharedWalletAtasCountOnlyOnce: true },
  recoveryLamports: { ordinaryQuotedPositionClose: positionRelated, ordinaryCloseRetainsWsolAndUsdcAtas: 2 * walletAta, optionalWsolUnwrapAdditionalRent: walletAta, positionClosePlusWsolUnwrap: positionRelated + walletAta, retainedUsdcAtaRentIfKeepingUsdcCash: walletAta, allAccountsRecoverableOnlyIfUsdcAccountAlsoEmptiedAndClosed: allAccountCapital },
  tickArrayKinds,
  tickRentMechanics: { reserveHeldRegardlessOfBoundaryInitializedState: bothTicks, selectedFixedBoundaryReserveStaysInPosition: tickArrayKinds.every(t => t.kind === 'fixed'), dynamicContingency: 'For each dynamic boundary, zero→positive position liquidity transfers 779520 lamports from position to array, even if the tick was already initialized. Positive→zero returns it to position. Actual array resizing depends on global tick initialization. This preserves per-position recoverability across other LP activity.', newMissingArrayFloorLamports: arrayFloor, currentRpcRent148ByteArrayLamports: rents['148'], sdkCurrentRentUnderstatementPerNewArray: arrayFloor - rents['148'], missingArrayBaseRentRecoverableByOrdinaryUserPositionClose: false, initializerRace: 'SDK 8.0.1 uses idempotent=false for missing-array initialization. A competing initializer can make a built entry fail; failed transaction fees remain spent but state changes roll back. Selected arrays already exist and are fixed.' },
  lifecycleConditions: ['Position liquidity must be zero.', 'Both fee_owed fields and all reward amount_owed fields must be zero. Claim fees and every accrued reward before close.', 'The position NFT account must hold exactly one matching NFT and be unlocked. Its holder or valid delegate must authorize close.', 'Token-2022 close burns the NFT and closes both its token account and MintCloseAuthority mint; Anchor then closes the position and sends remaining lamports to receiver.', 'Ordinary legacy USDC token account must have zero token balance before it can close. Keeping cash in USDC leaves this ATA rent committed.', 'Native WSOL token account may close with nonzero token amount; this unwraps remaining native SOL plus rent. Do not unwrap before an exit swap that consumes WSOL.', 'Reward claim can be partial if reward vault cannot satisfy owed amount; remaining owed reward can prevent position close until the reward is funded/collected.', 'A fee quote does not prove successful execution or rent recovery. Amounts assume correct source matches deployed semantics; bytecode/source mapping remains unverified.'],
  sdkDifferences: ['High-level SDK 8.0.1 defaults to native wrapping strategy keypair and withTokenMetadataExtension=true. That creates another signer/temporary WSOL account and a larger mint. Its default fees and rent differ from our explicit metadata-free/preacquired-WSOL path.', 'SDK initializationCost covers missing shared tick-array rent only, not all position/NFT/wallet account funding. It must not be interpreted as total upfront cost.', 'For newly missing dynamic arrays SDK initializationCost uses current sysvar rent, while official program source funds the fixed 1920960 fallback floor. Selected existing arrays avoid that discrepancy.', 'The earlier native-SOL-source preview deliberately transfers SOL into WSOL. It must remain separate from the prep-linked WSOL-source preview, which contains no such principal transfer.'],
  historicalConclusion: { attributableHistoricalFeesUsd: null, forecastLowerGrossFeeBoundUsd: 0, usefulUpperForecastBoundUsd: null, why: 'Daily OHLCV and pool fee totals do not identify historical liquidity shares or swap path. Zero fees is possible out of range or with no qualifying swaps. Historical whole-pool fees are only a loose conservation ceiling if their definitions/completeness are verified; applying them pro rata by current TVL is unsupported.', inventoryScenarios: 'Deterministic no-fee cases for rounded ticks/bins remain useful stress scenarios; they are not realized PnL or confidence intervals.' },
  auditReview: [
    { date: '2026-09-30', firm: 'Sec3', file: 'lp-orca-audit-2026-09-30.pdf', summaryPdfPages: [2, 4], relevantDetailPdfPages: [5, 6], incrementalScope: [{ pr: 1392, start: '59f4c4c', assessedRevision: 'b823c8dd3215e110590d0c5ad73dd719a2ddd67b', result: 'No issues found' }, { pr: 1396, start: '90333c1', assessedRevision: '5207a03c7643e9c860fa902737a7be4b115060f7', result: 'P2-I-01 Frequent updates reduce reward accrual; Informational; Acknowledged/accepted as-is' }], unresolvedCriticalOrHighInThisReport: 0, caveat: 'This is an incremental review of the named PR revisions; economics design/algorithm is out of scope. It is not an audit of all current code or deployed bytecode.' },
    { date: '2026-08-18', firm: 'Sec3', file: 'lp-orca-audit-2026-08-18.pdf', summaryPdfPages: [2, 4], relevantDetailPdfPages: [5, 6, 7], pr: 1366, assessedRevision: 'd12f6ac07923ba3b8e855561edd3e061ca04eb05', result: 'I-01 Rent fallback may temporarily DoS WSOL reward collection; Informational; Acknowledged. Recovery is to replenish missing SOL and sync native balance.', unresolvedCriticalOrHighInThisReport: 0, selectedPoolRelevance: 'Selected pool currently has ORCA reward mint with zero emissions; this is not the WSOL reward-vault configuration described by that finding. Future reward changes must be rechecked.' },
  ],
  verificationStatus: { deployedSourceHashMatchedLocally: false, successfulExecutionSimulation: false, publicOsecStatusRead: 'Timed out; no verification result obtained', officialSourceRepositoryRevision: 'cc683ec92acb5e7606caa3d8e514d9383e9c7c11', noFundingReadinessClaim: true },
};
await writeFile(dir + 'lp-funding-recovery-review.json', JSON.stringify(review, null, 2));
// Explicitly label the preserved earlier diagnostic to prevent capital double-funding.
const oldPath = dir + 'lp-orca-unsigned-previews.json';
const previous = parseObject<Record<string, unknown>>(await readFile(oldPath, 'utf8'));
previous.sourceAssetMode = 'native-SOL-source diagnostic; includes native SOL transfer plus SyncNative';
previous.notForPrepAcquiredWsol = true;
previous.prepLinkedReplacement = 'lp-orca-budgeted-unsigned-previews.json';
await writeFile(oldPath, JSON.stringify(previous, null, 2));
console.log(JSON.stringify({ accountFunding: review.accountFundingLamports, recovery: review.recoveryLamports, tickArrayKinds, auditDates: review.auditReview.map(a => a.date) }, null, 2));
