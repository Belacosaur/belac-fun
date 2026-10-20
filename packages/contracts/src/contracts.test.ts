import { describe, expect, it } from "vitest";
import { challengeDetailSchema } from "./index.js";

const stringEquity = {
  slug: "sample",
  provider: { slug: "sample-provider", name: "Sample" },
  state: "live",
  allocationUsd: "10.00",
  equityUsd: "10.00",
  netPnlUsd: "0.00",
  returnPct: "0.00",
  asOf: "2026-10-20T02:00:00.000Z",
  quality: "verified_onchain",
  isIllustrative: true,
};

describe("challengeDetailSchema", () => {
  it("rejects numeric equityUsd", () => {
    const result = challengeDetailSchema.safeParse({ ...stringEquity, equityUsd: 10 });
    expect(result.success).toBe(false);
  });

  it("accepts decimal-string equityUsd", () => {
    const result = challengeDetailSchema.safeParse(stringEquity);
    expect(result.success).toBe(true);
  });

  it("requires isIllustrative", () => {
    const withoutFlag = Object.fromEntries(
      Object.entries(stringEquity).filter(([key]) => key !== "isIllustrative"),
    );
    const result = challengeDetailSchema.safeParse(withoutFlag);
    expect(result.success).toBe(false);
  });
});
