import Fastify from "fastify";
import type pg from "pg";
import { expect, it } from "vitest";
import { registerResearchRoutes } from "./research-routes.js";

it("keeps private research behind existing admin authentication", async () => {
  const app = Fastify();
  registerResearchRoutes(app, null, "wallet", { APP_ENV: "production" });
  expect((await app.inject("/v1/admin/research/latest")).statusCode).toBe(401);
  await app.close();
});

it("reads only configured wallet reports and flags expired research", async () => {
  const calls: unknown[] = [];
  const payload = { completedAt: "2020-01-01", reviewBy: "2020-01-02", executionEnabled: false };
  const pool = { query: async (_sql: string, params: unknown[]) => { calls.push(params); return { rows: [{ payload }] }; } } as unknown as pg.Pool;
  const app = Fastify();
  registerResearchRoutes(app, pool, "our-wallet", { APP_ENV: "local", AUTH_MODE: "local_bypass" });
  const r = await app.inject({ url: "/v1/admin/research/latest?wallet=someone-else", headers: { "x-belac-dev-user": "owner", "x-belac-dev-role": "owner" } });
  expect(r.statusCode).toBe(200);
  expect(r.json().meta.stale).toBe(true);
  expect(calls).toEqual([["our-wallet"]]);
  expect(r.headers["cache-control"]).toBe("private, no-store");
  await app.close();
});
