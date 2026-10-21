import { expect, it } from "vitest";
import { loopCarryScenario } from "./loop.js";
it("distinguishes negative incremental carry from a still-positive total return", () => {
  const r = loopCarryScenario("10", "2", "0.05", "0.06", 30, "0");
  expect(r.approximateAnnualCarryFraction).toBe("0.04");
  expect(r.incrementalAnnualCarryFraction).toBe("-0.01");
  expect(Number(r.incrementalConstantRateGross)).toBeLessThan(0);
  expect(Number(r.constantRateGross)).toBeGreaterThan(0);
});
it("calculates leverage-dependent zero-carry threshold rather than yield alone", () => {
  const r = loopCarryScenario("10", "3", "0.07", "0.06", 30, "0");
  expect(r.approximateAnnualCarryFraction).toBe("0.09");
  expect(r.approximateBorrowRateForZeroTotalCarry).toBe("0.105");
  expect(loopCarryScenario("10", "3", "0.07", "0.11", 30, "0").approximateAnnualCarryFraction).toBe("-0.01");
});
it("charges upfront cash costs once and rejects invalid rates or leverage", () => {
  const r = loopCarryScenario("10", "2", "0.05", "0.04", 30, "0.1");
  expect(Number(r.constantRateNetAfterSpecifiedCosts)).toBeCloseTo(Number(r.constantRateGross) - 0.1, 12);
  for (const args of [["10", "0.9", "0.05", "0.04"], ["10", "2", "-1", "0.04"], ["0", "2", "0.05", "0.04"]]) {
    expect(() => loopCarryScenario(args[0]!, args[1]!, args[2]!, args[3]!, 30, "0")).toThrow();
  }
});
