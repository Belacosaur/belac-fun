import pg from "pg";
import { createExecutionServer, executionStatus } from "./execution-service.js";
import { startTradePreparation } from "./trade-worker.js";

// Validate before opening any network connection. An enabled flag fails closed.
const status = executionStatus(process.env);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
  idleTimeoutMillis: 10_000,
});
const stopPreparation = process.env.METEORA_PREPARATION_ENABLED === "true"
  ? await startTradePreparation(pool, process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com", process.env.JUPITER_API_KEY) : undefined;
const server = createExecutionServer(process.env, async () => {
  await pool.query("select 1");
});
server.listen(Number(process.env.PORT) || 3000, "::", () => {
  console.log(JSON.stringify({ event: "execution_service_started", ...status }));
});

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  stopPreparation?.();
  server.close(() => { void pool.end().then(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10_000).unref();
});
