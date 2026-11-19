import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { registerPublicRoutes } from "./public-routes.js";
import type { Database } from "./queries.js";
import { registerSecurity } from "./security.js";

const publicGet = new Set([
  "/v1/campaigns/current",
  "/v1/campaigns/:slug/leaderboard",
  "/v1/campaigns/:slug/timeline",
  "/v1/campaigns/:slug/summary", "/v1/campaigns/:slug/leaderboard.csv",
  "/v1/challenges/:slug", "/v1/challenges/:slug/snapshots",
  "/v1/challenges/:slug/transactions", "/v1/challenges/:slug/positions", "/v1/challenges/:slug/sources",
  "/v1/content", "/v1/content/:slug", "/v1/providers/:slug", "/v1/site/status",
]);
type ReaderOptions = {
  archiveAt: string;
  accessTeamDomain?: string;
  accessAudience?: string;
  researchAddress?: string;
  allowedOrigins?: string;
  rateLimitMax?: number;
};

export function buildNativeFunArchiveApp(db: Database, options: ReaderOptions) {
  const archiveAt = new Date(options.archiveAt).toISOString();
  const app = Fastify({ logger: false, genReqId: () => randomUUID() });
  app.register(async (instance) => {
    await registerSecurity(instance, {
      allowedOrigins: options.allowedOrigins ?? "",
      rateLimitMax: options.rateLimitMax ?? 60,
    });
    instance.addHook("onSend", async (req, reply, payload) => {
      reply.header("x-belac-archive-as-of", archiveAt).header("Cache-Control", req.url.startsWith("/v1/admin/") ? "private, no-store" : "no-store");
      const mime = reply.getHeader("content-type");
      if (typeof payload !== "string" || typeof mime !== "string" || !mime.startsWith("application/json")) return payload;
      const body = JSON.parse(payload);
      if (body && typeof body === "object" && body.meta && typeof body.meta === "object") {
        body.meta.archiveAsOf = archiveAt;
        body.meta.archiveMode = true;
        if ("asOf" in body.meta) body.meta.asOf = archiveAt;
        if (body.data && !Array.isArray(body.data) && typeof body.data === "object" && "asOf" in body.data && (req.url.startsWith("/v1/campaigns/current") || req.url.startsWith("/v1/site/status"))) body.data.asOf = archiveAt;
        return JSON.stringify(body);
      }
      return payload;
    });
    instance.setNotFoundHandler((req, reply) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) || /^\/v1\/(?:trade|recovery|station|pacifica|perps|next-run|studio)(?:[-/]|$)/.test(req.url)) {
        return reply.code(410).send({error:{code:"archive_only",message:"BELAC Fun is read-only. This live action is unavailable.",requestId:req.id}});
      }
      return reply.code(404).send({error:{code:"not_found",message:"Not found",requestId:req.id}});
    });
    instance.get("/health/live", async req => ({data:{status:"ok"},meta:{requestId:req.id,archiveAsOf:archiveAt}}));
    instance.get("/health/ready", async req => ({data:{status:"ok",mode:"archive",archiveAsOf:archiveAt},meta:{requestId:req.id,archiveAsOf:archiveAt}}));
    // This facade exposes only GET registration, not the runtime or any write method.
    const originalGet = instance.get.bind(instance) as (path: string, handler: unknown) => unknown;
    const getOnly = { get(path: string, handler: unknown) {
      if (publicGet.has(path)) originalGet(path, handler);
    }};
    registerPublicRoutes(getOnly as unknown as FastifyInstance, db);

    instance.get("/v1/admin/*", async (req, reply) => { reply.header("Cache-Control","private, no-store"); return reply.code(401).send({error:{code:"private_archive_unavailable",message:"Private archive access is unavailable.",requestId:req.id}}); });
  });
  return app;
}
