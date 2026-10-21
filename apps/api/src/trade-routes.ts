import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { TradeStore } from "../../jobs/src/trade-store.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
const idSchema = z.string().uuid(), key = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
type Store = Pick<TradeStore, "challenge" | "login" | "authorized" | "latest" | "create" | "get" | "begin" | "register" | "cancel">;
export function registerTradeRoutes(app: FastifyInstance, pool: pg.Pool | null, allowedOrigins: string, storeOverride?: Store, recoveryMode = false, preparationEnabled = false) {
  const store = storeOverride ?? (pool ? new TradeStore(pool) : null), origins = allowedOrigins.split(",").map(s => s.trim()).filter(Boolean);
  app.register(async instance => {
    instance.addHook("onRequest", async (req, reply) => {
      reply.header("Cache-Control", "private, no-store");
      const origin = req.headers.origin;
      if (!origin || !origins.includes(origin)) return reply.code(403).send({ error: "Origin not allowed" });
      if (!store) return reply.code(503).send({ error: "Trade preparation is unavailable" });
      if (req.routeOptions.url === "/v1/trades/wallet/challenge" || req.routeOptions.url === "/v1/trades/wallet/session") return;
      const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
      if (!await store.authorized(origin, token)) return reply.code(401).send({ error: "Connect and authenticate the challenge wallet" });
    });
    instance.post("/v1/trades/wallet/challenge", async req => { const b = z.object({ wallet: z.literal(CHALLENGE_WALLET) }).strict().parse(req.body); void b; return { data: await store!.challenge(req.headers.origin!) }; });
    instance.post("/v1/trades/wallet/session", async (req, reply) => {
      const b = z.object({ id: idSchema, signature: z.string().max(100) }).strict().parse(req.body);
      try { return { data: await store!.login(req.headers.origin!, b.id, b.signature) }; } catch { return reply.code(401).send({ error: "Wallet signature is invalid, expired or already used" }); }
    });
    instance.get("/v1/trades/meteora/latest", async () => ({ data: await store!.latest() }));
    instance.get("/v1/trades/status",async()=>({data:{wallet:CHALLENGE_WALLET,budgetUsdc:"10",automatedExecutionEnabled:false,preparationEnabled:preparationEnabled&&!recoveryMode,feePoolSeparate:true}}));
    instance.post("/v1/trades/meteora/prepare", async (req, reply) => {
      if(recoveryMode)return reply.code(403).send({error:"New entries are disabled during wallet recovery"});
      if(!preparationEnabled)return reply.code(403).send({error:"Quote preparation is disabled. Connect the new wallet and complete funding/account setup before enabling preparation."});
      const b = z.object({ mint: key, station: z.literal(5), budgetUsdc: z.literal("10") }).strict().parse(req.body);
      if ([CHALLENGE_WALLET, "So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].includes(b.mint)) return reply.code(400).send({ error: "Invalid position mint" });
      try { return { data: await store!.create(b.mint) }; } catch { return reply.code(409).send({ error: "An existing Meteora attempt or position is reserved. Review it before preparing another." }); }
    });
    instance.get("/v1/trades/meteora/:id", async (req, reply) => { const id = idSchema.parse((req.params as { id: string }).id); const a = await store!.get(id); return a ? { data: a } : reply.code(404).send({ error: "Attempt not found" }); });
    instance.post("/v1/trades/meteora/:id/begin", async (req, reply) => {
      if(recoveryMode)return reply.code(403).send({error:"New-entry signatures are disabled during wallet recovery"});
      if(!preparationEnabled)return reply.code(403).send({error:"Entry reviews are disabled until quote preparation is enabled"});
      const id = idSchema.parse((req.params as { id: string }).id);
      try { return { data: await store!.begin(id) }; } catch { return reply.code(409).send({ error: "Plan expired or already claimed. Refresh before signing." }); }
    });
    instance.post("/v1/trades/meteora/:id/signature", async (req, reply) => {
      const id = idSchema.parse((req.params as { id: string }).id), b = z.object({ signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/), messageHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
      const a = await store!.get(id); if (!a?.plan || a.plan.messageHash !== b.messageHash) return reply.code(409).send({ error: "Reviewed message differs from attempt" });
      try { await store!.register(id, b.signature); return { data: await store!.get(id) }; } catch { return reply.code(409).send({ error: "Attempt cannot accept this signature" }); }
    });
    instance.post("/v1/trades/meteora/:id/cancel", async (req, reply) => {
      const id = idSchema.parse((req.params as { id: string }).id); if (!await store!.cancel(id)) return reply.code(409).send({ error: "Attempt may be signed or submitted. Waiting for chain reconciliation." }); return { data: await store!.get(id) };
    });
  });
}
