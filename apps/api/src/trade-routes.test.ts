import { expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerTradeRoutes } from "./trade-routes.js";
import type { TradeStore } from "../../jobs/src/trade-store.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import {RECOVERY_SOURCE} from "../../../packages/contracts/src/recovery.js";
it("relays only authenticated block-height reads and never a transaction or caller-chosen RPC",async()=>{
 const app=Fastify();const fetcher=vi.fn(async(input:unknown)=>{expect(input).toBe("https://api.mainnet-beta.solana.com");return new Response(JSON.stringify({result:12345}));});vi.stubGlobal("fetch",fetcher);
 try{registerTradeRoutes(app,null,"https://belac.fun",{authorized:async(_o:string,t:string)=>t==="owner"} as unknown as TradeStore);
 const request=(payload:object,token="owner")=>app.inject({method:"POST",url:"/v1/trades/read",headers:{origin:"https://belac.fun",authorization:`Bearer ${token}`},payload});
 expect((await request({method:"getBlockHeight",params:[{commitment:"confirmed"}]},"")).statusCode).toBe(401);
 await request({method:"sendTransaction",params:["wire"]});await request({method:"getBlockHeight",params:[{commitment:"confirmed"}],url:"https://other.invalid"});expect(fetcher).not.toHaveBeenCalled();
 expect((await request({method:"getBlockHeight",params:[{commitment:"confirmed"}]})).json().data).toBe(12345);expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.mainnet-beta.solana.com");
 }finally{await app.close();vi.unstubAllGlobals();}
});
it("issues trade logins only for the new wallet and keeps preparation disabled by default",async()=>{
 const app=Fastify();let challenges=0,created=0;
 const store={authorized:async()=>true,challenge:async()=>{challenges++;return {wallet:CHALLENGE_WALLET};},create:async()=>{created++;}} as unknown as TradeStore;
 registerTradeRoutes(app,null,"https://belac.fun",store);
 const request=(url:string,payload?:object)=>app.inject({method:payload?"POST":"GET",url,headers:{origin:"https://belac.fun",authorization:"Bearer owner"},payload});
 expect((await request("/v1/trades/wallet/challenge",{wallet:CHALLENGE_WALLET})).statusCode).toBe(200);
 await request("/v1/trades/wallet/challenge",{wallet:RECOVERY_SOURCE});expect(challenges).toBe(1);
 const status=(await request("/v1/trades/status")).json().data;expect(status).toMatchObject({wallet:CHALLENGE_WALLET,budgetUsdc:"10",preparationEnabled:false,automatedExecutionEnabled:false,feePoolSeparate:true});
 expect((await request("/v1/trades/meteora/prepare",{station:5,mint:"AqCA9WUnMD5a1WetTvGiqyfns5AVyua6gXSzcJgduYCk",budgetUsdc:"10"})).statusCode).toBe(403);expect(created).toBe(0);await app.close();
});
it("only offers owner-authorized Meteora preparation and never server execution", async () => {
  const app = Fastify(); let created = 0;
  const store = { authorized: async (_origin: string, token: string) => token === "owner", challenge: async () => ({ id: "challenge" }), create: async () => { created++; return { state: "queued" }; }, latest: async () => null } as unknown as TradeStore;
  registerTradeRoutes(app, null, "http://localhost:5186", store,false,true);
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
