import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrate.js";
import { seed } from "./seed.js";
import { campaigns, challenges, ledgerEvents, valuationSnapshots } from "./schema.js";

describe("database", () => {
  let started: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
  let connectionString = "";

  beforeAll(async () => {
    started = await new PostgreSqlContainer("postgres:16-alpine").start();
    connectionString = started.getConnectionUri();
    await applyMigrations(connectionString);
  }, 180_000);

  afterAll(async () => {
    await started.stop();
  });

  it("seeds twice without duplicating demo rows", async () => {
    const pool = new pg.Pool({ connectionString });
    const db = drizzle(pool);
    await seed(db);
    await seed(db);
    const [campaignCount] = await db.select({ count: sql<number>`count(*)::int` }).from(campaigns);
    const [challengeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(challenges);
    const [depositCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ledgerEvents);
    const [snapshotCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(valuationSnapshots);
    expect(campaignCount?.count).toBe(1);
    expect(challengeCount?.count).toBe(2);
    expect(depositCount?.count).toBe(1);
    expect(snapshotCount?.count).toBe(1);
    await pool.end();
  });

  it("rejects signed_amount updates from belac_app", async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await expect(
      client.query("SET ROLE belac_app; UPDATE ledger_entries SET signed_amount = 1"),
    ).rejects.toMatchObject({ code: "42501" });
    await client.query("RESET ROLE");
    await client.end();
  });
});
