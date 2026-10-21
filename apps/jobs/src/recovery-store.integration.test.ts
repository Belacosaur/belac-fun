import {beforeAll,afterAll,afterEach,beforeEach,expect,it,vi} from "vitest";
import {PostgreSqlContainer,type StartedPostgreSqlContainer} from "@testcontainers/postgresql";
import pg from "pg";
import {readFile} from "node:fs/promises";
import {RecoveryStore} from "./recovery-store.js";
import {RECOVERY_SOURCE,RECOVERY_DESTINATION} from "../../../packages/contracts/src/recovery.js";
let container:StartedPostgreSqlContainer,pool:pg.Pool,store:RecoveryStore;
const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));
beforeAll(async()=>{container=await new PostgreSqlContainer("postgres:16-alpine").start();pool=new pg.Pool({connectionString:container.getConnectionUri(),max:4});store=new RecoveryStore(pool,"https://solana-rpc.publicnode.com");await store.setup();},120000);
afterAll(async()=>{await pool?.end();await container?.stop();},30000);
beforeEach(async()=>{await pool.query("truncate wallet_recovery_attempts");});
afterEach(()=>vi.unstubAllGlobals());
async function ready(){const p={...fixture.plan,expiresAt:new Date(Date.now()+45000).toISOString()};await pool.query("insert into wallet_recovery_attempts(id,wallet,destination,state,plan) values($1,$2,$3,'ready',$4)",[p.id,RECOVERY_SOURCE,RECOVERY_DESTINATION,p]);return p;}
it("serializes begin and reserves possibly signed attempts while permitting idempotent registration",async()=>{
 const p=await ready(),results=await Promise.allSettled([store.begin(p.id,p.messageHash),store.begin(p.id,p.messageHash)]);expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);
 await expect(pool.query("insert into wallet_recovery_attempts(id,wallet,destination,state) values(gen_random_uuid(),$1,$2,'preparing')",[RECOVERY_SOURCE,RECOVERY_DESTINATION])).rejects.toMatchObject({code:"23505"});
 await store.register(p.id,"signature-a",p.messageHash);await store.register(p.id,"signature-a",p.messageHash);
 await expect(store.register(p.id,"signature-b",p.messageHash)).rejects.toThrow();
 expect((await store.history())[0]?.state).toBe("submitted");
});
it("rejects changed hashes and expired reviews without claiming the attempt",async()=>{
 const p=await ready();await expect(store.begin(p.id,"0".repeat(64))).rejects.toThrow();
 await pool.query("update wallet_recovery_attempts set plan=jsonb_set(plan,'{expiresAt}',to_jsonb('2000-01-01T00:00:00Z'::text))");await expect(store.begin(p.id,p.messageHash)).rejects.toThrow();
 expect((await store.history())[0]?.state).toBe("ready");
});
it("does not expire a signing reservation from the provider's misreported slot-as-height",async()=>{
 const p=await ready();await store.begin(p.id,p.messageHash);const endpoints:string[]=[];
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>{endpoints.push(url);return new Response(JSON.stringify({result:url.includes("api.mainnet-beta")?Number(p.lastValidBlockHeight)-1:459999999}));}));
 expect((await store.latest())?.state).toBe("signing");expect(endpoints).toEqual(["https://api.mainnet-beta.solana.com"]);
});
it("recovers a crashed preparation lease and retains finalized sweep completion after later failed requests",async()=>{
 const p=await ready();await pool.query("update wallet_recovery_attempts set state='preparing',plan=null,created_at=now()-interval '3 minutes'");
 expect((await store.latest())?.state).toBe("expired");
 await pool.query("update wallet_recovery_attempts set state='confirmed',plan=$1",[{...p,step:"sweep"}]);
 await pool.query("insert into wallet_recovery_attempts(id,wallet,destination,state) values(gen_random_uuid(),$1,$2,'failed')",[RECOVERY_SOURCE,RECOVERY_DESTINATION]);
 expect(await store.completed()).toBe(true);
});
