/** Stable strategy identities, shared by the studio and read-only worker. */
export const CHALLENGE = [
  { id: 1, key: "jupiter-spot-hold", provider: "Jupiter Swap", method: "Spot buy & hold", short: "BUY & HOLD", detail: "Hold one token for 30 days", asset: "Token pending", logo: "jupiter", color: "#a9c797" },
  { id: 2, key: "raydium-active-spot", provider: "Raydium", method: "Active spot trading", short: "SPOT TRADING", detail: "Buy, sell and reinvest", asset: "Tokens pending", logo: "raydium", color: "#b4aad7" },
  { id: 3, key: "jupiter-perps-long", provider: "Jupiter Perps", method: "Leveraged long", short: "LONG", detail: "Position for rising prices", asset: "Market pending", logo: "jupiter", color: "#a9c797" },
  { id: 4, key: "pacifica-short", provider: "Pacifica", method: "Leveraged short", short: "SHORT", detail: "Position for falling prices", asset: "Market pending", logo: "pacifica", color: "#92c7d3" },
  { id: 5, key: "meteora-liquidity", provider: "Meteora", method: "Liquidity providing", short: "LIQUIDITY", detail: "Earn fees from a liquidity pool", asset: "Pool pending", logo: "meteora", color: "#d4bc93" },
  { id: 6, key: "kamino-usdc-lending", provider: "Kamino", method: "Lending USDC", short: "LENDING", detail: "Earn interest on deposited USDC", asset: "USDC", logo: "kamino", color: "#b4a2c7" },
  { id: 7, key: "pump-existing-memecoin", provider: "Pump.fun", method: "Buy an existing memecoin", short: "MEMECOIN BUY", detail: "Buy an existing memecoin and track its performance", asset: "Token pending", logo: "pump", color: "#a7ccad" },
  { id: 8, key: "orca-concentrated-liquidity", provider: "Orca", method: "Concentrated liquidity providing", short: "CONCENTRATED LP", detail: "Provide liquidity within a chosen price range", asset: "Pool and range pending", logo: "orca", color: "#f2cc65" },
  { id: 9, key: "ript-weekly-pack", provider: "Ript", method: "Open one pack every week", short: "WEEKLY PACK", detail: "Track weekly pack openings and collected cards", asset: "Challenge pack pending", logo: "ript", color: "#ff9d3d" },
  { id: 10, key: "pump-own-launch", provider: "Pump.fun", method: "Create & launch our own memecoin", short: "OUR MEMECOIN", detail: "Create and launch the experiment’s own memecoin", asset: "Launch pending", logo: "pump", color: "#a7ccad" },
] as const;
