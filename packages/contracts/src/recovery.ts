export const RECOVERY_SOURCE = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
export const RECOVERY_DESTINATION = "3nJzqZMc4WsGhCmD7vG2SmUzHDyD3Q58vxLbWUvUjSLX";
export type RecoveryStep = "orca" | "kamino" | "swap" | "cleanup" | "sweep";
export interface RecoveryInventory {
  source: string; destination: string; observedAt: string; slot: number;
  sourceLamports: string; destinationLamports: string; usdcAtoms: string; wsolAtoms: string; receiptAtoms: string;
  orcaOpen: boolean; openAccounts: number; next: RecoveryStep | "complete";
  accounts: { address: string; mint: string; program: string; amount: string; lamports: string; nativeRentLamports?:string }[];
}
export interface RecoveryPlan {
  id: string; step: RecoveryStep; source: string; destination: string;
  preparedAt: string; expiresAt: string; lastValidBlockHeight: string; slot: number;
  wireBase64: string; messageHash: string; feeLamports: string;
  minimumSolAtoms: string; minimumUsdcAtoms: string; summary: string;
  before: RecoveryInventory; after: RecoveryInventory;
  closedAccounts: string[];
}
export interface RecoveryAttempt {
  id: string; state: "preparing" | "ready" | "signing" | "submitted" | "confirmed" | "failed" | "expired";
  plan: RecoveryPlan | null; signature: string | null; error: string | null;
}
