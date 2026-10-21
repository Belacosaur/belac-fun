import { spawn } from "node:child_process";
import process from "node:process";

const role = process.env.SERVICE_ROLE || "api";
if (!["api", "sync-worker", "execution-worker", "research-worker"].includes(role)) throw new Error("Unknown SERVICE_ROLE");
const worker = role !== "api";
const child = spawn(worker ? "pnpm" : "node", worker
  ? ["--filter", "@belac/jobs", "exec", "tsx", `src/${role}.ts`]
  : ["apps/api/dist/server.js"], { stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => process.exit(1));
child.on("exit", (code) => process.exit(code ?? 1));
