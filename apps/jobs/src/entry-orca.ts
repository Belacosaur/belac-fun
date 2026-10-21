/** Unsigned atomic Orca entry; the caller supplies only its browser mint address. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import * as k from "@solana/kit";
import {Decimal} from "decimal.js";
import type {StationEntryPlan,StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
import type {PlatformBalance,StrategyPerformance} from "../../../packages/contracts/src/studio.js";
import {CHALLENGE_WALLET,TRADE_TOKEN_ACCOUNTS} from "../../../packages/contracts/src/trades.js";
import {ORCA_ENTRY,validateOrcaEntryPlan} from "../../web/src/station/entry-orca-wallet.js";
import {tradeRpc,type TradeRpc} from "./trade-rpc.js";
import {tokenAtoms} from "./meteora-builder.js";
import type {DammAccount} from "./meteora-damm.js";

export {validateOrcaEntryPlan};
const sdk=createRequire(createRequire(import.meta.url).resolve("@orca-so/whirlpools")),client=sdk("@orca-so/whirlpools-client"),core=sdk("@orca-so/whirlpools-core");
const o=ORCA_ENTRY,m={wallet:CHALLENGE_WALLET,...TRADE_TOKEN_ACCOUNTS};
async function accounts(rpc:TradeRpc,keys:string[]){return(await rpc<{context:{slot:number};value:(DammAccount|null)[]}>("getMultipleAccounts",[keys,{encoding:"base64",commitment:"confirmed"}])).value;}
function decoded(a:DammAccount|null|undefined,kind:"Whirlpool"|"Position"|"TickArray") {assert(a&&a.owner===o.program&&!a.executable&&a.data[1]==="base64");const b=Buffer.from(a.data[0]!,"base64"),names=kind==="TickArray"?["TickArray","DynamicTickArray"]:[kind];assert(names.some(n=>b.subarray(0,8).equals(createHash("sha256").update("account:"+n).digest().subarray(0,8))),"Orca account discriminator mismatch");return client[`get${kind}Decoder`]().decode(b);}
export async function buildOrcaEntry(input:{wallet:string;stationId:number;mint?:string},endpoint:string,apiKey?:string,fetcher:typeof fetch=fetch):Promise<StationEntryPlan>{
 assert.equal(input.wallet,m.wallet);assert.equal(input.stationId,8);assert(input.mint,"Generate the position mint in the browser before preparing");k.address(input.mint);assert(![...Object.values(m),...Object.values(o)].includes(input.mint));
 const started=Date.now(),rpc=tradeRpc(endpoint,fetcher);assert.equal(await rpc("getGenesisHash",[]),"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
 const raw=await accounts(rpc,[m.wallet,m.usdc,m.wsol,o.pool,o.vaultA,o.vaultB,input.mint]);
 assert(raw[0]&&!raw[0].executable&&!raw[6],"Wallet missing or browser mint already exists");
 assert(raw[1]&&raw[2],"Existing USDC and WSOL accounts required; protect established station inventory");
 const stable=tokenAtoms(raw[1],o.usdc,m.wallet),wrapped=tokenAtoms(raw[2],o.sol,m.wallet),native=BigInt(raw[0].lamports),s=decoded(raw[3],"Whirlpool");
 assert(stable>=10000000n&&native>=17155520n);assert.equal(s.tokenMintA,o.sol);assert.equal(s.tokenMintB,o.usdc);assert.equal(s.tickSpacing,4);assert.equal(s.tokenVaultA,o.vaultA);assert.equal(s.tokenVaultB,o.vaultB);
 tokenAtoms(raw[4]!,o.sol,o.pool);tokenAtoms(raw[5]!,o.usdc,o.pool);
 const sqrt=BigInt(s.sqrtPrice),price=core.sqrtPriceToPrice(sqrt,9,6),lower=core.getInitializableTickIndex(core.priceToTickIndex(price*.8,9,6),4,false),upper=core.getInitializableTickIndex(core.priceToTickIndex(price*1.2,9,6),4,true),start=core.getTickArrayStartTickIndex(s.tickCurrentIndex,4);
 const starts=[core.getTickArrayStartTickIndex(lower,4),core.getTickArrayStartTickIndex(upper,4),start,start+352,start+704];
 const arrays:string[]=await Promise.all(starts.map(t=>client.getTickArrayAddress(k.address(o.pool),t).then((p:[string,number])=>p[0])));
 const arrayRaw=await accounts(rpc,arrays);arrayRaw.forEach((a,i)=>{const v=decoded(a,"TickArray");assert.equal(v.whirlpool,o.pool);assert.equal(v.startTickIndex,starts[i]);});
 const qAt=(l:bigint)=>core.increaseLiquidityQuote(l,50,sqrt,lower,upper),q128=1n<<128n;
 let lo=0n,hi=2000000000n;while(lo<hi){const mid=(lo+hi+1n)/2n,q=qAt(mid);if(q.tokenMaxA*sqrt*sqrt+q.tokenMaxB*q128<=9850000n*q128)lo=mid;else hi=mid-1n;}
 assert(lo>0n);const q=qAt(lo),maxA=BigInt(q.tokenMaxA),maxB=BigInt(q.tokenMaxB);
 const oracle=(await client.getOracleAddress(k.address(o.pool)))[0];
 // Static-fee pool: the official core quote consumes the independently verified arrays.
 assert.equal(Number(s.feeTierIndexSeed[0])+Number(s.feeTierIndexSeed[1])*256,4);
 const swapQuote=core.swapQuoteByOutputToken(maxA,true,50,s,null,arrayRaw.slice(2).map(a=>decoded(a,"TickArray")),BigInt(Math.floor(Date.now()/1000)));
 assert.equal(BigInt(swapQuote.tokenOut),maxA);const maxSwap=BigInt(swapQuote.tokenMaxIn);assert(maxSwap>0n&&maxSwap+maxB<=10000000n,"Acquisition plus liquidity exceeds station allocation");
 const tables:Record<string,k.Address[]>={}; const payer=k.createNoopSigner(k.address(m.wallet)),mint=k.address(input.mint),position=(await client.getPositionAddress(mint))[0],enc=k.getAddressEncoder(),nft=(await k.getProgramDerivedAddress({programAddress:k.address(o.ata),seeds:[enc.encode(payer.address),enc.encode(k.address(o.token2022)),enc.encode(mint)]}))[0];
 assert((await accounts(rpc,[position,nft])).every(a=>a===null),"Position accounts already exist");
 const open=client.getOpenPositionWithTokenExtensionsInstruction({funder:payer,owner:payer.address,position,positionMint:k.createNoopSigner(mint),positionTokenAccount:nft,whirlpool:k.address(o.pool),tickLowerIndex:lower,tickUpperIndex:upper,withTokenMetadataExtension:false});
 const add=client.getIncreaseLiquidityV2Instruction({whirlpool:k.address(o.pool),positionAuthority:payer,position,positionTokenAccount:nft,tokenMintA:k.address(o.sol),tokenMintB:k.address(o.usdc),tokenOwnerAccountA:k.address(m.wsol),tokenOwnerAccountB:k.address(m.usdc),tokenVaultA:k.address(o.vaultA),tokenVaultB:k.address(o.vaultB),tokenProgramA:k.address(o.token),tokenProgramB:k.address(o.token),tickArrayLower:k.address(arrays[0]!),tickArrayUpper:k.address(arrays[1]!),remainingAccountsInfo:null,liquidityAmount:lo,tokenMaxA:maxA,tokenMaxB:maxB});
 const cu=Buffer.alloc(5);cu[0]=2;cu.writeUInt32LE(1400000,1);
 const swap=client.getSwapV2Instruction({tokenProgramA:k.address(o.token),tokenProgramB:k.address(o.token),tokenAuthority:payer,whirlpool:k.address(o.pool),tokenMintA:k.address(o.sol),tokenMintB:k.address(o.usdc),tokenOwnerAccountA:k.address(m.wsol),tokenVaultA:k.address(o.vaultA),tokenOwnerAccountB:k.address(m.usdc),tokenVaultB:k.address(o.vaultB),tickArray0:k.address(arrays[2]!),tickArray1:k.address(arrays[3]!),tickArray2:k.address(arrays[4]!),oracle,amount:maxA,otherAmountThreshold:maxSwap,sqrtPriceLimit:0n,amountSpecifiedIsInput:false,aToB:false,remainingAccountsInfo:null});
 const instructions:k.Instruction[]=[{programAddress:k.address("ComputeBudget111111111111111111111111111111"),data:cu},swap,open,add];
 const latest=(await rpc<{value:{blockhash:k.Blockhash;lastValidBlockHeight:string}}>("getLatestBlockhash",[{commitment:"confirmed"}])).value;
 const msg=k.pipe(k.createTransactionMessage({version:0}),t=>k.setTransactionMessageFeePayer(payer.address,t),t=>k.setTransactionMessageLifetimeUsingBlockhash({blockhash:latest.blockhash,lastValidBlockHeight:BigInt(latest.lastValidBlockHeight)},t),t=>k.appendTransactionMessageInstructions(instructions,t));
 const compiled=k.compileTransactionMessage(k.compressTransactionMessageUsingAddressLookupTables(msg,tables)),bytes=Buffer.from(k.getCompiledTransactionMessageEncoder().encode(compiled));assert.equal(compiled.header.numSignerAccounts,2);
 const wire=Buffer.concat([Buffer.from([2]),Buffer.alloc(128),bytes]);assert(wire.length<=1232,"Atomic acquisition and LP entry exceeds Solana packet capacity; no partial entry permitted");
 const fee=(await rpc<{value:number}>("getFeeForMessage",[bytes.toString("base64"),{commitment:"confirmed"}])).value;assert(Number.isSafeInteger(fee)&&fee>=10000&&fee<=12000);
 const sim=await rpc<{context:{slot:number};value:{err:unknown;accounts:DammAccount[];logs:string[]}}>("simulateTransaction",[wire.toString("base64"),{encoding:"base64",commitment:"confirmed",sigVerify:false,replaceRecentBlockhash:false,innerInstructions:true,accounts:{encoding:"base64",addresses:[m.wallet,m.usdc,m.wsol,position,mint,nft]}}]);
 assert.equal(sim.value.err,null,"Unsigned Orca entry simulation failed");const post=sim.value.accounts,afterUsdc=tokenAtoms(post[1]!,o.usdc,m.wallet),afterWsol=tokenAtoms(post[2]!,o.sol,m.wallet),spent=stable-afterUsdc,residual=afterWsol-wrapped,ps=decoded(post[3],"Position");
 assert(spent>0n&&spent<=maxSwap+maxB&&residual>=0n&&residual<=maxA);assert.equal(ps.whirlpool,o.pool);assert.equal(ps.positionMint,mint);assert.equal(ps.liquidity,lo);assert.equal(ps.tickLowerIndex,lower);assert.equal(ps.tickUpperIndex,upper);
 const nftBytes=Buffer.from(post[5]!.data[0]!,"base64");assert.equal(post[5]!.owner,o.token2022);assert(nftBytes.length>=165&&nftBytes.readUInt32LE(72)===0&&nftBytes[108]===1);assert.equal(k.getAddressDecoder().decode(nftBytes.subarray(0,32)),mint);assert.equal(k.getAddressDecoder().decode(nftBytes.subarray(32,64)),m.wallet);assert.equal(nftBytes.readBigUInt64LE(64),1n);
 const rent=post.slice(3).reduce((n,a)=>n+BigInt(a.lamports),0n);assert.equal(rent,7143520n);assert.equal(native-BigInt(post[0]!.lamports),rent+BigInt(fee));assert(BigInt(post[0]!.lamports)>=10000000n);
 const allowed=new Set<string>([o.program,o.token,o.token2022,o.system,o.ata,"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr","ComputeBudget111111111111111111111111111111"]);for(const log of sim.value.logs){const program=/^Program (\w+) invoke/.exec(log)?.[1];if(program)assert(allowed.has(program),"Unexpected invoked program");}
 const blockTime=await rpc<number>("getBlockTime",[sim.context.slot]);assert(Math.abs(Date.now()/1000-blockTime)<=90&&Date.now()-started<=45000,"Quote expired while preparing");
 const plan:StationEntryPlan={version:1,stationId:8,wallet:m.wallet,mint,preparedAt:new Date().toISOString(),expiresAt:new Date(started+50000).toISOString(),lastValidBlockHeight:String(latest.lastValidBlockHeight),blockhash:latest.blockhash,slot:sim.context.slot,wireBase64:wire.toString("base64"),messageBase64:bytes.toString("base64"),messageHash:createHash("sha256").update(bytes).digest("hex"),lookupTables:tables,budgetUsdcAtoms:"10000000",maxSpendUsdcAtoms:String(maxSwap+maxB),simulatedSpendUsdcAtoms:String(spent),feeLamports:String(fee),rentLamports:String(rent),before:{nativeLamports:String(native),usdcAtoms:String(stable),wsolAtoms:String(wrapped)},after:{nativeLamports:String(post[0]!.lamports),usdcAtoms:String(afterUsdc),wsolAtoms:String(afterWsol)},accounts:{pool:o.pool,usdc:m.usdc,wsol:m.wsol,position,mint,nft,vaultA:o.vaultA,vaultB:o.vaultB,tickArrayLower:arrays[0]!,tickArrayUpper:arrays[1]!,swapTickArray0:arrays[2]!,swapTickArray1:arrays[3]!,swapTickArray2:arrays[4]!,oracle},details:{tickLower:lower,tickUpper:upper,lowerPrice:String(core.tickIndexToPrice(lower,9,6)),upperPrice:String(core.tickIndexToPrice(upper,9,6)),price:String(price),swapTickStart:start,liquidity:String(lo),minAcquiredWSOL:String(maxA),maxSOLdeposit:String(maxA),maxUSDCdeposit:String(maxB),maxSwapUsdcAtoms:String(maxSwap),estimatedSwapUsdcAtoms:String(swapQuote.tokenEstIn),cashUsdcAtoms:String(10000000n-spent),residualWsolAtoms:String(residual)},summary:"Acquire investment SOL from this station's USDC and atomically open Orca SOL/USDC liquidity at approximately ±20%. Existing WSOL and native principal remain protected."};
 await validateOrcaEntryPlan(plan);return plan;
}
/** Receipt inventory only: no wallet-wide capital or operating SOL enters equity. */
export async function readOrcaEntry(receipt:StationEntryReceipt,endpoint:string,previous?:StrategyPerformance,now=new Date().toISOString()):Promise<PlatformBalance>{
 assert.equal(receipt.wallet,m.wallet);assert.equal(receipt.stationId,8);const p=receipt.plan;await validateOrcaEntryPlan(p);
 assert.equal(receipt.wallet,p.wallet);assert(BigInt(receipt.spentUsdcAtoms)>0n&&BigInt(receipt.spentUsdcAtoms)<=BigInt(p.maxSpendUsdcAtoms));assert(BigInt(receipt.receivedWsolAtoms)>=0n&&BigInt(receipt.receivedWsolAtoms)<=BigInt(String(p.details.maxSOLdeposit)));
 const rpc=tradeRpc(endpoint);assert.equal(await rpc("getGenesisHash",[]),"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
 assert(Number.isSafeInteger(receipt.slot)&&receipt.slot>=0&&Number.isFinite(Date.parse(now)),"Invalid receipt slot or observation time");
 const a=p.accounts,batch=await rpc<{context:{slot:number};value:(DammAccount|null)[]}>("getMultipleAccounts",[[o.pool,a.position!,a.nft!,a.tickArrayLower!,a.tickArrayUpper!,a.usdc!,a.wsol!],{encoding:"base64",commitment:"confirmed",minContextSlot:receipt.slot}]);
 assert(Number.isSafeInteger(batch.context?.slot)&&batch.context.slot>=receipt.slot,"Orca snapshot predates its entry receipt");
 const blockTime=await rpc<number|null>("getBlockTime",[batch.context.slot]);assert(typeof blockTime==="number"&&Number.isSafeInteger(blockTime)&&Math.abs(Date.parse(now)/1000-blockTime)<=90,"Orca snapshot is stale or its block time is unavailable");
 const raw=batch.value;assert(Array.isArray(raw)&&raw.length===7,"Incomplete Orca snapshot");
 assert(tokenAtoms(raw[5]!,o.usdc,m.wallet)>=10000000n-BigInt(receipt.spentUsdcAtoms),"Orca allocation cash is no longer present");
 assert(tokenAtoms(raw[6]!,o.sol,m.wallet)>=BigInt(p.before.wsolAtoms)+BigInt(receipt.receivedWsolAtoms),"Protected WSOL or receipt residual is no longer present");
 const s=decoded(raw[0],"Whirlpool"),pos=decoded(raw[1],"Position");
 assert.equal(s.tokenMintA,o.sol);assert.equal(s.tokenMintB,o.usdc);assert.equal(s.tickSpacing,4);assert.equal(s.tokenVaultA,o.vaultA);assert.equal(s.tokenVaultB,o.vaultB);assert.equal(pos.whirlpool,o.pool);assert.equal(pos.positionMint,p.mint);assert.equal(pos.tickLowerIndex,p.details.tickLower);assert.equal(pos.tickUpperIndex,p.details.tickUpper);assert.equal(pos.liquidity,BigInt(String(p.details.liquidity)),"Position changed; reconcile receipt inventory before valuation");
 const nft=raw[2];assert(nft&&nft.owner===o.token2022&&!nft.executable);const b=Buffer.from(nft.data[0]!,"base64");assert(b.length>=165&&b[108]===1&&b.readUInt32LE(72)===0&&b.readBigUInt64LE(64)===1n);assert.equal(k.getAddressDecoder().decode(b.subarray(0,32)),p.mint);assert.equal(k.getAddressDecoder().decode(b.subarray(32,64)),m.wallet);
 const arrays=[decoded(raw[3],"TickArray"),decoded(raw[4],"TickArray")];arrays.forEach((v,i)=>{assert.equal(v.whirlpool,o.pool);assert.equal(v.startTickIndex,core.getTickArrayStartTickIndex(i?pos.tickUpperIndex:pos.tickLowerIndex,4));});
 const tick=(i:number,t:number)=>arrays[i].ticks[(t-arrays[i].startTickIndex)/4],fees=core.collectFeesQuote(s,pos,tick(0,pos.tickLowerIndex),tick(1,pos.tickUpperIndex)),q=core.decreaseLiquidityQuote(pos.liquidity,0,s.sqrtPrice,pos.tickLowerIndex,pos.tickUpperIndex);
 const decimal=(v:bigint,scale:number)=>new Decimal(v.toString()).div(new Decimal(10).pow(scale));
 const principalA=decimal(BigInt(q.tokenEstA),9),principalB=decimal(BigInt(q.tokenEstB),6),feeA=decimal(BigInt(fees.feeOwedA),9),feeB=decimal(BigInt(fees.feeOwedB),6),residual=decimal(BigInt(receipt.receivedWsolAtoms),9),cash=decimal(10000000n-BigInt(receipt.spentUsdcAtoms),6),price=new Decimal(core.sqrtPriceToPrice(s.sqrtPrice,9,6));
 const sol=principalA.add(feeA).add(residual),equity=sol.mul(price).add(principalB).add(feeB).add(cash),pnl=equity.sub(10),history=previous?.entrySignature===receipt.signature?previous.history:[];
 const performance:StrategyPerformance={stationId:8,allocationUsd:"10.000000",entryCostUsdc:decimal(BigInt(receipt.spentUsdcAtoms),6).toFixed(6),equityUsd:equity.toFixed(6),pnlUsd:pnl.toFixed(6),pnlPct:pnl.mul(10).toFixed(6),solAmount:sol.toFixed(9),cashUsdc:cash.toFixed(6),entryAt:receipt.at,entrySignature:receipt.signature,executionEnabled:false,history:[...history.filter(h=>h.at!==now),{at:now,valueUsd:equity.toFixed(6)}].slice(-500),principalSol:principalA.toFixed(9),principalUsdc:principalB.toFixed(6),residualSol:residual.toFixed(9),accruedFeesSol:feeA.toFixed(9),accruedFeesUsdc:feeB.toFixed(6),accruedFeesUsd:feeA.mul(price).add(feeB).toFixed(6),positionAddress:a.position,lowerPrice:String(core.tickIndexToPrice(pos.tickLowerIndex,9,6)),upperPrice:String(core.tickIndexToPrice(pos.tickUpperIndex,9,6)),inRange:s.tickCurrentIndex>=pos.tickLowerIndex&&s.tickCurrentIndex<pos.tickUpperIndex};
 return{status:"ready",valueUsd:equity.toFixed(6),positionCount:1,executionEnabled:false,positions:[{address:a.position!,pool:o.pool,liquidity:String(pos.liquidity),lowerTick:pos.tickLowerIndex,upperTick:pos.tickUpperIndex}],performance,connection:{scope:"positions",detail:"Verified receipt NFT, position, pool and boundary fee growth"},detail:"Orca receipt principal, uncollected fees, residual acquired SOL and allocation cash; operating SOL excluded"};
}
