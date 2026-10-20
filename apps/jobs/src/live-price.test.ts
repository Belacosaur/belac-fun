import { describe, expect, it } from "vitest";
import { fetchLivePrice } from "./live-price";

describe("live price", () => {
  it("does not call the network when no base url is configured", async () => {
    let called = false;
    const price = await fetchLivePrice(undefined, "sol", async () => {
      called = true;
      return { ok: true, json: async () => ({ priceUsd: "1" }) };
    });
    expect(price).toBeNull();
    expect(called).toBe(false);
  });

  it("reads a decimal string from the configured source", async () => {
    const price = await fetchLivePrice("https://prices.example", "sol", async () => ({
      ok: true,
      json: async () => ({ priceUsd: "150.25" }),
    }));
    expect(price).toBe("150.25");
  });
});
