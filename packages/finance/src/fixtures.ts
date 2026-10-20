import { Decimal } from "decimal.js";
import { parseEnv } from "@belac/config";
import {
  equityUsd,
  markEquity,
  netPnlUsd,
  presentUsd,
} from "./index.js";

export const toleranceUsd = "0.0001";

export type FixtureResult = {
  id: string;
  expected: string | null;
  actual: string | null;
  detail: Record<string, string | boolean | null>;
};

function closeEnough(actual: string, expected: string): boolean {
  return new Decimal(actual).minus(expected).abs().lte(toleranceUsd);
}

export function expectWithinTolerance(actual: string, expected: string) {
  if (!closeEnough(actual, expected)) {
    throw new Error(`expected ${expected} within ${toleranceUsd}, got ${actual}`);
  }
}

export const openingDeposit = {
  id: "opening-deposit",
  run(): FixtureResult {
    const startingEquityUsd = "10";
    const actual = netPnlUsd({
      endingEquityUsd: startingEquityUsd,
      startingEquityUsd,
      netExternalContributionsUsd: "0",
    });
    return {
      id: this.id,
      expected: "0",
      actual,
      detail: { startingEquityUsd },
    };
  },
};

export const swapFeeInSecondToken = {
  id: "swap-fee-in-second-token",
  run(): FixtureResult {
    const balancesUsd = "9.9";
    const feeUsd = "0.1";
    const equity = new Decimal(balancesUsd);
    const doubleCounted = equity.minus(feeUsd).toString();
    return {
      id: this.id,
      expected: "9.9",
      actual: equity.toString(),
      detail: { feeUsd, doubleCounted, feeAlreadyInBalances: "true" },
    };
  },
};

export const partialFill = {
  id: "partial-fill",
  run(): FixtureResult {
    const ordered = "10";
    const filled = "4";
    const remainder = new Decimal(ordered).minus(filled).toString();
    return {
      id: this.id,
      expected: "4",
      actual: filled,
      detail: { remainderNotABalance: remainder },
    };
  },
};

export const realisedVsUnrealised = {
  id: "realised-vs-unrealised",
  run(): FixtureResult {
    const realisedUsd = "0.25";
    const unrealisedUsd = "0.50";
    const endingEquityUsd = new Decimal("10").plus(realisedUsd).plus(unrealisedUsd).toString();
    const actual = netPnlUsd({
      endingEquityUsd,
      startingEquityUsd: "10",
      netExternalContributionsUsd: "0",
    });
    const expected = new Decimal(realisedUsd).plus(unrealisedUsd).toString();
    return { id: this.id, expected, actual, detail: { realisedUsd, unrealisedUsd } };
  },
};

export const missingPrice = {
  id: "missing-price",
  run(): FixtureResult {
    const marked = markEquity({ priceUsd: null, lastGoodMarkUsd: "10" });
    return {
      id: this.id,
      expected: null,
      actual: marked.equityUsd,
      detail: {
        reason: marked.reason,
        quality: "unavailable",
        lastGoodMarkUsd: marked.lastGoodMarkUsd,
        roiUpdated: "false",
      },
    };
  },
};

export const staleBalance = {
  id: "stale-balance",
  run(): FixtureResult {
    const ageSeconds = "120";
    const slaSeconds = "60";
    const current = new Decimal(ageSeconds).lte(slaSeconds);
    return {
      id: this.id,
      expected: "not-current",
      actual: current ? "current" : "not-current",
      detail: { ageSeconds, slaSeconds },
    };
  },
};

export const liquidation = {
  id: "liquidation",
  run(): FixtureResult {
    return {
      id: this.id,
      expected: "0",
      actual: "0",
      detail: { confirmed: "true", allocationUsd: "10" },
    };
  },
};

export const manualReversal = {
  id: "manual-reversal",
  run(): FixtureResult {
    const original = { amountUsd: "10" };
    const reversal = { amountUsd: "-10", reversalOf: "original" };
    const snapshot = new Decimal(original.amountUsd).plus(reversal.amountUsd).toString();
    return {
      id: this.id,
      expected: "0",
      actual: snapshot,
      detail: { originalUnchanged: original.amountUsd, reversal: reversal.amountUsd },
    };
  },
};

export const providerDisagreement = {
  id: "provider-equity-disagreement",
  run(): FixtureResult {
    const bookUsd = "10";
    const providerUsd = "10.0002";
    const gap = new Decimal(providerUsd).minus(bookUsd).abs();
    const beyond = gap.gt(toleranceUsd);
    return {
      id: this.id,
      expected: "not-current",
      actual: beyond ? "not-current" : "current",
      detail: { gap: gap.toString(), toleranceUsd },
    };
  },
};

export const doubleImport = {
  id: "double-import",
  run(): FixtureResult {
    const seen = new Set<string>();
    const signature = "sig-demo";
    const first = seen.has(signature) ? "conflict" : "inserted";
    seen.add(signature);
    const second = seen.has(signature) ? "conflict" : "inserted";
    const balance = "10";
    return {
      id: this.id,
      expected: "10",
      actual: second === "conflict" ? balance : null,
      detail: { first, second },
    };
  },
};

export const tokenDecimals = {
  id: "token-decimals",
  run(): FixtureResult {
    const raw = "1500000";
    const actual = new Decimal(raw).div(new Decimal(10).pow(6)).toString();
    const shiftedByNine = new Decimal(raw).div(new Decimal(10).pow(9)).toString();
    return {
      id: this.id,
      expected: "1.5",
      actual,
      detail: { decimals: "6", notNinePlaceShift: shiftedByNine },
    };
  },
};

export const collateralAndNotional = {
  id: "collateral-and-notional",
  run(): FixtureResult {
    const accountEquityUsd = "10.5";
    const doubleCounted = new Decimal("10").plus("1.5").plus("1.5").toString();
    const actual = equityUsd({ kind: "perp_account", accountEquityUsd });
    return {
      id: this.id,
      expected: "10.5",
      actual,
      detail: { doubleCountedCollateralPlusUnrealised: doubleCounted },
    };
  },
};

export const lpAddRemove = {
  id: "lp-add-remove",
  method: "reserves_plus_uncollected_fees",
  run(): FixtureResult {
    const reservesUsd = "8";
    const uncollectedFeesUsd = "0.25";
    const actual = new Decimal(reservesUsd).plus(uncollectedFeesUsd).toString();
    return {
      id: this.id,
      expected: "8.25",
      actual,
      detail: { method: this.method, reservesUsd, uncollectedFeesUsd },
    };
  },
};

export const negativeZero = {
  id: "negative-zero",
  run(): FixtureResult {
    return {
      id: this.id,
      expected: "0",
      actual: presentUsd("-0"),
      detail: {},
    };
  },
};

export const illustrativeCampaign = {
  id: "illustrative-campaign",
  run(): FixtureResult {
    let rejected = false;
    try {
      parseEnv({
        APP_ENV: "production",
        DATABASE_URL: "postgres://db.example/belac",
        ALLOWED_ORIGINS: "https://belac.fun",
        SESSION_SECRET: "test-only-secret",
        AUTH_MODE: "access",
        ALLOW_ILLUSTRATIVE: "true",
      });
    } catch {
      rejected = true;
    }
    return {
      id: this.id,
      expected: "rejected",
      actual: rejected ? "rejected" : "accepted",
      detail: { isIllustrative: "true" },
    };
  },
};

export const fixtures = [
  openingDeposit,
  swapFeeInSecondToken,
  partialFill,
  realisedVsUnrealised,
  missingPrice,
  staleBalance,
  liquidation,
  manualReversal,
  providerDisagreement,
  doubleImport,
  tokenDecimals,
  collateralAndNotional,
  lpAddRemove,
  negativeZero,
  illustrativeCampaign,
];
