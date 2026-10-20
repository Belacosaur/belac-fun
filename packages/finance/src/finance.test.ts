import { describe, expect, it } from "vitest";
import { equityUsd, netPnlUsd, returnPct, solReturn } from "./index.js";

describe("finance", () => {
  it("computes the sample pnl and return as exact decimal strings", () => {
    const pnl = netPnlUsd({
      endingEquityUsd: "10.74",
      startingEquityUsd: "10",
      netExternalContributionsUsd: "0",
    });
    expect(pnl).toBe("0.74");
    expect(returnPct({ netPnlUsd: pnl, startingEquityUsd: "10" })).toBe("7.4");
  });

  it("rejects an invalid decimal", () => {
    expect(() =>
      netPnlUsd({
        endingEquityUsd: "10.74",
        startingEquityUsd: "nope",
        netExternalContributionsUsd: "0",
      }),
    ).toThrow(/invalid decimal/);
  });

  it("uses perp account equity once", () => {
    expect(equityUsd({ kind: "perp_account", accountEquityUsd: "10.74" })).toBe("10.74");
  });

  it("sums component equity without a second perp add", () => {
    expect(
      equityUsd({
        kind: "components",
        cashUsd: "1",
        tokenMarksUsd: "2",
        lpClaimValueUsd: "3",
        venueCollateralUsd: "4",
        unsettledRealisedReceivablesUsd: "0.5",
        loansUsd: "1",
        liabilitiesUsd: "0.5",
      }),
    ).toBe("9");
  });

  it("leaves SOL return unconfigured", () => {
    expect(solReturn()).toEqual({ status: "not_configured" });
  });
});
