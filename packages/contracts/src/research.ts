/** Research observations and hypotheses only. These records never authorize execution. */
export interface ResearchSource {
  id: string;
  url: string;
  fetchedAt: string;
  status: "ok" | "unavailable";
  sha256: string | null;
  payload: unknown;
  error: string | null;
}

export interface ResearchCandidate {
  id: string;
  label: string;
  assets: string[];
  disposition: "shortlist" | "rejected";
  rank: number | null;
  metrics: Record<string, string | number | boolean | null>;
  sourceIds: string[];
  reasons: string[];
  blockers: string[];
  entryEligible: false;
  plan: { entry: string; exit: string; horizonDays: number; benchmark: string };
}

export interface StationResearch {
  id: number;
  strategyKey: string;
  provider: string;
  method: string;
  allocationUsd: "10.00";
  decision: "WAIT" | "PENDING";
  comparison: "unbound";
  scanned: number;
  shortlisted: ResearchCandidate[];
  rejected: ResearchCandidate[];
  gaps: string[];
  rankingBasis: string;
}

export interface ResearchReport {
  version: 1;
  runId: string;
  policyVersion: string;
  policy: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
  reviewBy: string;
  mode: "dry-run";
  executionEnabled: false;
  walletAddress: string;
  status: "complete" | "partial";
  capital: { strategyUsd: "100.00"; perStationUsd: "10.00"; riptReservedUsd: "10.00"; solFeePool: "separate-unpriced" };
  stations: StationResearch[];
  sources: ResearchSource[];
  warnings: string[];
}
