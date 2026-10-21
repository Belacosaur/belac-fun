import type {StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
import type {StudioSnapshot,Observation,PlatformBalance} from "../../../packages/contracts/src/studio.js";
import {readSolEntry} from "./entry-sol.js";
import {readKaminoEntry} from "./entry-kamino.js";
import {readOrcaEntry} from "./entry-orca.js";
/** Called only after recovery is complete, with finalized receipts from the entry store. */
export async function applyStationEntryTracking(snapshot:StudioSnapshot,receipts:StationEntryReceipt[],endpoint:string,previous?:StudioSnapshot,now=snapshot.generatedAt):Promise<StudioSnapshot>{
 const seen=new Set<number>();for(const r of receipts){if(![1,6,8].includes(r.stationId)||r.wallet!==snapshot.address||r.plan.wallet!==snapshot.address||r.plan.stationId!==r.stationId||seen.has(r.stationId))throw Error("Entry receipt does not match migrated wallet and station");seen.add(r.stationId);}
 const byStation=new Map(receipts.map(r=>[r.stationId,r]));const readers={1:readSolEntry,6:readKaminoEntry,8:readOrcaEntry};
 const platforms=await Promise.all(snapshot.platforms.map(async p=>{const r=byStation.get(p.id as 1|6|8);if(!r)return p;
 const prior=previous?.address===snapshot.address&&previous.network===snapshot.network?previous.platforms.find(v=>v.id===p.id&&v.strategyKey===p.strategyKey&&v.provider===p.provider)?.observation:undefined;
 const validPrior=prior?.data?.performance?.entrySignature===r.signature?prior:undefined;let observation:Observation<PlatformBalance>;
 try{const data=await readers[r.stationId](r,endpoint,validPrior?.data?.performance,now);observation={status:data.status,checkedAt:now,lastSuccessAt:now,data:{...data,executionEnabled:false},message:data.detail};}
 catch{observation={status:"unavailable",checkedAt:now,lastSuccessAt:validPrior?.lastSuccessAt??null,data:validPrior?.data??{status:"unavailable",valueUsd:null,positionCount:null,executionEnabled:false,detail:"Position reconciliation unavailable · no live P&L shown"},message:"Source unavailable; retrying automatically. Displayed values are from the last successful sync."};}
 return {...p,observation};}));return {...snapshot,platforms};
}
