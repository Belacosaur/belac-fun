import { afterEach, expect, it, vi } from "vitest";
import { checkMeteoraInput } from "./meteora-builder.js";
import { buildMeteoraEntry } from "./meteora-builder.js";
import { readFile } from "node:fs/promises";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import * as k from "@solana/kit";
it("includes missing WSOL setup atomically and charges its rent only to SOL reserves",async()=>{
 const f=JSON.parse(await readFile(new URL("./fixtures/meteora-new-wallet-synthetic.json",import.meta.url),"utf8"));
 vi.spyOn(Date,"now").mockReturnValue(Date.parse(f.plan.preparedAt));
 const first=f.calls.find((c:{request?:{method:string}})=>c.request?.method==="getMultipleAccounts");first.response.result.value[2]=null;
 const sim=f.calls.find((c:{request?:{method:string}})=>c.request?.method==="simulateTransaction");
 const post=sim.response.result.value.accounts,rent=1488440n,oldWrapped=BigInt(f.plan.beforeWsolAtoms),wsol=Buffer.from(post[2].data[0],"base64");
 wsol.writeBigUInt64LE(wsol.readBigUInt64LE(64)-oldWrapped,64);post[2].data[0]=wsol.toString("base64");post[2].lamports-=Number(oldWrapped);post[0].lamports-=Number(rent);
 const queue=[...f.calls];const fetcher=(async(_u:unknown,init?:RequestInit)=>{const c=queue.shift(),q=init?.body?JSON.parse(String(init.body)):null;if(q?.method==="simulateTransaction"){const tx=k.getTransactionDecoder().decode(Buffer.from(q.params[0],"base64")),m=k.getCompiledTransactionMessageDecoder().decode(tx.messageBytes);expect(m.instructions).toHaveLength(6);expect(m.staticAccounts[m.instructions[2].programAddressIndex]).toBe("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");}return new Response(JSON.stringify(c.response),{status:c.status});}) as typeof fetch;
 const p=await buildMeteoraEntry({wallet:CHALLENGE_WALLET,station:5,mint:f.plan.mint},"https://solana-rpc.publicnode.com",undefined,fetcher);
 expect(p.setupWsol).toBe(true);expect(p.setupRentLamports).toBe(String(rent));expect(p.rentLamports).toBe(String(7223760n+rent));expect(p.beforeWsolAtoms).toBe("0");expect(BigInt(p.maxSpendUsdcAtoms)).toBeLessThanOrEqual(10000000n);
 expect(BigInt(p.feePoolAfterLamports)).toBe(BigInt(p.feePoolBeforeLamports)-BigInt(p.rentLamports)-BigInt(p.feeLamports));
});
afterEach(() => vi.restoreAllMocks());
it("only prepares station five with a distinct valid mint and the fixed challenge budget", () => {
  expect(() => checkMeteoraInput({ wallet: CHALLENGE_WALLET, station: 8, mint: CHALLENGE_WALLET })).toThrow();
  expect(() => checkMeteoraInput({ wallet: "wrong", station: 5, mint: CHALLENGE_WALLET })).toThrow();
  expect(() => checkMeteoraInput({ wallet: CHALLENGE_WALLET, station: 5, mint: CHALLENGE_WALLET })).toThrow();
});
it("replays the full captured unsigned builder and preserves principal/fee separation", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/meteora-new-wallet-synthetic.json", import.meta.url), "utf8"));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(fixture.plan.preparedAt));
  const calls: string[] = [], queue = [...fixture.calls];
  const fetcher = (async (url: string, init: RequestInit) => {
    const request = init.body ? JSON.parse(init.body as string) : null;
    const item = queue.shift(); expect(String(url)).toBe(item.url);
    if (request?.method) { calls.push(request.method); expect(request.method).toBe(item.request.method); }
    if (request?.method === "simulateTransaction") { expect(request.params[1].sigVerify).toBe(false); expect(request.params[1].replaceRecentBlockhash).toBe(false); }
    return new Response(JSON.stringify(item.response), { status: item.status });
  }) as typeof fetch;
  const plan = await buildMeteoraEntry({ wallet: CHALLENGE_WALLET, station: 5, mint: fixture.plan.mint }, "https://solana-rpc.publicnode.com", undefined, fetcher);
  expect(plan.messageHash).toBe(fixture.plan.messageHash);
  expect(BigInt(plan.maxSpendUsdcAtoms)).toBeLessThanOrEqual(10000000n);
  expect(plan.feeLamports).toBe("11000"); expect(plan.rentLamports).toBe("7223760");
  expect(plan.feePoolAfterLamports).toBe("12624640");
  expect(calls).not.toContain("sendTransaction"); expect(queue).toHaveLength(0);
});
