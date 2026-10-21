import * as k from "@solana/kit";
import {RECOVERY_SOURCE as SOURCE,RECOVERY_DESTINATION as DEST,type RecoveryPlan} from "../../../../packages/contracts/src/recovery";
import {decode64,encode64,digest} from "./trade-wallet";
const TOKEN="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",TOKEN22="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",SYS="11111111111111111111111111111111",BUDGET="ComputeBudget111111111111111111111111111111";
const POOL="Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",WHIRL="whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",KAMINO="KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",SOL="So11111111111111111111111111111111111111112",USA="8DDPMR9LcM7YaHfwq41TteyGpnFi222gCgDEZUuy5PmE",WSA="G5gUmEtvsE2RAj9gFSDP5ZgZ5WW4CeNRchj3r8fE4uvf",CTA="Ezb8iGvPbVKFN2tF6wrRermeo47qDXTWXQWMiUYLeAYx";
const POS="GmCZFFr96WxLefnXa93HyJ8UeSaYMsgkkYLcJwg7o7aL",NFT="9HPHs9VSEbVpWaRX9oFBqK7baK9vgtLKeiwB5d7mkNmi",MINT="8pN95gNGgAcRpGF3EnNR8RwDYkH9jxozDebgo2G4bkom";
const VA="EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9",VB="2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP",MEMO="MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const reserve="Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp",market="DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek",authority="B9spsrMK6pJicYtukaZzDyzsUQLgc3jbx5gHVwdDxb6y",collateral="32XLsweyeQwWgLKRVAzS72nxHGU1JmmNQQZ3C3q6fBjJ",vault="GENey8es3EgGiNTM8H8gzA3vf98haQF8LHiYFyErjgrv";
const check=(v:unknown,m="Recovery transaction differs from the approved action")=>{if(!v)throw new Error(m);};
const equal=(a:readonly unknown[],b:readonly unknown[])=>check(a.length===b.length&&a.every((x,i)=>x===b[i]));
const hex=(b:Uint8Array|k.ReadonlyUint8Array)=>[...b].map(x=>x.toString(16).padStart(2,"0")).join("");
const view=(b:Uint8Array|k.ReadonlyUint8Array)=>new DataView(new Uint8Array(b).buffer);
export async function recoveryRpc<T>(method:string,params:unknown[],readToken?:string):Promise<T>{
 check(["getGenesisHash","getMultipleAccounts","getBlockHeight","getFeeForMessage","simulateTransaction","sendTransaction","getTokenAccountsByOwner"].includes(method));
 const relayed=method==="getTokenAccountsByOwner"||method==="getBlockHeight";
 const api=(import.meta.env.VITE_API_BASE_URL||"https://belac-fun-production-c49e.up.railway.app").replace(/\/$/,"");
 const endpoint=relayed?`${api}/v1/recovery/read`:"https://solana-rpc.publicnode.com";
 const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",...(relayed?{authorization:`Bearer ${readToken??""}`}:{})},body:JSON.stringify(relayed?{method,params}:{jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(25000)});const j=await r.json();check(r.ok&&!j.error,"RPC unavailable; check the saved attempt before retrying");return (relayed?j.data:j.result) as T;
}
export async function validateRecoveryPlan(p:RecoveryPlan){
 check(p.source===SOURCE&&p.destination===DEST&&p.before.source===SOURCE&&p.before.destination===DEST);
 check(p.before.next===p.step,"Recovery steps must follow the refreshed inventory");
 check(Date.now()<Date.parse(p.expiresAt),"Plan expired — refresh the quote and simulation");
 check(BigInt(p.feeLamports)>0n&&BigInt(p.feeLamports)<=10000n);
 const tx=k.getTransactionDecoder().decode(decode64(p.wireBase64));check(await digest(tx.messageBytes)===p.messageHash);
 const m=k.getCompiledTransactionMessageDecoder().decode(tx.messageBytes);check(m.header.numSignerAccounts===1&&m.staticAccounts[0]===SOURCE&&!("addressTableLookups" in m&&m.addressTableLookups?.length));
 check(Object.values(tx.signatures).every(s=>s===null||s.every(x=>x===0)),"Preparation must be unsigned");
 const instructions=m.instructions.map(i=>({program:m.staticAccounts[i.programAddressIndex],keys:[...(i.accountIndices??[])].map(n=>m.staticAccounts[n]),data:new Uint8Array(i.data??[])}));
 if(p.step==="sweep"){
  check(instructions.length===1&&p.before.openAccounts===0&&!p.before.orcaOpen&&p.before.receiptAtoms==="0"&&p.before.usdcAtoms==="0");
  const ix=instructions[0]!;check(ix.program===SYS&&ix.data.length===12&&view(ix.data).getUint32(0,true)===2);equal(ix.keys,[SOURCE,DEST]);check(view(ix.data).getBigUint64(4,true)===BigInt(p.before.sourceLamports)-BigInt(p.feeLamports));return m;
 }
 equal(instructions.slice(0,2).map(i=>i.program),[BUDGET,BUDGET]);equal([...instructions[0]!.data],[2,32,161,7,0]);equal([...instructions[1]!.data],[3,232,3,0,0,0,0,0,0]);
 const actions=instructions.slice(2);
 if(p.step==="orca"){
  check(actions.length===3&&actions.every(i=>i.program===WHIRL));
  check(hex(actions[0]!.data.subarray(0,8))==="3a7fbc3e4f52c460"&&actions[0]!.data.length===41);
  equal(actions[0]!.keys,[POOL,TOKEN,TOKEN,MEMO,SOURCE,POS,NFT,SOL,USDC,WSA,USA,VA,VB,"8Rs3qKaVGBndwNdeDqHcayatonVzdBrdYoq27CKyjuE7","8fV1MQYaRiW9qDWinzYfNa3FLs8PXSdPxoytiwrcyJPD"]);
  check(view(actions[0]!.data).getBigUint64(24,true)===BigInt(p.minimumSolAtoms)&&view(actions[0]!.data).getBigUint64(32,true)===BigInt(p.minimumUsdcAtoms));
  check(hex(actions[1]!.data)==="cf755fbfe5b4e20f00");equal(actions[1]!.keys,[POOL,SOURCE,POS,NFT,SOL,USDC,WSA,VA,USA,VB,TOKEN,TOKEN,MEMO]);
  check(hex(actions[2]!.data)==="01b6873b9b1963df");equal(actions[2]!.keys,[SOURCE,SOURCE,POS,MINT,NFT,TOKEN22]);
 }else if(p.step==="kamino"){
  check(actions.length===3&&actions[0]!.program===KAMINO&&actions[1]!.program===KAMINO);
  check(hex(actions[0]!.data)==="02da8aeb4fc91966");equal(actions[0]!.keys,[reserve,market,KAMINO,KAMINO,KAMINO,"3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH"]);
  check(actions[1]!.data.length===16&&hex(actions[1]!.data.subarray(0,8))==="ea75b57db98edc1d"&&view(actions[1]!.data).getBigUint64(8,true)===BigInt(p.before.receiptAtoms));
  equal(actions[1]!.keys,[SOURCE,market,reserve,authority,USDC,collateral,vault,CTA,USA,TOKEN,TOKEN,"Sysvar1nstructions1111111111111111111111111"]);
 }else if(p.step==="swap"){
  check(actions.length===1&&actions[0]!.program===WHIRL);const i=actions[0]!;
  check(hex(i.data.subarray(0,8))===(await digest(new TextEncoder().encode("global:swap_v2"))).slice(0,16));
  equal(i.keys.slice(0,11),[TOKEN,TOKEN,MEMO,SOURCE,POOL,SOL,USDC,WSA,VA,USA,VB]);check(i.keys.length===17);
  check(view(i.data).getBigUint64(8,true)===BigInt(p.before.usdcAtoms)&&view(i.data).getBigUint64(16,true)===BigInt(p.minimumSolAtoms));check(i.data[40]===1&&i.data[41]===0);
 }else check(p.step==="cleanup");
 for(const i of actions.filter(i=>i.program===TOKEN||i.program===TOKEN22)){
  check(i.data.length===1&&i.data[0]===9);check(i.keys.length===3&&i.keys[1]===SOURCE&&i.keys[2]===SOURCE);
  const a=p.before.accounts.find(a=>a.address===i.keys[0]);check(a&&a.program===i.program&&(a.amount==="0"||a.mint===SOL));
 }
 if(p.step==="kamino")check(actions[2]!.program===TOKEN&&actions[2]!.keys[0]===CTA);
 if(p.step==="cleanup")check(actions.length===p.before.accounts.length&&new Set(actions.map(i=>i.keys[0])).size===actions.length&&actions.every(i=>i.program===TOKEN||i.program===TOKEN22));
 return m;
}
type Account={owner:string;lamports:number;executable:boolean;data:[string,string]};
const closed=(a:Account|null)=>!a||(a.owner===SYS&&a.lamports===0&&a.data[0]==="");
function amount(a:Account|null,mint:string){if(closed(a))return 0n;check(a&&!a.executable&&(a.owner===TOKEN||a.owner===TOKEN22));const b=decode64(a!.data[0]);check(b[108]===1&&view(b).getUint32(72,true)===0);const d=k.getAddressDecoder();check(d.decode(b.subarray(0,32))===mint&&d.decode(b.subarray(32,64))===SOURCE);return view(b).getBigUint64(64,true);}
export async function verifyOwnerScan(p:RecoveryPlan,minContextSlot:number,readToken?:string){
 const seen=new Set<string>();let slot=minContextSlot;
 for(const programId of [TOKEN,TOKEN22]){
  const scan=await recoveryRpc<{context:{slot:number};value:{pubkey:string;account:Account}[]}>("getTokenAccountsByOwner",[SOURCE,{programId},{encoding:"base64",commitment:"confirmed",minContextSlot:slot}],readToken);
  check(Number.isSafeInteger(scan.context.slot)&&scan.context.slot>=slot,"Owner scan is stale; sweep blocked");slot=scan.context.slot;
  for(const a of scan.value){const expected=p.before.accounts.find(x=>x.address===a.pubkey);check(expected&&!seen.has(a.pubkey),"Unlisted token account found; refresh before sweeping");check(a.account.owner===programId&&expected!.program===programId&&amount(a.account,expected!.mint).toString()===expected!.amount);seen.add(a.pubkey);}
 }
 check(seen.size===p.before.accounts.length,"Owner token account set changed; refresh");return slot;
}
export async function verifyRecoveryContext(p:RecoveryPlan,readToken?:string){
 await validateRecoveryPlan(p);check(await recoveryRpc("getGenesisHash",[])==="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
 check(BigInt(await recoveryRpc<number>("getBlockHeight",[{commitment:"confirmed"}],readToken))<=BigInt(p.lastValidBlockHeight));
 const keys=[SOURCE,DEST,USA,WSA,CTA,POS,MINT,NFT,POOL,...p.before.accounts.map(a=>a.address)].filter((v,i,a)=>a.indexOf(v)===i);
 const live=await recoveryRpc<{context:{slot:number};value:(Account|null)[]}>("getMultipleAccounts",[keys,{encoding:"base64",commitment:"confirmed",minContextSlot:p.slot}]);
 const a=live.value;check(String(a[0]?.lamports??0)===p.before.sourceLamports&&String(a[1]?.lamports??0)===p.before.destinationLamports,"Wallet balances changed; refresh the plan");
 let minSlot=live.context.slot;if(p.step==="cleanup"||p.step==="sweep")minSlot=await verifyOwnerScan(p,minSlot,readToken);
 check(amount(a[2]!,USDC).toString()===p.before.usdcAtoms&&amount(a[3]!,SOL).toString()===p.before.wsolAtoms&&amount(a[4]!,collateral).toString()===p.before.receiptAtoms);
 for(const t of p.before.accounts){const raw=a[keys.indexOf(t.address)]!;check(raw&&raw.owner===t.program&&amount(raw,t.mint).toString()===t.amount);if(t.amount!=="0"&&t.mint!==SOL&&p.step==="cleanup")throw new Error("Non-empty token account cannot be closed");}
 const pool=a[8]!;check(pool?.owner===WHIRL&&!pool.executable);const b=decode64(pool.data[0]),v=view(b),sqrt=v.getBigUint64(65,true)+(v.getBigUint64(73,true)<<64n),Q=1n<<64n;
 if(p.step==="orca"){
  check(a[5]?.owner===WHIRL&&amount(a[7]!,MINT)===1n);const pos=decode64(a[5]!.data[0]),pv=view(pos),L=pv.getBigUint64(72,true)+(pv.getBigUint64(80,true)<<64n);
  const m=await validateRecoveryPlan(p),ix=m.instructions[2]!,dv=view(ix.data!);check(dv.getBigUint64(8,true)+(dv.getBigUint64(16,true)<<64n)===L);
  const lo=BigInt(Math.floor(Math.pow(1.0001,-24612/2)*Number(Q))),hi=BigInt(Math.floor(Math.pow(1.0001,-20556/2)*Number(Q))),clamped=sqrt<lo?lo:sqrt>hi?hi:sqrt;
  const minA=L*(hi-clamped)*Q/(clamped*hi),minB=L*(clamped-lo)/Q;
  check(BigInt(p.minimumSolAtoms)+2n>=minA*99n/100n&&BigInt(p.minimumUsdcAtoms)+2n>=minB*99n/100n,"Withdrawal minimum is too low");
 }
 if(p.step==="swap")check(BigInt(p.minimumSolAtoms)>=BigInt(p.before.usdcAtoms)*Q*Q/(sqrt*sqrt)*99n/100n,"Swap minimum is too low");
 const fee=await recoveryRpc<{value:number}>("getFeeForMessage",[encode64(k.getTransactionDecoder().decode(decode64(p.wireBase64)).messageBytes),{commitment:"confirmed"}]);check(String(fee.value)===p.feeLamports);
 const sim=await recoveryRpc<{value:{err:unknown;accounts:(Account|null)[]}}>("simulateTransaction",[p.wireBase64,{encoding:"base64",sigVerify:false,replaceRecentBlockhash:false,commitment:"confirmed",minContextSlot:minSlot,accounts:{encoding:"base64",addresses:keys}}]);
 check(sim.value.err===null,"Fresh browser simulation failed");const post=sim.value.accounts;
 check(String(post[1]?.lamports??0)===(p.step==="sweep"?(BigInt(p.before.destinationLamports)+BigInt(p.before.sourceLamports)-BigInt(p.feeLamports)).toString():p.before.destinationLamports));
 if(p.step==="orca")check(closed(post[5]!)&&closed(post[6]!)&&closed(post[7]!)&&amount(post[2]!,USDC)>=BigInt(p.before.usdcAtoms)+BigInt(p.minimumUsdcAtoms)&&amount(post[3]!,SOL)>=BigInt(p.before.wsolAtoms)+BigInt(p.minimumSolAtoms));
 if(p.step==="kamino")check(closed(post[4]!)&&amount(post[2]!,USDC)>=BigInt(p.before.usdcAtoms)+BigInt(p.minimumUsdcAtoms));
 if(p.step==="swap")check(amount(post[2]!,USDC)===0n&&amount(post[3]!,SOL)>=BigInt(p.before.wsolAtoms)+BigInt(p.minimumSolAtoms));
 if(p.step==="cleanup")check(p.before.accounts.every(t=>closed(post[keys.indexOf(t.address)]!)));
 if(p.step==="sweep")check(closed(post[0]!));
}
export async function verifyRecoverySignature(p:RecoveryPlan,wire:Uint8Array){
 const tx=k.getTransactionDecoder().decode(wire);check(await digest(tx.messageBytes)===p.messageHash,"Wallet changed the recovery message");
 const sig=tx.signatures[k.address(SOURCE)];check(sig&&sig.some(x=>x!==0));
 const pub=await crypto.subtle.importKey("raw",new Uint8Array(k.getAddressEncoder().encode(k.address(SOURCE))),{name:"Ed25519"},false,["verify"]);
 check(await crypto.subtle.verify("Ed25519",pub,new Uint8Array(sig!),new Uint8Array(tx.messageBytes)),"Invalid owner signature");return k.getSignatureFromTransaction(tx);
}
