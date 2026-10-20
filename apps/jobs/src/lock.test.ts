import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { applyMigrations } from "@belac/db/migrate";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithLock } from "./lock.js";

describe("advisory lock", () => {
  let started: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
  let pool: pg.Pool;

  beforeAll(async () => {
    started = await new PostgreSqlContainer("postgres:16-alpine").start();
    await applyMigrations(started.getConnectionUri());
    pool = new pg.Pool({ connectionString: started.getConnectionUri() });
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await started.stop();
  });

  it("writes skipped and returns when the lock is already held", async () => {
    const holder = await pool.connect();
    await holder.query("select pg_advisory_lock(hashtext($1))", ["snapshot"]);
    const result = await runWithLock(pool, "snapshot", async () => undefined);
    const runs = await pool.query(`select state from job_runs where job_name = 'snapshot'`);
    expect(result).toBe("skipped");
    expect(runs.rows[0].state).toBe("skipped");
    await holder.query("select pg_advisory_unlock(hashtext($1))", ["snapshot"]);
    holder.release();
  });
});