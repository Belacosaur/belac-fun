import { createHash } from "node:crypto";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const integer = (v: unknown): bigint => {
  if (typeof v !== "string" || !/^[0-9]+$/.test(v)) throw new Error("Expected integer base units");
  return BigInt(v);
};

/** Diagnostic bound only: no signing, submission or executable approval. */
export function validatePrepQuote(quote: Record<string, unknown>, solRequired: string, usdcDeposit: string, budget: string) {
  if (quote.inputMint !== USDC || quote.outputMint !== SOL || quote.swapMode !== "ExactOut" || quote.outAmount !== solRequired) throw new Error("Preparation quote identity/mode/output mismatch");
  const input = integer(quote.inAmount), maxInput = integer(quote.otherAmountThreshold);
  const stable = integer(usdcDeposit), capital = integer(budget);
  if (input <= 0n || integer(solRequired) <= 0n || maxInput < input) throw new Error("Invalid preparation quote amounts");
  if (maxInput + stable > capital) throw new Error("Preparation swap and LP deposit exceed station budget");
  return { expectedSwapInputUsdcAtoms: input.toString(), maximumSwapInputUsdcAtoms: maxInput.toString(),
    depositUsdcAtoms: stable.toString(), expectedRemainingUsdcAtoms: (capital - stable - input).toString(),
    minimumRemainingUsdcAtoms: (capital - stable - maxInput).toString(), strategyBudgetUsdcAtoms: capital.toString() };
}

/** Checks fixed account roles and fixed-width amount suffix from official exactOutRoute IDL.
 * Route-plan enum decoding and inner venue execution are deliberately outside this diagnostic.
 */
export function inspectExactOutInstruction(ix: Record<string, unknown>, quote: Record<string, unknown>, payer: string, sourceAta: string, destinationAta: string) {
  const router = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
  if (ix.programId !== router || typeof ix.data !== "string" || !Array.isArray(ix.accounts)) throw new Error("Unsupported preparation instruction");
  const bytes = Buffer.from(ix.data, "base64"), discriminator = createHash("sha256").update("global:exact_out_route").digest().subarray(0, 8);
  if (bytes.length < 31 || !bytes.subarray(0, 8).equals(discriminator)) throw new Error("Unsupported exact-output instruction layout");
  const accounts = ix.accounts as { pubkey?: unknown; isSigner?: unknown; isWritable?: unknown }[];
  const expected: [number, string][] = [[0, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"], [1, payer], [2, sourceAta], [3, destinationAta], [4, router], [5, USDC], [6, SOL]];
  if (expected.some(([index, key]) => accounts[index]?.pubkey !== key) || accounts[1]?.isSigner !== true || accounts[2]?.isWritable !== true || accounts[3]?.isWritable !== true) throw new Error("Preparation source/destination account mismatch");
  const output = bytes.readBigUInt64LE(bytes.length - 19), input = bytes.readBigUInt64LE(bytes.length - 11), slippage = bytes.readUInt16LE(bytes.length - 3), platformFee = bytes[bytes.length - 1];
  if (output !== integer(quote.outAmount) || input !== integer(quote.inAmount) || slippage !== quote.slippageBps || slippage > 50 || platformFee !== 0) throw new Error("Encoded preparation amount/fee limits differ from quote");
  const maxInput = (input * BigInt(10000 + slippage) + 9999n) / 10000n;
  if (maxInput > integer(quote.otherAmountThreshold)) throw new Error("Encoded preparation input exceeds quote threshold");
  return { instruction: "exactOutRoute", outputSolAtoms: output.toString(), quotedInputUsdcAtoms: input.toString(), slippageBps: slippage,
    conservativeMaximumInputUsdcAtoms: maxInput.toString(), sourceAta, destinationAta,
    limitations: "Fixed-width amount suffix/account roles checked against official parser IDL; route-plan/venue decoding, full instruction allowlisting and funded simulation are not complete." };
}
