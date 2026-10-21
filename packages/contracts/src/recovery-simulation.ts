type Rpc=<T>(method:string,params:unknown[])=>Promise<T>;
type Simulation<A>={context:{slot:number};value:{err:unknown;accounts:(A|null)[];logs:string[]}};
export async function simulateRecoveryAccounts<A>(rpc:Rpc,wire:string,keys:string[],minContextSlot:number){
 const accounts:(A|null)[]=[];let slot=minContextSlot;const logs:string[]=[];
 // Public RPCs cap returned simulation accounts at five. Each batch simulates the
 // same unsigned transaction; no batch signs, submits, or changes chain state.
 for(let offset=0;offset<keys.length;offset+=5){
  const addresses=keys.slice(offset,offset+5);
  const result=await rpc<Simulation<A>>("simulateTransaction",[wire,{encoding:"base64",sigVerify:false,replaceRecentBlockhash:false,commitment:"confirmed",minContextSlot:slot,accounts:{encoding:"base64",addresses}}]);
  if(result.value.err!==null)throw new Error(`Recovery simulation failed: ${JSON.stringify(result.value.err)} ${(result.value.logs??[]).slice(-3).join(" ")}`);
  if(!Number.isSafeInteger(result.context.slot)||result.context.slot<slot)throw new Error("Recovery simulation context regressed; refresh");
  if(!Array.isArray(result.value.accounts)||result.value.accounts.length!==addresses.length)throw new Error("Recovery simulation account results missing; refresh");
  slot=result.context.slot;accounts.push(...result.value.accounts);logs.push(...(result.value.logs??[]));
 }
 return {context:{slot},value:{err:null,accounts,logs}};
}
