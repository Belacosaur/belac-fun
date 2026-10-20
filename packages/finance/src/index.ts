import { Decimal } from "decimal.js";

const decimalPattern = /^-?\d+(\.\d+)?$/;

function parseDecimal(value: string, name: string): Decimal {
  if (!decimalPattern.test(value)) {
    throw new Error(`invalid decimal: ${name}`);
  }
  return new Decimal(value);
}

function formatDecimal(value: Decimal): string {
  return value.toFixed();
}

export type ComponentEquity = {
  kind: "components";
  cashUsd: string;
  tokenMarksUsd: string;
  lpClaimValueUsd: string;
  venueCollateralUsd: string;
  unsettledRealisedReceivablesUsd: string;
  loansUsd: string;
  liabilitiesUsd: string;
};

export type PerpEquity = {
  kind: "perp_account";
  accountEquityUsd: string;
};

export function equityUsd(input: ComponentEquity | PerpEquity): string {
  if (input.kind === "perp_account") {
    return formatDecimal(parseDecimal(input.accountEquityUsd, "accountEquityUsd"));
  }
  const total = parseDecimal(input.cashUsd, "cashUsd")
    .plus(parseDecimal(input.tokenMarksUsd, "tokenMarksUsd"))
    .plus(parseDecimal(input.lpClaimValueUsd, "lpClaimValueUsd"))
    .plus(parseDecimal(input.venueCollateralUsd, "venueCollateralUsd"))
    .plus(parseDecimal(input.unsettledRealisedReceivablesUsd, "unsettledRealisedReceivablesUsd"))
    .minus(parseDecimal(input.loansUsd, "loansUsd"))
    .minus(parseDecimal(input.liabilitiesUsd, "liabilitiesUsd"));
  return formatDecimal(total);
}

export function netPnlUsd(input: {
  endingEquityUsd: string;
  startingEquityUsd: string;
  netExternalContributionsUsd: string;
}): string {
  const ending = parseDecimal(input.endingEquityUsd, "endingEquityUsd");
  const starting = parseDecimal(input.startingEquityUsd, "startingEquityUsd");
  const contributions = parseDecimal(
    input.netExternalContributionsUsd,
    "netExternalContributionsUsd",
  );
  return formatDecimal(ending.minus(starting).minus(contributions));
}

export function returnPct(input: { netPnlUsd: string; startingEquityUsd: string }): string {
  const pnl = parseDecimal(input.netPnlUsd, "netPnlUsd");
  const starting = parseDecimal(input.startingEquityUsd, "startingEquityUsd");
  if (starting.isZero()) {
    throw new Error("starting equity is zero");
  }
  return formatDecimal(pnl.div(starting).times(100));
}

export function solReturn(): { status: "not_configured" } {
  return { status: "not_configured" };
}

export function presentUsd(value: string): string {
  const parsed = parseDecimal(value, "value");
  if (parsed.isZero()) {
    return "0";
  }
  return formatDecimal(parsed);
}

export function markEquity(input: { priceUsd: string | null; lastGoodMarkUsd: string | null }): {
  equityUsd: string | null;
  reason: "unpriced" | null;
  lastGoodMarkUsd: string | null;
} {
  if (input.priceUsd === null) {
    return {
      equityUsd: null,
      reason: "unpriced",
      lastGoodMarkUsd: input.lastGoodMarkUsd,
    };
  }
  return {
    equityUsd: formatDecimal(parseDecimal(input.priceUsd, "priceUsd")),
    reason: null,
    lastGoodMarkUsd: input.lastGoodMarkUsd,
  };
}
