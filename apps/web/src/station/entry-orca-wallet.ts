import * as k from "@solana/kit";
import type {StationEntryPlan} from "../../../../packages/contracts/src/station-entries.js";
import {CHALLENGE_WALLET,TRADE_TOKEN_ACCOUNTS} from "../../../../packages/contracts/src/trades.js";
export const ORCA_ENTRY={pool:"Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",program:"whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",vaultA:"EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9",vaultB:"2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP",sol:"So11111111111111111111111111111111111111112",usdc:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",token:"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",token2022:"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",ata:"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",router:"JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",system:"11111111111111111111111111111111"} as const;
const check=(v:unknown)=>{if(!v)throw Error("Orca transaction differs from the reviewed capped entry");};
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
/** Exact instruction grammar: CU limit, exact-out acquisition, NFT position, liquidity. */
export async function validateOrcaEntryPlan(p:StationEntryPlan):Promise<void>{
 const o=ORCA_ENTRY,a=p.accounts,d=p.details;
 check(p.wallet===CHALLENGE_WALLET&&p.stationId===8&&p.mint&&p.budgetUsdcAtoms==="10000000");
 check(a.pool===o.pool&&a.usdc===TRADE_TOKEN_ACCOUNTS.usdc&&a.wsol===TRADE_TOKEN_ACCOUNTS.wsol&&a.mint===p.mint&&a.vaultA===o.vaultA&&a.vaultB===o.vaultB);
 const n=(key:string)=>{const s=d[key];check(typeof s==="string"&&/^\d+$/.test(s));return BigInt(String(s));};
 const maxSwap=n("maxSwapUsdcAtoms"),maxB=n("maxUSDCdeposit"),maxA=n("maxSOLdeposit"),liq=n("liquidity");
 check(n("estimatedSwapUsdcAtoms")>0n&&maxSwap===(n("estimatedSwapUsdcAtoms")*10050n+9999n)/10000n);
 check(maxSwap>0n&&maxA>0n&&maxB>0n&&liq>0n&&maxSwap+maxB<=10000000n&&maxSwap+maxB===BigInt(p.maxSpendUsdcAtoms)&&n("minAcquiredWSOL")===maxA);
 check(BigInt(p.feeLamports)>0n&&BigInt(p.feeLamports)<=12000n&&BigInt(p.rentLamports)===7143520n);
 check(BigInt(p.after.nativeLamports)>=10000000n&&BigInt(p.before.nativeLamports)-BigInt(p.after.nativeLamports)===BigInt(p.rentLamports)+BigInt(p.feeLamports));
 check(BigInt(p.after.wsolAtoms)>=BigInt(p.before.wsolAtoms)&&BigInt(p.simulatedSpendUsdcAtoms)>0n&&BigInt(p.simulatedSpendUsdcAtoms)<=maxSwap+maxB);
 check(BigInt(p.before.usdcAtoms)-BigInt(p.after.usdcAtoms)===BigInt(p.simulatedSpendUsdcAtoms));
 const lower=Number(d.tickLower),upper=Number(d.tickUpper),price=Number(d.price),lp=1000*1.0001**lower,up=1000*1.0001**upper;
 check(Number.isSafeInteger(lower)&&Number.isSafeInteger(upper)&&lower%4===0&&upper%4===0&&lower<upper&&price>0);
 check(lp/price>=.7995&&lp/price<=.8005&&up/price>=1.1993&&up/price<=1.2007);
 check(Math.abs(Number(d.lowerPrice)/lp-1)<1e-8&&Math.abs(Number(d.upperPrice)/up-1)<1e-8);
 const enc=k.getAddressEncoder(),text=new TextEncoder(),pda=async(program:string,seeds:(Uint8Array|k.ReadonlyUint8Array)[])=>(await k.getProgramDerivedAddress({programAddress:k.address(program),seeds}))[0];
 check(a.position===await pda(o.program,[text.encode("position"),enc.encode(k.address(p.mint!))]));
 check(a.nft===await pda(o.ata,[enc.encode(k.address(p.wallet)),enc.encode(k.address(o.token2022)),enc.encode(k.address(p.mint!))]));
 for(const [key,t]of [["tickArrayLower",lower],["tickArrayUpper",upper],["swapTickArray0",Number(d.swapTickStart)],["swapTickArray1",Number(d.swapTickStart)+352],["swapTickArray2",Number(d.swapTickStart)+704]] as const){check(Number.isSafeInteger(t));check(a[key]===await pda(o.program,[text.encode("tick_array"),enc.encode(k.address(o.pool)),text.encode(String(Math.floor(t/352)*352))]));}
 check(a.oracle===await pda(o.program,[text.encode("oracle"),enc.encode(k.address(o.pool))]));
 const c=k.getCompiledTransactionMessageDecoder().decode(decode(p.messageBase64));if(c.version!==0)throw Error("Expected v0 Orca message");check(c.header.numSignerAccounts===2&&c.staticAccounts[0]===p.wallet&&c.staticAccounts[1]===p.mint);
 const writable:string[]=[],readonly:string[]=[];
 for(const l of c.addressTableLookups??[]){const table=p.lookupTables[l.lookupTableAddress];check(table);for(const i of l.writableIndexes){check(table[i]);writable.push(table[i]!);}for(const i of l.readonlyIndexes){check(table[i]);readonly.push(table[i]!);}}
 const keys:string[]=[...c.staticAccounts,...writable,...readonly];check(c.instructions.length===4);
 const ix=c.instructions,accounts=(i:number)=>Array.from(ix[i]!.accountIndices??[],j=>keys[j]),data=(i:number)=>new Uint8Array(ix[i]!.data??[]),view=(i:number)=>new DataView(data(i).buffer),u64=(i:number,j:number)=>view(i).getBigUint64(j,true);
 const equal=(actual:unknown,expected:unknown)=>check(JSON.stringify(actual)===JSON.stringify(expected));
 equal(ix.map(i=>keys[i.programAddressIndex]),["ComputeBudget111111111111111111111111111111",o.program,o.program,o.program]);
 check(data(0).length===5&&data(0)[0]===2&&view(0).getUint32(1,true)===1400000);equal(accounts(0),[]);
 const discriminator=async(name:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",text.encode("global:"+name))).slice(0,8);
 equal([...data(1).slice(0,8)],[...await discriminator("swap_v2")]);check(data(1).length===43);
 check(u64(1,8)===maxA&&u64(1,16)===maxSwap&&u64(1,24)===0n&&u64(1,32)===0n&&data(1)[40]===0&&data(1)[41]===0&&data(1)[42]===0);
 equal(accounts(1),[o.token,o.token,"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",p.wallet,o.pool,o.sol,o.usdc,a.wsol,o.vaultA,a.usdc,o.vaultB,a.swapTickArray0,a.swapTickArray1,a.swapTickArray2,a.oracle]);
 equal([...data(2).slice(0,8)],[...await discriminator("open_position_with_token_extensions")]);check(data(2).length===17&&view(2).getInt32(8,true)===lower&&view(2).getInt32(12,true)===upper&&data(2)[16]===0);
 equal(accounts(2),[p.wallet,p.wallet,a.position,p.mint,a.nft,o.pool,o.token2022,o.system,o.ata,"3axbTs2z5GBy6usVbNVoqEgZMng3vZvMnAoX29BFfwhr"]);
 equal([...data(3).slice(0,8)],[...await discriminator("increase_liquidity_v2")]);check(data(3).length===41&&u64(3,8)+(u64(3,16)<<64n)===liq&&u64(3,24)===maxA&&u64(3,32)===maxB&&data(3)[40]===0);
 equal(accounts(3),[o.pool,o.token,o.token,"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",p.wallet,a.position,a.nft,o.sol,o.usdc,a.wsol,a.usdc,o.vaultA,o.vaultB,a.tickArrayLower,a.tickArrayUpper]);
}
/** Rebind the exact offline grammar to independently fetched current pool state. */
export async function verifyOrcaEntryContext(p:StationEntryPlan):Promise<void>{
 await validateOrcaEntryPlan(p);
 const env=(import.meta as unknown as {env?:Record<string,string>}).env;
 const r=await fetch(env?.VITE_SOLANA_RPC_URL||"https://solana-rpc.publicnode.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getMultipleAccounts",params:[[ORCA_ENTRY.pool,p.accounts.vaultA,p.accounts.vaultB,p.accounts.tickArrayLower,p.accounts.tickArrayUpper,p.accounts.swapTickArray0,p.accounts.swapTickArray1,p.accounts.swapTickArray2],{encoding:"base64",commitment:"confirmed",minContextSlot:p.slot}]}),signal:AbortSignal.timeout(20000)});
 check(r.ok);const body=await r.json() as {error?:unknown;result?:{value:({owner:string;executable:boolean;data:[string,string]}|null)[]}};check(!body.error&&body.result?.value.length===8);
 const raw=body.result!.value,o=ORCA_ENTRY,addr=k.getAddressDecoder(),same=(b:Uint8Array,x:number[])=>b.length===x.length&&b.every((n,i)=>n===x[i]);
 const bytes=(i:number,program:string)=>{const a=raw[i];check(a&&a.owner===program&&!a.executable&&a.data[1]==="base64");return decode(a!.data[0]);};
 const pool=bytes(0,o.program);check(pool.length===653&&same(pool.slice(0,8),[63,149,209,12,225,128,99,9]));const v=new DataView(pool.buffer);check(v.getUint16(41,true)===4);
 check(addr.decode(pool.slice(101,133))===o.sol&&addr.decode(pool.slice(133,165))===o.vaultA&&addr.decode(pool.slice(181,213))===o.usdc&&addr.decode(pool.slice(213,245))===o.vaultB);
 const sqrt=v.getBigUint64(65,true)+(v.getBigUint64(73,true)<<64n),price=(Number(sqrt)/2**64)**2*1000,current=v.getInt32(81,true),start=Math.floor(current/352)*352;
 check(start===Number(p.details.swapTickStart));check(Math.abs(price/Number(p.details.price)-1)<=.001);
 for(const [i,mint]of [[1,o.sol],[2,o.usdc]] as const){const b=bytes(i,o.token),view=new DataView(b.buffer);check(b.length===165&&addr.decode(b.slice(0,32))===mint&&addr.decode(b.slice(32,64))===o.pool&&b[108]===1&&view.getUint32(72,true)===0);}
 const starts=[Math.floor(Number(p.details.tickLower)/352)*352,Math.floor(Number(p.details.tickUpper)/352)*352,start,start+352,start+704];
 for(let i=3;i<8;i++){
  const b=bytes(i,o.program),view=new DataView(b.buffer);check(b.length>=44&&view.getInt32(8,true)===starts[i-3]);
  if(same(b.slice(0,8),[69,97,189,190,110,7,66,187]))check(b.length===9988&&addr.decode(b.slice(9956,9988))===o.pool);
  else {check(same(b.slice(0,8),[17,216,246,142,225,199,218,56]));check(addr.decode(b.slice(12,44))===o.pool&&b.length>=148);}
 }
}
