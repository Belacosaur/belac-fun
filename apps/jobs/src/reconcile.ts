import { Decimal } from "decimal.js";

export const disagreementUsd = "0.05";

export function reconciliationGap(reportedUsd: string, replayUsd: string) {
  const gap = new Decimal(reportedUsd).minus(replayUsd).abs();
  return {
    openIssue: gap.gt(disagreementUsd),
    gap: gap.toString(),
  };
}
