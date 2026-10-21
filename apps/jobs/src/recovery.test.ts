import { afterEach, expect, it, vi } from "vitest";
import {readFile} from "node:fs/promises";
import { recoveryStep, validateRecoveryRequest, RECOVERY_DESTINATION, isClosedAccount,buildRecoveryPlan,scanAccounts } from "./recovery.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it("rejects lagging full-owner scans and carries each scan slot into the next token-program read",async()=>{
 const requests:number[]=[];const good=(async(_u:unknown,init?:RequestInit)=>{const q=JSON.parse(String(init?.body));requests.push(q.params[2].minContextSlot);return new Response(JSON.stringify({result:{context:{slot:q.params[2].minContextSlot+1},value:[]}}));}) as typeof fetch;
 expect((await scanAccounts("https://rpc.example",good,100)).slot).toBe(102);expect(requests).toEqual([100,101]);
 const stale=(async()=>new Response(JSON.stringify({result:{context:{slot:99},value:[]}}))) as typeof fetch;
 await expect(scanAccounts("https://rpc.example",stale,100)).rejects.toThrow("slot regressed");
});
it("replays the actual unsigned Orca closure simulation and never calls a submission method",async()=>{
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(Date.parse(fixture.plan.preparedAt));const queue=[...fixture.calls],methods:string[]=[];
 const fetcher=vi.fn(async (_url:unknown,init?:RequestInit)=>{const req=JSON.parse(String(init?.body)),c=queue.shift();expect(req.method).toBe(c.request.method);methods.push(req.method);return new Response(JSON.stringify({...c.response,id:req.id}),{status:c.status});});
 vi.stubGlobal("fetch",fetcher);const plan=await buildRecoveryPlan(fixture.plan.id,"https://solana-rpc.publicnode.com",fetcher as typeof fetch);
 expect(plan.messageHash).toBe(fixture.plan.messageHash);expect(plan.after.orcaOpen).toBe(false);expect(plan.closedAccounts).toHaveLength(3);expect(plan.feeLamports).toBe("5500");expect(queue).toHaveLength(0);expect(methods).not.toContain("sendTransaction");
});
for(const step of ["kamino","swap"] as const)it(`replays the independent mainnet ${step} diagnostic without authorizing an out-of-sequence action`,async()=>{
 const f=JSON.parse(await readFile(new URL(`./fixtures/recovery-${step}-preview.json`,import.meta.url),"utf8"));vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(Date.parse(f.plan.preparedAt));const queue=[...f.calls];
 const fetcher=vi.fn(async(_u:unknown,init?:RequestInit)=>{const q=JSON.parse(String(init?.body)),c=queue.shift();expect(q.method).toBe(c.request.method);return new Response(JSON.stringify({...c.response,id:q.id}),{status:c.status});});vi.stubGlobal("fetch",fetcher);
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
