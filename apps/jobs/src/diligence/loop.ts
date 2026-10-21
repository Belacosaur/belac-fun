import { Decimal } from "decimal.js";

/** Constant-rate arithmetic without price changes beyond modeled yield; not a forecast or execution plan. */
export function loopCarryScenario(equity: string, leverage: string, collateralApy: string, borrowApy: string, horizonDays: number, specifiedUpfrontCosts: string) {
  const e = new Decimal(equity), l = new Decimal(leverage), s = new Decimal(collateralApy), b = new Decimal(borrowApy), fees = new Decimal(specifiedUpfrontCosts);
  if ([e,l,s,b,fees].some(v => !v.isFinite()) || e.lte(0) || l.lt(1) || s.lte(-1) || b.lt(0) || fees.lt(0) || !Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 3650) throw new Error("Invalid loop scenario inputs");
  const debtMultiple = l.minus(1), years = new Decimal(horizonDays).div(365);
  const annual = l.mul(s).minus(debtMultiple.mul(b));
  const supplyGrowth = s.add(1).pow(years).minus(1), debtGrowth = b.add(1).pow(years).minus(1);
  const gross = e.mul(l.mul(supplyGrowth).minus(debtMultiple.mul(debtGrowth))), unlevered = e.mul(supplyGrowth);
  return { equity, leverage, collateralApy, borrowApy, horizonDays, specifiedUpfrontCosts,
    approximateAnnualCarryFraction: annual.toString(), incrementalAnnualCarryFraction: annual.minus(s).toString(),
    approximateBorrowRateForZeroTotalCarry: debtMultiple.isZero() ? null : l.mul(s).div(debtMultiple).toString(),
    startingLtv: debtMultiple.div(l).toString(), collateralStartingValue: e.mul(l).toString(), debtStartingValue: e.mul(debtMultiple).toString(),
    constantRateGross: gross.toFixed(12), unleveredConstantRateGross: unlevered.toFixed(12), incrementalConstantRateGross: gross.minus(unlevered).toFixed(12),
    constantRateNetAfterSpecifiedCosts: gross.minus(fees).toFixed(12), unpricedCostsExcluded: true, entryEligible: false,
    assumptions: "Starting collateral/debt grow separately at constant input APYs; no rebalancing, extra relative-price changes beyond modeled yield, incentives, liquidation, market impact, changing rates or unspecified fees. For SOL-denominated positions USD comparison additionally assumes unchanged SOL/USD. Annual carry equation is an approximation, not a promised portfolio APY." };
}
