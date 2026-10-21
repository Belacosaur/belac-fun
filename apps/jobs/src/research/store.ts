import { readFile } from "node:fs/promises";
import type pg from "pg";
import type { ResearchReport } from "../../../../packages/contracts/src/research.js";
import { renderResearch } from "./render.js";

export async function ensureResearchSchema(pool: pg.Pool) {
  const sql = await readFile(new URL("../../../../packages/db/drizzle/0008_research.sql", import.meta.url), "utf8");
  await pool.query(sql);
}

export async function saveResearch(pool: pg.Pool, report: ResearchReport) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`insert into research_runs(id,wallet_address,policy_version,started_at,completed_at,status,mode,payload,markdown)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [report.runId, report.walletAddress, report.policyVersion, report.startedAt, report.completedAt, report.status, report.mode, report, renderResearch(report)]);
    for (const s of report.sources) await client.query(`insert into research_observations(run_id,source_id,url,fetched_at,status,sha256,payload,error)
      values($1,$2,$3,$4,$5,$6,$7,$8)`, [report.runId, s.id, s.url, s.fetchedAt, s.status, s.sha256, JSON.stringify(s.payload), s.error]);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
