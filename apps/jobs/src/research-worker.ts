import { createServer } from "node:http";
import pg from "pg";
import { POLICY } from "./research/policy.js";
import { runResearch } from "./research/run.js";
import { ensureResearchSchema, saveResearch } from "./research/store.js";
import { nextResearchDelay, researchInterval } from "./research/schedule.js";

if (process.env.EXECUTION_ENABLED !== "false") throw new Error("Research worker requires EXECUTION_ENABLED=false");
const address = process.env.EXPERIMENT_WALLET_ADDRESS;
if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) || !process.env.DATABASE_URL) throw new Error("Public wallet address and database are required");
const wallet: string = address;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, query_timeout: 15_000 });
await ensureResearchSchema(pool);
// Persist first run immediately; daily bounded refresh builds an evidence history for weekly reviews.
const intervalMs = researchInterval(process.env.RESEARCH_INTERVAL_MS);
let stopping = false, active = false, lastCompleted = 0, lastAttempt = 0, consecutiveFailures = 0;
let lastRun: string | null = null, lastStatus: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const server = createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405).end(); return; }
  if (req.url !== "/health/live" && req.url !== "/research/status") { res.writeHead(404).end(); return; }
  const healthy = !stopping && consecutiveFailures < 3 && (!lastAttempt || Date.now() - lastAttempt < intervalMs * 2 + 600_000);
  res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ status: healthy ? "ok" : "stalled", service: "research-worker", executionEnabled: false, mode: "dry-run",
    policyVersion: POLICY.version, active, intervalMs, lastCompleted: lastCompleted || null, lastRun, lastStatus, consecutiveFailures }));
});
server.listen(Number(process.env.PORT) || 3000, "::");

async function tick() {
  if (stopping || active) return;
  active = true; lastAttempt = Date.now();
  const client = await pool.connect(); let locked = false;
  try {
    locked = (await client.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1)) as locked", [`research:${wallet}`])).rows[0]?.locked ?? false;
    if (!locked) return;
    // Restart-safe cadence: don't rescan each time an unrelated deployment happens.
    const previous = await client.query<{ id: string; completed_at: Date; status: string }>("select id,completed_at,status from research_runs where wallet_address=$1 and policy_version=$2 order by completed_at desc limit 1", [wallet, POLICY.version]);
    const p = previous.rows[0];
    if (p && Date.now() - p.completed_at.getTime() < intervalMs) {
      lastCompleted = p.completed_at.getTime(); lastRun = p.id; lastStatus = p.status; consecutiveFailures = 0; return;
    }
    const report = await runResearch(wallet, { jupiterApiKey: process.env.JUPITER_API_KEY });
    await saveResearch(pool, report);
    lastCompleted = Date.now(); lastRun = report.runId; lastStatus = report.status; consecutiveFailures = 0;
    console.log(JSON.stringify({ event: "research_completed", runId: report.runId, status: report.status, sources: report.sources.length,
      stations: report.stations.map(s => ({ id: s.id, decision: s.decision, scanned: s.scanned, shortlisted: s.shortlisted.length })) }));
  } finally {
    if (locked) await client.query("select pg_advisory_unlock(hashtext($1))", [`research:${wallet}`]).catch(() => undefined);
    client.release(); active = false;
  }
}
async function loop() {
  try { await tick(); } catch { active = false; consecutiveFailures++; console.error(JSON.stringify({ event: "research_failed", retry: true })); }
  if (!stopping) timer = setTimeout(loop, nextResearchDelay(intervalMs, lastCompleted, Date.now(), consecutiveFailures));
}
void loop();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
  stopping = true; if (timer) clearTimeout(timer); server.close();
  void pool.end().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
});
