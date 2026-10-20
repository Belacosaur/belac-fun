import { readFileSync } from "node:fs";
import { netPnlUsd } from "@belac/finance";
import { manualAdapter } from "./adapters/types.js";
import { disagreementUsd } from "./reconcile.js";

export const calcVersion = "v1";

export async function snapshotFromManualDeposit() {
  const activity = await manualAdapter.fetchActivity({ challengeId: "demo-a", now: "2026-10-20T00:00:00.000Z" });
  const deposit = activity[0];
  if (!deposit) {
    throw new Error("manual adapter emitted no activity");
  }
  const equityUsd = deposit.amount;
  const pnl = netPnlUsd({
    endingEquityUsd: equityUsd,
    startingEquityUsd: "10",
    netExternalContributionsUsd: "0",
  });
  return {
    equityUsd,
    pnlUsd: pnl,
    quality: deposit.sourceStatus,
    calcVersion,
  };
}

export function mapTransactionFixture(path: string) {
  const payload = JSON.parse(readFileSync(path, "utf8")) as {
    transaction: { signatures: string[] };
    meta?: { logMessages?: string[] };
  };
  const signature = payload.transaction.signatures[0] ?? "";
  const known = (payload.meta?.logMessages ?? []).some((line) => line.includes("known-program"));
  return {
    signature,
    sourceStatus: known ? "verified_onchain" : "unverified",
  };
}

export { disagreementUsd };
