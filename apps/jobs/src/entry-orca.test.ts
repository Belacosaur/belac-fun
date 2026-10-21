import {describe,it,expect,vi} from "vitest";
import {buildOrcaEntry,readOrcaEntry} from "./entry-orca.js";

import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import * as k from "@solana/kit";
import {Decimal} from "decimal.js";
import type {StationEntryPlan,StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
import {CHALLENGE_WALLET} from "../../../packages/contracts/src/trades.js";
describe("Orca owner entry",()=>{
 it("rejects retired wallets, other stations and missing browser mint before reading RPC",async()=>{
  const f=vi.fn();
  for(const input of [{wallet:"HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j",stationId:8,mint:CHALLENGE_WALLET},{wallet:CHALLENGE_WALLET,stationId:6,mint:CHALLENGE_WALLET},{wallet:CHALLENGE_WALLET,stationId:8}]) await expect(buildOrcaEntry(input,"https://example.com",undefined,f)).rejects.toThrow();
  expect(f).not.toHaveBeenCalled();
 });
 it("never attributes retired inventory to the new challenge",async()=>{
  await expect(readOrcaEntry({wallet:"retired"} as never,"https://example.com")).rejects.toThrow();
 });
 it.each(["fresh","stale slot","stale time","future time","missing cash","missing residual"])("requires current receipt inventory and freshness (%s)",async(mode)=>{
  const plan=JSON.parse(await readFile(new URL("./fixtures/orca-entry-mainnet.json",import.meta.url),"utf8")) as StationEntryPlan;
  const sdk=createRequire(createRequire(import.meta.url).resolve("@orca-so/whirlpools")),c=sdk("@orca-so/whirlpools-client"),core=sdk("@orca-so/whirlpools-core"),o=plan.accounts;
  const pool={...c.getWhirlpoolDecoder().decode(Buffer.alloc(653)),tickSpacing:4,feeTierIndexSeed:new Uint8Array([4,0]),sqrtPrice:core.priceToSqrtPrice(100,9,6),tickCurrentIndex:core.priceToTickIndex(100,9,6),tokenMintA:k.address("So11111111111111111111111111111111111111112"),tokenMintB:k.address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),tokenVaultA:k.address(o.vaultA!),tokenVaultB:k.address(o.vaultB!)};
  const position={...c.getPositionDecoder().decode(Buffer.alloc(216)),whirlpool:k.address(o.pool!),positionMint:k.address(plan.mint!),liquidity:BigInt(String(plan.details.liquidity)),tickLowerIndex:Number(plan.details.tickLower),tickUpperIndex:Number(plan.details.tickUpper),feeOwedA:1000000n,feeOwedB:200000n};
  const account=(owner:string,b:Uint8Array|k.ReadonlyUint8Array)=>({owner,executable:false,lamports:999999999999,data:[Buffer.from(b).toString("base64"),"base64"]});
  const nft=Buffer.alloc(165);Buffer.from(k.getAddressEncoder().encode(k.address(plan.mint!))).copy(nft);Buffer.from(k.getAddressEncoder().encode(k.address(CHALLENGE_WALLET))).copy(nft,32);nft.writeBigUInt64LE(1n,64);nft[108]=1;
  const raw=[account("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",c.getWhirlpoolEncoder().encode(pool)),account("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",c.getPositionEncoder().encode(position)),account("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",nft),...[position.tickLowerIndex,position.tickUpperIndex].map(t=>account("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",c.getFixedTickArrayEncoder().encode({...c.getFixedTickArrayDecoder().decode(Buffer.alloc(9988)),whirlpool:k.address(o.pool!),startTickIndex:core.getTickArrayStartTickIndex(t,4)})))];
  const ownedToken=(mint:string,amount:bigint)=>{const bytes=Buffer.from(nft);Buffer.from(k.getAddressEncoder().encode(k.address(mint))).copy(bytes);bytes.writeBigUInt64LE(amount,64);return account("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",bytes);};
  // Other station entries may consume the rest of the old wallet USDC balance.
  raw.push(ownedToken(pool.tokenMintB,mode==="missing cash"?175064n:175065n),ownedToken(pool.tokenMintA,mode==="missing residual"?569770n:569771n));
  const requests:{method:string;params:unknown[]}[]=[],now="2026-10-21T01:00:00.000Z",time=Date.parse(now)/1000;
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{const q=JSON.parse(init.body);requests.push(q);return new Response(JSON.stringify({result:q.method==="getGenesisHash"?"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d":q.method==="getBlockTime"?time+(mode==="stale time"?-91:mode==="future time"?91:0):{context:{slot:mode==="stale slot"?0:2},value:raw}}));}));
  const receipt:StationEntryReceipt={plan,wallet:CHALLENGE_WALLET,stationId:8,signature:"confirmed-only-test",at:"2026-10-21T00:00:00.000Z",slot:1,spentUsdcAtoms:"9824935",receivedWsolAtoms:"207807",feeLamports:"10000",rentLamports:"7143520"};
  try{const read=readOrcaEntry(receipt,"https://example.com",undefined,now);if(mode!=="fresh"){await expect(read).rejects.toThrow();return;}const result=await read,p=result.performance!;expect(p.cashUsdc).toBe("0.175065");expect(p.residualSol).toBe("0.000207807");expect(p.accruedFeesSol).toBe("0.001000000");expect(p.accruedFeesUsdc).toBe("0.200000");
   expect(new Decimal(p.solAmount).sub(p.principalSol!).toFixed(9)).toBe("0.001207807");expect(new Decimal(p.equityUsd).lt(11)).toBe(true);expect(result.positionCount).toBe(1);expect(requests.map(q=>q.method)).toEqual(["getGenesisHash","getMultipleAccounts","getBlockTime"]);
   expect(requests[1]!.params).toEqual([[o.pool,o.position,o.nft,o.tickArrayLower,o.tickArrayUpper,o.usdc,o.wsol],{encoding:"base64",commitment:"confirmed",minContextSlot:receipt.slot}]);expect(requests[2]!.params).toEqual([2]);
  }finally{vi.unstubAllGlobals();}
 });
});
