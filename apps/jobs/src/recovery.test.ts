import { afterEach, expect, it, vi } from "vitest";
import {readFile} from "node:fs/promises";
import { recoveryStep, validateRecoveryRequest, RECOVERY_DESTINATION, isClosedAccount,buildRecoveryPlan,scanAccounts } from "./recovery.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import * as k from "@solana/kit";
const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));
function simulationBatches(calls:{request:{method:string;params:unknown[]};response:{result?:{value:{accounts:unknown[]}}};status:number}[]){
 return calls.flatMap(c=>{
  if(c.request.method!=="simulateTransaction")return [c];
  const opts=c.request.params[1] as {accounts:{addresses:string[]}},result=c.response.result!;
  return Array.from({length:Math.ceil(opts.accounts.addresses.length/5)},(_,i)=>({...c,response:{...c.response,result:{...result,value:{...result.value,accounts:result.value.accounts.slice(i*5,i*5+5)}}}}));
 });
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it("prepares an unsigned final sweep only after both owner scans are empty and deducts exactly its fee",async()=>{
 const source=975162821,fee=5000,methods:string[]=[];
 const account=(lamports:number)=>({owner:"11111111111111111111111111111111",lamports,executable:false,data:["","base64"]});
 const fetcher=(async(_u:unknown,init?:RequestInit)=>{
  const q=JSON.parse(String(init?.body));methods.push(q.method);let result;
  if(q.method==="getMultipleAccounts")result={context:{slot:200},value:q.params[0].map((a:string)=>a===CHALLENGE_WALLET?account(source):null)};
  else if(q.method==="getGenesisHash")result="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
  else if(q.method==="getTokenAccountsByOwner")result={context:{slot:200},value:[]};
  else if(q.method==="getLatestBlockhash")result=fixture.calls.find((c:{request:{method:string}})=>c.request.method==="getLatestBlockhash").response.result;
  else if(q.method==="getFeeForMessage")result={value:fee};
  else if(q.method==="simulateTransaction"){
   const tx=k.getTransactionDecoder().decode(Buffer.from(q.params[0],"base64")),m=k.getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
   expect(m.instructions).toHaveLength(1);expect(m.staticAccounts.slice(0,2)).toEqual([CHALLENGE_WALLET,RECOVERY_DESTINATION]);
   expect(Buffer.from(m.instructions[0]!.data!).readBigUInt64LE(4)).toBe(BigInt(source-fee));
   const addresses=q.params[1].accounts.addresses as string[];expect(addresses.length).toBeLessThanOrEqual(m.staticAccounts.length);
   result={context:{slot:200},value:{err:null,accounts:addresses.map(a=>a===RECOVERY_DESTINATION?account(source-fee):null),logs:[]}};
  }else throw new Error(`Unexpected RPC ${q.method}`);
  return new Response(JSON.stringify({result}));
 }) as typeof fetch;
 const p=await buildRecoveryPlan("test-sweep","https://rpc.example",fetcher);
 expect(p.step).toBe("sweep");expect(p.after.sourceLamports).toBe("0");expect(p.after.destinationLamports).toBe(String(source-fee));expect(p.before.accounts).toEqual([]);expect(methods.filter(m=>m==="getTokenAccountsByOwner")).toHaveLength(2);expect(methods).not.toContain("sendTransaction");
});
it("rejects lagging full-owner scans and carries each scan slot into the next token-program read",async()=>{
 const requests:number[]=[];const good=(async(_u:unknown,init?:RequestInit)=>{const q=JSON.parse(String(init?.body));requests.push(q.params[2].minContextSlot);return new Response(JSON.stringify({result:{context:{slot:q.params[2].minContextSlot+1},value:[]}}));}) as typeof fetch;
 expect((await scanAccounts("https://rpc.example",good,100)).slot).toBe(102);expect(requests).toEqual([100,101]);
 const stale=(async()=>new Response(JSON.stringify({result:{context:{slot:99},value:[]}}))) as typeof fetch;
 await expect(scanAccounts("https://rpc.example",stale,100)).rejects.toThrow("slot regressed");
});
it("replays the actual unsigned Orca closure simulation and never calls a submission method",async()=>{
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(Date.parse(fixture.plan.preparedAt));const queue=simulationBatches(fixture.calls),methods:string[]=[];
 const fetcher=vi.fn(async (_url:unknown,init?:RequestInit)=>{const req=JSON.parse(String(init?.body)),c=queue.shift()!;expect(req.method).toBe(c.request.method);methods.push(req.method);return new Response(JSON.stringify({...c.response,id:req.id}),{status:c.status});});
 vi.stubGlobal("fetch",fetcher);const plan=await buildRecoveryPlan(fixture.plan.id,"https://solana-rpc.publicnode.com",fetcher as typeof fetch);
 expect(plan.messageHash).toBe(fixture.plan.messageHash);expect(plan.after.orcaOpen).toBe(false);expect(plan.closedAccounts).toHaveLength(3);expect(plan.feeLamports).toBe("5500");expect(queue).toHaveLength(0);expect(methods).not.toContain("sendTransaction");
});
for(const step of ["kamino","swap"] as const)it(`replays the independent mainnet ${step} diagnostic without authorizing an out-of-sequence action`,async()=>{
 const f=JSON.parse(await readFile(new URL(`./fixtures/recovery-${step}-preview.json`,import.meta.url),"utf8"));vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(Date.parse(f.plan.preparedAt));const queue=simulationBatches(f.calls);
 const fetcher=vi.fn(async(_u:unknown,init?:RequestInit)=>{const q=JSON.parse(String(init?.body)),c=queue.shift()!;expect(q.method).toBe(c.request.method);return new Response(JSON.stringify({...c.response,id:q.id}),{status:c.status});});vi.stubGlobal("fetch",fetcher);
 const p=await buildRecoveryPlan(f.plan.id,"https://solana-rpc.publicnode.com",fetcher as typeof fetch,step);expect(p.messageHash).toBe(f.plan.messageHash);expect(p.before.next).not.toBe(p.step);expect(p.feeLamports).toBe("5500");expect(queue).toHaveLength(0);
});
it("pins recovery to the compromised source and the approved new wallet", () => {
  expect(() => validateRecoveryRequest(CHALLENGE_WALLET, RECOVERY_DESTINATION)).not.toThrow();
  expect(() => validateRecoveryRequest(RECOVERY_DESTINATION, CHALLENGE_WALLET)).toThrow();
  expect(() => validateRecoveryRequest(CHALLENGE_WALLET, CHALLENGE_WALLET)).toThrow();
});
it("recognizes simulated account closure without hiding funded or token-owned accounts", () => {
  expect(isClosedAccount(null)).toBe(true);
  expect(isClosedAccount({owner:"11111111111111111111111111111111",lamports:0,executable:false,data:["","base64"]})).toBe(true);
  expect(isClosedAccount({owner:"11111111111111111111111111111111",lamports:1,executable:false,data:["","base64"]})).toBe(false);
  expect(isClosedAccount({owner:"token",lamports:0,executable:false,data:["","base64"]})).toBe(false);
});
it("requires positions, cash conversion and account cleanup before any SOL sweep", () => {
  const state = { orcaOpen: true, receiptAtoms: "8295955", usdcAtoms: "70077648", openAccounts: 4, sourceLamports: "113539467" };
  expect(recoveryStep(state)).toBe("orca");
  state.orcaOpen = false; expect(recoveryStep(state)).toBe("kamino");
  state.receiptAtoms = "0"; expect(recoveryStep(state)).toBe("swap");
  state.usdcAtoms = "0"; expect(recoveryStep(state)).toBe("cleanup");
  state.openAccounts = 0; expect(recoveryStep(state)).toBe("sweep");
  state.sourceLamports = "0"; expect(recoveryStep(state)).toBe("complete");
});
