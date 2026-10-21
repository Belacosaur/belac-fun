/** Screening heuristics, fixed before the first run; not a proven trading edge. */
export const POLICY = {
  version: "research-v1.0.1",
  validated: false,
  allocationUsd: 10,
  tokenLimit: 100,
  poolLimitPerProvider: 50,
  shortlistLimit: 3,
  minTokenLiquidityUsd: 500_000,
  minTokenVolume24hUsd: 100_000,
  minOrganicScore: 60,
  maxTopHoldersPct: 30,
  minTokenAgeDays: 30,
  minPumpAgeDays: 7,
  minPoolTvlUsd: 100_000,
  minPoolVolume24hUsd: 50_000,
  minLendingSupplyUsd: 1_000_000,
  maxLendingUtilization: 0.95,
  maxTokenAgeMs: 15 * 60_000,
  maxPoolAgeMs: 30 * 60_000,
  maxSourceAgeMs: 15 * 60_000,
  maxQuoteAgeMs: 60_000,
  maxQuoteRoundTripLossPct: 2,
  maxPriceImpactPct: 1,
  requestLimit: 150,
  requestTimeoutMs: 12_000,
  transportConcurrency: 3,
  reportLifetimeMs: 24 * 60 * 60_000,
  diagnosticFeeBps: 25,
  // No risk budget or leverage has been approved. Never infer either from minimums.
  approvedMaxLossUsd: null,
  approvedLeverage: null,
} as const;

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL = "So11111111111111111111111111111111111111112";
export const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
// Initial LP risk universe is intentionally narrow. New assets require a policy review.
export const LP_ASSETS = [SOL, USDC, USDT] as const;
export const CORE = [
  { symbol: "SOL", mint: SOL, product: "SOL-USD" },
  { symbol: "BTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", product: "BTC-USD" },
  { symbol: "ETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", product: "ETH-USD" },
] as const;
export const SPOT_HISTORY = [
  { symbol: "SOL", mint: SOL, product: "SOL-USD" },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", product: "JUPITER-USD" },
] as const;
