/** Read-only quote and unsigned-instruction builder. No private key, signature or submission. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { address, getAddressDecoder, getAddressEncoder } from "@solana/kit";
import { compileCostMessage } from "./costs.js";
import { inspectExactOutInstruction, validatePrepQuote } from "./prep.js";
import { SecurityRpc } from "./security.js";
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Execution must remain disabled");
const payer = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
const dir = fileURLToPath(new URL("../../../../artifacts/diligence/", import.meta.url));
const source = await readFile(dir + "lp-orca-budgeted-quote.json", "utf8"), lp = row(JSON.parse(source));
const rpc = new SecurityRpc("https://api.mainnet-beta.solana.com");
const evidence: unknown[] = [];
const report: Row = { observedAt: new Date().toISOString(), executionEnabled: false, ript: "pending", sourceSha256: createHash("sha256").update(source).digest("hex"),
  signed: false, sent: false, successfulExecutionSimulation: false, status: "partial", limitations: ["Saved LP deposit price/ticks and fresh preparation route are different snapshots; full LP amounts must be refreshed together before funding.", "A fee query does not execute or validate the message; zero chosen priority price is not a landing guarantee.", "Shared USDC/WSOL account rent is counted once in the LP account-capital table."] };
async function request(url: string, body?: Row) {
  const response = await fetch(url, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(20000),
    headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.text();
  if (payload.length > 1_000_000) throw new Error("Builder response exceeds bound");
  evidence.push({ url, method: body ? "POST" : "GET", requestBody: body, observedAt: new Date().toISOString(), httpStatus: response.status, sha256: createHash("sha256").update(payload).digest("hex"), payload });
  if (!response.ok) throw new Error(`Unsigned builder HTTP ${response.status}`);
  return row(JSON.parse(payload));
}
try {
  const query = new URLSearchParams({ inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", outputMint: "So11111111111111111111111111111111111111112",
    amount: String(lp.prepSwapRequiredSolOutputAtoms), swapMode: "ExactOut", slippageBps: "50" });
  const quote = await request(`https://api.jup.ag/swap/v1/quote?${query}`);
  report.budget = validatePrepQuote(quote, String(lp.prepSwapRequiredSolOutputAtoms), String(row(lp.quote).tokenMaxB), String(lp.strategyBudgetUsdcAtoms));
  report.quote = quote;
  const preview = await request("https://api.jup.ag/swap/v1/swap-instructions", { quoteResponse: quote, userPublicKey: payer, wrapAndUnwrapSol: false,
    dynamicComputeUnitLimit: false, computeUnitPriceMicroLamports: 0, asLegacyTransaction: false });
  report.unsignedPreview = preview;
  if (preview.error) throw new Error("Builder returned an instruction error");
  report.encodedAmountChecks = inspectExactOutInstruction(row(preview.swapInstruction), quote, payer,
    "8DDPMR9LcM7YaHfwq41TteyGpnFi222gCgDEZUuy5PmE", "G5gUmEtvsE2RAj9gFSDP5ZgZ5WW4CeNRchj3r8fE4uvf");
  const luts = preview.addressLookupTableAddresses;
  if (!Array.isArray(luts) || luts.length > 20 || luts.some(v => typeof v !== "string")) throw new Error("Invalid lookup table list");
  const tables: Record<string, string[]> = {};
  if (luts.length) {
    const result = row(await rpc.call("getMultipleAccounts", [luts, { encoding: "base64", commitment: "confirmed" }]));
    if (!Array.isArray(result.value) || result.value.length !== luts.length) throw new Error("Lookup table accounts missing");
    result.value.forEach((v, index) => {
      const a = row(v);
      if (a.owner !== "AddressLookupTab1e1111111111111111111111111" || a.executable !== false || !Array.isArray(a.data)) throw new Error("Unverified lookup table owner/layout");
      const bytes = Buffer.from(String(a.data[0]), "base64");
      if (bytes.length < 56 || (bytes.length - 56) % 32 !== 0 || bytes.readUInt32LE(0) !== 1 || bytes.readBigUInt64LE(4) !== 18446744073709551615n) throw new Error("Lookup table invalid/deactivated");
      tables[String(luts[index])] = Array.from({ length: (bytes.length - 56) / 32 }, (_, j) => getAddressDecoder().decode(bytes.subarray(56 + j * 32, 88 + j * 32)));
    });
  }
  const latest = row(row(await rpc.call("getLatestBlockhash", [{ commitment: "confirmed" }])).value);
  const message = compileCostMessage({ ...preview, transactionVersion: 0, addressesByLookupTableAddress: tables, blockhashWithMetadata: {
    blockhash: Array.from(getAddressEncoder().encode(address(String(latest.blockhash)))), lastValidBlockHeight: latest.lastValidBlockHeight } }, payer);
  const fee = row(await rpc.call("getFeeForMessage", [message.messageBase64, { commitment: "confirmed" }]));
  if (typeof fee.value !== "number" || !Number.isSafeInteger(fee.value)) throw new Error("Current message fee unavailable");
  report.currentMessageFeeLamports = String(fee.value); report.message = message;
  report.serializedTransactionBytes = message.messageBytes + 1 + 64 * message.requiredSignatures;
  if (Number(report.serializedTransactionBytes) > 1232) throw new Error("v0 preview exceeds transaction byte limit");
  report.status = "budget-bounded-current-unsigned-preview";
} catch (error) { report.error = error instanceof Error ? error.message : "Unknown preview failure"; }
finally {
  report.evidence = evidence; report.rpcEvidence = rpc.evidence;
  await writeFile(dir + "costs-orca-budgeted-prep.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, budget: report.budget, currentMessageFeeLamports: report.currentMessageFeeLamports, serializedTransactionBytes: report.serializedTransactionBytes, error: report.error }, null, 2));
