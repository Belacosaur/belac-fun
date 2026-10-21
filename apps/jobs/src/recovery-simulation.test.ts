import {expect,it} from "vitest";
import {simulateRecoveryAccounts} from "../../../packages/contracts/src/recovery-simulation.js";
import type {TradeRpc} from "./trade-rpc.js";
it("simulates the same unsigned transaction in batches of at most five account results, preserving order and context",async()=>{
 const requests:{wire:string;keys:string[];slot:number}[]=[];
 const rpc=(async(_method,params)=>{const opts=params[1] as {accounts:{addresses:string[]};minContextSlot:number};requests.push({wire:params[0] as string,keys:opts.accounts.addresses,slot:opts.minContextSlot});expect(opts.accounts.addresses.length).toBeLessThanOrEqual(5);return {context:{slot:opts.minContextSlot+1},value:{err:null,accounts:opts.accounts.addresses.map(address=>({address})),logs:[]}};}) as TradeRpc;
 const keys=Array.from({length:12},(_,i)=>String(i));const result=await simulateRecoveryAccounts(rpc,"unsigned-wire",keys,100,20);
 expect(result.value.accounts).toEqual(keys.map(address=>({address})));expect(requests.map(r=>r.keys.length)).toEqual([5,5,2]);expect(requests.map(r=>r.slot)).toEqual([100,101,102]);expect(requests.every(r=>r.wire==="unsigned-wire")).toBe(true);
});
it("fails closed on any failed, truncated or stale simulation batch",async()=>{
 for(const problem of ["err","missing","stale"]){
  let n=0;const rpc=(async(_m,params)=>{const opts=params[1] as {accounts:{addresses:string[]};minContextSlot:number};n++;return {context:{slot:problem==="stale"&&n===2?99:101+n},value:{err:problem==="err"&&n===2?"failed":null,accounts:problem==="missing"&&n===2?[]:opts.accounts.addresses.map(()=>null),logs:[]}};}) as TradeRpc;
  await expect(simulateRecoveryAccounts(rpc,"unsigned-wire",["a","b","c","d","e","f"],100,20)).rejects.toThrow();
 }
});
