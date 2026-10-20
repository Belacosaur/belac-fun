import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixturePriceSource, staleness } from "./prices.js";
import { reconciliationGap } from "./reconcile.js";
import { mapTransactionFixture, snapshotFromManualDeposit } from "./snapshot.js";
import { manualAdapter } from "./adapters/types.js";

describe("jobs", () => {
  it("manual adapter emits manual evidence only", async () => {
    const rows = await manualAdapter.fetchActivity({ challengeId: "x", now: "2026-10-20T00:00:00.000Z" });
    expect(rows.every((row) => row.sourceStatus === "manual_evidence")).toBe(true);
  });

  it("returns null for a missing price and stale after the SLA", async () => {
    const missing = await fixturePriceSource.quote("missing", "2026-10-20T00:00:00.000Z", "2026-10-20T00:01:00.000Z");
    expect(missing.priceUsd).toBeNull();
    const stale = await fixturePriceSource.quote("usdc", "2026-10-20T00:00:00.000Z", "2026-10-20T00:20:00.000Z");
    expect(stale.priceUsd).toBe("1");
    expect(stale.stale).toBe(true);
  });

  it("builds a snapshot equal to the finance deposit fixture", async () => {
    const snapshot = await snapshotFromManualDeposit();
    expect(snapshot.equityUsd).toBe("10");
    expect(snapshot.pnlUsd).toBe("0");
  });

  it("opens a reconciliation issue only beyond $0.05", () => {
    expect(reconciliationGap("10.06", "10").openIssue).toBe(true);
    expect(reconciliationGap("10.04", "10").openIssue).toBe(false);
  });

  it("marks a missed job interval as stale", () => {
    expect(staleness("2026-10-20T00:00:00.000Z", 15, "2026-10-20T00:30:00.000Z")).toBe("stale");
    expect(staleness("2026-10-20T00:00:00.000Z", 15, "2026-10-20T00:10:00.000Z")).toBe("current");
  });

  it("keeps unknown programs unverified and stable", () => {
    const fixture = fileURLToPath(new URL("./fixtures/unknown-tx.json", import.meta.url));
    const first = mapTransactionFixture(fixture);
    const second = mapTransactionFixture(fixture);
    expect(first).toEqual(second);
    expect(first.sourceStatus).toBe("unverified");
    expect(first.signature).toBe("sig-unknown");
  });
});
