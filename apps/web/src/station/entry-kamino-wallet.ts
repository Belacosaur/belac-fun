import * as k from "@solana/kit";
import { CHALLENGE_WALLET as wallet, TRADE_TOKEN_ACCOUNTS as t } from "../../../../packages/contracts/src/trades";
import type { StationEntryPlan } from "../../../../packages/contracts/src/station-entries";
const program="KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",market="DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek",reserve="Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp",authority="B9spsrMK6pJicYtukaZzDyzsUQLgc3jbx5gHVwdDxb6y",mint="32XLsweyeQwWgLKRVAzS72nxHGU1JmmNQQZ3C3q6fBjJ",usdc="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",vault="GENey8es3EgGiNTM8H8gzA3vf98haQF8LHiYFyErjgrv",token="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",ataProgram="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",system="11111111111111111111111111111111",scope="3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH",sysvar="Sysvar1nstructions1111111111111111111111111";
const check=(v:unknown)=>{if(!v)throw new Error("Kamino transaction differs from the reviewed direct 10 USDC deposit");};
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const same=(a:readonly unknown[],b:readonly unknown[])=>JSON.stringify(a)===JSON.stringify(b);
function atoms(s:unknown):bigint {check(typeof s==="string"&&/^\d+$/.test(s));return BigInt(s as string);}
/** Canonical decoded semantics. Common entry validation independently verifies freshness, hashes and live balances. */
export async function validateKaminoEntryPlan(p:StationEntryPlan):Promise<void> {
 check(p.version===1&&p.wallet===wallet&&p.stationId===6&&(!p.mint||p.mint===usdc));check(p.budgetUsdcAtoms==="10000000"&&p.maxSpendUsdcAtoms==="10000000"&&p.simulatedSpendUsdcAtoms==="10000000");
 check(p.accounts.usdc===t.usdc&&p.accounts.wsol===t.wsol&&p.accounts.reserve===reserve);check(p.details.collateralMint===mint&&p.details.reserve===reserve);
 const enc=k.getAddressEncoder(),ata=(await k.getProgramDerivedAddress({programAddress:k.address(ataProgram),seeds:[enc.encode(k.address(wallet)),enc.encode(k.address(token)),enc.encode(k.address(mint))]}))[0];check(p.accounts.collateralAta===ata);
 check(typeof p.details.setupCollateral==="boolean");const setup=p.details.setupCollateral;const shares=atoms(p.details.receiptAtoms),minimum=atoms(p.details.minReceiptAtoms),prior=atoms(p.details.collateralBeforeAtoms);check(shares>0n&&minimum>0n&&shares>=minimum&&atoms(p.details.collateralAfterAtoms)===prior+shares);if(setup)check(prior===0n);
 const rent=atoms(p.rentLamports),fee=atoms(p.feeLamports);check(setup?rent>0n&&rent<=2039280n:rent===0n);check(fee>=5000n&&fee<=12000n);check(atoms(p.before.usdcAtoms)-atoms(p.after.usdcAtoms)===10000000n);check(p.before.wsolAtoms===p.after.wsolAtoms);check(atoms(p.before.nativeLamports)-atoms(p.after.nativeLamports)===rent+fee&&atoms(p.after.nativeLamports)>=10000000n);
 // A direct lending message fits without a LUT. Reject every table or extra instruction.
 check(Object.keys(p.lookupTables).length===0);const c=k.getCompiledTransactionMessageDecoder().decode(decode(p.messageBase64));check(c.version===0);if(c.version!==0)throw new Error("Expected version zero");check(!c.addressTableLookups?.length&&c.header.numSignerAccounts===1&&c.staticAccounts[0]===wallet);check(c.lifetimeToken===p.blockhash);
 const keys:readonly string[]=c.staticAccounts,ix=c.instructions;check(ix.length===(setup?3:2));
 function instruction(i:number,id:string,data:readonly number[],accounts:string[]) {const instruction=ix[i]!;check(keys[instruction.programAddressIndex]===id);check(same(Array.from(instruction.data??[]),data));check(same(Array.from(instruction.accountIndices??[],n=>keys[n]),accounts));}
 if(setup)instruction(0,ataProgram,[1],[wallet,ata,wallet,mint,system,token]);
 instruction(setup?1:0,program,[2,218,138,235,79,201,25,102],[reserve,market,program,program,program,scope]);
 const data=new Uint8Array(16);data.set([169,201,30,126,6,205,102,68]);new DataView(data.buffer).setBigUint64(8,10000000n,true);
 instruction(setup?2:1,program,Array.from(data),[wallet,reserve,market,authority,usdc,vault,mint,t.usdc,ata,token,token,sysvar]);
 const writable=new Set<string>([wallet,reserve,vault,mint,t.usdc,ata]);const required=new Set<string>([...writable,market,authority,usdc,program,scope,token,sysvar,...(setup?[ataProgram,system]:[])]);
 check(keys.length===required.size&&keys.every(a=>required.has(a)));const writableEnd=keys.length-c.header.numReadonlyNonSignerAccounts;
 check(c.header.numReadonlySignerAccounts===0);keys.forEach((a,i)=>check((i<writableEnd)===writable.has(a)));
}
