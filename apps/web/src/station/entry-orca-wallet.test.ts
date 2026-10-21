import {it,expect,vi} from "vitest";
import {createRequire} from "node:module";
import * as k from "@solana/kit";
import {validateOrcaEntryPlan,verifyOrcaEntryContext,ORCA_ENTRY as o} from "./entry-orca-wallet";
import {CHALLENGE_WALLET,TRADE_TOKEN_ACCOUNTS} from "../../../../packages/contracts/src/trades";
import type {StationEntryPlan} from "../../../../packages/contracts/src/station-entries";
const require=createRequire(import.meta.url),sdk=createRequire(require.resolve("../../../jobs/node_modules/@orca-so/whirlpools")),c=sdk("@orca-so/whirlpools-client");
async function fixture():Promise<StationEntryPlan>{
 const payer=k.createNoopSigner(k.address(CHALLENGE_WALLET)),mint=k.address("3neViiXheuuQNCMmi5gGrL5xGcy66ofdtUgoGbZwjeSX"),position=(await c.getPositionAddress(mint))[0],enc=k.getAddressEncoder(),pda=async(program:string,seeds:(Uint8Array|k.ReadonlyUint8Array)[])=>(await k.getProgramDerivedAddress({programAddress:k.address(program),seeds}))[0];
 const nft=await pda(o.ata,[enc.encode(payer.address),enc.encode(k.address(o.token2022)),enc.encode(mint)]),lower=Math.floor(Math.log(.08)/Math.log(1.0001)/4)*4,upper=Math.ceil(Math.log(.12)/Math.log(1.0001)/4)*4,start=Math.floor(Math.log(.1)/Math.log(1.0001)/352)*352;
 const arrays=await Promise.all([Math.floor(lower/352)*352,Math.floor(upper/352)*352,start,start+352,start+704].map(t=>c.getTickArrayAddress(k.address(o.pool),t).then((p:[string,number])=>p[0]))),oracle=(await c.getOracleAddress(k.address(o.pool)))[0];
 const a={pool:o.pool,...TRADE_TOKEN_ACCOUNTS,position,mint,nft,vaultA:o.vaultA,vaultB:o.vaultB,tickArrayLower:arrays[0],tickArrayUpper:arrays[1],swapTickArray0:arrays[2],swapTickArray1:arrays[3],swapTickArray2:arrays[4],oracle};
 const cu=Buffer.alloc(5);cu[0]=2;cu.writeUInt32LE(1400000,1);
 const instructions:k.Instruction[]=[{programAddress:k.address("ComputeBudget111111111111111111111111111111"),data:cu}, c.getSwapV2Instruction({tokenProgramA:k.address(o.token),tokenProgramB:k.address(o.token),tokenAuthority:payer,whirlpool:k.address(o.pool),tokenMintA:k.address(o.sol),tokenMintB:k.address(o.usdc),tokenOwnerAccountA:k.address(a.wsol),tokenVaultA:k.address(o.vaultA),tokenOwnerAccountB:k.address(a.usdc),tokenVaultB:k.address(o.vaultB),tickArray0:k.address(arrays[2]),tickArray1:k.address(arrays[3]),tickArray2:k.address(arrays[4]),oracle,amount:10000000n,otherAmountThreshold:5025000n,sqrtPriceLimit:0n,amountSpecifiedIsInput:false,aToB:false,remainingAccountsInfo:null}),c.getOpenPositionWithTokenExtensionsInstruction({funder:payer,owner:payer.address,position,positionMint:k.createNoopSigner(mint),positionTokenAccount:nft,whirlpool:k.address(o.pool),tickLowerIndex:lower,tickUpperIndex:upper,withTokenMetadataExtension:false}),c.getIncreaseLiquidityV2Instruction({whirlpool:k.address(o.pool),positionAuthority:payer,position,positionTokenAccount:nft,tokenMintA:k.address(o.sol),tokenMintB:k.address(o.usdc),tokenOwnerAccountA:k.address(a.wsol),tokenOwnerAccountB:k.address(a.usdc),tokenVaultA:k.address(o.vaultA),tokenVaultB:k.address(o.vaultB),tokenProgramA:k.address(o.token),tokenProgramB:k.address(o.token),tickArrayLower:k.address(arrays[0]),tickArrayUpper:k.address(arrays[1]),remainingAccountsInfo:null,liquidityAmount:1234n,tokenMaxA:10000000n,tokenMaxB:4000000n})];
 const msg=k.pipe(k.createTransactionMessage({version:0}),t=>k.setTransactionMessageFeePayer(payer.address,t),t=>k.setTransactionMessageLifetimeUsingBlockhash({blockhash:k.blockhash("11111111111111111111111111111111"),lastValidBlockHeight:100n},t),t=>k.appendTransactionMessageInstructions(instructions,t));
 const bytes=k.getCompiledTransactionMessageEncoder().encode(k.compileTransactionMessage(msg));
 return {version:1,stationId:8,wallet:payer.address,mint,accounts:a,details:{tickLower:lower,tickUpper:upper,lowerPrice:String(1000*1.0001**lower),upperPrice:String(1000*1.0001**upper),price:"100",swapTickStart:start,liquidity:"1234",minAcquiredWSOL:"10000000",maxSOLdeposit:"10000000",maxUSDCdeposit:"4000000",maxSwapUsdcAtoms:"5025000",estimatedSwapUsdcAtoms:"5000000"},budgetUsdcAtoms:"10000000",maxSpendUsdcAtoms:"9025000",simulatedSpendUsdcAtoms:"9000000",feeLamports:"10000",rentLamports:"7143520",before:{nativeLamports:"30000000",wsolAtoms:"361964",usdcAtoms:"20000000"},after:{nativeLamports:"22846480",wsolAtoms:"361964",usdcAtoms:"11000000"},messageBase64:Buffer.from(bytes).toString("base64"),lookupTables:{},preparedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+50000).toISOString(),lastValidBlockHeight:"100",blockhash:"11111111111111111111111111111111",slot:1,wireBase64:"",messageHash:"",summary:"test grammar"} as StationEntryPlan;
}
it("rejects an arbitrary transaction presented as an Orca plan",async()=>{
 await expect(validateOrcaEntryPlan({wallet:"retired",stationId:6} as never)).rejects.toThrow();
});
it("accepts exactly the SDK NFT/open and capped exact-out route grammar",async()=>{
 await expect(validateOrcaEntryPlan(await fixture())).resolves.toBeUndefined();
});
it("rejects changed authority, vault, range, native-principal draw and pre-existing WSOL consumption",async()=>{
 const p=await fixture();
 for(const change of [()=>{p.accounts.nft=p.wallet;},()=>{p.accounts.vaultA=p.wallet;},()=>{p.details.tickLower=0;},()=>{p.after.nativeLamports="10000000";},()=>{p.after.wsolAtoms="361963";}]){
  const copy=structuredClone(p);change();await expect(validateOrcaEntryPlan(p)).rejects.toThrow();Object.assign(p,copy);
 }
});
it("rejects modified route slippage, LP caps and extra instructions even when title is unchanged",async()=>{
 const p=await fixture();
 for(const [instruction,offset] of [[1,16],[1,40],[1,41],[1,42],[2,16],[3,24],[3,40]]){
  const decoded=k.getCompiledTransactionMessageDecoder().decode(Buffer.from(p.messageBase64,"base64"));const data=new Uint8Array(decoded.instructions[instruction]!.data!);data[offset]^=1;decoded.instructions[instruction]={...decoded.instructions[instruction]!,data};
  await expect(validateOrcaEntryPlan({...p,messageBase64:Buffer.from(k.getCompiledTransactionMessageEncoder().encode(decoded)).toString("base64")})).rejects.toThrow();
 }
});
it("independently binds current pool, vault authority and all boundary/swap arrays before signing",async()=>{
 const p=await fixture(),addressBytes=(a:string)=>k.getAddressEncoder().encode(k.address(a)),pool=Buffer.alloc(653);pool.set([63,149,209,12,225,128,99,9]);pool.writeUInt16LE(4,41);const sqrt=BigInt(Math.floor(Math.sqrt(.1)*2**64));pool.writeBigUInt64LE(sqrt&((1n<<64n)-1n),65);pool.writeBigUInt64LE(sqrt>>64n,73);pool.writeInt32LE(Math.floor(Math.log(.1)/Math.log(1.0001)),81);pool.set(addressBytes(o.sol),101);pool.set(addressBytes(o.vaultA),133);pool.set(addressBytes(o.usdc),181);pool.set(addressBytes(o.vaultB),213);
 const account=(owner:string,b:Buffer)=>({owner,executable:false,data:[b.toString("base64"),"base64"]});
 const token=(mint:string)=>{const b=Buffer.alloc(165);b.set(addressBytes(mint));b.set(addressBytes(o.pool),32);b[108]=1;return account(o.token,b);};
 const raw=[account(o.program,pool),token(o.sol),token(o.usdc),...[Number(p.details.tickLower),Number(p.details.tickUpper),Number(p.details.swapTickStart),Number(p.details.swapTickStart)+352,Number(p.details.swapTickStart)+704].map(t=>{const b=Buffer.alloc(9988);b.set([69,97,189,190,110,7,66,187]);b.writeInt32LE(Math.floor(t/352)*352,8);b.set(addressBytes(o.pool),9956);return account(o.program,b);})];
 const set=(v:typeof raw)=>vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({result:{value:v}}))));
 try{set(raw);await expect(verifyOrcaEntryContext(p)).resolves.toBeUndefined();
  for(const index of [0,1,3,7]){const bad=structuredClone(raw);bad[index]!.owner=p.wallet;set(bad);await expect(verifyOrcaEntryContext(p)).rejects.toThrow();}
  const bad=structuredClone(raw),b=Buffer.from(bad[4]!.data[0]!,"base64");b.set(addressBytes(p.wallet),9956);bad[4]!.data[0]=b.toString("base64");set(bad);await expect(verifyOrcaEntryContext(p)).rejects.toThrow();
 }finally{vi.unstubAllGlobals();}
});
