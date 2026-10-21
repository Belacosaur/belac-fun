import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { inspectMint, SecurityRpc, summarizeHolders } from "./security.js";
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Execution must stay disabled");
const report = row(JSON.parse(await readFile("artifacts/diligence/security.json", "utf8")));
const tokens = report.tokens as Row[];
const token = tokens.find(t => t.mint === "METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL")!;
const rpc = new SecurityRpc("https://api.mainnet-beta.solana.com");
const url = `https://api.rugcheck.xyz/v1/tokens/${token.mint}/report`;
const savedPath = "artifacts/diligence/security-met-index-response.json";
const saved = process.argv.includes("--saved");
const response = saved ? null : await fetch(url, { redirect: "error", signal: AbortSignal.timeout(25000) });
const body = saved ? await readFile(savedPath, "utf8") : await response!.text();
if (response && !response.ok || body.length > 4_000_000) throw new Error("MET index unavailable or exceeds bounded response cap");
const fetchedAt = saved ? (await stat(savedPath)).mtime.toISOString() : new Date().toISOString();
const payload = row(JSON.parse(body));
if (payload.mint !== token.mint || !Array.isArray(payload.topHolders) || payload.topHolders.length === 0) throw new Error("No verified index");
const top = payload.topHolders.slice(0,20).map(row);
const snapshot = row(await rpc.call("getMultipleAccounts", [[token.mint, ...top.map(t => t.address)], { encoding: "jsonParsed", commitment: "confirmed" }]));
const accounts = snapshot.value as unknown[], current = inspectMint(String(token.mint), accounts[0]);
if (current.transferChecks !== "pass" || !current.supplyBaseUnits) throw new Error("MET controls did not clear");
const holders = top.map((t, i) => {
  const a = row(accounts[i + 1]), info = row(row(row(a.data).parsed).info);
  if (a.owner !== current.program || info.mint !== token.mint || typeof info.owner !== "string" || typeof row(info.tokenAmount).amount !== "string") throw new Error("Holder identity mismatch");
  return { address: String(t.address), owner: info.owner, amount: String(row(info.tokenAmount).amount) };
});
const concentration = summarizeHolders(current.supplyBaseUnits, holders, new Set());
Object.assign(token, current, { concentration, holderIndex: "Rugcheck address sample, quantities/owners/supply independently verified at one mainnet RPC context", holderSnapshotSlot: row(snapshot.context).slot,
  holderAccounts: holders,
  independentFindings: Number(concentration.top10ObservedNonVaultOwnersPct) > 30 ? ["Observed top-ten owners exceed 30% concentration cap; treasury/vesting attribution requires further control/schedule analysis."] : [],
  conclusion: Number(concentration.top10ObservedNonVaultOwnersPct) > 30 ? "do-not-fund-yet" : "controls-checked-history-and-cost-review-required" });
(report.externalEvidence as unknown[]).push({ url, fetchedAt, status: response?.status ?? 200, sha256: createHash("sha256").update(body).digest("hex"), payload });
(report.evidence as unknown[]).push(...rpc.evidence.map(e => ({ ...e, id: `retry-${e.id}` })));
report.observedAt = new Date().toISOString();
await writeFile("artifacts/diligence/security.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ mint: token.mint, concentration, findings: token.independentFindings }, null, 2));
