import * as k from "@solana/kit";
import type {StationEntryPlan} from "../../../../packages/contracts/src/station-entries";
import {CHALLENGE_WALLET,TRADE_TOKEN_ACCOUNTS} from "../../../../packages/contracts/src/trades";
import {simulateRecoveryAccounts} from "../../../../packages/contracts/src/recovery-simulation";
import {browserRpc,decode64,encode64,digest} from "./trade-wallet";
import {validateSolEntryPlan} from "./entry-sol-wallet";
import {validateKaminoEntryPlan} from "./entry-kamino-wallet";
import {validateOrcaEntryPlan,verifyOrcaEntryContext} from "./entry-orca-wallet";
const check=(ok:unknown,message="Entry differs from the owner-reviewed plan")=>{if(!ok)throw Error(message);};
const SOL="So11111111111111111111111111111111111111112",USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",TOKEN="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",TOKEN2022="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
type Account={owner:string;executable:boolean;lamports:number;data:[string,string]};
function tokenAmount(a:Account|null|undefined,mint:string):bigint{
 check(a&&!a.executable&&(a.owner===TOKEN||a.owner===TOKEN2022));const b=decode64(a!.data[0]);check(b.length>=165&&b[108]===1);const v=new DataView(b.buffer);check(v.getUint32(72,true)===0&&v.getUint32(129,true)===0);const dec=k.getAddressDecoder();check(dec.decode(b.subarray(0,32))===mint&&dec.decode(b.subarray(32,64))===CHALLENGE_WALLET);return v.getBigUint64(64,true);
}
export async function validateEntryEnvelope(p:StationEntryPlan,mint?:string,now=Date.now()){
 check(p.version===1&&p.wallet===CHALLENGE_WALLET&&[1,6,8].includes(p.stationId));
 check(Number.isFinite(Date.parse(p.preparedAt))&&Date.parse(p.preparedAt)<=now+5000&&Date.parse(p.expiresAt)>now&&Date.parse(p.expiresAt)<=Date.parse(p.preparedAt)+60000,"Review expired. Refresh before signing.");
 check(p.budgetUsdcAtoms==="10000000"&&/^\d+$/.test(p.maxSpendUsdcAtoms)&&BigInt(p.maxSpendUsdcAtoms)>0n&&BigInt(p.maxSpendUsdcAtoms)<=10000000n);
 for(const value of [...Object.values(p.before),...Object.values(p.after),p.feeLamports,p.rentLamports,p.lastValidBlockHeight])check(/^\d+$/.test(value));
 check(Number.isSafeInteger(p.slot)&&p.slot>0&&BigInt(p.feeLamports)>=5000n&&BigInt(p.feeLamports)<=12000n&&BigInt(p.after.nativeLamports)>=10000000n);
 check(p.accounts.usdc===TRADE_TOKEN_ACCOUNTS.usdc&&p.accounts.wsol===TRADE_TOKEN_ACCOUNTS.wsol);
 const wire=decode64(p.wireBase64);check(wire.length<=1232);const tx=k.getTransactionDecoder().decode(wire),c=k.getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
 check(await digest(tx.messageBytes)===p.messageHash&&await digest(decode64(p.messageBase64))===p.messageHash);check(c.version===0&&c.lifetimeToken===p.blockhash&&c.staticAccounts[0]===CHALLENGE_WALLET);
 check(c.header.numSignerAccounts===(p.stationId===8?2:1));
 check(p.stationId===8?!!mint&&mint===p.mint&&c.staticAccounts[1]===mint:p.mint===undefined);
 check(Object.keys(tx.signatures).length===c.header.numSignerAccounts&&Object.values(tx.signatures).every(s=>!s||s.every(n=>n===0)),"Prepared transaction must be unsigned");
 if(c.version!==0)throw Error("Expected version zero");
 const writable:string[]=[],readonly:string[]=[];
 const tables=c.addressTableLookups??[];check(tables.length<=8&&new Set(tables.map(t=>t.lookupTableAddress)).size===tables.length);
 check(Object.keys(p.lookupTables).length===tables.length);
 for(const t of tables){const a=p.lookupTables[t.lookupTableAddress];check(a);for(const i of t.writableIndexes){check(a?.[i]);writable.push(a![i]!);}for(const i of t.readonlyIndexes){check(a?.[i]);readonly.push(a![i]!);}}
 const keys:string[]=[...c.staticAccounts,...writable,...readonly];check(new Set(keys).size===keys.length);
 return {tx,c,keys};
}
export async function verifyEntryContext(p:StationEntryPlan,readToken:string,mint?:string){
 const {c,keys}=await validateEntryEnvelope(p,mint);
 if(p.stationId===1)await validateSolEntryPlan(p);else if(p.stationId===6)await validateKaminoEntryPlan(p);else {await validateOrcaEntryPlan(p);await verifyOrcaEntryContext(p);}
 check(await browserRpc("getGenesisHash",[])==="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d","Wallet RPC must use mainnet");
 const height=()=>browserRpc<number>("getBlockHeight",[{commitment:"confirmed"}],readToken);
 check(BigInt(await height())<BigInt(p.lastValidBlockHeight)-8n,"Review blockhash is expiring; refresh");
 const tableKeys=Object.keys(p.lookupTables);
 if(tableKeys.length){const r=await browserRpc<{value:(Account|null)[]}>("getMultipleAccounts",[tableKeys,{encoding:"base64",commitment:"confirmed",minContextSlot:p.slot}]);check(r.value.length===tableKeys.length);r.value.forEach((a,i)=>{check(a?.owner==="AddressLookupTab1e1111111111111111111111111"&&!a.executable);const b=decode64(a!.data[0]),v=new DataView(b.buffer);check(b.length>=56&&(b.length-56)%32===0&&v.getUint32(0,true)===1&&v.getBigUint64(4,true)===(1n<<64n)-1n);const addresses=Array.from({length:(b.length-56)/32},(_,j)=>k.getAddressDecoder().decode(b.subarray(56+j*32,88+j*32)));check(JSON.stringify(addresses)===JSON.stringify(p.lookupTables[tableKeys[i]!]),"Lookup table changed; refresh");});}
 const extra=p.stationId===6?[p.accounts.collateralAta!]:p.stationId===8?[p.accounts.position!,p.mint!,p.accounts.nft!]:[];
 const addresses=[CHALLENGE_WALLET,TRADE_TOKEN_ACCOUNTS.usdc,TRADE_TOKEN_ACCOUNTS.wsol,...extra];
 const before=await browserRpc<{context:{slot:number};value:(Account|null)[]}>("getMultipleAccounts",[addresses,{encoding:"base64",commitment:"confirmed",minContextSlot:p.slot}]);check(before.value.length===addresses.length);
 const a=before.value;check(a[0]?.owner==="11111111111111111111111111111111"&&!a[0].executable&&String(a[0].lamports)===p.before.nativeLamports,"SOL balance changed; refresh");
 check(String(tokenAmount(a[1],USDC))===p.before.usdcAtoms,"USDC balance changed; refresh");check(String(a[2]?tokenAmount(a[2],SOL):0n)===p.before.wsolAtoms,"WSOL balance changed; refresh");
 if(p.stationId===8)check(a.slice(3).every(v=>v===null),"Position already exists");
 if(p.stationId===6)check(String(a[3]?tokenAmount(a[3],p.accounts.collateralMint!):0n)===String(p.details.collateralBeforeAtoms),"Receipt balance changed; refresh");
 const fee=await browserRpc<{value:number|null}>("getFeeForMessage",[p.messageBase64,{commitment:"confirmed"}]);check(String(fee.value)===p.feeLamports,"Network fee changed; refresh");
 const sim=await simulateRecoveryAccounts<Account>((method,params)=>browserRpc(method as Parameters<typeof browserRpc>[0],params,readToken),p.wireBase64,addresses,before.context.slot,keys.length),post=sim.value.accounts;
 check(post[0]?.owner==="11111111111111111111111111111111"&&!post[0].executable);
 check(BigInt(p.before.nativeLamports)-BigInt(post[0]!.lamports)===BigInt(p.rentLamports)+BigInt(p.feeLamports)&&BigInt(post[0]!.lamports)>=10000000n,"Separate SOL fee pool would be exceeded");
 const spend=BigInt(p.before.usdcAtoms)-tokenAmount(post[1],USDC),wrapped=(post[2]?tokenAmount(post[2],SOL):0n)-BigInt(p.before.wsolAtoms);
 check(spend>0n&&spend<=10000000n&&spend<=BigInt(p.maxSpendUsdcAtoms)&&wrapped>=0n,"Principal or existing WSOL protection failed");
 if(p.stationId===1)check(spend===10000000n&&wrapped>=BigInt(String(p.details.minimumWsolAtoms)));
 if(p.stationId===6)check(spend===10000000n&&wrapped===0n&&tokenAmount(post[3],p.accounts.collateralMint!)-BigInt(String(p.details.collateralBeforeAtoms))>=BigInt(String(p.details.minReceiptAtoms)));
 if(p.stationId===8)check(post[3]?.owner==="whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"&&tokenAmount(post[5],p.mint!)===1n);
 check(Date.now()<Date.parse(p.expiresAt)&&BigInt(await height())<BigInt(p.lastValidBlockHeight)-8n,"Review expired during verification; refresh");
 void c;
}
export async function finishEntrySignature(p:StationEntryPlan,bytes:Uint8Array,mint?:k.KeyPairSigner){
 await validateEntryEnvelope(p,mint?.address);const tx=k.getTransactionDecoder().decode(bytes);check(await digest(tx.messageBytes)===p.messageHash,"Wallet changed the reviewed message");
 const signature=tx.signatures[k.address(CHALLENGE_WALLET)];check(signature?.some(n=>n!==0),"Owner signature missing");
 const pub=await crypto.subtle.importKey("raw",new Uint8Array(k.getAddressEncoder().encode(k.address(CHALLENGE_WALLET))),{name:"Ed25519"},false,["verify"]);
 check(await crypto.subtle.verify("Ed25519",pub,new Uint8Array(signature!),new Uint8Array(tx.messageBytes)),"Owner signature invalid");
 const complete=mint?await k.partiallySignTransaction([mint.keyPair],tx):tx;
 return {wire:encode64(k.getTransactionEncoder().encode(complete)),signature:k.getSignatureFromTransaction(complete)};
}
