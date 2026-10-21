import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { syncStudio } from "./studio-sync.js";
import { TradeStore } from "./trade-store.js";
import {RecoveryStore} from "./recovery-store.js";
import type { StudioSnapshot } from "../../../packages/contracts/src/studio.js";

const address = process.env.EXPERIMENT_WALLET_ADDRESS;
if (!address || !process.env.DATABASE_URL) throw new Error("Wallet address and database URL are required");
const walletAddress: string = address;
const kaminoProduct = process.env.KAMINO_PRODUCT || "lending";
if (kaminoProduct !== "lending") throw new Error("This challenge requires KAMINO_PRODUCT=lending");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, query_timeout: 15_000 });
const recoveryStore=new RecoveryStore(pool,process.env.SOLANA_RPC_URL||"https://solana-rpc.publicnode.com");
await recoveryStore.setup();
const intervalMs = Math.max(60_000, Number(process.env.SYNC_INTERVAL_MS) || 60_000);
let stopping = false;
let lastCompleted = 0;
const started = Date.now();
let timer: ReturnType<typeof setTimeout> | undefined;

// Idempotent additive migration; included in the normal Drizzle migration set too.
const schema = await readFile(new URL("../../../packages/db/drizzle/0007_live_sync.sql", import.meta.url), "utf8");
await pool.query(schema);
await pool.query(await readFile(new URL("../../../packages/db/drizzle/0009_wallet_trades.sql", import.meta.url), "utf8"));
const tradeStore = new TradeStore(pool);
const server = createServer((request, response) => {
  if (request.url !== "/health/live") { response.writeHead(404).end(); return; }
  const healthy = !stopping && Date.now() - (lastCompleted || started) < intervalMs * 5;
  response.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: healthy ? "ok" : "stalled", lastCompleted: lastCompleted || null }));
});
server.listen(Number(process.env.PORT) || 3000, "::");

async function tick() {
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1)) as locked", [`studio:${walletAddress}`])).rows[0]?.locked ?? false;
    if (!locked) return;
    const old = await client.query<{ payload: StudioSnapshot }>("select payload from studio_snapshots where wallet_address=$1", [walletAddress]);
    const receipt = await tradeStore.receipt();
    const fees = await pool.query("select coalesce(sum(lamports),0)::text as total from wallet_trade_fee_events where wallet=$1", [walletAddress]);
    await recoveryStore.latest();
    const recovery=await recoveryStore.started()?{inventory:await recoveryStore.inventory(),complete:await recoveryStore.completed()}:undefined;
    const snapshot = await syncStudio(walletAddress, process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", old.rows[0]?.payload, { jupiterApiKey: process.env.JUPITER_API_KEY, meteoraReceipt: receipt, failedTradeFees: BigInt(fees.rows[0].total), recovery });
    await client.query("begin");
    try {
      await client.query(`insert into studio_snapshots values ($1,$2,$3) on conflict(wallet_address)
        do update set observed_at=excluded.observed_at, payload=excluded.payload`, [walletAddress, snapshot.generatedAt, snapshot]);
      await client.query("insert into studio_sync_history(wallet_address,observed_at,payload) values($1,$2,$3)", [walletAddress, snapshot.generatedAt, snapshot]);
      await client.query("delete from studio_sync_history where wallet_address=$1 and observed_at < now() - interval '90 days'", [walletAddress]);
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; }
    lastCompleted = Date.now();
    console.log(JSON.stringify({ event: "studio_sync", wallet: snapshot.wallet.status,
      platforms: snapshot.platforms.map((p) => ({ id: p.id, status: p.observation.status })) }));
  } finally {
    if (locked) await client.query("select pg_advisory_unlock(hashtext($1))", [`studio:${walletAddress}`]).catch(() => undefined);
    client.release();
  }
}
async function loop() {
  try { await tick(); } catch { console.error(JSON.stringify({ event: "studio_sync_failed", retry: true })); }
  if (!stopping) timer = setTimeout(loop, intervalMs);
}
void loop();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
  stopping = true;
  if (timer) clearTimeout(timer);
  server.close();
  void pool.end().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
});
