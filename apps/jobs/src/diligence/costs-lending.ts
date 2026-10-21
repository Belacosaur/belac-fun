import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getAddressEncoder, address } from "@solana/kit";
import { compileCostMessage } from "./costs.js";
import { SecurityRpc } from "./security.js";
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const payer = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Execution must remain disabled");
const rpc = new SecurityRpc("https://api.mainnet-beta.solana.com");
const results: unknown[] = [];
for (const market of ["jlp", "solbtc"]) {
  const raw = await readFile(`artifacts/diligence/lending-preview-${market}.json`, "utf8");
  const preview = row(JSON.parse(raw));
  if (!Array.isArray(preview.instructions)) throw new Error("Missing unsigned lending instructions");
  const instructions = preview.instructions.map(v => {
    const i = row(v); if (!Array.isArray(i.accounts)) throw new Error("Invalid lending instruction");
    return { programId: i.programAddress, data: i.data, accounts: i.accounts.map(v => {
      const a = row(v), role = String(a.role);
      if (!["READONLY", "WRITABLE", "READONLY_SIGNER", "WRITABLE_SIGNER"].includes(role)) throw new Error("Unknown account role");
      return { pubkey: a.address, isSigner: role.includes("SIGNER"), isWritable: role.startsWith("WRITABLE") };
    }) };
  });
  const latest = row(row(await rpc.call("getLatestBlockhash", [{ commitment: "confirmed" }])).value);
  const cost = compileCostMessage({ transactionVersion: 0, addressesByLookupTableAddress: preview.lutsByAddress,
    otherInstructions: instructions.slice(0, -1), swapInstruction: instructions.at(-1),
    blockhashWithMetadata: { blockhash: Array.from(getAddressEncoder().encode(address(String(latest.blockhash)))), lastValidBlockHeight: latest.lastValidBlockHeight } }, payer);
  const response = row(await rpc.call("getFeeForMessage", [cost.messageBase64, { commitment: "confirmed" }]));
  results.push({ market, unsignedPreviewSha256: createHash("sha256").update(raw).digest("hex"), currentEntryFeeLamports: response.value ?? null, currentMessageBytes: cost.messageBytes, currentInstructionCount: cost.instructionCount,
    requiredSignatures: cost.requiredSignatures, feePolicy: "Official API unsigned entry instructions, supplied CU limit, zero additional CU price/tip; no signing, simulation or landing guarantee.",
    currentExitFeeLamports: null, exitGap: "Official withdrawal preview requires an existing obligation; wallet is unfunded and no obligation will be created for this check." });
}
const report = { observedAt: new Date().toISOString(), executionEnabled: false, mode: "unsigned-message-fee-read", results, evidence: rpc.evidence };
await writeFile("artifacts/diligence/lending-message-costs.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(results, null, 2));
