import pg from "pg";

/** Operator CLI: export an already persisted report; never starts a scan or action. */
if (!process.env.DATABASE_URL || !process.env.EXPERIMENT_WALLET_ADDRESS) throw new Error("Database and public wallet required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, query_timeout: 15000 });
try {
  const result = await pool.query<{ payload: unknown; markdown: string }>("select payload,markdown from research_runs where wallet_address=$1 order by completed_at desc limit 1", [process.env.EXPERIMENT_WALLET_ADDRESS]);
  const saved = result.rows[0]; if (!saved) throw new Error("No saved research report");
  console.log(process.argv.includes("--markdown") ? saved.markdown : JSON.stringify(saved.payload));
} finally { await pool.end(); }
