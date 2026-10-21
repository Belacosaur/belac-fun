import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { address, getAddressDecoder } from "@solana/kit";
import { inspectMint, SecurityRpc, summarizeHolders, TOKEN_2022, TOKEN_PROGRAM, type Holder } from "./security.js";
import type { ResearchReport } from "../../../../packages/contracts/src/research.js";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const values = (v: unknown): unknown[] => Array.isArray(row(v).value) ? row(v).value as unknown[] : [];
if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Execution must remain disabled");
const input = process.argv[2] || "artifacts/research/62211178-1953-4a04-909b-4e85883a43e8.production.json";
const prior: ResearchReport = JSON.parse(await readFile(input, "utf8"));
const rpc = new SecurityRpc(process.env.DILIGENCE_RPC_URL || "https://solana-rpc.publicnode.com");
const SOL = "So11111111111111111111111111111111111111112", USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const selected = prior.stations.filter(s => [1,7].includes(s.id)).flatMap(s => s.shortlisted.map(c => ({ mint: c.id, label: c.label, station: s.id })));
const mints = [...new Set([...selected.map(t => t.mint), USDC])];
const parsed = values(await rpc.call("getMultipleAccounts", [mints, { encoding: "jsonParsed", commitment: "confirmed" }]));
const base64 = values(await rpc.call("getMultipleAccounts", [mints, { encoding: "base64", commitment: "confirmed" }]));
const knownVaults = new Set<string>();
for (const source of prior.sources.filter(s => ["orca", "meteora"].includes(s.id))) {
  const pools = row(source.payload).data;
  if (Array.isArray(pools)) for (const p of pools) for (const key of ["tokenVaultA", "tokenVaultB", "reserve_x", "reserve_y"]) {
    if (typeof row(p)[key] === "string") knownVaults.add(String(row(p)[key]));
  }
}
const tokens: unknown[] = [];
const externalEvidence: unknown[] = [];
for (let i = 0; i < mints.length; i++) {
  const mint = mints[i], result = inspectMint(mint, parsed[i]);
  const findings: string[] = [], largest: Holder[] = [];
  if (mint !== SOL && result.supplyBaseUnits && BigInt(result.supplyBaseUnits) > 0n) {
    try {
      let top: Row[];
      try { top = values(await rpc.call("getTokenLargestAccounts", [mint, { commitment: "confirmed" }])).map(row); }
      catch {
        const url = `https://api.rugcheck.xyz/v1/tokens/${mint}/report`;
        const r = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(15000) });
        const body = await r.text(); if (body.length > 3_000_000) throw new Error("Index response exceeds limit");
        const payload: unknown = JSON.parse(body);
        externalEvidence.push({ url, fetchedAt: new Date().toISOString(), status: r.status, sha256: createHash("sha256").update(body).digest("hex"), payload });
        if (!r.ok || row(payload).mint !== mint || !Array.isArray(row(payload).topHolders)) throw new Error("Holder index unavailable");
        top = (row(payload).topHolders as unknown[]).map(row).slice(0,20);
      }
      const accounts = values(await rpc.call("getMultipleAccounts", [[mint, ...top.map(h => h.address)], { encoding: "jsonParsed", commitment: "confirmed" }]));
      const currentMint = inspectMint(mint, accounts[0]);
      if (!currentMint.supplyBaseUnits || currentMint.transferChecks === "blocked") throw new Error("Current mint state no longer clears controls");
      result.supplyBaseUnits = currentMint.supplyBaseUnits;
      for (let k = 0; k < top.length; k++) {
        const a = row(accounts[k + 1]), info = row(row(row(a.data).parsed).info), amount = row(info.tokenAmount).amount;
        if (a.owner !== result.program || info.mint !== mint || typeof info.owner !== "string" || typeof amount !== "string" || !/^\d+$/.test(amount)) throw new Error("Holder identity or quantity not verified");
        largest.push({ address: String(top[k].address), amount, owner: info.owner });
      }
    } catch { findings.push("Independent top-account concentration read was unavailable or changed between slots; no concentration clearance."); }
  }
  let concentration: ReturnType<typeof summarizeHolders> | null = null;
  try { concentration = largest.length && result.supplyBaseUnits ? summarizeHolders(result.supplyBaseUnits, largest, knownVaults) : null; }
  catch { findings.push("Supply and holder snapshots are inconsistent; concentration not cleared."); }
  if (concentration && Number(concentration.top10ObservedNonVaultOwnersPct) > 30) findings.push("Observed top-ten non-vault owners exceed the preliminary 30% concentration cap; treasury/vesting attribution does not remove control risk.");
  const bytes = row(base64[i]), data = Array.isArray(bytes.data) ? Buffer.from(String(bytes.data[0]), "base64") : null;
  // Keep raw bytes to independently reproduce the parser and detect extensions absent from parsed RPC output.
  const rawHash = data ? createHash("sha256").update(data).digest("hex") : null;
  const tlvTypes: number[] = [];
  if (bytes.owner === TOKEN_2022 && data && data.length > 166) {
    let offset = 166;
    while (offset + 4 <= data.length) {
      const type = data.readUInt16LE(offset), length = data.readUInt16LE(offset + 2); offset += 4;
      if (!type && !length) break;
      if (!type || offset + length > data.length) { findings.push("Malformed or unrecognized raw Token-2022 TLV layout."); break; }
      tlvTypes.push(type); offset += length;
    }
    if (tlvTypes.some(type => ![18,19].includes(type))) findings.push("Raw mint includes financial/non-metadata extensions; explicit review required.");
    if (tlvTypes.length !== result.extensions.length) findings.push("Raw TLV and parsed extension counts do not match.");
  }
  tokens.push({ ...result, station: selected.find(s => s.mint === mint)?.station ?? null, label: selected.find(s => s.mint === mint)?.label ?? "USDC",
    rawMintSha256: rawHash, tlvTypes, concentration, holderAccounts: largest, independentFindings: findings,
    conclusion: result.transferChecks === "blocked" || findings.length ? "do-not-fund-yet" : mint === USDC ? "retain-issuer-risk" : "controls-checked-history-and-cost-review-required" });
}

// Account rent and existing wallet inventory: confirmed current observations, not blanket charges per station.
const rentSizes = [165, 170, 182], rent: Record<string, string> = {};
for (const size of rentSizes) { try { rent[String(size)] = String(await rpc.call("getMinimumBalanceForRentExemption", [size, { commitment: "confirmed" }])); } catch { rent[String(size)] = "unavailable"; } }
const walletAccounts: unknown[] = [];
for (const programId of [TOKEN_PROGRAM, TOKEN_2022]) { try { walletAccounts.push(await rpc.call("getTokenAccountsByOwner", [prior.walletAddress, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }])); } catch { walletAccounts.push({ programId, error: "read unavailable" }); } }
let balance: unknown;
try { balance = await rpc.call("getBalance", [prior.walletAddress, { commitment: "confirmed" }]); } catch { balance = { error: "read unavailable" }; }
const decode = getAddressDecoder();
const programs: unknown[] = [];
for (const program of ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"]) {
  address(program);
  try {
    const value = row(await rpc.call("getAccountInfo", [program, { encoding: "base64", commitment: "confirmed" }]));
    const a = row(value.value), d = Array.isArray(a.data) ? Buffer.from(String(a.data[0]), "base64") : null;
    let programData: string | null = null, authority: string | null = null, authorityKnown = false;
    if (a.owner === "BPFLoaderUpgradeab1e11111111111111111111111" && d && d.readUInt32LE(0) === 2 && d.length >= 36) {
      programData = decode.decode(d.subarray(4,36));
      const pd = row(row(await rpc.call("getAccountInfo", [programData, { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 0, length: 45 } }])).value);
      const b = Array.isArray(pd.data) ? Buffer.from(String(pd.data[0]), "base64") : null;
      if (pd.owner === "BPFLoaderUpgradeab1e11111111111111111111111" && b && b.length >= 13 && b.readUInt32LE(0) === 3) {
        if (b[12] === 0) authorityKnown = true;
        if (b[12] === 1 && b.length >= 45) { authority = decode.decode(b.subarray(13,45)); authorityKnown = true; }
      }
    }
    programs.push({ program, owner: a.owner, executable: a.executable, programData, upgradeAuthority: authority, upgradeStatus: authorityKnown ? authority ? "upgradeable" : "immutable" : "not-decoded" });
  } catch { programs.push({ program, error: "Program control read unavailable" }); }
}
const report = { version: 1, basedOnRun: prior.runId, observedAt: new Date().toISOString(), mode: "read-only-diligence", executionEnabled: false, ript: "pending", tokens,
  wallet: { address: prior.walletAddress, balance, tokenAccounts: walletAccounts }, rentLamportsBySize: rent, programs,
  evidence: rpc.evidence, externalEvidence, limitations: ["Mint authority/extension checks do not establish project legitimacy or future returns.", "A top-20 account sample cannot establish beneficial ownership or eliminate related-wallet concentration.", "When native largest-account indexing is restricted, Rugcheck supplies candidate addresses only; quantities/owners/supply are independently re-read from mainnet. The index may omit accounts and has no guaranteed current ranking.", "Upgradeable programs retain governance/admin risk; an executable program check is not a code audit.", "No signature, funding, transaction submission or Ript call occurred."] };
await mkdir("artifacts/diligence", { recursive: true });
await writeFile("artifacts/diligence/security.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ basedOnRun: prior.runId, tokens: tokens.map(t => { const r = row(t); return { mint: r.mint, label: r.label, controls: r.transferChecks, concentration: r.concentration, findings: r.independentFindings, conclusion: r.conclusion }; }), rent, programs }, null, 2));
