/** Public finalized entry attribution. No signer, transaction builder or execution capability. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Decimal } from "decimal.js";
import { SecurityRpc, TOKEN_PROGRAM, TOKEN_2022 } from "./diligence/security.js";
import type { ChallengeAccounting, StrategyPerformance, PlatformBalance } from "../../../packages/contracts/src/studio.js";
import type { KaminoEntry } from "./kamino-direct.js";
import type { MeteoraReceipt } from "../../../packages/contracts/src/trades.js";

const sdk = createRequire(createRequire(import.meta.url).resolve("@orca-so/whirlpools"));
const client = sdk("@orca-so/whirlpools-client"), core = sdk("@orca-so/whirlpools-core");
const MAINNET="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", PROGRAM="whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const SOL="So11111111111111111111111111111111111111112", USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** Sources: artifacts/execution/2026-10-21/station-{1,8}-receipt.json, both finalized. */
export const ACTIVE_ENTRIES = {
  wallet:"HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j",
  usdcAta:"8DDPMR9LcM7YaHfwq41TteyGpnFi222gCgDEZUuy5PmE", wsolAta:"G5gUmEtvsE2RAj9gFSDP5ZgZ5WW4CeNRchj3r8fE4uvf",
  hold:{sol:93680067n,cost:10000000n,at:"2026-10-21T00:55:01.000Z",signature:"2vFhUtHSXHX3Pg5hRgtMhoVasLAnZCFJZ5SLoXxSoUtfWPjNtH1q3wMQD4PNcjRv5aTHPoMhWneVinZCjXrJaUgA"},
  orca:{pool:"Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",position:"GmCZFFr96WxLefnXa93HyJ8UeSaYMsgkkYLcJwg7o7aL",nft:"9HPHs9VSEbVpWaRX9oFBqK7baK9vgtLKeiwB5d7mkNmi",mint:"8pN95gNGgAcRpGF3EnNR8RwDYkH9jxozDebgo2G4bkom",liquidity:157245224n,lower:-24612,upper:-20556,cash:77548n,wsol:209636n,cost:9922452n,at:"2026-10-21T00:55:39.000Z",signature:"4og1j7QYep3KZEG7aSGjbpwoR6D4cSygtc4GZM3PDn2bNokx36mHFcAYGqDuC96uJ9f887ZcV2y6apZ25efuan2R"},
  operating:{available:21353240n,accounts:8631960n,fees:15800n,senderAccountCapital:1488440n},unallocated:80000000n,surplus:100n,
} as const;
type Account={owner:string;lamports:number;executable:boolean;data:[string,string]};
interface Reader {call(method:string,params:unknown[]):Promise<unknown>}
const sol=(n:bigint)=>new Decimal(n.toString()).div(1e9).toFixed(9),usdc=(n:bigint)=>new Decimal(n.toString()).div(1e6).toFixed(6);
const object=(v:unknown):Record<string,unknown>=>{assert(v&&typeof v==="object"&&!Array.isArray(v));return v as Record<string,unknown>;};
function bytes(a:Account|undefined,owner:string,discriminator?:Uint8Array){assert(a&&a.owner===owner&&a.executable===false,"Unexpected account owner");assert.equal(a.data[1],"base64");const b=Buffer.from(a.data[0],"base64");if(discriminator)assert(b.subarray(0,8).equals(Buffer.from(discriminator)),"Account discriminator mismatch");return b;}
function tokenAmount(a:Account|undefined,mint:string,owner:string,program=TOKEN_PROGRAM){const b=bytes(a,program);assert(b.length>=165);assert.equal(clientAddress(b.subarray(0,32)),mint);assert.equal(clientAddress(b.subarray(32,64)),owner);assert.equal(b[108],1,"Token frozen/uninitialized");assert.equal(b.readUInt32LE(72),0,"Unexpected delegate");return b.readBigUInt64LE(64);}
import { getAddressDecoder } from "@solana/kit";
const clientAddress=(b:Uint8Array)=>getAddressDecoder().decode(b);

export async function readActivePositions(wallet:string,rpcUrl:string,previous?:ChallengeAccounting,reader:Reader=new SecurityRpc(rpcUrl),now=new Date().toISOString(),kamino?:{entry:KaminoEntry;balance:PlatformBalance},meteora?:{entry:MeteoraReceipt;balance:PlatformBalance},failedFees=0n):Promise<ChallengeAccounting>{
  assert.equal(wallet,ACTIVE_ENTRIES.wallet);assert(Number.isFinite(Date.parse(now)));assert.equal(await reader.call("getGenesisHash",[]),MAINNET);
  const e=ACTIVE_ENTRIES,p=e.orca;
  const cost=kamino?BigInt(kamino.entry.spentUsdcAtoms):0n,rent=kamino?BigInt(kamino.entry.accountRentLamports):0n,network=kamino?BigInt(kamino.entry.networkFeeLamports):0n;
  if(kamino){
    assert(kamino.balance.lending?.state==="active"&&kamino.balance.executionEnabled===false);
    assert(cost>0n&&cost<=10000000n&&rent>=0n&&network>=0n);
    assert.equal(kamino.balance.lending.receiptAtoms,kamino.entry.receiptAtoms);
    assert.equal(kamino.balance.lending.redeemableUsdc,kamino.balance.valueUsd);
    assert(Number.isFinite(Date.parse(kamino.entry.at))&&kamino.entry.at<=now);
    assert(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(kamino.entry.signature));
  }
  assert(failedFees>=0n);
  const metCash=meteora?10000000n-BigInt(meteora.entry.spentUsdcAtoms):0n,metWsol=meteora?BigInt(meteora.entry.residualWsolAtoms):0n,metRent=meteora?BigInt(meteora.entry.rentLamports):0n,metFee=meteora?BigInt(meteora.entry.feeLamports):0n;
  if(meteora){assert(meteora.entry.wallet===wallet&&meteora.balance.performance?.stationId===5&&meteora.balance.performance.entrySignature===meteora.entry.signature);assert(metCash>=0n&&metCash<10000000n&&metWsol>=0n&&metRent>=0n&&metFee>0n);}
  const unallocated=e.unallocated-cost-(meteora?10000000n:0n),operating=e.operating.available-rent-network-metRent-metFee-failedFees;
  assert(unallocated>=0n&&operating>=0n);
  const arrays:string[]=await Promise.all([p.lower,p.upper].map(t=>client.getTickArrayAddress(p.pool,core.getTickArrayStartTickIndex(t,4)).then((a:[string,number])=>a[0])));
  const addresses=[wallet,e.usdcAta,e.wsolAta,p.position,p.nft,p.mint,p.pool,...arrays];
  const batch=object(await reader.call("getMultipleAccounts",[addresses,{encoding:"base64",commitment:"confirmed",...(previous?{minContextSlot:previous.slot}:{})}]));
  const slot=object(batch.context).slot;assert(typeof slot==="number"&&Number.isSafeInteger(slot)&&slot>0);if(previous)assert(slot>=previous.slot,"RPC slot regressed");
  if(previous && now>previous.observedAt) assert(slot>previous.slot,"RPC slot is stuck; retain the previous valuation as stale");
  const chainTime=await reader.call("getBlockTime",[slot]);
  assert(typeof chainTime==="number"&&Number.isSafeInteger(chainTime),"Chain timestamp unavailable");
  const age=Date.parse(now)/1000-chainTime;
  assert(age>=-30&&age<=90,"RPC valuation context is not fresh");
  assert(Array.isArray(batch.value)&&batch.value.length===addresses.length);const aa=batch.value as Account[];
  bytes(aa[0],"11111111111111111111111111111111");assert(Number.isSafeInteger(aa[0]!.lamports));
  const native=BigInt(aa[0]!.lamports),stable=tokenAmount(aa[1],USDC,wallet),wrapped=tokenAmount(aa[2],SOL,wallet);
  assert(native>=e.hold.sol+operating,"SOL allocation or operating reserve shortfall");
  assert(stable>=p.cash+unallocated+e.surplus+metCash,"USDC attribution shortfall");assert(wrapped>=p.wsol+metWsol,"Attributed residual WSOL missing");
  assert.equal(tokenAmount(aa[4],p.mint,wallet,TOKEN_2022),1n,"Position NFT missing");
  const mint=bytes(aa[5],TOKEN_2022);assert.equal(mint.readBigUInt64LE(36),1n);assert.equal(mint[44],0);assert.equal(mint[45],1);
  const position=client.getPositionDecoder().decode(bytes(aa[3],PROGRAM,client.POSITION_DISCRIMINATOR));
  assert.equal(position.whirlpool,p.pool);assert.equal(position.positionMint,p.mint);assert.equal(position.liquidity,p.liquidity,"Position liquidity changed; reconcile first");assert.equal(position.tickLowerIndex,p.lower);assert.equal(position.tickUpperIndex,p.upper);
  const pool=client.getWhirlpoolDecoder().decode(bytes(aa[6],PROGRAM,client.WHIRLPOOL_DISCRIMINATOR));
  assert.equal(pool.tokenMintA,SOL);assert.equal(pool.tokenMintB,USDC);assert.equal(pool.tickSpacing,4);assert(pool.sqrtPrice>0n);
  const ticks=[7,8].map((i,n)=>{const a=client.getTickArrayDecoder().decode(bytes(aa[i],PROGRAM,client.TICK_ARRAY_DISCRIMINATOR));assert.equal(a.whirlpool,p.pool);assert.equal(a.startTickIndex,core.getTickArrayStartTickIndex([p.lower,p.upper][n],4));const tick=a.ticks[core.getTickIndexInArray([p.lower,p.upper][n],a.startTickIndex,4)];assert(tick.initialized);return tick;});
  const principal=core.decreaseLiquidityQuote(position.liquidity,0,pool.sqrtPrice,p.lower,p.upper),fees=core.collectFeesQuote(pool,position,...ticks);
  const rewards=core.collectRewardsQuote(pool,position,...ticks,BigInt(Math.floor(Date.parse(now)/1000)));
  assert(rewards.rewards.every((r:{rewardsOwed:bigint})=>r.rewardsOwed===0n),"Unpriced incentive rewards require valuation support");
  const price=new Decimal(String(pool.sqrtPrice)).pow(2).div(new Decimal(2).pow(128)).mul(1000);
  const holdValue=new Decimal(sol(e.hold.sol)).mul(price),lpSol=principal.tokenEstA+fees.feeOwedA+p.wsol;
  const lpValue=new Decimal(sol(lpSol)).mul(price).add(usdc(principal.tokenEstB+fees.feeOwedB+p.cash));
  const common=(stationId:1|8,value:Decimal,cost:bigint,at:string,signature:string):StrategyPerformance=>{
    const equityUsd=value.toFixed(12),prior=previous?.wallet===wallet?previous.strategies.find(s=>s.stationId===stationId):undefined;
    const history=[...(prior?.history??[]).filter(h=>h.at<now),{at:now,valueUsd:equityUsd}].slice(-120);
    return {stationId,allocationUsd:"10",entryCostUsdc:usdc(cost),equityUsd,pnlUsd:value.sub(10).toFixed(12),pnlPct:value.sub(10).mul(10).toFixed(8),solAmount:stationId===1?sol(e.hold.sol):sol(lpSol),cashUsdc:stationId===1?"0.000000":usdc(p.cash),entryAt:at,entrySignature:signature,executionEnabled:false,history};
  };
  const hold=common(1,holdValue,e.hold.cost,e.hold.at,e.hold.signature),lp:StrategyPerformance={...common(8,lpValue,p.cost,p.at,p.signature),principalSol:sol(principal.tokenEstA),principalUsdc:usdc(principal.tokenEstB),residualSol:sol(p.wsol),accruedFeesSol:sol(fees.feeOwedA),accruedFeesUsdc:usdc(fees.feeOwedB),accruedFeesUsd:new Decimal(sol(fees.feeOwedA)).mul(price).add(usdc(fees.feeOwedB)).toFixed(12),positionAddress:p.position,lowerPrice:String(core.tickIndexToPrice(p.lower,9,6)),upperPrice:String(core.tickIndexToPrice(p.upper,9,6)),inRange:pool.tickCurrentIndex>=p.lower&&pool.tickCurrentIndex<p.upper};
  const strategies:StrategyPerformance[]=[hold,lp];let kaminoValue=new Decimal(0);
  if(kamino){
    const l=kamino.balance.lending!;
    assert(Math.abs(l.slot-slot)<=300,"Kamino context differs too far from portfolio");
    const age=Date.parse(now)-Date.parse(l.accruedAt);assert(age>=-30000&&age<=300000);
    kaminoValue=new Decimal(kamino.balance.valueUsd!);assert(kaminoValue.isFinite()&&kaminoValue.gte(0));
    const basis=new Decimal(usdc(cost)),pnl=kaminoValue.sub(basis),prior=previous?.strategies.find(s=>s.stationId===6);
    strategies.push({stationId:6,allocationUsd:basis.toFixed(),entryCostUsdc:usdc(cost),equityUsd:kaminoValue.toFixed(12),pnlUsd:pnl.toFixed(12),pnlPct:pnl.div(basis).mul(100).toFixed(8),solAmount:"0.000000000",cashUsdc:"0.000000",entryAt:kamino.entry.at,entrySignature:kamino.entry.signature,executionEnabled:false,history:[...(prior?.history??[]).filter(h=>h.at<now),{at:now,valueUsd:kaminoValue.toFixed(12)}].slice(-120)});
  }
  let metValue=new Decimal(0);if(meteora){metValue=new Decimal(meteora.balance.valueUsd!);assert(metValue.isFinite()&&metValue.gte(0));strategies.push(meteora.balance.performance!);}
  const equity=holdValue.add(lpValue).add(usdc(unallocated)).add(kaminoValue).add(metValue);
  return {wallet,slot,observedAt:now,solPriceUsd:price.toFixed(12),equityUsd:equity.toFixed(12),pnlUsd:equity.sub(100).toFixed(12),pnlPct:equity.sub(100).toFixed(8),allocatedUsd:new Decimal(20).add(usdc(cost)).add(meteora?10:0).toFixed(6),unallocatedUsdc:usdc(unallocated),surplusUsdc:usdc(e.surplus),unattributedSol:sol(native-e.hold.sol-operating),unattributedUsdc:usdc(stable-p.cash-unallocated-e.surplus-metCash),strategies,feePool:{availableSol:sol(operating),valueUsd:new Decimal(sol(operating)).mul(price).toFixed(12),accountCapitalSol:sol(e.operating.accounts+rent+metRent),networkFeesSol:sol(e.operating.fees+network+metFee+failedFees),senderFundedAccountCapitalSol:sol(e.operating.senderAccountCapital)},valuationBasis:"SOL/USDC pool mark; USDC=$1. LP principal + accrued swap fees + residual cash/tokens; confirmed Kamino receipt tokens at last accrued reserve rate when present. Operating fees, rent capital and future exit costs excluded from strategy P&L.",disabledStations:[2,3,4,5,6,7,9,10].filter(id=>!(id===6&&kamino)&&!(id===5&&meteora))};
}
