import { expect, it } from "vitest";
import Fastify from "fastify";
import { registerTradeRoutes } from "./trade-routes.js";
import type { TradeStore } from "../../jobs/src/trade-store.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
it("only offers owner-authorized Meteora preparation and never server execution", async () => {
  const app = Fastify(); let created = 0;
  const store = { authorized: async (_origin: string, token: string) => token === "owner", challenge: async () => ({ id: "challenge" }), create: async () => { created++; return { state: "queued" }; }, latest: async () => null } as unknown as TradeStore;
  registerTradeRoutes(app, null, "http://localhost:5186", store);
  const request = (url: string, payload: unknown, authorization = "Bearer owner", origin = "http://localhost:5186") => app.inject({ method: "POST", url, headers: { authorization, origin }, payload: payload as object });
  expect((await request("/v1/trades/meteora/prepare", { station: 5, mint: CHALLENGE_WALLET, budgetUsdc: "10" }, "")).statusCode).toBe(401);
  expect((await request("/v1/trades/wallet/challenge", { wallet: CHALLENGE_WALLET }, "", "https://attacker.invalid")).statusCode).toBe(403);
  // Without the application's Zod handler Fastify reports schema exceptions as 500; no request reaches storage.
  await request("/v1/trades/meteora/prepare", { station: 8, mint: CHALLENGE_WALLET, budgetUsdc: "10" });
  await request("/v1/trades/meteora/prepare", { station: 5, mint: CHALLENGE_WALLET, budgetUsdc: "11" });
  expect(created).toBe(0);
  expect((await request("/v1/trades/meteora/prepare", { station: 5, mint: "AqCA9WUnMD5a1WetTvGiqyfns5AVyua6gXSzcJgduYCk", budgetUsdc: "10" })).statusCode).toBe(200);
  expect(created).toBe(1); expect((await request("/v1/trades/execute", {})).statusCode).toBe(404);
  await app.close();
});
it("recovery mode blocks old ready entry plans from reaching signing claims",async()=>{
 const app=Fastify();let begun=0;const store={authorized:async()=>true,begin:async()=>{begun++;}} as unknown as TradeStore;
 registerTradeRoutes(app,null,"https://belac.fun",store,true);
 const r=await app.inject({method:"POST",url:"/v1/trades/meteora/00000000-0000-4000-8000-000000000001/begin",headers:{origin:"https://belac.fun",authorization:"Bearer owner"},payload:{}});
 expect(r.statusCode).toBe(403);expect(begun).toBe(0);await app.close();
});
