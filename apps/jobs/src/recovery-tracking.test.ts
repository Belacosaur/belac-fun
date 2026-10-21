import {expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import {applyRecoveryTracking} from "./recovery-tracking.js";
import type {StudioSnapshot} from "../../../packages/contracts/src/studio.js";
it("shows a newly approved Meteora position after migration without reviving old positions",()=>{
 const snapshot={address:fixture.plan.destination,platforms:Array.from({length:10},(_,i)=>({id:i+1}))} as unknown as StudioSnapshot;
 const active={status:"ready",checkedAt:"now",lastSuccessAt:"now",message:"New owner-approved entry",data:{status:"ready",valueUsd:"9.99",positionCount:1,executionEnabled:false,detail:"Meteora"}} as const;
 const result=applyRecoveryTracking(snapshot,fixture.plan.after,true,{wallet:fixture.plan.destination,observation:active});
 expect(result.platforms.find(p=>p.id===5)?.observation.data?.positionCount).toBe(1);expect(result.platforms.filter(p=>p.id!==5).every(p=>p.observation.data?.closed)).toBe(true);
 expect(()=>applyRecoveryTracking(snapshot,fixture.plan.after,true,{wallet:fixture.plan.source,observation:active})).toThrow();
});
const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));
it("removes stale active positions and P&L after closure, preserving the recovery source and destination",()=>{
 const snapshot={version:1,address:fixture.plan.source,network:"mainnet-beta",generatedAt:"old",wallet:{},accounting:{data:{equityUsd:"100"}},platforms:[{id:8,observation:{data:{performance:{equityUsd:"10"}}}},{id:6,observation:{data:{performance:{equityUsd:"10"}}}}]} as unknown as StudioSnapshot;
 const result=applyRecoveryTracking(snapshot,fixture.plan.after,false);
 expect(result.accounting).toBeUndefined();expect(result.platforms[0]?.observation.data?.performance).toBeUndefined();expect(result.platforms[0]?.observation.data?.closed).toBe(true);
 expect(result.platforms[1]?.observation.data?.closed).toBe(false);expect(result.recovery?.inventory.destination).toBe(fixture.plan.destination);
});
it("marks all ten stations closed with zero allocations after recovery completes",()=>{
 const snapshot={version:1,address:fixture.plan.destination,network:"mainnet-beta",generatedAt:"old",wallet:{},platforms:Array.from({length:10},(_,i)=>({id:i+1,observation:{data:{performance:{equityUsd:"10"},positions:[{address:"old"}]}}}))} as unknown as StudioSnapshot;
 const inventory={...fixture.plan.after,orcaOpen:false,receiptAtoms:"0",usdcAtoms:"0",wsolAtoms:"0",sourceLamports:"0",openAccounts:0,accounts:[],next:"complete" as const};
 const result=applyRecoveryTracking(snapshot,inventory,true);
 expect(result.address).toBe(fixture.plan.destination);expect(result.recovery?.complete).toBe(true);
 for(const p of result.platforms){
  expect(p.observation.status).toBe("empty");expect(p.observation.data).toMatchObject({closed:true,valueUsd:"0",positionCount:0,executionEnabled:false});
  expect(p.observation.message).not.toContain("Recovery in progress");expect(p.observation.data?.performance).toBeUndefined();expect(p.observation.data?.positions).toBeUndefined();
 }
});
