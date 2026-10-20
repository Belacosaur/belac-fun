import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { seed } from "./seed.js";

if (process.env.APP_ENV === "production") {
  console.error("seed refused: APP_ENV=production");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

async function main() {
  await seed(db);
  await pool.end();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
