import { expect, it } from "vitest";
import { inspectExactOutInstruction, validatePrepQuote } from "./prep.js";
import { createHash } from "node:crypto";

const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const sol = "So11111111111111111111111111111111111111112";
const quote = { inputMint: usdc, outputMint: sol, swapMode: "ExactOut", inAmount: "4500000", outAmount: "41849442", otherAmountThreshold: "4522500" };
it("bounds the combined LP deposit and preparation swap by the station budget", () => {
  const result = validatePrepQuote(quote, "41849442", "5451204", "10000000");
  expect(result.minimumRemainingUsdcAtoms).toBe("26296");
  expect(result.expectedRemainingUsdcAtoms).toBe("48796");
  expect(() => validatePrepQuote({ ...quote, otherAmountThreshold: "4548797" }, "41849442", "5451204", "10000000")).toThrow(/budget/);
});
it("rejects ignored ExactOut mode, wrong mint/quantity, or malformed thresholds", () => {
  for (const bad of [{ swapMode: "ExactIn" }, { outputMint: usdc }, { outAmount: "41849443" }, { otherAmountThreshold: "4499999" }, { inAmount: "4.5e6" }]) {
    expect(() => validatePrepQuote({ ...quote, ...bad }, "41849442", "5451204", "10000000")).toThrow();
  }
});
it("independently checks encoded exact-output bounds and owned source/destination accounts", () => {
  const bytes = Buffer.alloc(8 + 4 + 4 + 19);
  createHash("sha256").update("global:exact_out_route").digest().copy(bytes, 0, 0, 8);
  bytes.writeBigUInt64LE(41849442n, bytes.length - 19); bytes.writeBigUInt64LE(4500000n, bytes.length - 11);
  bytes.writeUInt16LE(50, bytes.length - 3);
  const payer = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
  const accounts = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", payer, "source", "destination", "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", usdc, sol].map((pubkey, i) => ({ pubkey, isSigner: i === 1, isWritable: i === 2 || i === 3 }));
  const instruction = { programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", data: bytes.toString("base64"), accounts };
  expect(inspectExactOutInstruction(instruction, { ...quote, slippageBps: 50 }, payer, "source", "destination").conservativeMaximumInputUsdcAtoms).toBe("4522500");
  bytes.writeBigUInt64LE(41849443n, bytes.length - 19);
  expect(() => inspectExactOutInstruction({ ...instruction, data: bytes.toString("base64") }, { ...quote, slippageBps: 50 }, payer, "source", "destination")).toThrow(/amount/);
  expect(() => inspectExactOutInstruction(instruction, { ...quote, slippageBps: 50 }, payer, "source", "wrong-destination")).toThrow(/account/);
});
