export type SyncContext = {
  challengeId: string;
  now: string;
};

export type NormalizedActivity = {
  externalId: string;
  eventType: "deposit" | "fee" | "swap";
  amount: string;
  sourceStatus: "manual_evidence" | "unverified";
  signature?: string;
};

export type ProviderAdapter = {
  id: string;
  capabilities: Array<"tx" | "positions" | "balances" | "fees" | "funding" | "market_data">;
  fetchActivity(ctx: SyncContext): Promise<NormalizedActivity[]>;
};

export const manualAdapter: ProviderAdapter = {
  id: "manual",
  capabilities: ["tx"],
  async fetchActivity() {
    return [
      {
        externalId: "manual-deposit",
        eventType: "deposit",
        amount: "10",
        sourceStatus: "manual_evidence",
      },
    ];
  },
};
