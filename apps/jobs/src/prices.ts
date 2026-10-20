export const priceSlaMinutes = 15;

export type PriceQuote = {
  priceUsd: string | null;
  stale: boolean;
};

export type PriceSource = {
  id: string;
  quote(assetId: string, observedAt: string, now: string): Promise<PriceQuote>;
};

const fixturePrices: Record<string, { priceUsd: string; observedAt: string }> = {
  usdc: { priceUsd: "1", observedAt: "2026-10-20T00:00:00.000Z" },
};

export const fixturePriceSource: PriceSource = {
  id: "fixture",
  async quote(assetId, observedAt, now) {
    const known = fixturePrices[assetId];
    if (!known) {
      return { priceUsd: null, stale: false };
    }
    const ageMs = new Date(now).getTime() - new Date(observedAt).getTime();
    return {
      priceUsd: known.priceUsd,
      stale: ageMs > priceSlaMinutes * 60 * 1000,
    };
  },
};

export function staleness(lastSuccessAt: string | null, expectedIntervalMinutes: number, now: string) {
  if (!lastSuccessAt) {
    return "stale" as const;
  }
  const limit = (expectedIntervalMinutes + 10) * 60 * 1000;
  return new Date(now).getTime() - new Date(lastSuccessAt).getTime() > limit ? "stale" : "current";
}
