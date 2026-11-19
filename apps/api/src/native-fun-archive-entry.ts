import pg from "pg";
import { buildNativeFunArchiveApp } from "./native-fun-archive.js";

const uri = new URL(process.env.FUN_ARCHIVE_DATABASE_URL ?? "");
if (!["postgres:", "postgresql:"].includes(uri.protocol)
    || uri.hostname !== "127.0.0.1" || uri.port !== "55442"
    || decodeURIComponent(uri.username) !== "belac_fun_archive_reader"
    || uri.pathname !== "/belac_fun_archive"
    || uri.search || uri.hash || !uri.password) {
  throw new Error("Expected the dedicated loopback BELAC Fun presentation role");
}
const pool = new pg.Pool({
  connectionString: uri.href, max: 4, query_timeout: 8_000,
  connectionTimeoutMillis: 3_000, options: "-c default_transaction_read_only=on"
});
const archived = await pool.query("select source_observed_at from public.archive_freshness");
const when = archived.rows[0]?.source_observed_at;
if (!(when instanceof Date) || !Number.isFinite(when.getTime()) || when.getTime() > Date.now()+60_000 || archived.rows.length !== 1) { await pool.end(); throw new Error("Expected one verified migration archive receipt"); }
const app = buildNativeFunArchiveApp(pool, {
  archiveAt: when.toISOString(),
  allowedOrigins: process.env.FUN_ARCHIVE_ALLOWED_ORIGINS ?? "",
});
app.addHook("onClose", async () => { await pool.end(); });
for (const signal of ["SIGINT","SIGTERM"] as const) {
  process.on(signal, () => { void app.close(); });
}
try {
  const r = await pool.query("select current_user,current_database(),current_setting('transaction_read_only') as read_only");
  if (r.rows[0]?.current_user !== "belac_fun_archive_reader"
    || r.rows[0]?.current_database !== "belac_fun_archive"
    || r.rows[0]?.read_only !== "on") {
    throw new Error("Read role check failed");
  }
  await app.listen({ host: "127.0.0.1", port: 18184 });
} catch {
  console.error("BELAC Fun presentation listener did not start.");
  await app.close();
  process.exitCode = 1;
}
