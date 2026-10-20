import { describe, expect, it } from "vitest";
import { expectWithinTolerance, fixtures, missingPrice } from "./fixtures.js";

describe("financial fixtures", () => {
  it.each(fixtures)("$id", (fixture) => {
    const result = fixture.run();
    if (result.expected === null) {
      expect(result.actual).toBeNull();
      expect(result.detail.reason).toBe("unpriced");
      return;
    }
    expect(result.actual).not.toBeNull();
    if (/^-?\d+(\.\d+)?$/.test(result.expected)) {
      expectWithinTolerance(result.actual ?? "", result.expected);
      return;
    }
    expect(result.actual).toBe(result.expected);
  });

  it("missing price never reports zero equity", () => {
    const result = missingPrice.run();
    expect(result.actual).toBeNull();
    expect(result.actual).not.toBe("0");
    expect(result.detail.reason).toBe("unpriced");
  });
});
