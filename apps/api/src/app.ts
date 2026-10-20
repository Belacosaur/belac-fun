import { randomUUID } from "node:crypto";
import swagger from "@fastify/swagger";
import Fastify, { type FastifyInstance } from "fastify";
import pg from "pg";
import { registerAdminRoutes } from "./admin-routes.js";
import type { Actor } from "./auth.js";
import { registerPublicRoutes } from "./public-routes.js";
import { registerSecurity } from "./security.js";

export type ApiEnv = {
  APP_ENV?: string;
  DATABASE_URL?: string;
  PORT?: string;
  ALLOWED_ORIGINS?: string;
  AUTH_MODE?: string;
  RATE_LIMIT_MAX?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  R2_BUCKET?: string;
  R2_ACCOUNT_ID?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor;
  }
}

const connectionTimeoutMillis = 1000;

export function buildApp(env: ApiEnv = process.env): FastifyInstance {
  const app = Fastify({
    logger: true,
    genReqId: () => randomUUID(),
  });
  const databaseUrl = env.DATABASE_URL ?? "";
  const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : null;
  const rateLimitMax = Number(env.RATE_LIMIT_MAX || 60);

  app.addHook("onClose", async () => {
    await pool?.end();
  });

  app.register(async (instance) => {
    await registerSecurity(instance, {
      allowedOrigins: env.ALLOWED_ORIGINS ?? "",
      rateLimitMax,
    });
    await instance.register(swagger, {
      openapi: {
        openapi: "3.0.3",
        info: { title: "Belac.fun", version: "0.0.0" },
      },
    });
    instance.get("/openapi.json", async () => instance.swagger());
    if (env.APP_ENV !== "production") {
      instance.get("/documentation", async () => ({ openapi: "/openapi.json" }));
    }
    instance.get("/health/live", async (request) => {
      return { data: { status: "ok" }, meta: { requestId: request.id } };
    });
    instance.get("/health/ready", async (request, reply) => {
      const localWithoutDatabase = env.APP_ENV === "local" && databaseUrl === "";
      if (localWithoutDatabase) {
        return { data: { status: "ok" }, meta: { requestId: request.id } };
      }
      if (databaseUrl === "") {
        reply.code(503);
        return { data: { status: "unavailable" }, meta: { requestId: request.id } };
      }
      const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis });
      try {
        await client.connect();
        await client.query("select 1");
        return { data: { status: "ok" }, meta: { requestId: request.id } };
      } catch (error) {
        request.log.error({ requestId: request.id, err: error }, "database readiness failed");
        reply.code(503);
        return { data: { status: "unavailable" }, meta: { requestId: request.id } };
      } finally {
        await client.end().catch(() => undefined);
      }
    });
    registerPublicRoutes(instance, pool);
    registerAdminRoutes(instance, pool, env);
  });

  return app;
}

export function listenPort(env: ApiEnv = process.env): number {
  const raw = env.PORT;
  if (raw === undefined || raw === "") {
    return 3000;
  }
  return Number(raw);
}
