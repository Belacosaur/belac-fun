/** Offline matched-mint rate comparison. Discovery/rate data never overrides a blocked route. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Decimal } from "decimal.js";
import { loopCarryScenario } from "./loop.js";
interface Side { mint: string; reserve: string; market: string; symbol: string; baseSupplyApyFraction: number; borrowApyFraction: number }
interface Pair { collateral: Side; debt: Side; configurationScreen: string; configurationBlockers: string[] }
interface Yield { mint: string; symbol: string; apyFraction: number | null; status: string; basis: string; observedAt: string; sourceDataAsOf: string | null; sourceUrl: string; sourceSha256: string; freshness: string }
const dir = fileURLToPath(new URL("../../../../artifacts/diligence/", import.meta.url));
const marketRaw = await readFile(dir + "lending-loop-lst-market.json", "utf8"), yieldRaw = await readFile(dir + "loop-lst-yields-summary.json", "utf8");
const market: { generatedAt: string; verified: Pair[] } = JSON.parse(marketRaw), yields: { generatedAt: string; rows: Yield[] } = JSON.parse(yieldRaw);
if (!Array.isArray(market.verified) || !Array.isArray(yields.rows)) throw new Error("Missing matched market/yield rows");
const byMint = new Map(yields.rows.map(v => [v.mint, v]));
if (byMint.size !== yields.rows.length) throw new Error("Duplicate yield mint");
const rows = market.verified.map(pair => {
  if (pair.debt.mint !== "So11111111111111111111111111111111111111112" || pair.debt.market !== pair.collateral.market) throw new Error("Mismatched debt mint/market");
  const underlying = byMint.get(pair.collateral.mint);
  const known = underlying && typeof underlying.apyFraction === "number" && Number.isFinite(underlying.apyFraction) && underlying.apyFraction >= 0 && underlying.status.startsWith("issuer-rate-");
  const combined = known ? new Decimal(1).add(underlying.apyFraction!).mul(new Decimal(1).add(pair.collateral.baseSupplyApyFraction)).minus(1).toString() : null;
  if (!Number.isFinite(pair.debt.borrowApyFraction) || pair.debt.borrowApyFraction < 0 || !Number.isFinite(pair.collateral.baseSupplyApyFraction) || pair.collateral.baseSupplyApyFraction < 0) throw new Error("Invalid reserve rates");
  return { symbol: pair.collateral.symbol, collateralMint: pair.collateral.mint, collateralReserve: pair.collateral.reserve, debtReserve: pair.debt.reserve, market: pair.collateral.market,
    configurationScreen: pair.configurationScreen, configurationBlockers: pair.configurationBlockers, entryEligible: false,
    underlyingYield: underlying ?? null, assumedCombinedCollateralApy: combined, borrowApy: String(pair.debt.borrowApyFraction),
    scenarios: combined === null ? [] : ["1", "2", "3"].map(l => loopCarryScenario("10", l, combined, String(pair.debt.borrowApyFraction), 30, "0")),
    borrowPlusThreePercentagePointsAt3x: combined === null ? null : loopCarryScenario("10", "3", combined, new Decimal(pair.debt.borrowApyFraction).add("0.03").toString(), 30, "0"),
    economicallyRanked: false, matchedHistoricalCarryValidated: false, allInCostsKnown: false };
});
const report = { generatedAt: new Date().toISOString(), executionEnabled: false, ript: "pending", mode: "offline-gross-rate-comparison", entryEligible: false,
  marketSnapshotAt: market.generatedAt, yieldCollectionAt: yields.generatedAt, sourceHashes: { market: createHash("sha256").update(marketRaw).digest("hex"), yields: createHash("sha256").update(yieldRaw).digest("hex") }, rows,
  limitations: ["A positive modeled spread cannot override blocked borrowing, incomplete setup/exit costs or issuer/oracle security gaps.", "This is not a global best-loop ranking: broader discovery has missing underlying yields; only seven pairs received fresh on-chain configuration checks.", "Issuer yields have different periods. mSOL is a trailing 30-day figure, Jito is the reported snapshot, bSOL is a past-epochs average without a measurement timestamp. Other unavailable rates remain null.", "All zero-specified-cost scenarios exclude unpriced setup, flash loans, swaps, priority, failed transactions and exits.", "USD-equivalent figures hold SOL/USD constant and include only modeled yield. No matched historical leveraged-return validation or execution simulation is claimed."] };
await writeFile(dir + "loop-lst-comparison.json", JSON.stringify(report, null, 2));
const pct = (v: string | number | null) => v === null ? "unknown" : new Decimal(v).mul(100).toFixed(4) + "%";
const md = ["# Matched SOL-LST loop comparison", "", `Market capture ${market.generatedAt}; yield collection ${yields.generatedAt}. Execution disabled; every row entry-ineligible.`, "",
  "All numbers are hypothetical gross-rate comparisons. Actual reserve borrowing guards, account setup, swaps, flash loans, exits, yield-source periods and security checks remain separate. Positive modeled carry does not clear them.", "",
  "| Pair / market | Assumed collateral APY | Borrow APY | 3x annual carry approximation | Extra 30d gross vs unlevered, $10 | Configuration |", "|---|---:|---:|---:|---:|---|"];
for (const r of rows) {
  const scenario = r.scenarios.find(s => s.leverage === "3");
  md.push(`| ${r.symbol}/SOL · ${r.market.startsWith("H6r") ? "Jito isolated" : "SOL/BTC"} | ${pct(r.assumedCombinedCollateralApy)} | ${pct(r.borrowApy)} | ${pct(scenario?.approximateAnnualCarryFraction ?? null)} | ${scenario ? "$" + new Decimal(scenario.incrementalConstantRateGross).toFixed(6) : "unknown"} | ${r.configurationBlockers.join("; ") || r.configurationScreen} |`);
}
md.push("", ...report.limitations.map(v => "- " + v), "", "Source matching uses exact on-chain collateral mint and debt market. The full JSON preserves source periods/timestamps, null rates, configuration blockers, 1x/2x/3x scenarios and a +3 percentage-point borrowing stress. Neither API discovery nor a displayed yield authorizes borrowing.", "");
await writeFile(dir + "loop-lst-comparison.md", md.join("\n"));
console.log(JSON.stringify({ rows: rows.length, modeled: rows.filter(r => r.scenarios.length).length, entryEligible: false, configurationBlockers: [...new Set(rows.flatMap(r => r.configurationBlockers))] }));
