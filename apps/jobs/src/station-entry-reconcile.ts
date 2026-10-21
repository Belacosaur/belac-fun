import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import * as k from "@solana/kit";
import {CHALLENGE_WALLET,TRADE_TOKEN_ACCOUNTS} from "../../../packages/contracts/src/trades.js";
import type {StationEntryPlan,StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
import type {ChainTransaction} from "./meteora-receipt.js";
import {StationEntryStore} from "./station-entry-store.js";
import {tradeRpc} from "./trade-rpc.js";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",SOL="So11111111111111111111111111111111111111112";
/** Bind finalized bytes and balance deltas to the one owner-reviewed message. */
export function verifyStationEntryReceipt(p:StationEntryPlan,signature:string,tx:ChainTransaction):StationEntryReceipt {
 assert.equal(p.wallet,CHALLENGE_WALLET);assert([1,6,8].includes(p.stationId));assert(tx.blockTime&&tx.slot>=p.slot);
 const decoded=k.getTransactionDecoder().decode(Buffer.from(tx.transaction[0],"base64"));
 assert.equal(k.getSignatureFromTransaction(decoded),signature);assert.equal(createHash("sha256").update(new Uint8Array(decoded.messageBytes)).digest("hex"),p.messageHash);
 const c=k.getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);assert.equal(c.staticAccounts[0],p.wallet);
 assert.equal(c.header.numSignerAccounts,p.stationId===8?2:1);
 const writable:string[]=[],readonly:string[]=[];
 if(c.version===0)for(const t of c.addressTableLookups??[]){const table=p.lookupTables[t.lookupTableAddress];assert(table);for(const i of t.writableIndexes){assert(table[i]);writable.push(table[i]!);}for(const i of t.readonlyIndexes){assert(table[i]);readonly.push(table[i]!);}}
 assert.deepEqual(tx.meta.loadedAddresses?.writable??[],writable);assert.deepEqual(tx.meta.loadedAddresses?.readonly??[],readonly);
 const keys:string[]=[...c.staticAccounts,...writable,...readonly],m=tx.meta;
 assert.equal(m.preBalances.length,keys.length);assert.equal(m.postBalances.length,keys.length);
 assert(Number.isSafeInteger(m.fee)&&m.fee>=5000&&String(m.fee)===p.feeLamports&&m.fee<=12000);
 const at=(rows:typeof m.preTokenBalances,key:string,mint:string,optional=false)=>{const row=rows.find(r=>r.accountIndex===keys.indexOf(key));if(!row){assert(optional,"Expected token balance missing");return 0n;}assert.equal(row.owner,p.wallet);assert.equal(row.mint,mint);assert(/^\d+$/.test(row.uiTokenAmount.amount));return BigInt(row.uiTokenAmount.amount);};
 if(m.err)throw new Error("Finalized entry failed");
 const untouchedWsol=p.stationId===6&&!keys.includes(TRADE_TOKEN_ACCOUNTS.wsol);
 const before=at(m.preTokenBalances,TRADE_TOKEN_ACCOUNTS.usdc,USDC),wrappedBefore=untouchedWsol?BigInt(p.before.wsolAtoms):at(m.preTokenBalances,TRADE_TOKEN_ACCOUNTS.wsol,SOL,true);
 assert.equal(String(before),p.before.usdcAtoms);assert.equal(String(wrappedBefore),p.before.wsolAtoms);assert.equal(String(m.preBalances[0]),p.before.nativeLamports);
 const spent=before-at(m.postTokenBalances,TRADE_TOKEN_ACCOUNTS.usdc,USDC),wrapped=untouchedWsol?0n:at(m.postTokenBalances,TRADE_TOKEN_ACCOUNTS.wsol,SOL,true)-wrappedBefore;
 assert(spent>0n&&spent<=10000000n&&spent<=BigInt(p.maxSpendUsdcAtoms));assert(wrapped>=0n,"Existing station WSOL cannot be spent");
 const rent=BigInt(m.preBalances[0]!)-BigInt(m.postBalances[0]!)-BigInt(m.fee);assert.equal(String(rent),p.rentLamports);assert(BigInt(m.postBalances[0]!)>=10000000n);
 const actualPlan:StationEntryPlan={...p,details:{...p.details}};
 if(p.stationId===1){assert.equal(spent,10000000n);assert(wrapped>=BigInt(String(p.details.minimumWsolAtoms)));actualPlan.details.acquiredWsolAtoms=String(wrapped);}
 if(p.stationId===6){assert.equal(spent,10000000n);assert.equal(wrapped,0n);const prior=at(m.preTokenBalances,p.accounts.collateralAta!,p.accounts.collateralMint!,true),after=at(m.postTokenBalances,p.accounts.collateralAta!,p.accounts.collateralMint!);assert.equal(String(prior),String(p.details.collateralBeforeAtoms));assert(after-prior>=BigInt(String(p.details.minReceiptAtoms)));actualPlan.details.receiptAtoms=String(after-prior);actualPlan.details.collateralAfterAtoms=String(after);}
 if(p.stationId===8){assert(p.mint&&p.accounts.position);const nft=p.accounts.nft??p.accounts.positionTokenAccount;assert(nft,"Missing position NFT account");assert.equal(at(m.postTokenBalances,nft,p.mint),1n);const i=keys.indexOf(p.accounts.position);assert(i>=0&&m.preBalances[i]===0&&m.postBalances[i]!>0);}
 return {wallet:p.wallet,stationId:p.stationId,signature,at:new Date(tx.blockTime*1000).toISOString(),slot:tx.slot,spentUsdcAtoms:String(spent),receivedWsolAtoms:String(wrapped),feeLamports:String(m.fee),rentLamports:String(rent),plan:actualPlan};
}
export async function reconcileStationEntries(store:StationEntryStore,endpoint:string){
 const rpc=tradeRpc(endpoint);
 for(const a of await store.pending()){
  if(!a.plan)continue;
  try{
   if(a.signature){
    const tx=await rpc<ChainTransaction|null>("getTransaction",[a.signature,{encoding:"base64",commitment:"finalized",maxSupportedTransactionVersion:0}]);
    if(tx){
     if(tx.meta.err){
      // Even a failed transaction must match the reviewed bytes before its fee is charged.
      const d=k.getTransactionDecoder().decode(Buffer.from(tx.transaction[0],"base64"));assert.equal(k.getSignatureFromTransaction(d),a.signature);assert.equal(createHash("sha256").update(new Uint8Array(d.messageBytes)).digest("hex"),a.plan.messageHash);assert(Number.isSafeInteger(tx.meta.fee)&&tx.meta.fee>0&&tx.meta.fee<=12000&&String(tx.meta.fee)===a.plan.feeLamports);
      await store.pool.query("insert into wallet_trade_fee_events(signature,wallet,lamports) values($1,$2,$3) on conflict do nothing",[a.signature,a.wallet,String(tx.meta.fee)]);await store.mark(a.id,"failed","Transaction failed on chain; network fee recorded separately.");
     }else await store.confirm(a.id,verifyStationEntryReceipt(a.plan,a.signature,tx));
     continue;
    }
   }
   const height=await tradeRpc("https://api.mainnet-beta.solana.com")<number>("getBlockHeight",[{commitment:"finalized"}]);
   if(BigInt(height)<=BigInt(a.plan.lastValidBlockHeight)+32n)continue;
   if(a.signature){const status=(await rpc<{value:unknown[]}>("getSignatureStatuses",[[a.signature],{searchTransactionHistory:true}])).value[0];if(status)continue;}
   // A balance or position change may be an unregistered fill. Keep its budget reserved.
   type Account={lamports:number;data:[string,string]};
   const keys=[a.wallet,TRADE_TOKEN_ACCOUNTS.usdc,TRADE_TOKEN_ACCOUNTS.wsol,...(a.plan.accounts.position?[a.plan.accounts.position]:[]),...(a.plan.stationId===6?[a.plan.accounts.collateralAta!]:[])];
   const result=await rpc<{value:(Account|null)[]}>("getMultipleAccounts",[keys,{encoding:"base64",commitment:"finalized",minContextSlot:a.plan.slot}]);
   const atoms=(account:Account|null|undefined)=>account?Buffer.from(account.data[0],"base64").readBigUInt64LE(64):0n;
   let unchanged=String(result.value[0]?.lamports)===a.plan.before.nativeLamports&&String(atoms(result.value[1]))===a.plan.before.usdcAtoms&&String(atoms(result.value[2]))===a.plan.before.wsolAtoms;
   if(a.plan.accounts.position)unchanged=unchanged&&result.value[3]===null;
   if(a.plan.stationId===6)unchanged=unchanged&&String(atoms(result.value.at(-1)))===String(a.plan.details.collateralBeforeAtoms);
   await store.mark(a.id,unchanged?"expired":"unknown",unchanged?null:"Wallet changed; receipt verification required before another entry.");
  }catch{await store.mark(a.id,"unknown","Awaiting verified chain reconciliation. Do not repeat this trade.");}
 }
}
