import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { runResearch } from "./research/run.js";
import { renderResearch } from "./research/render.js";
import { ensureResearchSchema, saveResearch } from "./research/store.js";

if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Research requires execution disabled");
const address = process.env.EXPERIMENT_WALLET_ADDRESS;
if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new Error("A public wallet address is required");
const report = await runResearch(address, { jupiterApiKey: process.env.JUPITER_API_KEY });
if (process.argv.includes("--persist")) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required for --persist");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000, query_timeout: 15_000 });
  try { await ensureResearchSchema(pool); await saveResearch(pool, report); } finally { await pool.end(); }
}
const outputArg = process.argv.indexOf("--output");
if (outputArg >= 0) {
  const output = path.resolve(process.argv[outputArg + 1] || "artifacts/research");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, `${report.runId}.json`), JSON.stringify(report, null, 2));
  await writeFile(path.join(output, `${report.runId}.md`), renderResearch(report));
}
console.log(JSON.stringify({ runId: report.runId, mode: report.mode, executionEnabled: false, status: report.status, sourceCount: report.sources.length,
  failedSources: report.sources.filter(s => s.status !== "ok").map(s => ({ id: s.id, error: s.error })),
  stations: report.stations.map(s => ({ id: s.id, provider: s.provider, decision: s.decision, scanned: s.scanned, shortlisted: s.shortlisted.length, rejected: s.rejected.length })) }, null, 2));
