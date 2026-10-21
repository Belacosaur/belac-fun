/** Fixed-wallet unsigned recovery. No private-key reads, signing or broadcasting. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import * as k from "@solana/kit";
import { ACTIVE_ENTRIES as E } from "./active-positions.js";
import { KAMINO_DIRECT as K, decodeKaminoReserve, receiptValueUsdcAtoms } from "./kamino-direct.js";
import { tradeRpc, type TradeRpc } from "./trade-rpc.js";
import {simulateRecoveryAccounts} from "../../../packages/contracts/src/recovery-simulation.js";
import { RECOVERY_SOURCE, RECOVERY_DESTINATION, type RecoveryInventory, type RecoveryPlan, type RecoveryStep } from "../../../packages/contracts/src/recovery.js";
export { RECOVERY_DESTINATION };
const sdk = createRequire(createRequire(import.meta.url).resolve("@orca-so/whirlpools"));
const orca = sdk("@orca-so/whirlpools"), token = sdk("@solana-program/token"), system = sdk("@solana-program/system");
const TOKEN = K.tokenProgram, TOKEN22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", SOL = "So11111111111111111111111111111111111111112";
export const RECOVERY_KEYS = [RECOVERY_SOURCE, RECOVERY_DESTINATION, E.usdcAta, E.wsolAta, K.collateralAta, E.orca.position, E.orca.mint, E.orca.nft];
type Account = { owner: string; lamports: number; executable: boolean; data: [string, string] };
export function isClosedAccount(a: Account | null) { return a === null || (a.owner === "11111111111111111111111111111111" && a.lamports === 0 && !a.executable && a.data[0] === ""); }
const sol = (n: bigint) => (Number(n) / 1e9).toFixed(9), usdc = (n: bigint) => (Number(n) / 1e6).toFixed(6);
export function validateRecoveryRequest(source: string, destination: string) { assert.equal(source, RECOVERY_SOURCE); assert.equal(destination, RECOVERY_DESTINATION); }
export function recoveryStep(s: Pick<RecoveryInventory, "orcaOpen" | "receiptAtoms" | "usdcAtoms" | "openAccounts" | "sourceLamports">): RecoveryStep | "complete" {
  return s.orcaOpen ? "orca" : BigInt(s.receiptAtoms) > 0n ? "kamino" : BigInt(s.usdcAtoms) > 0n ? "swap" : s.openAccounts > 0 ? "cleanup" : BigInt(s.sourceLamports) > 0n ? "sweep" : "complete";
}
function tokenAccount(address: string, a: Account, mint?: string) {
  assert([TOKEN, TOKEN22].includes(a.owner) && !a.executable && a.data[1] === "base64");
  const b = Buffer.from(a.data[0], "base64"); assert(b.length >= 165 && b[108] === 1, "Frozen or invalid token account");
  const enc = k.getAddressDecoder(), owner = enc.decode(b.subarray(32, 64)), actualMint = enc.decode(b.subarray(0, 32));
  assert.equal(owner, RECOVERY_SOURCE); if (mint) assert.equal(actualMint, mint);
  assert.equal(b.readUInt32LE(72), 0, "Delegated token account requires manual review");
  if (b.readUInt32LE(129)) assert.equal(enc.decode(b.subarray(133, 165)), RECOVERY_SOURCE, "Different close authority");
  const nativeRentLamports=actualMint===SOL?(assert.equal(b.readUInt32LE(109),1),b.readBigUInt64LE(113).toString()):undefined;
  return { address, mint: actualMint, program: a.owner, amount: b.readBigUInt64LE(64).toString(), lamports: String(a.lamports),...(nativeRentLamports?{nativeRentLamports}:{}) };
}
function inventory(values: (Account | null)[], slot: number, accounts?: RecoveryInventory["accounts"]): RecoveryInventory {
  values = values.map(a => isClosedAccount(a) ? null : a);
  if (values[0]) assert(values[0].owner === "11111111111111111111111111111111" && !values[0].executable);
  if (values[1]) assert(values[1].owner === "11111111111111111111111111111111" && !values[1].executable);
  const known = [2, 3, 4, 7].flatMap(i => values[i] ? [tokenAccount(RECOVERY_KEYS[i]!, values[i]!, [K.usdcMint, SOL, K.collateralMint, E.orca.mint][[2, 3, 4, 7].indexOf(i)])] : []);
  const get = (key: string) => known.find(a => a.address === key)?.amount ?? "0";
  if (values[5]) assert(values[5].owner === "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc" && values[6] && get(E.orca.nft) === "1", "Orca ownership requires reconciliation");
  else assert(!values[6] && get(E.orca.nft) === "0", "Orphaned position mint requires review");
  const data = { source: RECOVERY_SOURCE, destination: RECOVERY_DESTINATION, observedAt: new Date().toISOString(), slot, sourceLamports: String(values[0]?.lamports ?? 0), destinationLamports: String(values[1]?.lamports ?? 0), usdcAtoms: get(E.usdcAta), wsolAtoms: get(E.wsolAta), receiptAtoms: get(K.collateralAta), orcaOpen: !!values[5], openAccounts: (accounts ?? known).length, accounts: accounts ?? known };
  return { ...data, next: recoveryStep(data) };
}
async function batch(rpc: TradeRpc, keys = RECOVERY_KEYS, minContextSlot?:number) { return rpc<{ context: { slot: number }; value: (Account | null)[] }>("getMultipleAccounts", [keys, { encoding: "base64", commitment: "confirmed",...(minContextSlot?{minContextSlot}:{}) }]); }
export async function recoveryInventory(endpoint: string, fetcher: typeof fetch = fetch) {
  const rpc = tradeRpc(endpoint, fetcher); assert.equal(await rpc("getGenesisHash", []), "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  const b = await batch(rpc); return inventory(b.value, b.context.slot);
}
/** Full indexed scan before cleanup/sweep; failure never becomes an empty inventory. */
export async function scanAccounts(endpoint: string, fetcher: typeof fetch, minContextSlot:number): Promise<{accounts:RecoveryInventory["accounts"];slot:number}> {
  let lastError: unknown;
  for (const url of [...new Set([endpoint, "https://api.mainnet-beta.solana.com"])]) {
    try {
      const result: RecoveryInventory["accounts"] = [];
      let slot=minContextSlot;
      for (const program of [TOKEN, TOKEN22]) {
        const r = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [RECOVERY_SOURCE, { programId: program }, { encoding: "base64", commitment: "confirmed",minContextSlot:slot }] }), signal: AbortSignal.timeout(20000) });
        const j = await r.json() as { error?: unknown; result?: { context:{slot:number};value: { pubkey: string; account: Account }[] } }; assert(r.ok && !j.error && j.result, "Full token scan unavailable; SOL sweep blocked");
        assert(Number.isSafeInteger(j.result.context.slot)&&j.result.context.slot>=slot,"Token scan slot regressed; sweep blocked");slot=j.result.context.slot;
        for (const a of j.result.value) result.push(tokenAccount(a.pubkey, a.account));
      }
      return {accounts:result,slot};
    } catch (e) { lastError = e; }
  }
  throw lastError;
}
export async function buildRecoveryPlan(id: string, endpoint: string, fetcher: typeof fetch = fetch, previewStep?: "kamino" | "swap"): Promise<RecoveryPlan> {
  const started = Date.now(), rpc = tradeRpc(endpoint, fetcher); let b = await batch(rpc), before = inventory(b.value, b.context.slot);
  assert.equal(await rpc("getGenesisHash", []), "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  if (["cleanup", "sweep", "complete"].includes(before.next)) { const all = await scanAccounts(endpoint, fetcher,b.context.slot); b = await batch(rpc,RECOVERY_KEYS,all.slot);assert(b.context.slot>=all.slot);before = inventory(b.value, b.context.slot, all.accounts); }
  assert(before.next !== "complete", "Source wallet already empty");
  // Diagnostic previews can simulate independent redemption/swap instructions on current chain state.
  // API callers never supply this argument; browser validation rejects out-of-sequence previews.
  const step = previewStep ?? before.next, payer = k.createNoopSigner(k.address(RECOVERY_SOURCE));
  let instructions: k.Instruction[] = [], minimumSol = 0n, minimumUsdc = 0n, summary = "";
  const closed: string[] = [];
  // The SDK's 'none' strategy uses existing WSOL ATAs and never generates an auxiliary signer or wraps strategy SOL.
  orca.setNativeMintWrappingStrategy("none");
  if (step === "orca") {
    const result = await orca.closePositionInstructions(k.createSolanaRpc(endpoint), k.address(E.orca.mint), { authority: payer, slippageToleranceBps: 50 });
    instructions = result.instructions; minimumSol = result.quote.tokenMinA; minimumUsdc = result.quote.tokenMinB;
    closed.push(E.orca.position, E.orca.mint, E.orca.nft);
    summary = `Withdraw all Orca liquidity and collect fees. Minimum ${sol(minimumSol)} SOL + ${usdc(minimumUsdc)} USDC; close the position, NFT and mint.`;
  } else if (step === "kamino") {
    const a = await batch(rpc, [K.reserve]), reserve = decodeKaminoReserve(a.value[0]);
    const amount = BigInt(before.receiptAtoms); minimumUsdc = receiptValueUsdcAtoms(reserve, amount) * 999n / 1000n;
    const meta = (address: string, role = 0) => ({ address: k.address(address), role: role as 0 | 1 | 2 | 3 });
    const data = Buffer.alloc(16); Buffer.from([234,117,181,125,185,142,220,29]).copy(data); data.writeBigUInt64LE(amount, 8);
    instructions = [
      { programAddress: k.address(K.program), data: new Uint8Array([2,218,138,235,79,201,25,102]), accounts: [meta(K.reserve,1),meta(K.market),meta(K.program),meta(K.program),meta(K.program),meta(K.scope)] },
      { programAddress: k.address(K.program), data, accounts: [meta(RECOVERY_SOURCE,2),meta(K.market),meta(K.reserve,1),meta(K.authority),meta(K.usdcMint),meta(K.collateralMint,1),meta(K.vault,1),meta(K.collateralAta,1),meta(E.usdcAta,1),meta(TOKEN),meta(TOKEN),meta("Sysvar1nstructions1111111111111111111111111")] },
      token.getCloseAccountInstruction({ account: k.address(K.collateralAta), owner: payer, destination: payer.address }),
    ]; closed.push(K.collateralAta); summary = `Redeem all ${usdc(amount)} Kamino receipt tokens to USDC and close the empty receipt account. Expected at least ${usdc(minimumUsdc)} USDC.`;
  } else if (step === "swap") {
    const result = await orca.swapInstructions(k.createSolanaRpc(endpoint), { mint: k.address(K.usdcMint), inputAmount: BigInt(before.usdcAtoms) }, k.address(E.orca.pool), { signer: payer, slippageToleranceBps: 50 });
    instructions = result.instructions; minimumSol = result.quote.tokenMinOut; assert(minimumSol > 0n);
    summary = `Swap all ${usdc(BigInt(before.usdcAtoms))} USDC through the existing Orca SOL/USDC pool. Minimum ${sol(minimumSol)} SOL; 0.50% slippage limit. Output stays as WSOL until cleanup.`;
  } else if (step === "cleanup") {
    assert(before.accounts.every(a => a.amount === "0" || a.mint === SOL), "A non-empty token account remains; manual review required before cleanup");
    assert(before.accounts.length <= 20, "Too many accounts for one reviewed cleanup");
    instructions = before.accounts.map(a => {
      closed.push(a.address); return { ...token.getCloseAccountInstruction({ account: k.address(a.address), owner: payer, destination: payer.address }), programAddress: k.address(a.program) };
    }); summary = `Unwrap all WSOL and close ${closed.length} eligible token accounts. All tokens and rent return to the source wallet for the final sweep.`;
  } else {
    assert(before.accounts.length === 0 && !before.orcaOpen && before.receiptAtoms === "0" && before.usdcAtoms === "0");
    // Exactly one system transfer, no priority instructions: base fee is priced before the final amount is set below.
    instructions = [system.getTransferSolInstruction({ source: payer, destination: k.address(RECOVERY_DESTINATION), amount: 1n })];
    summary = "Sweep all remaining SOL, after the exact network fee, to the approved new wallet.";
  }
  if (step !== "sweep") {
    const limit = Buffer.alloc(5); limit[0] = 2; limit.writeUInt32LE(500000,1); const price = Buffer.alloc(9); price[0] = 3; price.writeBigUInt64LE(1000n,1);
    instructions.unshift({ programAddress: k.address("ComputeBudget111111111111111111111111111111"), data: limit }, { programAddress: k.address("ComputeBudget111111111111111111111111111111"), data: price });
  }
  const life = (await rpc<{value:{blockhash:k.Blockhash;lastValidBlockHeight:string}}>("getLatestBlockhash", [{commitment:"confirmed"}])).value;
  const compile = () => k.compileTransactionMessage(k.pipe(k.createTransactionMessage({version:0}), m=>k.setTransactionMessageFeePayer(payer.address,m), m=>k.setTransactionMessageLifetimeUsingBlockhash({...life,lastValidBlockHeight:BigInt(life.lastValidBlockHeight)},m), m=>k.appendTransactionMessageInstructions(instructions,m)));
  let message = compile(), bytes = Buffer.from(k.getCompiledTransactionMessageEncoder().encode(message));
  const fee = (await rpc<{value:number}>("getFeeForMessage",[bytes.toString("base64"),{commitment:"confirmed"}])).value; assert(Number.isSafeInteger(fee)&&fee>0&&fee<=10000);
  if (step === "sweep") { const amount = BigInt(before.sourceLamports)-BigInt(fee); assert(amount>0n,"Remaining SOL does not cover the sweep fee"); instructions=[system.getTransferSolInstruction({source:payer,destination:k.address(RECOVERY_DESTINATION),amount})]; message=compile(); bytes=Buffer.from(k.getCompiledTransactionMessageEncoder().encode(message)); }
  assert.equal(message.header.numSignerAccounts,1); assert.equal(message.staticAccounts[0],RECOVERY_SOURCE);
  const wire = Buffer.concat([Buffer.from([1]),Buffer.alloc(64),bytes]); assert(wire.length<=1232,"Recovery transaction exceeds packet size");
  const extra = closed.filter(a=>!RECOVERY_KEYS.includes(a)); const simKeys=[...RECOVERY_KEYS,...extra];
  const sim=await simulateRecoveryAccounts<Account>(rpc,wire.toString("base64"),simKeys,b.context.slot);
  const after = inventory(sim.value.accounts.slice(0,8),sim.context.slot,step==="cleanup"?[]:undefined);
  assert.equal(after.destinationLamports,step==="sweep"?(BigInt(before.destinationLamports)+BigInt(before.sourceLamports)-BigInt(fee)).toString():before.destinationLamports);
  if(step==="orca"){assert(!after.orcaOpen);assert(BigInt(after.usdcAtoms)>=BigInt(before.usdcAtoms)+minimumUsdc);assert(BigInt(after.wsolAtoms)>=BigInt(before.wsolAtoms)+minimumSol);}
  if(step==="kamino"){assert.equal(after.receiptAtoms,"0");assert(BigInt(after.usdcAtoms)>=BigInt(before.usdcAtoms)+minimumUsdc);}
  if(step==="swap"){assert.equal(after.usdcAtoms,"0");assert(BigInt(after.wsolAtoms)>=BigInt(before.wsolAtoms)+minimumSol);}
  if(step==="cleanup")assert(closed.every(a=>isClosedAccount(sim.value.accounts[simKeys.indexOf(a)]!)),"An account was not closed");
  if(step==="sweep")assert.equal(after.sourceLamports,"0");
  assert(Date.now()-started<40000,"Preparation took too long; refresh");
  return {id,step,source:RECOVERY_SOURCE,destination:RECOVERY_DESTINATION,preparedAt:new Date(started).toISOString(),expiresAt:new Date(started+45000).toISOString(),lastValidBlockHeight:String(life.lastValidBlockHeight),slot:sim.context.slot,wireBase64:wire.toString("base64"),messageHash:createHash("sha256").update(bytes).digest("hex"),feeLamports:String(fee),minimumSolAtoms:minimumSol.toString(),minimumUsdcAtoms:minimumUsdc.toString(),summary,before,after,closedAccounts:closed};
}
