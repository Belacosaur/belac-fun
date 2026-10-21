import { CORE, POLICY, SOL, USDC } from "./policy.js";
import { ResearchClient } from "./transport.js";
import { num, row, rows, screenToken, text } from "./evaluate.js";

export async function collectResearch(client: ResearchClient, now = Date.now()) {
  // Data is cached per run, including in-flight calls. Independent collectors share a 3-request semaphore.
  const initial = await Promise.all([
    client.get("tokens", `https://api.jup.ag/tokens/v2/toptraded/24h?limit=${POLICY.tokenLimit}`),
    client.get("core-tokens", `https://api.jup.ag/tokens/v2/search?query=${CORE.map(t => t.mint).join(",")}`),
    client.get("orca", `https://api.orca.so/v2/solana/pools?size=${POLICY.poolLimitPerProvider}&sortBy=tvl&sortDirection=desc`),
    client.get("meteora", `https://dlmm.datapi.meteora.ag/pools?page=1&page_size=${POLICY.poolLimitPerProvider}&sort_by=tvl:desc`),
    client.get("raydium-pools", "https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=50&page=1"),
    client.get("kamino-markets", "https://api.kamino.finance/v2/kamino-market"),
    client.get("pacifica-markets", "https://api.pacifica.fi/api/v1/info"),
    client.get("pacifica-prices", "https://api.pacifica.fi/api/v1/info/prices"),
    client.get("pump-program-docs", "https://raw.githubusercontent.com/pump-fun/pump-public-docs/main/README.md"),
    ...CORE.map(t => client.get(`jupiter-perps:${t.symbol}`, `https://perps-api.jup.ag/v1/market-stats?mint=${t.mint}`)),
    ...["SOL", "BTC", "ETH", "JUP", "BONK", "WIF"].map(symbol => client.get(`history:${symbol}`, `https://api.exchange.coinbase.com/products/${symbol === "JUP" ? "JUPITER" : symbol}-USD/candles?granularity=86400`)),
  ]);
  const markets = rows(initial.find(s => s.id === "kamino-markets")?.payload);
  // Bound market fan-out. Discover all names, evaluate reserves in the first 12 official non-curated markets.
  await Promise.all(markets.filter(m => m.isCurated === false && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text(m.lendingMarket))).slice(0, 12)
    .map(m => client.get(`kamino:${text(m.lendingMarket)}`, `https://api.kamino.finance/kamino-market/${text(m.lendingMarket)}/reserves/metrics`)));

  const tokens = rows(initial.find(s => s.id === "tokens")?.payload);
  const merged = [...new Map([...tokens, ...rows(initial.find(s => s.id === "core-tokens")?.payload)].map(t => [text(t.id), t])).values()];
  // Enrich Pump provenance from official Jupiter token metadata; no arbitrary suffix matching.
  const pumpTokens = merged.filter(t => t.launchpad === "pump.fun");
  if (pumpTokens.length) await client.get("pump-discovery", `https://api.jup.ag/tokens/v2/search?query=${pumpTokens.slice(0, 30).map(t => text(t.id)).join(",")}`);
  const ranked = merged.filter(t => text(t.id) !== USDC).map(t => ({ token: t, c: screenToken(t, now) }))
    .filter(t => t.c.disposition === "shortlist").sort((a, b) => Number(b.c.metrics.liquidityUsd) - Number(a.c.metrics.liquidityUsd)).slice(0, 3).map(t => t.token);
  const pumps = pumpTokens.map(t => ({ token: t, c: screenToken(t, now, true) })).filter(t => t.c.disposition === "shortlist")
    .sort((a, b) => Number(b.c.metrics.liquidityUsd) - Number(a.c.metrics.liquidityUsd)).slice(0, 3).map(t => t.token);
  const quoteTokens = [...new Map([...ranked, ...pumps, ...merged.filter(t => t.id === SOL)].map(t => [text(t.id), t])).values()];
  for (const t of quoteTokens) {
    const mint = text(t.id);
    // Quotes only. $10 USDC in, then a hypothetical sale of exactly the quoted output.
    for (const venue of ["jupiter", "raydium"] as const) {
      const url = (input: string, output: string, amount: string) => venue === "jupiter"
        ? `https://api.jup.ag/swap/v1/quote?inputMint=${input}&outputMint=${output}&amount=${amount}&slippageBps=50`
        : `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${input}&outputMint=${output}&amount=${amount}&slippageBps=50&txVersion=V0`;
      const buy = await client.get(`quote:${venue}:${mint}:buy`, url(USDC, mint, "10000000"));
      const data = row(venue === "raydium" ? row(buy.payload).data : buy.payload);
      const amount = text(venue === "raydium" ? data.outputAmount : data.outAmount);
      if (/^[1-9][0-9]*$/.test(amount)) await client.get(`quote:${venue}:${mint}:sell`, url(mint, USDC, amount));
    }
  }
  const prices = rows(row(initial.find(s => s.id === "pacifica-prices")?.payload).data);
  // Deepen the three liquid core markets, plus the two weakest liquid listed markets, with current book data.
  const shortMarkets = prices.filter(p => num(p.volume_24h) !== null && Number(p.volume_24h) > 100_000 && num(p.yesterday_price) && num(p.mark))
    .sort((a, b) => Number(a.mark) / Number(a.yesterday_price) - Number(b.mark) / Number(b.yesterday_price)).slice(0, 2).map(p => text(p.symbol));
  await Promise.all([...new Set([...CORE.map(t => t.symbol), ...shortMarkets])].map(symbol => client.get(`pacifica-book:${symbol}`, `https://api.pacifica.fi/api/v1/book?symbol=${encodeURIComponent(symbol)}`)));
  return client.sources();
}
