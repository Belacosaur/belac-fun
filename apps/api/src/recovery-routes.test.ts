import {expect,it} from "vitest";
import Fastify from "fastify";
import {registerRecoveryRoutes} from "./recovery-routes.js";
import type {RecoveryStore} from "../../jobs/src/recovery-store.js";
it("requires owner authentication and allowed origin, rejects arbitrary destinations and has no server execution route",async()=>{
 const app=Fastify();let prepared=0;
 registerRecoveryRoutes(app,{authorized:async (_o:string,t:string)=>t==="owner"}, {inventory:async()=>({next:"orca"}),latest:async()=>null,history:async()=>[],prepare:async()=>{prepared++;return {id:"x"};},begin:async()=>{},register:async()=>{}} as unknown as RecoveryStore,"https://belac.fun");
 const req=(url:string,body:object,token="owner",origin="https://belac.fun")=>app.inject({method:"POST",url,headers:{origin,authorization:`Bearer ${token}`},payload:body});
 expect((await req("/v1/recovery/prepare",{},"")).statusCode).toBe(401);
 expect((await req("/v1/recovery/prepare",{},"owner","https://attacker.invalid")).statusCode).toBe(403);
 await req("/v1/recovery/prepare",{destination:"attacker"});expect(prepared).toBe(0);
 expect((await req("/v1/recovery/prepare",{})).statusCode).toBe(200);expect(prepared).toBe(1);
 expect((await req("/v1/recovery/execute",{})).statusCode).toBe(404);await app.close();
});
it("the read relay never accepts broadcast methods or an arbitrary wallet",async()=>{
 const app=Fastify();let reads=0;const store={setup:async()=>{},read:async()=>{reads++;return 123;}} as unknown as RecoveryStore;
 registerRecoveryRoutes(app,{authorized:async()=>true},store,"https://belac.fun");
 const req=(payload:object)=>app.inject({method:"POST",url:"/v1/recovery/read",headers:{origin:"https://belac.fun",authorization:"Bearer owner"},payload});
 await req({method:"sendTransaction",params:["signed-wire"]});await req({method:"getTokenAccountsByOwner",params:["attacker",{programId:"token"},{}]});expect(reads).toBe(0);
 expect((await req({method:"getBlockHeight",params:[{commitment:"confirmed"}]})).statusCode).toBe(200);expect(reads).toBe(1);await app.close();
});
