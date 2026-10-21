import { Decimal } from "decimal.js";
import { address, appendTransactionMessageInstructions, blockhash, compileTransactionMessage, compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage, getAddressDecoder, getCompiledTransactionMessageEncoder, setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash, type Instruction } from "@solana/kit";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};

/** Unsigned message bytes only. This module has no signer, transaction or submission API. */
export function compileCostMessage(preview: Row, payer: string) {
  if (preview.transactionVersion !== 0) throw new Error("Only v0 cost previews supported");
  const instructions: Instruction[] = [];
  const all = [
    ...(Array.isArray(preview.computeBudgetInstructions) ? preview.computeBudgetInstructions : []),
    ...(Array.isArray(preview.setupInstructions) ? preview.setupInstructions : []),
    ...(Array.isArray(preview.otherInstructions) ? preview.otherInstructions : []),
    preview.swapInstruction, preview.cleanupInstruction, preview.tipInstruction,
  ].filter(Boolean);
  for (const v of all) {
    const ix = row(v);
    if (!ix.programId || !Array.isArray(ix.accounts) || typeof ix.data !== "string") throw new Error("Invalid preview instruction");
    instructions.push({ programAddress: address(String(ix.programId)), data: Buffer.from(ix.data, "base64"), accounts: ix.accounts.map(v => {
      const a = row(v); if (a.isSigner === true && a.pubkey !== payer) throw new Error("Unexpected required signer in cost preview");
      return { address: address(String(a.pubkey)), role: a.isSigner === true ? a.isWritable === true ? 3 : 2 : a.isWritable === true ? 1 : 0 };
    }) });
  }
  const rawHash = row(preview.blockhashWithMetadata).blockhash;
  if (!Array.isArray(rawHash) || rawHash.length !== 32 || rawHash.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error("Invalid preview blockhash");
  const hash = blockhash(getAddressDecoder().decode(Uint8Array.from(rawHash)));
  const tx = appendTransactionMessageInstructions(instructions, setTransactionMessageLifetimeUsingBlockhash({ blockhash: hash,
    lastValidBlockHeight: BigInt(String(row(preview.blockhashWithMetadata).lastValidBlockHeight)) }, setTransactionMessageFeePayer(address(payer), createTransactionMessage({ version: 0 }))));
  const tables = Object.fromEntries(Object.entries(row(preview.addressesByLookupTableAddress)).map(([key, v]) => {
    if (!Array.isArray(v)) throw new Error("Invalid lookup table mapping");
    return [address(key), v.map(a => address(String(a)))];
  }));
  const compiled = compileTransactionMessage(compressTransactionMessageUsingAddressLookupTables(tx, tables));
  const bytes = getCompiledTransactionMessageEncoder().encode(compiled);
  return { messageBase64: Buffer.from(bytes).toString("base64"), messageBytes: bytes.length, instructionCount: instructions.length, requiredSignatures: compiled.header.numSignerAccounts };
}

export function summarizeSwapCosts(inputUsdcBase: string, recoveredUsdcBase: string, buyFeeLamports: string, sellFeeLamports: string, rentLamports: string, solUsd: string) {
  const network = new Decimal(buyFeeLamports).add(sellFeeLamports).div(1e9);
  return { currentQuoteRoundTripLossUsdc: new Decimal(inputUsdcBase).sub(recoveredUsdcBase).div(1e6).toFixed(6),
    networkRoundTripSol: network.toFixed(9), networkRoundTripUsdAtSnapshot: network.mul(solUsd).toFixed(6),
    recoverableRentSol: new Decimal(rentLamports).div(1e9).toFixed(9), rentCountedAsExpense: false, futureExitCostGuaranteed: false,
    interpretation: "Sequential current quotes include venue fees/impact and market movement; not guaranteed future costs or arbitrage. Rent is separately funded recoverable capital." };
}
