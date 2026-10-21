import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createExecutionServer, executionStatus } from "./execution-service.js";

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  }
});
async function start(checkDatabase: () => Promise<void> = async () => undefined) {
  server = createExecutionServer({}, checkDatabase);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test address");
  return `http://127.0.0.1:${address.port}`;
}

describe("disabled execution service", () => {
  it("defaults to disabled without loading credentials or a signer", () => {
    expect(executionStatus({})).toMatchObject({
      enabled: false, mode: "disabled",
      capabilities: { sign: false, submit: false, claimJobs: false },
    });
    expect(executionStatus({ EXECUTION_ENABLED: "false" }).enabled).toBe(false);
  });
  it.each(["true", "1", "TRUE", "yes", ""])("rejects accidental activation or ambiguous flag %j", (flag) => {
    expect(() => createExecutionServer({ EXECUTION_ENABLED: flag }, async () => undefined)).toThrow();
  });
  it("reports disabled and never invokes the database for status or action requests", async () => {
    let checks = 0;
    const base = await start(async () => { checks++; });
    expect(await (await fetch(`${base}/execution/status`)).json()).toMatchObject({ enabled: false, mode: "disabled" });
    expect((await fetch(`${base}/execute`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${base}/execution/status`, { method: "POST" })).status).toBe(405);
    expect(checks).toBe(0);
  });
  it("is live while disabled, and fails readiness safely when Postgres is unavailable", async () => {
    const base = await start(async () => { throw new Error("secret database credentials"); });
    expect((await fetch(`${base}/health/live`)).status).toBe(200);
    const ready = await fetch(`${base}/health/ready`);
    expect(ready.status).toBe(503);
    expect(await ready.text()).not.toContain("secret");
  });
});
