export const CHALLENGE_WALLET = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
export const METEORA_POOL = "8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie";
export type TradeState = "queued" | "preparing" | "ready" | "awaiting_submission" | "submitted" | "confirmed" | "reconciled" | "failed" | "expired" | "unknown" | "cancelled";
export interface MeteoraPlan {
  wallet: string; stationId: 5; pool: string; mint: string; position: string; nft: string;
  messageBase64: string; wireBase64: string; messageHash: string; blockhash: string; lastValidBlockHeight: number;
  preparedAt: string; expiresAt: string; slot: number; lookupTables: Record<string, string[]>;
  liquidity: string; maxSolAtoms: string; maxSpendUsdcAtoms: string; maxSwapUsdcAtoms: string; maxDepositUsdcAtoms: string;
  simulatedSpendUsdcAtoms: string; principalSolAtoms: string; principalUsdcAtoms: string; residualWsolAtoms: string;
  rentLamports: string; feeLamports: string; feePoolBeforeLamports: string; feePoolAfterLamports: string;
  beforeUsdcAtoms: string; beforeWsolAtoms: string; beforeNativeLamports: string;
  lowerPrice: string; upperPrice: string; minimumCashUsdcAtoms: string;
}
export interface MeteoraReceipt {
  signature: string; at: string; slot: number; wallet: string; pool: string; position: string; mint: string; nft: string;
  liquidity: string; spentUsdcAtoms: string; residualWsolAtoms: string; rentLamports: string; feeLamports: string;
}
export interface TradeAttempt {
  id: string; wallet: string; station: 5; state: TradeState; mint: string; createdAt: string;
  plan: MeteoraPlan | null; signature: string | null; error: string | null; receipt: MeteoraReceipt | null;
}
