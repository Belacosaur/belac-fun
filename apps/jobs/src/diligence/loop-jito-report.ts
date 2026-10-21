/** Offline review of saved public Jito and Kamino snapshots. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Decimal } from "decimal.js";
import { loopCarryScenario } from "./loop.js";
const dir = fileURLToPath(new URL("../../../../artifacts/diligence/", import.meta.url));
const statsRaw = await readFile(dir + "loop-jito-stats.json", "utf8"), metricsRaw = await readFile(dir + "loop-jito-kamino-metrics.json", "utf8");
const source = JSON.parse(await readFile(dir + "loop-jito-stats-source.json", "utf8"));
const metricsSource = JSON.parse(await readFile(dir + "loop-jito-kamino-metrics-source.json", "utf8"));
const stats: { apy: { data: number; date: string }[] } = JSON.parse(statsRaw);
const metrics: { reserve: string; liquidityTokenMint: string; supplyApy: string; borrowApy: string }[] = JSON.parse(metricsRaw);
const yields = stats.apy.filter(v => Number.isFinite(v.data) && v.data >= 0 && Number.isFinite(Date.parse(v.date))).sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
const latest = yields.at(-1), sol = metrics.find(v => v.liquidityTokenMint === "So11111111111111111111111111111111111111112"), jito = metrics.find(v => v.liquidityTokenMint === "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
if (!latest || !sol || !jito || Date.parse(source.fetchedAt) - Date.parse(latest.date) > 86400000 || Date.parse(latest.date) > Date.parse(source.fetchedAt)) throw new Error("Missing/stale/future yield or exact-mint identity");
const combined = new Decimal(1).add(latest.data).mul(new Decimal(1).add(jito.supplyApy)).minus(1);
const scenarios = ["1","2","3"].map(l => loopCarryScenario("10", l, combined.toString(), sol.borrowApy, 30, "0"));
const stress = loopCarryScenario("10", "3", combined.toString(), new Decimal(sol.borrowApy).add("0.03").toString(), 30, "0");
const report = { generatedAt: new Date().toISOString(), mode: "offline-constant-rate-diagnostic", executionEnabled: false, ript: "pending", entryEligible: false,
  market: "H6rHXmXoCQvq8Ue81MqNh7ow5ysPa1dSozwW3PU1dDH6", collateralReserve: jito.reserve, debtReserve: sol.reserve,
  jitoApyObservation: latest, jitoLendingSupplyApy: jito.supplyApy, assumedCombinedCollateralApy: combined.toString(), solBorrowApy: sol.borrowApy,
  scenarios, borrowPlusThreePercentagePoints: stress,
  sourceEvidence: [{ ...source, checkedFileSha256: createHash("sha256").update(statsRaw).digest("hex") }, { ...metricsSource, checkedFileSha256: createHash("sha256").update(metricsRaw).digest("hex") }],
  limitations: ["This compares rates from different timestamps, including a reported staking APY observation; their very small spread is not an established executable arbitrage.", "Combining asset growth and lending yield assumes multiplicative effects with no extra underlying fee omitted; no reward token incentive is credited.", "Zero specified fees is a gross scenario, not a free executable route. Actual setup, swap, borrow, flash-loan, close and priority costs are not quoted for this new strategy.", "Elevation-group feasibility, exact mint/oracle controls, full market/rent configuration and funded simulation were not cleared for this Jito-market proposal.", "SOL/USD still affects the USD value of net SOL equity; matching SOL debt can reduce directional leverage without eliminating staking-protocol, oracle, rate, market-exit or insolvency risks.", "No recommendation to use maximum leverage. This would change station6 from USDC lending and require distinct position attribution/valuation."] };
await writeFile(dir + "loop-jito-assessment.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ jitoAssetApy: latest, collateralApy: combined.toString(), solBorrowApy: sol.borrowApy, scenarios, stress }, null, 2));
