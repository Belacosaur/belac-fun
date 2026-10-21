import { spawn } from "node:child_process";
import process from "node:process";

const role = process.env.SERVICE_ROLE || "api";
if (!["api", "sync-worker", "execution-worker", "research-worker"].includes(role)) throw new Error("Unknown SERVICE_ROLE");
const worker = role !== "api";
// API recovery adapters load schema resources relative to their source modules,
// like the workers. Run both through the already-installed TS runtime.
const child = spawn("pnpm", ["--filter", "@belac/jobs", "exec", "tsx", worker ? `src/${role}.ts` : "../api/src/server.ts"], { stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => process.exit(1));
child.on("exit", (code) => process.exit(code ?? 1));
