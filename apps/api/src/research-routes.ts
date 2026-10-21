import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { ResearchReport } from "../../../packages/contracts/src/research.js";
import { readActor, unauthorized, type AuthEnv } from "./auth.js";

/** Private, read-only saved reports. No public research trigger or execution action. */
export function registerResearchRoutes(app: FastifyInstance, pool: pg.Pool | null, address: string | undefined, env: AuthEnv) {
  app.register(async instance => {
    instance.addHook("onRequest", async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (!await readActor(request, env)) return reply.send(unauthorized(reply, request.id));
    });
    instance.get("/v1/admin/research/latest", async (request, reply) => {
      if (!pool || !address) return reply.code(503).send({ error: { code: "research_not_configured" } });
      const result = await pool.query<{ payload: ResearchReport }>("select payload from research_runs where wallet_address=$1 order by completed_at desc limit 1", [address]);
      const report = result.rows[0]?.payload;
      if (!report) return reply.code(503).send({ error: { code: "research_pending" } });
      return { data: report, meta: { stale: !Number.isFinite(Date.parse(report.reviewBy)) || Date.now() > Date.parse(report.reviewBy), requestId: request.id } };
    });
    instance.get("/v1/admin/research/history", async (request, reply) => {
      if (!pool || !address) return reply.code(503).send({ error: { code: "research_not_configured" } });
      const result = await pool.query("select id,policy_version,completed_at,status,mode from research_runs where wallet_address=$1 order by completed_at desc limit 20", [address]);
      return { data: result.rows, meta: { requestId: request.id } };
    });
  });
}
