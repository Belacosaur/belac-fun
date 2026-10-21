import type {StudioSnapshot,Observation,PlatformBalance} from "../../../packages/contracts/src/studio.js";
import type {RecoveryInventory} from "../../../packages/contracts/src/recovery.js";
export function applyRecoveryTracking(snapshot:StudioSnapshot,inventory:RecoveryInventory,complete:boolean,active?:{wallet:string;observation:Observation<PlatformBalance>}):StudioSnapshot{
 if(active&&(!complete||active.wallet!==inventory.destination||snapshot.address!==inventory.destination))throw new Error("New position ownership differs from migrated wallet");
 const now=inventory.observedAt;
 return {...snapshot,accounting:undefined,recovery:{inventory,complete},platforms:snapshot.platforms.map(p=>{
  if(active&&p.id===5)return {...p,observation:active.observation};
  const closed=complete||(p.id===8?!inventory.orcaOpen:p.id===6?inventory.receiptAtoms==="0":false);
  const detail=closed?([1,6,8].includes(p.id)?"Closed · funds recovered · execution disabled":"Closed · no open positions · execution disabled"):p.id===9?"Pending custom pack · execution disabled":"Recovery in progress · new positions disabled";
  return {...p,observation:{status:closed?"empty":p.id===9?"pending":"needs_setup",checkedAt:now,lastSuccessAt:now,message:detail,data:{status:closed?"empty":p.id===9?"pending":"needs_setup",valueUsd:closed?"0":null,positionCount:closed?0:null,closed,detail,executionEnabled:false}}};
 })};
}
