import pg from "pg";
import { runWithLock } from "./lock.js";
import { snapshotFromManualDeposit } from "./snapshot.js";
import { freezeLeaderboard, writeReconciliation, writeSnapshots } from "./persist.js";

const job = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

async function guarded(name: string, work: () => Promise<void>) {
  if (!databaseUrl) {
    await work();
    return;
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await runWithLock(pool, name, work);
    if (result === "skipped") {
      console.log(JSON.stringify({ state: "skipped" }));
    }
  } finally {
    await pool.end();
  }
}

try {
  if (job === "snapshot") {
    await guarded("snapshot", async () => {
      const snapshot = await snapshotFromManualDeposit();
      if (databaseUrl) {
        const pool = new pg.Pool({ connectionString: databaseUrl });
        await writeSnapshots(pool);
        await pool.end();
      }
      console.log(JSON.stringify(snapshot));
    });
    process.exit(0);
  }
  if (job === "reconcile") {
    await guarded("reconcile", async () => {
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required");
      }
      const pool = new pg.Pool({ connectionString: databaseUrl });
      const challengeId = process.argv[3];
      const reported = process.argv[4] ?? "10";
      const replay = process.argv[5] ?? "10";
      if (!challengeId) {
        throw new Error("usage: reconcile <challengeId> <reported> <replay>");
      }
      const result = await writeReconciliation(pool, challengeId, reported, replay);
      await pool.end();
      console.log(JSON.stringify(result));
    });
    process.exit(0);
  }
  if (job === "freeze") {
    await guarded("freeze", async () => {
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required");
      }
      const pool = new pg.Pool({ connectionString: databaseUrl });
      await freezeLeaderboard(pool);
      await pool.end();
    });
    process.exit(0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "job failed");
  process.exit(1);
}
console.error("usage: start <snapshot|reconcile>");
process.exit(1);
