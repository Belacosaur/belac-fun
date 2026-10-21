export interface RpcAccount { data: [string, string]; owner: string; lamports: number; executable: boolean }
export interface RpcEnvelope<T> { result: T; error?: { code: number; message: string } }
export type JsonValue = null | boolean | string | number | JsonValue[] | { [key: string]: JsonValue };
export type IdlType = string | { array: [IdlType, number] } | { defined: { name: string } };
export interface IdlField { name: string; type: IdlType }
export interface IdlStruct { kind: 'struct'; fields: IdlField[] }
export interface IdlAccount { name: string; discriminator: number[] }
export interface IdlInstructionAccount { name: string; writable?: boolean; signer?: boolean; optional?: boolean; address?: string }
export interface IdlInstruction { name: string; discriminator: number[]; accounts: IdlInstructionAccount[] }
export interface Idl { types: { name: string; type: IdlStruct }[]; accounts: IdlAccount[]; instructions: IdlInstruction[] }
export type DecodedValue = string | number | bigint | DecodedValue[] | { [key: string]: DecodedValue };
export interface MeteoraState {
  token_x_mint: string; token_y_mint: string; reserve_x: string; reserve_y: string; active_id: number; bin_step: number; status: number;
  parameters: { base_factor: number; base_fee_power_factor: number; protocol_share: number };
}
export interface OrcaState {
  tokenMintA: string; tokenMintB: string; tokenVaultA: string; tokenVaultB: string; whirlpoolsConfig: string;
  sqrtPrice: bigint | string; tickSpacing: number;
  rewardInfos: { extension: { type: string; data: number[] }; emissionsPerSecondX64: bigint | string }[];
}
export interface BinState { amount_x: bigint; amount_y: bigint; liquidity_supply: bigint; fee_amount_x_per_token_stored: bigint; fee_amount_y_per_token_stored: bigint }
export interface BinArrayState { lb_pair: string; index: bigint; bins: BinState[] }
export interface Scenario { change: number; price: number; sol: number; usdc: number; valueUsd: number; holdUsd: number; differenceVsHoldUsd: number; inRange: boolean; feesUsd: number }
export interface Allocation { x?: number; y?: number; sol?: number; usdc?: number; scenarios: Scenario[] }
export interface RangeSetup {
  totalUpfrontAccountLamports: number; recoverableRentLamports: number; positionCount?: number;
  missingBinArrayRentLamports?: number; missingTickArrayRentLamports?: number;
  [field: string]: unknown;
}
export interface TickArrayDetail { address: string; exists: boolean; [field: string]: unknown }
export interface BinArrayDetail { address: string; exists: boolean; index: number; dataLength: number | null }
export interface LpRange {
  requestedWidthPct: number; lower: number; upper: number; lowerPrice: number; upperPrice: number; actualLowerPct: number; actualUpperPct: number;
  count?: number; allocation: Allocation; setup: RangeSetup;
  atomicDepositCaps?: { solAtoms: number; usdcAtoms: number; note: string };
  tickArrays?: TickArrayDetail[]; existingBinArrays?: BinArrayDetail[];
  [field: string]: unknown;
}
export interface Candle { timestamp: number; timestamp_str: string; open: number; high: number; low: number; close: number; volume: number }
export interface FeeRow { timestamp: number; timestamp_str: string; volume: number; fees: number; protocol_fees: number }
export interface Vault { address: string; mint: string; authority: string; amount: bigint; state: number; slot: number; derivedAddressMatches?: boolean }
export interface CompactAccount { owner: string; lamports: number; executable: boolean; space: number }
export interface LpPool {
  id: string; provider: string; account: CompactAccount; slot: number; decoded: MeteoraState | OrcaState;
  ranges: LpRange[]; vaults: Vault[]; priceUsdcPerSol: number;
  history?: { data: Candle[] }; volumeHistory?: { data: FeeRow[] }; indexedCurrent?: { pool_config: { protocol_fee_pct: number } };
}
export interface MeteoraPool extends LpPool { decoded: MeteoraState; history: { data: Candle[] }; volumeHistory: { data: FeeRow[] }; indexedCurrent: { pool_config: { protocol_fee_pct: number } } }
export interface OrcaPool extends LpPool { decoded: OrcaState; ranges: (LpRange & { atomicDepositCaps: { solAtoms: number; usdcAtoms: number }; tickArrays: TickArrayDetail[] })[] }
export interface LpReport {
  createdAt: string; genesisHash: string; wallet: string; pools: LpPool[];
  sharedRent: { associatedTokenAccounts: { address: string }[]; tokenAccountRentLamports: number; absentCount: number };
}
export interface LiquidityQuote { liquidityDelta: bigint; tokenMaxA: bigint; tokenMaxB: bigint; tokenEstA: bigint; tokenEstB: bigint }
export interface StoredPreview {
  widthPct: number; action: string; baseFeeLamports: number; quote?: LiquidityQuote; pool?: string;
  [field: string]: unknown;
}
export interface PreviewReport { previews: StoredPreview[] }
export function parseObject<T>(text: string): T {
  const value: unknown = JSON.parse(text);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  return value as T;
}
export function parseLpReport(text: string): LpReport {
  const report = parseObject<LpReport>(text);
  if (!Array.isArray(report.pools) || report.pools.length !== 4 || typeof report.createdAt !== 'string' || typeof report.wallet !== 'string') throw new Error('Invalid LP report');
  for (const pool of report.pools) if (typeof pool.id !== 'string' || !pool.decoded || !Array.isArray(pool.ranges)) throw new Error('Invalid LP pool');
  return report;
}
