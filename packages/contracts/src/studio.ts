/** Read-only observations. USD values are exact decimal strings. */
import type {RecoveryInventory} from "./recovery.js";
export type SyncStatus = "ready" | "empty" | "needs_setup" | "pending" | "deferred" | "manual" | "not_indexed" | "unavailable";
export interface Observation<T> {
  status: SyncStatus;
  checkedAt: string;
  lastSuccessAt: string | null;
  data: T | null;
  message: string;
}
export interface WalletBalance {
  sol: string;
  slot: number;
  tokens: { mint: string; amount: string }[];
  valueUsd: string | null;
  unpricedAssets: number;
  recentTransactions: { signature: string; blockTime: number | null; failed: boolean }[];
}
export interface PlatformBalance {
  closed?: boolean;
  valueUsd: string | null;
  positionCount: number | null;
  status: SyncStatus;
  detail: string;
  /** A successful read proves this scope only, never permission to execute. */
  connection?: { scope: "quotes" | "positions" | "portfolio" | "program_accounts"; detail: string };
  positions?: { address: string; pool: string; liquidity: string; lowerTick: number; upperTick: number }[];
  performance?: StrategyPerformance;
  executionEnabled?: false;
  damm?: {
    state: "prepared"; pool: string; plannedUsdc: string; slot: number;
    poolPriceUsd: string; lowerPriceUsd: string; upperPriceUsd: string;
    preparation: {
      simulatedAt: string; budgetUsdc: string; maxSpendUsdc: string; simulatedSpendUsdc: string;
      plannedSol: string; plannedUsdc: string; residualWsol: string; minimumCashUsdc: string;
      rentSol: string; entryFeeSol: string; entryMessageHash: string; roundtripMessageHash: string;
      exitMinSol: string; exitMinUsdc: string; requiresQuoteRefresh: true;
    };
  };
  lending?: {
    state: "prepared" | "unattributed" | "active";
    plannedUsdc: string; reserve: string; collateralMint: string; receiptAccount: string;
    receiptAtoms: string; redeemableUsdc: string; pnlUsd: string | null;
    supplyApy: string | null; slot: number; accruedAt: string;
    preparation?: { simulatedAt: string; depositUsdc: string; rentSol: string; entryFeeSol: string; entryMessageHash: string };
    entry?: { signature: string; at: string; spentUsdc: string; accountRentSol: string; networkFeeSol: string };
    history: { at: string; valueUsd: string }[];
  };
}
export interface StrategyPerformance {
  stationId: 1 | 5 | 6 | 8;
  allocationUsd: string;
  entryCostUsdc: string;
  equityUsd: string;
  pnlUsd: string;
  pnlPct: string;
  solAmount: string;
  cashUsdc: string;
  entryAt: string;
  entrySignature: string;
  executionEnabled: false;
  history: { at: string; valueUsd: string }[];
  principalSol?: string;
  principalUsdc?: string;
  residualSol?: string;
  accruedFeesSol?: string;
  accruedFeesUsdc?: string;
  accruedFeesUsd?: string;
  positionAddress?: string;
  lowerPrice?: string;
  upperPrice?: string;
  inRange?: boolean;
}
export interface ChallengeAccounting {
  wallet: string;
  slot: number;
  observedAt: string;
  solPriceUsd: string;
  equityUsd: string;
  pnlUsd: string;
  pnlPct: string;
  allocatedUsd: string;
  unallocatedUsdc: string;
  surplusUsdc: string;
  unattributedSol: string;
  unattributedUsdc: string;
  strategies: StrategyPerformance[];
  feePool: { availableSol: string; valueUsd: string; accountCapitalSol: string; networkFeesSol: string; senderFundedAccountCapitalSol: string };
  valuationBasis: string;
  disabledStations: number[];
}
export interface StudioSnapshot {
  recovery?: {inventory:RecoveryInventory;complete:boolean};
  version: 1;
  address: string;
  network: "mainnet-beta";
  generatedAt: string;
  wallet: Observation<WalletBalance>;
  platforms: { id: number; strategyKey?: string; provider: string; source: string; observation: Observation<PlatformBalance> }[];
  accounting?: Observation<ChallengeAccounting>;
}
export interface StudioResponse {
  data: StudioSnapshot;
  meta: { stale: boolean; pollAfterMs: number; requestId: string };
}
