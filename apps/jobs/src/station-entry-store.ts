import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import type pg from "pg";
import {CHALLENGE_WALLET} from "../../../packages/contracts/src/trades.js";
import type {EntryStation,StationEntryAttempt,StationEntryPlan,StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
type Row={id:string;wallet:string;station_id:EntryStation;state:StationEntryAttempt["state"];created_at:Date;plan:StationEntryPlan|null;signature:string|null;receipt:StationEntryReceipt|null;error:string|null};
const from=(r:Row):StationEntryAttempt=>({id:r.id,wallet:r.wallet,stationId:r.station_id,state:r.state,createdAt:r.created_at.toISOString(),plan:r.plan,signature:r.signature,receipt:r.receipt,error:r.error});
/** Reserves one owner-reviewed message across all new entry stations. Never receives signed bytes. */
export class StationEntryStore {
 constructor(readonly pool:pg.Pool,readonly wallet=CHALLENGE_WALLET){}
 async setup(){await this.pool.query(await readFile(new URL("../../../packages/db/drizzle/0011_station_entries.sql",import.meta.url),"utf8"));}
 async list(){return (await this.pool.query<Row>("select * from station_entry_attempts where wallet=$1 order by created_at desc limit 60",[this.wallet])).rows.map(from);}
 async get(id:string){const r=(await this.pool.query<Row>("select * from station_entry_attempts where id=$1 and wallet=$2",[id,this.wallet])).rows[0];return r?from(r):null;}
 async create(stationId:EntryStation,mint?:string){
  assert([1,6,8].includes(stationId));assert.equal(stationId===8,!!mint,"Only Orca requires a browser position mint");
  const id=randomUUID(),c=await this.pool.connect();
  try{await c.query("begin");await c.query("select pg_advisory_xact_lock(hashtext($1))",["station-entries:"+this.wallet]);
   assert(!(await c.query("select 1 from wallet_trade_attempts where wallet=$1 and state in ('queued','preparing','ready','awaiting_submission','submitted','confirmed','unknown') limit 1",[this.wallet])).rowCount,"Meteora review needs reconciliation first");
   // Only never-signed reviews can be replaced. Ambiguous signatures retain the lock.
   await c.query("update station_entry_attempts set state='expired',updated_at=now() where wallet=$1 and ((state='ready' and (plan->>'expiresAt')::timestamptz<now()) or (state='preparing' and updated_at<now()-interval '2 minutes'))",[this.wallet]);
   assert(!(await c.query("select 1 from station_entry_attempts where wallet=$1 and station_id=$2 and state='confirmed'",[this.wallet,stationId])).rowCount,"This station already has a verified entry");
   await c.query("insert into station_entry_attempts(id,wallet,station_id,mint,state) values($1,$2,$3,$4,'preparing')",[id,this.wallet,stationId,mint??null]);await c.query("commit");
  }catch(e){await c.query("rollback");throw e;}finally{c.release();}return (await this.get(id))!;
 }
 async publish(id:string,plan:StationEntryPlan){
  assert.equal(plan.wallet,this.wallet);assert.equal(plan.budgetUsdcAtoms,"10000000");assert(BigInt(plan.maxSpendUsdcAtoms)>0n&&BigInt(plan.maxSpendUsdcAtoms)<=10000000n);
  // Wallet USDC includes the unspent portion of active allocations. It is not all unallocated capital.
  const meteora=(await this.pool.query("select receipt from wallet_trade_attempts where wallet=$1 and state='reconciled' and receipt is not null",[this.wallet])).rows;
  const others=await this.receipts();
  const assigned=[...meteora.map(r=>r.receipt as {spentUsdcAtoms:string}),...others];
  const reserved=assigned.reduce((n,r)=>{const spent=BigInt(r.spentUsdcAtoms);assert(spent>0n&&spent<=10000000n);return n+10000000n-spent;},0n);
  assert(BigInt(plan.before.usdcAtoms)-reserved>=10000000n,"Preserve cash already assigned to active stations");
  const r=await this.pool.query("update station_entry_attempts set state='ready',plan=$3,updated_at=now() where id=$1 and wallet=$2 and station_id=$4 and state='preparing' returning id",[id,this.wallet,plan,plan.stationId]);assert.equal(r.rowCount,1,"Preparation was replaced or expired");
 }
 async preparationFailed(id:string){await this.pool.query("update station_entry_attempts set state='failed',error='Fresh quote or simulation failed validation. Nothing was submitted.',updated_at=now() where id=$1 and wallet=$2 and state='preparing'",[id,this.wallet]);}
 async begin(id:string,hash:string){const r=await this.pool.query("update station_entry_attempts set state='signing',updated_at=now() where id=$1 and wallet=$2 and state='ready' and plan->>'messageHash'=$3 and (plan->>'expiresAt')::timestamptz>now() returning id",[id,this.wallet,hash]);assert.equal(r.rowCount,1,"Review expired, changed or already claimed");}
 async register(id:string,signature:string,hash:string){const r=await this.pool.query("update station_entry_attempts set state='submitted',signature=$3,updated_at=now() where id=$1 and wallet=$2 and state in ('signing','submitted','unknown') and plan->>'messageHash'=$4 and (signature is null or signature=$3) returning id",[id,this.wallet,signature,hash]);assert.equal(r.rowCount,1,"Attempt cannot accept this signature");}
 async cancel(id:string){return (await this.pool.query("update station_entry_attempts set state='cancelled',updated_at=now() where id=$1 and wallet=$2 and state in ('preparing','ready')",[id,this.wallet])).rowCount===1;}
 async pending(){return (await this.pool.query<Row>("select * from station_entry_attempts where wallet=$1 and state in ('signing','submitted','unknown') order by created_at",[this.wallet])).rows.map(from);}
 async mark(id:string,state:"unknown"|"expired"|"failed",error:string|null=null){await this.pool.query("update station_entry_attempts set state=$3,error=$4,updated_at=now() where id=$1 and wallet=$2 and state in ('signing','submitted','unknown')",[id,this.wallet,state,error]);}
 async confirm(id:string,receipt:StationEntryReceipt){assert.equal(receipt.wallet,this.wallet);const r=await this.pool.query("update station_entry_attempts set state='confirmed',receipt=$3,error=null,updated_at=now() where id=$1 and wallet=$2 and station_id=$4 and signature=$5 and state in ('submitted','unknown') returning id",[id,this.wallet,receipt,receipt.stationId,receipt.signature]);assert.equal(r.rowCount,1);}
 async receipts():Promise<StationEntryReceipt[]>{return (await this.pool.query("select receipt from station_entry_attempts where wallet=$1 and state='confirmed' and receipt is not null",[this.wallet])).rows.map(r=>r.receipt);}
}
