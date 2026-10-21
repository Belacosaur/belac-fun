import {afterEach,expect,it,vi} from "vitest";
import {readFile} from "node:fs/promises";
import * as k from "@solana/kit";
import {digest,decode64,encode64} from "./trade-wallet";
import {validateRecoveryPlan,verifyOwnerScan} from "./recovery-wallet";
const fixture=JSON.parse(await readFile("../jobs/src/fixtures/recovery-orca-mainnet.json","utf8"));
afterEach(()=>vi.unstubAllGlobals());
it("requires an independent full owner scan before sweeping and rejects hidden token accounts or stale context",async()=>{
 const p={...fixture.plan,before:{...fixture.plan.before,accounts:[]}};
 vi.stubGlobal("fetch",vi.fn(async(_u,init)=>{const q=JSON.parse(init.body);return new Response(JSON.stringify({data:{context:{slot:q.params[2].minContextSlot+1},value:[]}}));}));
 await expect(verifyOwnerScan(p,100)).resolves.toBe(102);
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({data:{context:{slot:99},value:[]}}))));
 await expect(verifyOwnerScan(p,100)).rejects.toThrow();
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({data:{context:{slot:101},value:[{pubkey:"unlisted"}]}}))));
 await expect(verifyOwnerScan(p,100)).rejects.toThrow();
});
it("accepts the captured full unsigned exit but rejects destination, fee, expiry and message changes",async()=>{
 const p={...fixture.plan,expiresAt:new Date(Date.now()+45000).toISOString()};
 await expect(validateRecoveryPlan(p)).resolves.toBeDefined();
 await expect(validateRecoveryPlan({...p,destination:p.source})).rejects.toThrow();
 await expect(validateRecoveryPlan({...p,feeLamports:"1000000"})).rejects.toThrow();
 await expect(validateRecoveryPlan({...p,expiresAt:new Date(0).toISOString()})).rejects.toThrow();
 await expect(validateRecoveryPlan({...p,messageHash:"0".repeat(64)})).rejects.toThrow();
});
it("rejects an unexpected program even when a malicious plan recomputes its message hash",async()=>{
 const p={...fixture.plan,expiresAt:new Date(Date.now()+45000).toISOString()},tx=k.getTransactionDecoder().decode(decode64(p.wireBase64)),m=k.getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
 const changed={...m,instructions:m.instructions.map((i,n)=>n===2?{...i,programAddressIndex:m.staticAccounts.indexOf(k.address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"))}:i)};
 const bytes=new Uint8Array(k.getCompiledTransactionMessageEncoder().encode(changed)),wire=new Uint8Array(65+bytes.length);wire[0]=1;wire.set(bytes,65);
 await expect(validateRecoveryPlan({...p,wireBase64:encode64(wire),messageHash:await digest(bytes)})).rejects.toThrow();
});
