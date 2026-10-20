import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { applyMigrations } from "@belac/db/migrate";
import { seed } from "@belac/db/seed";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeReconciliation, writeSnapshots } from "./persist.js";

describe("snapshot persistence", () => {
  let started: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
  let pool: pg.Pool;

  beforeAll(async () => {
    started = await new PostgreSqlContainer("postgres:16-alpine").start();
    await applyMigrations(started.getConnectionUri());
    pool = new pg.Pool({ connectionString: started.getConnectionUri() });
    await seed(drizzle(pool));
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await started.stop();
  });

  it("writes a snapshot once and opens one disagreement above 0.05", async () => {
    await writeSnapshots(pool);
    await writeSnapshots(pool);
    const snaps = await pool.query(`select count(*)::int as count from valuation_snapshots where calc_version = 'v1' and quality = 'manual_evidence'`);
    const challenge = await pool.query(`select id from challenges where slug = 'demo-a'`);
    const small = await writeReconciliation(pool, challenge.rows[0].id, "10.04", "10.00");
    const large = await writeReconciliation(pool, challenge.rows[0].id, "10.06", "10.00");
    const again = await writeReconciliation(pool, challenge.rows[0].id, "10.06", "10.00");
    const issues = await pool.query(`select count(*)::int as count from reconciliation_issues where kind = 'disagreement' and state = 'open'`);
    expect(snaps.rows[0].count).toBeGreaterThan(0);
    expect(small.opened).toBe(false);
    expect(large.opened).toBe(true);
    expect(again.opened).toBe(false);
    expect(issues.rows[0].count).toBe(1);
  });
});