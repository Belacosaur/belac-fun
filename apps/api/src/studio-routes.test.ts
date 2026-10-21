import Fastify from "fastify";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { registerStudioRoutes } from "./studio-routes.js";

describe("studio snapshots", () => {
  it("never falls back to illustrative data before the worker is configured", async () => {
    const app = Fastify();
    registerStudioRoutes(app, null);
    const response = await app.inject("/v1/studio");
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("sync_not_configured");
    await app.close();
  });
  it("marks an old persisted snapshot stale and queries only the configured wallet", async () => {
    const queries: unknown[] = [];
    const payload = { version: 1, generatedAt: "2020-01-01T00:00:00Z", wallet: { data: { valueUsd: "0" } } };
    const pool = { query: async (_sql: string, params: unknown[]) => { queries.push(params); return { rows: [{ payload }] }; } } as unknown as pg.Pool;
    const app = Fastify();
    registerStudioRoutes(app, pool, "configured-wallet");
    const response = await app.inject("/v1/studio?wallet=attacker-selected");
    expect(response.statusCode).toBe(200);
    expect(response.json().meta.stale).toBe(true);
    expect(response.json().data.wallet.data.valueUsd).toBe("0");
    expect(queries).toEqual([["configured-wallet"]]);
    await app.close();
  });
});
