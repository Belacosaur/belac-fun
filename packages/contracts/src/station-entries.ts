/** Owner-reviewed entries only. No standing authority or server signing. */
export type EntryStation = 1 | 6 | 8;
export type EntryState = "preparing" | "ready" | "signing" | "submitted" | "confirmed" | "failed" | "expired" | "cancelled" | "unknown";
export interface EntryBalances { nativeLamports:string; usdcAtoms:string; wsolAtoms:string; }
export interface StationEntryPlan {
 version:1; stationId:EntryStation; wallet:string; mint?:string;
 preparedAt:string; expiresAt:string; lastValidBlockHeight:string; blockhash:string; slot:number;
 wireBase64:string; messageBase64:string; messageHash:string; lookupTables:Record<string,string[]>;
 budgetUsdcAtoms:"10000000"; maxSpendUsdcAtoms:string; simulatedSpendUsdcAtoms:string;
 feeLamports:string; rentLamports:string; before:EntryBalances; after:EntryBalances;
 accounts:Record<string,string>;
 details:Record<string,string|number|boolean|string[]>;
 summary:string;
}
export interface StationEntryReceipt {
 wallet:string; stationId:EntryStation; signature:string; at:string; slot:number;
 spentUsdcAtoms:string; receivedWsolAtoms:string; feeLamports:string; rentLamports:string;
 plan:StationEntryPlan;
}
export interface StationEntryAttempt {
 id:string; stationId:EntryStation; state:EntryState; wallet:string; createdAt:string;
 plan:StationEntryPlan|null; signature:string|null; receipt:StationEntryReceipt|null; error:string|null;
}
