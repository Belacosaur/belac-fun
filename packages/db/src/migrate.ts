import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle");

export async function applyMigrations(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  await pool.end();
}

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && process.argv[1]?.includes("migrate")) {
  await applyMigrations(databaseUrl);
}
