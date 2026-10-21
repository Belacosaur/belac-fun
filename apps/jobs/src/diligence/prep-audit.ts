/** Offline, limited ABI cross-check of saved unsigned preparation evidence. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { inspectExactOutInstruction, validatePrepQuote } from "./prep.js";
const dir = fileURLToPath(new URL("../../../../artifacts/diligence/", import.meta.url));
const raw = await readFile(dir + "costs-orca-budgeted-prep.json", "utf8");
const saved = JSON.parse(raw);
const lp = JSON.parse(await readFile(dir + "lp-orca-budgeted-quote.json", "utf8"));
const schema = await readFile(dir + "costs-jupiter-parser-idl.ts.txt");
const result = { auditedAt: new Date().toISOString(), networkCalls: 0, signed: false, submitted: false,
  quoteObservedAt: saved.observedAt, savedPreviewSha256: createHash("sha256").update(raw).digest("hex"),
  schemaSource: "https://github.com/jup-ag/instruction-parser/blob/main/src/idl/jupiter.ts",
  schemaFileSha256: createHash("sha256").update(schema).digest("hex"),
  quoteBudget: validatePrepQuote(saved.quote, lp.prepSwapRequiredSolOutputAtoms, lp.quote.tokenMaxB, lp.strategyBudgetUsdcAtoms),
  instructionAmounts: inspectExactOutInstruction(saved.unsignedPreview.swapInstruction, saved.quote,
    "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j", "8DDPMR9LcM7YaHfwq41TteyGpnFi222gCgDEZUuy5PmE", "G5gUmEtvsE2RAj9gFSDP5ZgZ5WW4CeNRchj3r8fE4uvf"),
  completeTransactionSecurityAudit: false, fundedSimulation: false };
await writeFile(dir + "costs-orca-prep-abi-check.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
