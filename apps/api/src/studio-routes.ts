import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { StudioSnapshot } from "../../../packages/contracts/src/studio.js";

export function registerStudioRoutes(app: FastifyInstance, pool: pg.Pool | null, address?: string) {
  app.get("/v1/studio", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!pool || !address) return reply.code(503).send({ error: { code: "sync_not_configured", message: "Live sync is not configured." } });
    const result = await pool.query<{ payload: StudioSnapshot }>("select payload from studio_snapshots where wallet_address=$1", [address]);
    const snapshot = result.rows[0]?.payload;
    if (!snapshot) return reply.code(503).send({ error: { code: "sync_pending", message: "Waiting for the first wallet sync." } });
    return { data: snapshot, meta: { stale: Date.now() - Date.parse(snapshot.generatedAt) > 180_000, pollAfterMs: 30_000, requestId: request.id } };
  });
}
