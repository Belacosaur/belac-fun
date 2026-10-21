import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import * as k from "@solana/kit";
import { CHALLENGE_WALLET, TRADE_TOKEN_ACCOUNTS } from "../../../packages/contracts/src/trades.js";
import { KAMINO_DIRECT as c, decodeKaminoReserve } from "./kamino-direct.js";
import { buildKaminoEntry, readKaminoEntry } from "./entry-kamino.js";
const f = JSON.parse(await readFile(new URL("./fixtures/kamino-direct-mainnet.json", import.meta.url), "utf8"));
const enc = (a:string) => Buffer.from(k.getAddressEncoder().encode(k.address(a)));
function token(mint:string, amount:bigint, owner:string=CHALLENGE_WALLET) { const b=Buffer.alloc(165);enc(mint).copy(b);enc(owner).copy(b,32);b.writeBigUInt64LE(amount,64);b[108]=1;return {owner:c.tokenProgram, executable:false,lamports:2039280,data:[b.toString("base64"),"base64"]}; }
async function fixture(setup=true, change: "none"|"wsol"|"debit"|"rent"|"shares"="none") {
 const ata=(await k.getProgramDerivedAddress({programAddress:k.address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),seeds:[enc(CHALLENGE_WALLET),enc(c.tokenProgram),enc(c.collateralMint)]}))[0];
 const r=decodeKaminoReserve(f.reserve),mint=Buffer.alloc(82);mint.writeBigUInt64LE(BigInt(r.collateral.mintTotalSupply),36);mint[44]=6;mint[45]=1;
 const map:Record<string,unknown>={ [CHALLENGE_WALLET]:{owner:"11111111111111111111111111111111",executable:false,lamports:20000000,data:["","base64"]},[TRADE_TOKEN_ACCOUNTS.usdc]:token(c.usdcMint,30000000n),[TRADE_TOKEN_ACCOUNTS.wsol]:token("So11111111111111111111111111111111111111112",123n),[ata]:setup?null:token(c.collateralMint,100n),[c.reserve]:f.reserve,[c.market]:f.market,[c.collateralMint]:{owner:c.tokenProgram,executable:false,data:[mint.toString("base64"),"base64"]},[c.vault]:token(c.usdcMint,BigInt(r.liquidity.totalAvailableAmount),c.authority)};
 const fetcher=vi.fn(async (_:unknown, opts?:RequestInit)=>{ const q=JSON.parse(String(opts?.body));let result:unknown;
 if(q.method==="getGenesisHash")result="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
 else if(q.method==="getMultipleAccounts")result={context:{slot:f.slot},value:q.params[0].map((a:string)=>map[a]??null)};
 else if(q.method==="getLatestBlockhash")result={value:{blockhash:"11111111111111111111111111111111",lastValidBlockHeight:1000}};
 else if(q.method==="getFeeForMessage")result={value:5000};
 else if(q.method==="getBlockTime")result=Math.floor(Date.parse(f.observedAt)/1000);
 else if(q.method==="simulateTransaction")result={context:{slot:f.slot},value:{err:null,logs:[],accounts:q.params[1].accounts.addresses.map((a:string)=> a===CHALLENGE_WALLET?{...map[a] as object,lamports:20000000-5000-(setup?2039280:0)-(change==="rent"?1:0)}:a===TRADE_TOKEN_ACCOUNTS.usdc?token(c.usdcMint,change==="debit"?19999999n:20000000n):a===TRADE_TOKEN_ACCOUNTS.wsol?token("So11111111111111111111111111111111111111112",change==="wsol"?122n:123n):a===ata?token(c.collateralMint,(setup?0n:100n)+(change==="shares"?1n:8295976n)):map[a])}};
 else throw new Error(q.method);
 return new Response(JSON.stringify({result})); }) as unknown as typeof fetch;
 return {fetcher,map,ata};
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(f.observedAt));});afterEach(()=>vi.useRealTimers());
it.each([true,false])("prepares unsigned direct 10 USDC lending, preserving other holdings (setup %s)",async setup=>{ const {fetcher,ata}=await fixture(setup); const p=await buildKaminoEntry({wallet:CHALLENGE_WALLET,stationId:6},"https://rpc.example",undefined,fetcher);expect(p.accounts.collateralAta).toBe(ata);expect(p.details.receiptAtoms).toBe("8295976");expect(p.details.setupCollateral).toBe(setup);expect(p.rentLamports).toBe(setup?"2039280":"0");expect(p.after.wsolAtoms).toBe("123");const w=Buffer.from(p.wireBase64,"base64");expect(w[0]).toBe(1);expect(w.subarray(1,65).equals(Buffer.alloc(64))).toBe(true);expect(w.length).toBeLessThanOrEqual(1232);expect(p.simulatedSpendUsdcAtoms).toBe("10000000");expect(p.lookupTables).toEqual({});});
it.each(["wsol","debit","rent","shares"] as const)("rejects unreviewed %s balance changes",async change=>{const {fetcher}=await fixture(true,change);await expect(buildKaminoEntry({wallet:CHALLENGE_WALLET,stationId:6},"https://rpc.example",undefined,fetcher)).rejects.toThrow();});
it("rejects retired wallet and wrong station before RPC",async()=>{ const fetcher=vi.fn();for(const input of [{wallet:c.wallet,stationId:6},{wallet:CHALLENGE_WALLET,stationId:8}])await expect(buildKaminoEntry(input,"https://rpc.example",undefined,fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled(); });
it("values only newly acquired shares, retaining attribution when unrelated shares exist",async()=>{const {fetcher,map,ata}=await fixture(false);const p=await buildKaminoEntry({wallet:CHALLENGE_WALLET,stationId:6},"https://rpc.example",undefined,fetcher);map[ata]=token(c.collateralMint,8296076n+5000n);vi.stubGlobal("fetch",fetcher);try {const b=await readKaminoEntry({wallet:CHALLENGE_WALLET,stationId:6,signature:"1".repeat(88),at:f.observedAt,slot:f.slot,spentUsdcAtoms:"10000000",receivedWsolAtoms:"0",feeLamports:"5000",rentLamports:"0",plan:p},"https://rpc.example",undefined,f.observedAt);expect(b.valueUsd).toBe("9.999999");expect(b.performance?.allocationUsd).toBe("10");expect(b.lending?.receiptAtoms).toBe("8295976");expect(b.executionEnabled).toBe(false);}finally {vi.unstubAllGlobals();}});
