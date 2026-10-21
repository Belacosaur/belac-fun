import { createServer } from "node:http";

export interface ExecutionEnv {
  EXECUTION_ENABLED?: string;
  METEORA_PREPARATION_ENABLED?: string;
}

export function executionStatus(env: ExecutionEnv) {
  if (env.EXECUTION_ENABLED !== undefined && env.EXECUTION_ENABLED !== "false") {
    throw new Error("This deployment only supports EXECUTION_ENABLED=false. Trading activation requires a separate implementation and release.");
  }
  return {
    service: "execution-worker",
    mode: "disabled",
    enabled: false,
    capabilities: { sign: false, submit: false, claimJobs: false },
    preparation: { enabled: env.METEORA_PREPARATION_ENABLED === "true", stationIds: [5], walletSigningRequired: true, serverSigningEnabled: false, serverBroadcastEnabled: false },
    activationRequirements: ["Connect the challenge wallet in the frontend", "Review a fresh validated simulation", "Owner signs and submits through the frontend wallet"],
  } as const;
}

/** Intentionally has no signer, RPC client, queue consumer or trading adapters. */
export function createExecutionServer(env: ExecutionEnv, checkDatabase: () => Promise<void>) {
  const status = executionStatus(env);
  return createServer(async (request, response) => {
    const send = (code: number, body: unknown) => {
      response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(body));
    };
    if (!["/health/live", "/health/ready", "/execution/status"].includes(request.url ?? "")) {
      send(404, { error: "not_found" }); return;
    }
    if (request.method !== "GET") { send(405, { error: "method_not_allowed" }); return; }
    if (request.url === "/execution/status") { send(200, status); return; }
    if (request.url === "/health/live") { send(200, { status: "ok", execution: "disabled" }); return; }
    try {
      await checkDatabase();
      send(200, { status: "ok", database: "connected", execution: "disabled" });
    } catch {
      send(503, { status: "unavailable", database: "unavailable", execution: "disabled" });
    }
  });
}
