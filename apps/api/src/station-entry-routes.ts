import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { StationEntryStore } from "../../jobs/src/station-entry-store.js";
import { TradeStore } from "../../jobs/src/trade-store.js";
import { buildSolEntry } from "../../jobs/src/entry-sol.js";
import { buildKaminoEntry } from "../../jobs/src/entry-kamino.js";
import { buildOrcaEntry } from "../../jobs/src/entry-orca.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import { ENTRY_PROPOSALS, ENTRY_RESEARCH } from "../../../packages/contracts/src/entry-proposals.js";
type Store=Pick<StationEntryStore,"list"|"get"|"create"|"publish"|"preparationFailed"|"begin"|"register"|"cancel">;
export interface EntryRouteOverrides {store?:Store;authorized?:TradeStore["authorized"];buildSol?:typeof buildSolEntry;buildKamino?:typeof buildKaminoEntry;buildOrca?:typeof buildOrcaEntry;reconcile?:(store:Store,endpoint:string)=>Promise<unknown>}
const key=z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),idSchema=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/),beginBody=z.object({messageHash:hash}).strict();
const prepareBody=z.discriminatedUnion("stationId",[z.object({stationId:z.literal(1),budgetUsdc:z.literal("10")}).strict(),z.object({stationId:z.literal(6),budgetUsdc:z.literal("10")}).strict(),z.object({stationId:z.literal(8),budgetUsdc:z.literal("10"),mint:key}).strict()]);
/** Owner-authenticated review preparation and signature tracking. No transaction submission endpoint. */
export function registerStationEntryRoutes(app:FastifyInstance,pool:pg.Pool|null,allowedOrigins:string,endpoint:string,apiKey?:string,enabled=false,recoveryMode=false,overrides:EntryRouteOverrides={}) {
 const store=overrides.store??(pool?new StationEntryStore(pool):null),trade=pool?new TradeStore(pool):null,auth=overrides.authorized??trade?.authorized.bind(trade),origins=allowedOrigins.split(",").map(s=>s.trim()).filter(Boolean);
 const active=enabled&&!recoveryMode,builders={1:overrides.buildSol??buildSolEntry,6:overrides.buildKamino??buildKaminoEntry,8:overrides.buildOrca??buildOrcaEntry};
 let schema:Promise<void>|undefined;
 async function ensureSchema(){if(store instanceof StationEntryStore){schema??=store.setup().catch(e=>{schema=undefined;throw e;});await schema;}}
 async function reconcile(){if(overrides.reconcile)await overrides.reconcile(store!,endpoint);else if(store instanceof StationEntryStore){const {reconcileStationEntries}=await import("../../jobs/src/station-entry-reconcile.js");await reconcileStationEntries(store,endpoint);}}
 app.register(async instance=>{
  instance.addHook("onRequest",async(req,reply)=>{reply.header("Cache-Control","private, no-store");const origin=req.headers.origin;if(!origin||!origins.includes(origin))return reply.code(403).send({error:"Origin not allowed"});if(!store||!auth)return reply.code(503).send({error:"Entry preparation is unavailable"});const token=/^Bearer (\S+)$/.exec(req.headers.authorization??"")?.[1]??"";if(!await auth(origin,token))return reply.code(401).send({error:"Connect and authenticate the challenge wallet"});try{await ensureSchema();}catch{return reply.code(503).send({error:"Entry preparation storage is temporarily unavailable"});}});
  instance.get("/v1/entries",async(_req,reply)=>{try{await reconcile();return {data:{wallet:CHALLENGE_WALLET,enabled:active,automatedExecutionEnabled:false,proposals:ENTRY_PROPOSALS,research:ENTRY_RESEARCH,attempts:await store!.list()}};}catch{return reply.code(503).send({error:"Entry history is temporarily unavailable"});}});
  instance.post("/v1/entries/prepare",async(req,reply)=>{
   if(!active)return reply.code(403).send({error:"Entry preparation is disabled"});const parsed=prepareBody.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:"Expected station 1, 6 or 8 and exactly 10 USDC; only Orca requires a position mint"});const b=parsed.data,mint="mint" in b?b.mint:undefined;
   if(mint&&[CHALLENGE_WALLET,"So11111111111111111111111111111111111111112","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].includes(mint))return reply.code(400).send({error:"Invalid position mint"});
   let attempt;try{await reconcile();attempt=await store!.create(b.stationId,mint);}catch{return reply.code(409).send({error:"An existing review or position requires reconciliation before another entry"});}
   try{const plan=await builders[b.stationId]({wallet:CHALLENGE_WALLET,stationId:b.stationId,...(mint?{mint}:{})},endpoint,apiKey);await store!.publish(attempt.id,plan);return {data:await store!.get(attempt.id)};}catch{try{await store!.preparationFailed(attempt.id);}catch{/* A failed persistence write must not expose RPC or database details. */}return reply.code(503).send({error:"Fresh quote or simulation failed validation. Nothing was submitted."});}
  });
  instance.post("/v1/entries/:id/begin",async(req,reply)=>{if(!active)return reply.code(403).send({error:"Entry signatures are disabled"});const id=idSchema.safeParse((req.params as {id:string}).id),b=beginBody.safeParse(req.body);if(!id.success||!b.success)return reply.code(400).send({error:"Invalid review claim"});try{await store!.begin(id.data,b.data.messageHash);return {data:await store!.get(id.data)};}catch{return reply.code(409).send({error:"Review expired, changed or already claimed"});}});
  instance.post("/v1/entries/:id/signature",async(req,reply)=>{const id=idSchema.safeParse((req.params as {id:string}).id),b=z.object({messageHash:hash,signature:z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/)}).strict().safeParse(req.body);if(!id.success||!b.success)return reply.code(400).send({error:"Invalid signature registration"});const a=await store!.get(id.data);if(!a?.plan||a.plan.messageHash!==b.data.messageHash)return reply.code(409).send({error:"Reviewed message differs from attempt"});try{await store!.register(id.data,b.data.signature,b.data.messageHash);return {data:await store!.get(id.data)};}catch{return reply.code(409).send({error:"Attempt cannot accept this signature"});}});
  instance.post("/v1/entries/:id/cancel",async(req,reply)=>{const id=idSchema.safeParse((req.params as {id:string}).id);if(!id.success||!z.object({}).strict().safeParse(req.body??{}).success)return reply.code(400).send({error:"Invalid cancellation request"});if(!await store!.cancel(id.data))return reply.code(409).send({error:"Attempt may be signed or submitted. Waiting for chain reconciliation."});return {data:await store!.get(id.data)};});
 });
}
