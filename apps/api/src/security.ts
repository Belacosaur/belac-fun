import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export async function registerSecurity(
  app: FastifyInstance,
  options: { allowedOrigins: string; rateLimitMax: number },
) {
  const origins = options.allowedOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  await app.register(cors, {
    origin: origins.length === 0 ? false : origins,
  });
  await app.register(helmet, { global: true });
  await app.register(rateLimit, {
    max: options.rateLimitMax,
    timeWindow: "1 minute",
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400);
      return {
        error: {
          code: "validation_error",
          message: error.issues.map((issue) => issue.message).join("; "),
          requestId: request.id,
        },
      };
    }
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    reply.code(statusCode);
    const message = error instanceof Error ? error.message : "Request failed";
    return {
      error: {
        code: statusCode === 500 ? "internal_error" : "request_error",
        message: statusCode === 500 ? "Internal error" : message,
        requestId: request.id,
      },
    };
  });
}
