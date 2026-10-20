import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";

export type Role = "owner" | "editor" | "viewer";

export type Actor = {
  id: string;
  role: Role;
};

export type AuthEnv = {
  APP_ENV?: string;
  AUTH_MODE?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  R2_BUCKET?: string;
  R2_ACCOUNT_ID?: string;
};

const roles = new Set<Role>(["owner", "editor", "viewer"]);

export async function verifyAccessJwt(
  token: string,
  env: AuthEnv,
): Promise<Actor | null> {
  const domain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!domain || !audience) {
    return null;
  }
  const jwks = createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`));
  const verified = await jwtVerify(token, jwks, { audience });
  const roleHeader = verified.payload["role"];
  const role = typeof roleHeader === "string" && roles.has(roleHeader as Role) ? (roleHeader as Role) : "viewer";
  const subject = typeof verified.payload.sub === "string" ? verified.payload.sub : "access-user";
  return { id: subject, role };
}

export function readActor(request: FastifyRequest, env: AuthEnv, verify = verifyAccessJwt) {
  return resolveActor(request, env, verify);
}

async function resolveActor(
  request: FastifyRequest,
  env: AuthEnv,
  verify: typeof verifyAccessJwt,
): Promise<Actor | null> {
  if (env.APP_ENV === "local" && env.AUTH_MODE === "local_bypass") {
    const user = request.headers["x-belac-dev-user"];
    const role = request.headers["x-belac-dev-role"];
    if (typeof user !== "string" || typeof role !== "string" || !roles.has(role as Role)) {
      return null;
    }
    return { id: user, role: role as Role };
  }
  if (env.AUTH_MODE === "access") {
    const token = request.headers["cf-access-jwt-assertion"];
    if (typeof token !== "string" || token.length === 0) {
      return null;
    }
    return verify(token, env);
  }
  return null;
}

export function unauthorized(reply: FastifyReply, requestId: string) {
  reply.code(401);
  return {
    error: { code: "unauthorized", message: "Sign-in required", requestId },
  };
}

export function forbidden(reply: FastifyReply, requestId: string) {
  reply.code(403);
  return {
    error: { code: "forbidden", message: "Role cannot perform this action", requestId },
  };
}
