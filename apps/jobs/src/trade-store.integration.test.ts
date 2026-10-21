import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { TradeStore } from "./trade-store.js";
import { CHALLENGE_WALLET, type MeteoraPlan } from "../../../packages/contracts/src/trades.js";
let container: StartedPostgreSqlContainer, pool: pg.Pool, store: TradeStore;
const fixture = JSON.parse(await readFile(new URL("./fixtures/meteora-builder-mainnet.json", import.meta.url), "utf8"));
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri(), max: 4 });
  await pool.query(await readFile(new URL("../../../packages/db/drizzle/0009_wallet_trades.sql", import.meta.url), "utf8"));
  store = new TradeStore(pool);
}, 120000);
afterAll(async () => { await pool?.end(); await container?.stop(); }, 30000);
beforeEach(async () => { await pool.query("truncate wallet_trade_attempts,wallet_trade_fee_events,wallet_trade_sessions,wallet_trade_challenges"); });
async function ready() { const a = await store.create(fixture.plan.mint); await store.claim(); await store.publish(a.id, { ...fixture.plan, expiresAt: new Date(Date.now() + 45000).toISOString() } as MeteoraPlan); return a; }
it("serializes concurrent queue claims, signature requests and permanent station reservations", async () => {
  const a = await store.create(fixture.plan.mint);
  await expect(store.create(fixture.plan.mint)).rejects.toMatchObject({ code: "23505" });
  const claims = await Promise.all([store.claim(), store.claim()]); expect(claims.filter(Boolean)).toHaveLength(1);
  await store.publish(a.id, { ...fixture.plan, expiresAt: new Date(Date.now() + 45000).toISOString() });
  const begins = await Promise.allSettled([store.begin(a.id), store.begin(a.id)]); expect(begins.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await store.cancel(a.id)).toBe(false);
  await store.register(a.id, "signature-a"); await store.register(a.id, "signature-a");
  await expect(store.register(a.id, "signature-b")).rejects.toThrow();
  await store.mark(a.id, "unknown"); await expect(store.create(fixture.plan.mint)).rejects.toMatchObject({ code: "23505" });
  const receipt = { ...fixture.plan, signature: "signature-a", at: new Date().toISOString(), slot: fixture.plan.slot, spentUsdcAtoms: fixture.plan.simulatedSpendUsdcAtoms, residualWsolAtoms: fixture.plan.residualWsolAtoms, rentLamports: fixture.plan.rentLamports, feeLamports: fixture.plan.feeLamports };
  await store.reconcile(a.id, receipt); await store.reconcile(a.id, receipt);
  expect((await store.latest())?.state).toBe("reconciled"); expect((await store.receipt())?.signature).toBe("signature-a");
  await expect(store.create(fixture.plan.mint)).rejects.toMatchObject({ code: "23505" });
});
it("recovers abandoned preparation leases and rejects expired reviews", async () => {
  const a = await store.create(fixture.plan.mint); await store.claim();
  await pool.query("update wallet_trade_attempts set lease_until=now()-interval '1 second' where id=$1", [a.id]);
  expect((await store.claim())?.id).toBe(a.id);
  await store.publish(a.id, { ...fixture.plan, expiresAt: "2020-01-01T00:00:00Z" });
  await expect(store.begin(a.id)).rejects.toThrow(); expect(await store.cancel(a.id)).toBe(true);
  expect((await store.create(fixture.plan.mint)).state).toBe("queued");
});
it("binds one-time login challenges and bearer sessions to the original origin", async () => {
  const auth = new TradeStore(pool, (wallet, message, signature) => wallet === CHALLENGE_WALLET && message.includes("Origin: http://localhost:5186") && signature === "test-only-proof");
  const challenge = await auth.challenge("http://localhost:5186");
  await expect(auth.login("https://wrong.invalid", challenge.id, "test-only-proof")).rejects.toThrow();
  const session = await auth.login("http://localhost:5186", challenge.id, "test-only-proof");
  expect(await auth.authorized("http://localhost:5186", session.token)).toBe(true);
  expect(await auth.authorized("https://wrong.invalid", session.token)).toBe(false);
  await expect(auth.login("http://localhost:5186", challenge.id, "test-only-proof")).rejects.toThrow();
});
it("records failed fees once before releasing a failed attempt", async () => {
  const a = await ready(); await store.begin(a.id); await store.register(a.id, "failed-signature");
  for (let i = 0; i < 2; i++) await pool.query("insert into wallet_trade_fee_events values($1,$2,$3) on conflict do nothing", ["failed-signature", CHALLENGE_WALLET, "11000"]);
  expect((await pool.query("select sum(lamports)::text as total from wallet_trade_fee_events")).rows[0].total).toBe("11000");
  await store.mark(a.id, "failed"); expect((await store.create(fixture.plan.mint)).state).toBe("queued");
});
