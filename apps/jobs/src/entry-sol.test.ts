import {afterEach,expect,it,vi} from "vitest";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {buildSolEntry,checkSolRoute,readSolEntry} from "./entry-sol.js";
import {CHALLENGE_WALLET} from "../../../packages/contracts/src/trades.js";

import type {Quote,RpcInstruction} from "./meteora-route.js";
interface FixtureAccount { owner:string; executable:boolean; lamports:number; data:[string,string] }
interface FixtureCall {url:string;request?:{method:string;params:[string[]]};response:{result:{context:{slot:number};value:FixtureAccount[]};swapInstruction:RpcInstruction}}
interface EntryFixture {plan:{preparedAt:string;slot:number};calls:FixtureCall[]}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it("rejects another wallet and station before any network access",async()=>{
 const f=vi.fn();await expect(buildSolEntry({wallet:"wrong",stationId:1},"https://example.com",undefined,f)).rejects.toThrow();
 await expect(buildSolEntry({wallet:CHALLENGE_WALLET,stationId:8},"https://example.com",undefined,f)).rejects.toThrow();expect(f).not.toHaveBeenCalled();
});
export async function fixture(){
 const f=JSON.parse(await readFile(new URL("./fixtures/meteora-new-wallet-synthetic.json",import.meta.url),"utf8")) as EntryFixture;
 const q=f.calls.find(x=>x.url.includes("/quote?"))!.response as unknown as Quote; q.swapMode="ExactIn";q.inAmount="10000000";q.outAmount="70000000";q.otherAmountThreshold="69650000";Object.assign(q.routePlan[0].swapInfo,{inAmount:q.inAmount,outAmount:q.outAmount});
 const swap=f.calls.find(x=>x.url.endsWith("swap-instructions"))!.response.swapInstruction;
 const b=Buffer.from(swap.data,"base64");createHash("sha256").update("global:route").digest().copy(b,0,0,8);b.writeBigUInt64LE(10000000n,17);b.writeBigUInt64LE(70000000n,25);swap.data=b.toString("base64");swap.accounts.splice(5,1);swap.accounts.splice(7,1);
 return {f,q,swap};
}
it("binds ExactIn 10 USDC and minimum output to one fee-free Whirlpool route",async()=>{
 const {q,swap}=await fixture();const rest=swap.accounts.slice(9).map(a=>a.pubkey);
 expect(checkSolRoute(swap,q,rest)).toBe(69650000n);
 for(const mutate of [(x:Quote)=>{x.inAmount="10000001"},(x:Quote)=>{x.platformFee={amount:"1"}},(x:Quote)=>{x.otherAmountThreshold="1"}]){const bad=structuredClone(q);mutate(bad);expect(()=>checkSolRoute(swap,bad,rest)).toThrow();}
 const bad=structuredClone(swap);bad.accounts[3].pubkey=CHALLENGE_WALLET;expect(()=>checkSolRoute(bad,q,rest)).toThrow();
});
it("builds only an unsigned purchase, preserves all prior WSOL and charges native only for fees",async()=>{
 const {f,q,swap}=await fixture();vi.spyOn(Date,"now").mockReturnValue(Date.parse(f.plan.preparedAt));const before=f.calls[1].response.result;const balances=before.value.slice(0,3);const post=structuredClone(balances);post[0].lamports-=6000;const ub=Buffer.from(post[1].data[0],"base64"),wb=Buffer.from(post[2].data[0],"base64");ub.writeBigUInt64LE(ub.readBigUInt64LE(64)-10000000n,64);wb.writeBigUInt64LE(wb.readBigUInt64LE(64)+70000000n,64);post[1].data[0]=ub.toString("base64");post[2].data[0]=wb.toString("base64");
 const methods:string[]=[];const fetcher=(async(url:unknown,init?:RequestInit)=>{const req=init?.body?JSON.parse(String(init.body)):null;let result:unknown;
 if(String(url).includes("/quote?"))return new Response(JSON.stringify(q));
 if(String(url).endsWith("swap-instructions"))return new Response(JSON.stringify({...f.calls[3].response,swapInstruction:swap}));
 const method=req.method;methods.push(method);
 if(method==="getMultipleAccounts"){const n=req.params[0].length;result=n===3?{...before,value:balances}:req.params[0][0]===q.routePlan[0].swapInfo.ammKey?f.calls[4].response.result:n===5?f.calls[5].response.result:f.calls[6].response.result;}
 else if(method==="getFeeForMessage")result={value:6000};
 else if(method==="simulateTransaction"){expect(Buffer.from(req.params[0],"base64").subarray(1,65)).toEqual(Buffer.alloc(64));result={context:before.context,value:{err:null,accounts:post,logs:[]}};}
 else result=f.calls.find(c=>c.request?.method===method)?.response.result;
 return new Response(JSON.stringify({result}));}) as typeof fetch;
 const plan=await buildSolEntry({wallet:CHALLENGE_WALLET,stationId:1},"https://solana-rpc.publicnode.com",undefined,fetcher);
 expect(plan.rentLamports).toBe("0");expect(plan.simulatedSpendUsdcAtoms).toBe("10000000");expect(BigInt(plan.after.wsolAtoms)-BigInt(plan.before.wsolAtoms)).toBe(70000000n);expect(BigInt(plan.before.nativeLamports)-BigInt(plan.after.nativeLamports)).toBe(6000n);expect(methods).not.toContain("sendTransaction");
});


it("values only the receipt-attributed WSOL holding rather than the shared ATA",async()=>{
 const {f,q}=await fixture();const map=new Map<string,FixtureAccount>();for(const c of f.calls)if(c.request?.method==="getMultipleAccounts")c.request.params[0].forEach((key:string,i:number)=>map.set(key,structuredClone(c.response.result.value[i])));
 const wrapped=map.get("C6K1LEGJ48YdTXzYYvHEZoRV1cMS5ZGzrYaPHDcWc77c")!,b=Buffer.from(wrapped.data[0],"base64");b.writeBigUInt64LE(90000000n,64);wrapped.data[0]=b.toString("base64");
 vi.stubGlobal("fetch",(async(_url:unknown,init:RequestInit)=>{const req=JSON.parse(String(init.body));let result:unknown;if(req.method==="getGenesisHash")result="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";else if(req.method==="getBlockTime")result=Date.parse(f.plan.preparedAt)/1000;else result={context:{slot:f.plan.slot},value:req.params[0].map((key:string)=>map.get(key))};return new Response(JSON.stringify({result}));}) as typeof fetch);
 const r={wallet:CHALLENGE_WALLET,stationId:1,receivedWsolAtoms:"70000000",spentUsdcAtoms:"10000000",slot:f.plan.slot,signature:"confirmed",at:f.plan.preparedAt,plan:{accounts:{wsol:"C6K1LEGJ48YdTXzYYvHEZoRV1cMS5ZGzrYaPHDcWc77c",route:q.routePlan[0].swapInfo.ammKey},before:{wsolAtoms:"361964"}}} as never;
 const result=await readSolEntry(r,"https://rpc.example",undefined,f.plan.preparedAt);expect(result.performance?.solAmount).toBe("0.070000000");expect(result.performance?.cashUsdc).toBe("0.000000");expect(result.valueUsd).toMatch(/^\d+\.\d+$/);expect(result.executionEnabled).toBe(false);
});
it("uses Jupiter's rounded-up minimum output so slippage never exceeds 0.5 percent",async()=>{const {q,swap}=await fixture();q.outAmount="70000001";q.otherAmountThreshold="69650001";q.routePlan[0].swapInfo.outAmount=q.outAmount;const b=Buffer.from(swap.data,"base64");b.writeBigUInt64LE(70000001n,25);swap.data=b.toString("base64");expect(checkSolRoute(swap,q,swap.accounts.slice(9).map(a=>a.pubkey))).toBe(69650001n);});
