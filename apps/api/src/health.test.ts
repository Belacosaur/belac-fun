import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health", () => {
  it("GET /health/live returns 200 and a request id", async () => {
    const app = buildApp({ APP_ENV: "local" });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toEqual({ status: "ok" });
    expect(body.meta.requestId).toEqual(expect.any(String));
  });

  it("GET /health/ready returns 200 when local and DATABASE_URL is empty", async () => {
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: "" });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ status: "ok" });
  });

  it("GET /health/ready returns 503 when DATABASE_URL cannot be reached", async () => {
    const app = buildApp({
      APP_ENV: "local",
      DATABASE_URL: "postgres://invalid:5432/none",
    });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json().data.status).toBe("unavailable");
  });
});
