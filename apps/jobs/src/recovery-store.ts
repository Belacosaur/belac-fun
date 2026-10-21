import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type pg from "pg";
import * as k from "@solana/kit";
import { buildRecoveryPlan, recoveryInventory } from "./recovery.js";
import { tradeRpc } from "./trade-rpc.js";
import { RECOVERY_SOURCE, RECOVERY_DESTINATION, type RecoveryAttempt,type RecoveryPlan } from "../../../packages/contracts/src/recovery.js";
type Row = RecoveryAttempt & { receipt?: unknown; created_at: Date };
export function recoveryRent(plan:RecoveryPlan,keys:readonly string[],pre:number[],post:number[]){
 return plan.closedAccounts.reduce((sum,address)=>{
  const index=keys.indexOf(address);assert(index>=0);const refund=BigInt(pre[index]!)-BigInt(post[index]!);assert(refund>=0n);
  const account=plan.before.accounts.find(a=>a.address===address);
  if(account?.mint==="So11111111111111111111111111111111111111112"){assert(account.nativeRentLamports,"Native rent reserve missing");const rent=BigInt(account.nativeRentLamports);assert(refund>=rent);return sum+rent;}
  return sum+refund;
 },0n);
}
export class RecoveryStore {
  constructor(readonly pool: pg.Pool, readonly endpoint: string) {}
  async setup() { await this.pool.query(await readFile(new URL("../../../packages/db/drizzle/0010_wallet_recovery.sql",import.meta.url),"utf8")); }
  async inventory() { return recoveryInventory(this.endpoint); }
  async read(method:"getBlockHeight"|"getTokenAccountsByOwner",params:unknown[]){
    assert(["getBlockHeight","getTokenAccountsByOwner"].includes(method));
    if(method==="getTokenAccountsByOwner")assert.equal(params[0],RECOVERY_SOURCE);
    const response=await fetch("https://api.mainnet-beta.solana.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(20000)});
    const j=await response.json() as {error?:unknown;result:unknown};assert(response.ok&&!j.error,"Official mainnet read unavailable; retry later");return j.result;
  }
  async latest(): Promise<RecoveryAttempt | null> {
    const a: Row | undefined = (await this.pool.query("select id,state,plan,signature,error,created_at from wallet_recovery_attempts where wallet=$1 order by created_at desc limit 1",[RECOVERY_SOURCE])).rows[0];
    if(a?.state==="preparing"&&Date.now()-a.created_at.getTime()>120000){await this.pool.query("update wallet_recovery_attempts set state='expired',updated_at=now() where id=$1 and state='preparing'",[a.id]);return {...a,state:"expired"};}
    if(!a?.plan || !["signing","submitted"].includes(a.state)) return a ?? null;
    const rpc=tradeRpc(this.endpoint);
    if(a.signature){
      const tx=await rpc<{transaction:[string,string];meta:{err:unknown;fee:number;preBalances:number[];postBalances:number[];preTokenBalances:{accountIndex:number;mint:string;uiTokenAmount:{amount:string}}[]};slot:number}|null>("getTransaction",[a.signature,{encoding:"base64",commitment:"finalized",maxSupportedTransactionVersion:0}]);
      if(tx){
        const decoded=k.getTransactionDecoder().decode(Buffer.from(tx.transaction[0],"base64"));
        assert.equal(createHash("sha256").update(new Uint8Array(decoded.messageBytes)).digest("hex"),a.plan.messageHash,"Finalized message differs from reviewed recovery");
        assert.equal(k.getSignatureFromTransaction(decoded),a.signature);
        const state=tx.meta.err?"failed":"confirmed";
        const compiled=k.getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
        const rent=tx.meta.err?0n:recoveryRent(a.plan,compiled.staticAccounts,tx.meta.preBalances,tx.meta.postBalances);
        await this.pool.query("update wallet_recovery_attempts set state=$2,receipt=$3,error=$4,updated_at=now() where id=$1 and state='submitted'",[a.id,state,{signature:a.signature,slot:tx.slot,feeLamports:String(tx.meta.fee),rentRecoveredLamports:rent.toString(),messageHash:a.plan.messageHash,step:a.plan.step},tx.meta.err?JSON.stringify(tx.meta.err):null]);
        return {...a,state,error:tx.meta.err?"Transaction failed on chain. Review the refreshed inventory before retrying.":null};
      }
    }
    // Publicnode's observed getBlockHeight response was a slot, not a block height.
    // Lifetime decisions use the independently checked official mainnet endpoint.
    const height=await tradeRpc("https://api.mainnet-beta.solana.com")<number>("getBlockHeight",[{commitment:"finalized"}]);
    if(BigInt(height)>BigInt(a.plan.lastValidBlockHeight)+32n){
      // Historical lookup can lag. A known successful signature remains reserved until its receipt is available.
      if(a.signature){ const s=await rpc<{value:({err:unknown;confirmationStatus:string}|null)[]}>("getSignatureStatuses",[[a.signature],{searchTransactionHistory:true}]); if(s.value[0]) return a; }
      await this.pool.query("update wallet_recovery_attempts set state='expired',updated_at=now() where id=$1 and state in ('signing','submitted')",[a.id]);return {...a,state:"expired"};
    }
    return a;
  }
  async prepare(): Promise<RecoveryAttempt> {
    await this.latest();
    const id=randomUUID(), c=await this.pool.connect();
    try{
      await c.query("begin");await c.query("select pg_advisory_xact_lock(hashtext($1))",["wallet-recovery:"+RECOVERY_SOURCE]);
      const pending=await c.query("select 1 from wallet_trade_attempts where wallet=$1 and state in ('awaiting_submission','submitted','confirmed','unknown','reconciled') limit 1",[RECOVERY_SOURCE]);
      assert(!pending.rowCount,"An entry transaction or Meteora position needs reconciliation before recovery");
      await c.query("update wallet_trade_attempts set state='cancelled',updated_at=now() where wallet=$1 and state in ('queued','preparing','ready')",[RECOVERY_SOURCE]);
      await c.query("update wallet_recovery_attempts set state='expired',updated_at=now() where wallet=$1 and (state='ready' or (state='preparing' and created_at<now()-interval '2 minutes'))",[RECOVERY_SOURCE]);
      await c.query("insert into wallet_recovery_attempts(id,wallet,destination,state) values($1,$2,$3,'preparing')",[id,RECOVERY_SOURCE,RECOVERY_DESTINATION]);await c.query("commit");
    }catch(e){await c.query("rollback");throw e;}finally{c.release();}
    try{const plan=await buildRecoveryPlan(id,this.endpoint);const published=await this.pool.query("update wallet_recovery_attempts set state='ready',plan=$2,updated_at=now() where id=$1 and state='preparing'",[id,plan]);assert.equal(published.rowCount,1,"Preparation lease expired; refresh");return {id,state:"ready",plan,signature:null,error:null};}
    catch(e){const error=e instanceof Error?e.message:"Recovery simulation unavailable";await this.pool.query("update wallet_recovery_attempts set state='failed',error=$2,updated_at=now() where id=$1",[id,error]);throw e;}
  }
  async begin(id:string,hash:string){
    const r=await this.pool.query("update wallet_recovery_attempts set state='signing',updated_at=now() where id=$1 and wallet=$2 and state='ready' and plan->>'messageHash'=$3 and (plan->>'expiresAt')::timestamptz>now() returning id",[id,RECOVERY_SOURCE,hash]);assert.equal(r.rowCount,1,"Plan expired, changed or already claimed");
  }
  async register(id:string,signature:string,hash:string){
    const r=await this.pool.query("update wallet_recovery_attempts set state='submitted',signature=$3,updated_at=now() where id=$1 and wallet=$2 and state in ('signing','submitted') and (signature is null or signature=$3) and plan->>'messageHash'=$4 returning id",[id,RECOVERY_SOURCE,signature,hash]);assert.equal(r.rowCount,1,"Attempt cannot accept this signature");
  }
  async history(){return (await this.pool.query("select id,state,plan->>'step' as step,signature,receipt,created_at from wallet_recovery_attempts where wallet=$1 order by created_at",[RECOVERY_SOURCE])).rows;}
  async started(){return !!(await this.pool.query("select 1 from wallet_recovery_attempts where wallet=$1 and state='confirmed' limit 1",[RECOVERY_SOURCE])).rowCount;}
  async completed(){return !!(await this.pool.query("select 1 from wallet_recovery_attempts where wallet=$1 and state='confirmed' and plan->>'step'='sweep' limit 1",[RECOVERY_SOURCE])).rowCount;}
}
