import * as k from "@solana/kit";
import {simulateRecoveryAccounts} from "../../../../packages/contracts/src/recovery-simulation";
import type { MeteoraPlan } from "../../../../packages/contracts/src/trades";
import { CHALLENGE_WALLET, METEORA_POOL, TRADE_TOKEN_ACCOUNTS } from "../../../../packages/contracts/src/trades";
export const decode64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const encode64 = (b: Uint8Array | k.ReadonlyUint8Array) => btoa(String.fromCharCode(...b));
export const digest = async (b: Uint8Array | k.ReadonlyUint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(b)))).map(x => x.toString(16).padStart(2, "0")).join("");
const check = (v: unknown, message = "Transaction differs from the reviewed Meteora plan") => { if (!v) throw new Error(message); };
const program = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG", token = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", router = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", sol = "So11111111111111111111111111111111111111112", usdcAta = TRADE_TOKEN_ACCOUNTS.usdc, wsolAta = TRADE_TOKEN_ACCOUNTS.wsol;
export async function browserRpc<T>(method: "getGenesisHash" | "getBlockHeight" | "getMultipleAccounts" | "getFeeForMessage" | "simulateTransaction" | "sendTransaction", params: unknown[], readToken?: string): Promise<T> {
  const relayed=method==="getBlockHeight",api=(import.meta.env.VITE_API_BASE_URL||"https://belac-fun-production-c49e.up.railway.app").replace(/\/$/,"");
  const endpoint = relayed?`${api}/v1/trades/read`:import.meta.env.VITE_SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
  const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json",...(relayed?{authorization:`Bearer ${readToken??""}`}:{}) }, body: JSON.stringify(relayed?{method,params}:{ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("Wallet RPC unavailable"); const j = await r.json(); if (j.error) throw new Error("RPC did not confirm submission. Check the recorded attempt before retrying."); return (relayed?j.data:j.result) as T;
}
/** Validate decoded message semantics, not just a backend-supplied title or hash. */
export async function validateMeteoraPlan(plan: MeteoraPlan, mint: string, now = Date.now()) {
  check(plan.wallet === CHALLENGE_WALLET && plan.stationId === 5 && plan.pool === METEORA_POOL && plan.mint === mint);
  check(now < Date.parse(plan.expiresAt), "Quote expired. Refresh before signing.");
  for (const v of [plan.maxSpendUsdcAtoms, plan.maxSwapUsdcAtoms, plan.maxDepositUsdcAtoms, plan.feeLamports, plan.rentLamports, plan.liquidity, plan.maxSolAtoms]) check(/^\d+$/.test(v));
  check(BigInt(plan.maxSpendUsdcAtoms) > 0n && BigInt(plan.maxSpendUsdcAtoms) <= 10000000n);
  check(BigInt(plan.maxSwapUsdcAtoms) + BigInt(plan.maxDepositUsdcAtoms) === BigInt(plan.maxSpendUsdcAtoms));
  const setupRent=BigInt(plan.setupRentLamports??"0");check(plan.setupWsol?setupRent>0n&&setupRent<=2039280n:setupRent===0n);
  check(BigInt(plan.feeLamports) <= 12000n && BigInt(plan.rentLamports) === 7223760n+setupRent && BigInt(plan.feePoolAfterLamports) >= 10000000n);
  check(BigInt(plan.feePoolBeforeLamports)<=19859400n&&BigInt(plan.beforeNativeLamports)>=BigInt(plan.feePoolBeforeLamports));
  check(BigInt(plan.feePoolAfterLamports)===BigInt(plan.feePoolBeforeLamports)-BigInt(plan.rentLamports)-BigInt(plan.feeLamports));
  check(BigInt(plan.beforeUsdcAtoms)>=BigInt(plan.maxSpendUsdcAtoms),"USDC strategy capital is required; SOL fee reserves cannot fund strategy principal");
  const bytes = decode64(plan.messageBase64); check(await digest(bytes) === plan.messageHash);
  const tx = k.getTransactionDecoder().decode(decode64(plan.wireBase64)); check(await digest(tx.messageBytes) === plan.messageHash);
  const c = k.getCompiledTransactionMessageDecoder().decode(bytes); if (c.version !== 0) throw new Error("Expected a version zero transaction"); check(c.lifetimeToken === plan.blockhash);
  check(c.header.numSignerAccounts === 2 && c.staticAccounts[0] === CHALLENGE_WALLET && new Set(c.staticAccounts.slice(0, 2)).has(k.address(mint)));
  const tableKeys = Object.keys(plan.lookupTables);
  const loaded = c.addressTableLookups ?? [];
  const writable: string[] = [], readonly: string[] = [];
  for (const l of loaded) { const addresses = plan.lookupTables[l.lookupTableAddress]; check(addresses && tableKeys.includes(l.lookupTableAddress)); l.writableIndexes.forEach(i => writable.push(addresses![i]!)); l.readonlyIndexes.forEach(i => readonly.push(addresses![i]!)); }
  const keys: string[] = [...c.staticAccounts, ...writable, ...readonly];
  if(plan.setupWsol){const setup=c.instructions[2]!;check(keys[setup.programAddressIndex]==="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");check(setup.data?.length===1&&setup.data[0]===1);check(JSON.stringify(Array.from(setup.accountIndices??[],n=>keys[n]))===JSON.stringify([CHALLENGE_WALLET,wsolAta,CHALLENGE_WALLET,sol,"11111111111111111111111111111111",token]));}
  const ix=plan.setupWsol?[...c.instructions.slice(0,2),...c.instructions.slice(3)]:c.instructions;
  check(ix.length === 5); const prog = (i: number) => keys[ix[i]!.programAddressIndex];
  check(prog(0) === "ComputeBudget111111111111111111111111111111" && prog(1) === prog(0) && prog(2) === router && prog(3) === program && prog(4) === program);
  const data = (i: number) => new Uint8Array(ix[i]!.data!), view = (i: number) => new DataView(data(i).buffer), u64 = (i: number, at: number) => view(i).getBigUint64(at, true);
  check(data(0).length === 5 && data(0)[0] === 2 && view(0).getUint32(1, true) === 1000000);
  check(data(1).length === 9 && data(1)[0] === 3 && u64(1, 1) === 1000n);
  const same = (b: Uint8Array, expected: number[]) => b.length === expected.length && b.every((v, i) => v === expected[i]);
  const routeDiscriminator = decode64("0DPvl3sr7Vw="); check(same(data(2).subarray(0, 8), [...routeDiscriminator]));
  check(data(2).length === 36 && view(2).getUint32(8, true) === 1 && same(data(2).subarray(12, 17), [17, 0, 100, 0, 1]));
  check(u64(2, 17) === BigInt(plan.maxSolAtoms) && (u64(2, 25) * 10050n + 9999n) / 10000n === BigInt(plan.maxSwapUsdcAtoms));
  check(view(2).getUint16(33, true) === 50 && data(2)[35] === 0);
  const accounts = (i: number) => Array.from(ix[i]!.accountIndices ?? [], n => keys[n]!);
  check(JSON.stringify(accounts(2).slice(0, 11)) === JSON.stringify([token, CHALLENGE_WALLET, usdcAta, wsolAta, router, usdc, sol, router, router, "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf", router]));
  const remaining = accounts(2).slice(11); check(remaining.length === 12);
  check(remaining[0] === "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc" && remaining[1] === token && remaining[2] === CHALLENGE_WALLET && remaining[4] === wsolAta && remaining[6] === usdcAta);
  const pda = async (seeds: k.ReadonlyUint8Array[]) => (await k.getProgramDerivedAddress({ programAddress: k.address(program), seeds }))[0], enc = k.getAddressEncoder();
  check(plan.position === await pda([new TextEncoder().encode("position"), enc.encode(k.address(mint))]));
  check(plan.nft === await pda([new TextEncoder().encode("position_nft_account"), enc.encode(k.address(mint))]));
  const event = await pda([new TextEncoder().encode("__event_authority")]);
  check(same(data(3), [48, 215, 197, 153, 96, 203, 180, 133]));
  check(JSON.stringify(accounts(3)) === JSON.stringify([CHALLENGE_WALLET, mint, plan.nft, METEORA_POOL, plan.position, "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC", CHALLENGE_WALLET, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "11111111111111111111111111111111", event, program]));
  check(data(4).length === 40 && same(data(4).subarray(0, 8), [181, 157, 89, 67, 143, 182, 52, 72]));
  check(u64(4, 8) + (u64(4, 16) << 64n) === BigInt(plan.liquidity));
  check(u64(4, 24) === BigInt(plan.maxSolAtoms) && u64(4, 32) === BigInt(plan.maxDepositUsdcAtoms));
  check(JSON.stringify(accounts(4)) === JSON.stringify([METEORA_POOL, plan.position, wsolAta, usdcAta, "sx8hCMCauCdbZ7sVBGSJmH7b7JmtuN8d8YwYmBpuPLH", "8S8HjmPZr8tNNEmMj5pcqS5RN73uF6DmcUDEDaoUQ1Ei", sol, usdc, plan.nft, CHALLENGE_WALLET, token, token, event, program]));
  return { tx, tables: tableKeys };
}
export async function verifyLivePlanContext(plan: MeteoraPlan,readToken?:string) {
  await validateMeteoraPlan(plan,plan.mint);
  check(await browserRpc("getGenesisHash", []) === "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", "Wallet RPC must use mainnet");
  check(await browserRpc<number>("getBlockHeight", [{ commitment: "confirmed" }],readToken) < plan.lastValidBlockHeight - 8, "Transaction is expiring. Refresh before signing.");
  const keys = Object.keys(plan.lookupTables);
  if (keys.length) {
    const raw = await browserRpc<{ value: { owner: string; data: [string, string] }[] }>("getMultipleAccounts", [keys, { encoding: "base64", commitment: "confirmed" }]);
    raw.value.forEach((a, i) => { check(a.owner === "AddressLookupTab1e1111111111111111111111111"); const b = decode64(a.data[0]); check(b.length >= 56 && (b.length - 56) % 32 === 0); const decoded = Array.from({ length: (b.length - 56) / 32 }, (_, j) => k.getAddressDecoder().decode(b.subarray(56 + j * 32, 88 + j * 32))); check(JSON.stringify(decoded) === JSON.stringify(plan.lookupTables[keys[i]!])); });
  }
  // Independently bind the remaining Jupiter route accounts to the current legacy SOL/USDC Whirlpool.
  const c = k.getCompiledTransactionMessageDecoder().decode(decode64(plan.messageBase64)); if (c.version !== 0) throw Error("Expected version zero");
  const writable = c.addressTableLookups?.flatMap(l => l.writableIndexes.map(i => plan.lookupTables[l.lookupTableAddress]![i]!)) ?? [], readonly = c.addressTableLookups?.flatMap(l => l.readonlyIndexes.map(i => plan.lookupTables[l.lookupTableAddress]![i]!)) ?? [];
  const all: string[] = [...c.staticAccounts, ...writable, ...readonly], route = Array.from(c.instructions[plan.setupWsol?3:2]!.accountIndices ?? [], i => all[i]!).slice(11), whirl = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
  const amm = route[3]!, raw = await browserRpc<{ value: { owner: string; executable: boolean; data: [string, string] }[] }>("getMultipleAccounts", [[amm, route[5], route[7]], { encoding: "base64", commitment: "confirmed" }]);
  const pool = raw.value[0]!; check(pool.owner === whirl && !pool.executable); const b = decode64(pool.data[0]); check(b.length >= 245);
  check(Array.from(b.subarray(0, 8)).map(x => x.toString(16).padStart(2, "0")).join("") === (await digest(new TextEncoder().encode("account:Whirlpool"))).slice(0, 16));
  const addressAt = (offset: number) => k.getAddressDecoder().decode(b.subarray(offset, offset + 32));
  check(addressAt(101) === sol && addressAt(181) === usdc && addressAt(133) === route[5] && addressAt(213) === route[7]);
  const v = new DataView(b.buffer), spacing = v.getUint16(41, true), tick = v.getInt32(81, true); check(spacing > 0);
  const start = Math.floor(tick / (88 * spacing)) * 88 * spacing, encoder = k.getAddressEncoder();
  const pda = async (seeds: k.ReadonlyUint8Array[]) => (await k.getProgramDerivedAddress({ programAddress: k.address(whirl), seeds }))[0];
  for (let i = 0; i < 3; i++) check(route[8 + i] === await pda([new TextEncoder().encode("tick_array"), encoder.encode(k.address(amm)), new TextEncoder().encode(String(start + i * 88 * spacing))]));
  check(route[11] === await pda([new TextEncoder().encode("oracle"), encoder.encode(k.address(amm))]));
  for (let i = 0; i < 2; i++) { const vault = raw.value[1 + i]!; check(vault.owner === token && !vault.executable); const t = decode64(vault.data[0]); check(t.length === 165 && t[108] === 1); check(k.getAddressDecoder().decode(t.subarray(0, 32)) === (i ? usdc : sol)); check(k.getAddressDecoder().decode(t.subarray(32, 64)) === amm); }
  const addresses=[CHALLENGE_WALLET,usdcAta,wsolAta,plan.position,plan.mint,plan.nft];
  type Account={owner:string;executable:boolean;lamports:number;data:[string,string]};
  const rawWallet=await browserRpc<{context:{slot:number};value:(Account|null)[]}>("getMultipleAccounts",[addresses,{encoding:"base64",commitment:"confirmed",minContextSlot:plan.slot}]);
  const tokenAmount=(a:Account|null,mint:string)=>{check(a&&!a.executable&&(a.owner===token||a.owner==="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));const b=decode64(a!.data[0]);check(b[108]===1&&new DataView(b.buffer).getUint32(72,true)===0);const d=k.getAddressDecoder();check(d.decode(b.subarray(0,32))===mint&&d.decode(b.subarray(32,64))===CHALLENGE_WALLET);return new DataView(b.buffer).getBigUint64(64,true);};
  const before=rawWallet.value;check(String(before[0]?.lamports)===plan.beforeNativeLamports,"SOL balance changed; refresh the review");check(tokenAmount(before[1]!,usdc)===BigInt(plan.beforeUsdcAtoms),"USDC balance changed; refresh the review");
  check(plan.setupWsol?before[2]===null:tokenAmount(before[2]!,sol)===BigInt(plan.beforeWsolAtoms),"WSOL account changed; refresh the review");check(before.slice(3).every(a=>a===null));
  const fee=await browserRpc<{value:number}>("getFeeForMessage",[plan.messageBase64,{commitment:"confirmed"}]);check(String(fee.value)===plan.feeLamports);
  const sim=await simulateRecoveryAccounts<Account>((method,params)=>browserRpc(method as Parameters<typeof browserRpc>[0],params,readToken),plan.wireBase64,addresses,rawWallet.context.slot,c.staticAccounts.length),post=sim.value.accounts;
  const spent=BigInt(plan.beforeUsdcAtoms)-tokenAmount(post[1]!,usdc);check(spent>0n&&spent<=BigInt(plan.maxSpendUsdcAtoms));
  check(BigInt(plan.beforeNativeLamports)-BigInt(post[0]!.lamports)===BigInt(plan.rentLamports)+BigInt(plan.feeLamports),"SOL fee/rent differs from the review");
  check(tokenAmount(post[2]!,sol)>=BigInt(plan.beforeWsolAtoms)&&tokenAmount(post[5]!,plan.mint)===1n&&post[3]?.owner===program);
  check(Date.now()<Date.parse(plan.expiresAt),"Quote expired during simulation. Refresh before signing.");
  check(await browserRpc<number>("getBlockHeight",[{commitment:"confirmed"}],readToken)<plan.lastValidBlockHeight-8,"Transaction is expiring. Refresh before signing.");
}
export async function finishWalletSignature(plan: MeteoraPlan, signedBytes: Uint8Array, mint: k.KeyPairSigner) {
  await validateMeteoraPlan(plan,mint.address);
  const tx = k.getTransactionDecoder().decode(signedBytes); check(await digest(tx.messageBytes) === plan.messageHash, "Wallet changed the reviewed transaction");
  const signature = tx.signatures[k.address(CHALLENGE_WALLET)]; check(signature && signature.some(x => x !== 0), "Wallet signature missing");
  const publicKey = await crypto.subtle.importKey("raw", new Uint8Array(k.getAddressEncoder().encode(k.address(CHALLENGE_WALLET))), { name: "Ed25519" }, false, ["verify"]);
  check(await crypto.subtle.verify("Ed25519", publicKey, new Uint8Array(signature!), new Uint8Array(tx.messageBytes)), "Wallet signature does not match the challenge wallet");
  check(mint.address === plan.mint); const complete = await k.partiallySignTransaction([mint.keyPair], tx);
  return { wire: new Uint8Array(k.getTransactionEncoder().encode(complete)), signature: k.getSignatureFromTransaction(complete) };
}
