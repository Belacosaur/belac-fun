import {expect,it} from "vitest";
import * as k from "@solana/kit";
import {CHALLENGE_WALLET} from "../../../packages/contracts/src/trades.js";
import {RECOVERY_SOURCE,RECOVERY_DESTINATION} from "../../../packages/contracts/src/recovery.js";
import {METEORA_ACCOUNTS,checkMeteoraInput} from "./meteora-builder.js";
it("only permits the migrated wallet and derives both token accounts from that owner",async()=>{
 expect(CHALLENGE_WALLET).toBe(RECOVERY_DESTINATION);
 const enc=k.getAddressEncoder();
 for(const [name,mint] of [["usdc","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],["wsol","So11111111111111111111111111111111111111112"]] as const){
  const [ata]=await k.getProgramDerivedAddress({programAddress:k.address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),seeds:[enc.encode(k.address(RECOVERY_DESTINATION)),enc.encode(k.address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),enc.encode(k.address(mint))]});
  expect(METEORA_ACCOUNTS[name]).toBe(ata);
 }
 expect(()=>checkMeteoraInput({wallet:RECOVERY_SOURCE,station:5,mint:"AqCA9WUnMD5a1WetTvGiqyfns5AVyua6gXSzcJgduYCk"})).toThrow();
 expect(METEORA_ACCOUNTS.hold).toBe(0n);expect(METEORA_ACCOUNTS.orcaWsol).toBe(0n);
});
