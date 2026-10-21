import type {FastifyInstance} from "fastify";
import {z} from "zod";
import type {TradeStore} from "../../jobs/src/trade-store.js";
import type {RecoveryStore} from "../../jobs/src/recovery-store.js";
import {RECOVERY_SOURCE} from "../../../packages/contracts/src/recovery.js";
type Store=Pick<RecoveryStore,"inventory"|"latest"|"history"|"prepare"|"begin"|"register"|"read"> & {setup?:()=>Promise<void>};
export function registerRecoveryRoutes(app:FastifyInstance,auth:Pick<TradeStore,"authorized">|null,store:Store|null,allowedOrigins:string){
 const origins=allowedOrigins.split(",").map(s=>s.trim());
 app.register(async instance=>{
  instance.addHook("onRequest",async(req,reply)=>{
   reply.header("Cache-Control","private, no-store");const origin=req.headers.origin;
   if(!origin||!origins.includes(origin))return reply.code(403).send({error:"Origin not allowed"});
   if(!store||!auth)return reply.code(503).send({error:"Recovery unavailable"});
   if(!await auth.authorized(origin,req.headers.authorization?.replace(/^Bearer /,"")??""))return reply.code(401).send({error:"Connect and authenticate the old challenge wallet"});
   await store.setup?.();
  });
  instance.get("/v1/recovery/status",async()=>({data:{inventory:await store!.inventory(),attempt:await store!.latest(),history:await store!.history()}}));
  instance.post("/v1/recovery/read",async(req)=>{
   const body=z.discriminatedUnion("method",[
    z.object({method:z.literal("getBlockHeight"),params:z.tuple([z.object({commitment:z.enum(["confirmed","finalized"])}).strict()])}).strict(),
    z.object({method:z.literal("getTokenAccountsByOwner"),params:z.tuple([z.literal(RECOVERY_SOURCE),z.object({programId:z.enum(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"])}).strict(),z.object({encoding:z.literal("base64"),commitment:z.literal("confirmed"),minContextSlot:z.number().int().positive()}).strict()])}).strict(),
   ]).parse(req.body);return {data:await store!.read(body.method,body.params)};
  });
  instance.post("/v1/recovery/prepare",async(req,reply)=>{z.object({}).strict().parse(req.body);try{return {data:await store!.prepare()};}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:"Simulation unavailable"});}});
  instance.post("/v1/recovery/:id/begin",async(req,reply)=>{
   const id=z.string().uuid().parse((req.params as {id:string}).id),body=z.object({messageHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);
   try{await store!.begin(id,body.messageHash);return {data:{accepted:true}};}catch{return reply.code(409).send({error:"Plan expired or already claimed. Refresh status before retrying."});}
  });
  instance.post("/v1/recovery/:id/signature",async(req,reply)=>{
   const id=z.string().uuid().parse((req.params as {id:string}).id),body=z.object({signature:z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/),messageHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);
   try{await store!.register(id,body.signature,body.messageHash);return {data:{accepted:true}};}catch{return reply.code(409).send({error:"Attempt cannot accept this signature"});}
  });
 });
}
