import { expect, it } from "vitest";
import { compileCostMessage, summarizeSwapCosts } from "./costs.js";
const payer = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
it("compiles an unsigned message and rejects a foreign required signer", () => {
  const ix = { programId: "11111111111111111111111111111111", accounts: [{ pubkey: payer, isSigner: true, isWritable: true }], data: "AAAAAA==" };
  const preview = { transactionVersion: 0, swapInstruction: ix, addressesByLookupTableAddress: {}, blockhashWithMetadata: { blockhash: Array(32).fill(1), lastValidBlockHeight: 100 } };
  expect(Buffer.from(compileCostMessage(preview, payer).messageBase64, "base64").length).toBeGreaterThan(50);
  expect(() => compileCostMessage({ ...preview, swapInstruction: { ...ix, accounts: [{ pubkey: "11111111111111111111111111111111", isSigner: true, isWritable: true }] } }, payer)).toThrow(/signer/);
});
it("reports current quote friction separately from refundable rent and exact message fees", () => {
  const r = summarizeSwapCosts("10000000", "9890000", "5000", "5000", "1488440", "100");
  expect(r.currentQuoteRoundTripLossUsdc).toBe("0.110000");
  expect(r.networkRoundTripSol).toBe("0.000010000");
  expect(r.networkRoundTripUsdAtSnapshot).toBe("0.001000");
  expect(r.recoverableRentSol).toBe("0.001488440");
  expect(r.rentCountedAsExpense).toBe(false);
  expect(r.futureExitCostGuaranteed).toBe(false);
});
