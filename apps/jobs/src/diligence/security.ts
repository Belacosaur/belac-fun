import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const MAINNET = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
export interface MintSecurity {
  mint: string; program: string; decimals: number | null; supplyBaseUnits: string | null; bytes: number | null;
  mintAuthority: unknown; freezeAuthority: unknown; extensions: { type: string; state: unknown }[];
  transferChecks: "pass" | "blocked" | "issuer-controlled";
  findings: string[];
}

/** A narrow control audit, not a claim that an asset, issuer or protocol is safe. */
export function inspectMint(mint: string, value: unknown): MintSecurity {
  const a = row(value), parsed = row(row(a.data).parsed), info = row(parsed.info);
  const extensions = Array.isArray(info.extensions) ? info.extensions.map(e => ({ type: String(row(e).extension), state: row(e).state })) : [];
  const findings: string[] = [];
  const result: MintSecurity = { mint, program: String(a.owner ?? "unknown"), decimals: typeof info.decimals === "number" ? info.decimals : null,
    supplyBaseUnits: typeof info.supply === "string" && /^\d+$/.test(info.supply) ? info.supply : null, bytes: typeof a.space === "number" ? a.space : null,
    mintAuthority: info.mintAuthority, freezeAuthority: info.freezeAuthority, extensions, transferChecks: "pass", findings };
  if (![TOKEN_PROGRAM, TOKEN_2022].includes(result.program) || a.executable !== false || parsed.type !== "mint" || info.isInitialized !== true ||
    result.decimals === null || !Number.isInteger(result.decimals) || result.decimals < 0 || result.decimals > 18 || !result.supplyBaseUnits) findings.push("Unverified initialized mint identity, token program or layout.");
  if (!Object.hasOwn(info, "mintAuthority") || info.mintAuthority !== null) findings.push("Mint authority is present or not explicitly decoded as disabled.");
  if (!Object.hasOwn(info, "freezeAuthority") || info.freezeAuthority !== null) findings.push("Freeze authority is present or not explicitly decoded as disabled.");
  if (result.program === TOKEN_PROGRAM && extensions.length) findings.push("Unexpected extension data on legacy SPL mint.");
  for (const e of extensions) {
    if (e.type === "metadataPointer" || e.type === "tokenMetadata") {
      const state = row(e.state);
      const target = e.type === "metadataPointer" ? state.metadataAddress : state.mint;
      if (target !== mint) findings.push(`${e.type} does not identify the audited mint.`);
      if (e.type === "tokenMetadata" && state.updateAuthority !== null) findings.push("Token metadata remains editable; display identity/URI is not immutable.");
      if (e.type === "metadataPointer" && state.authority !== null) findings.push("Metadata pointer remains editable; metadata identity requires review.");
    } else findings.push(`Financial or unrecognized extension requires explicit review: ${e.type}.`);
  }
  if (findings.length) result.transferChecks = "blocked";
  if (mint === USDC && a.executable === false && [TOKEN_PROGRAM, TOKEN_2022].includes(result.program) && parsed.type === "mint" && info.isInitialized === true && result.decimals === 6 &&
      result.supplyBaseUnits !== null && !extensions.length && typeof info.mintAuthority === "string" && typeof info.freezeAuthority === "string") {
    result.transferChecks = "issuer-controlled";
    findings.push("USDC is explicitly issuer-controlled: mint and freeze authority can affect balances/transfers. This is a retained issuer risk, not a disabled-authority pass.");
  }
  if (mint === SOL) findings.push("Canonical wrapped native SOL: mint supply/holder concentration does not measure total SOL ownership.");
  return result;
}

export interface Holder { address: string; amount: string; owner: string }
export function summarizeHolders(supply: string, holders: Holder[], knownVaults: Set<string>) {
  if (!/^\d+$/.test(supply) || BigInt(supply) <= 0n) throw new Error("Invalid supply for concentration");
  const total = BigInt(supply); let vault = 0n, observed = 0n;
  const owners = new Map<string, bigint>(), seen = new Set<string>();
  for (const h of holders) {
    if (!/^\d+$/.test(h.amount) || !h.owner || seen.has(h.address)) throw new Error("Invalid or duplicate holder");
    seen.add(h.address); const amount = BigInt(h.amount); observed += amount;
    if (observed > total) throw new Error("Observed holdings exceed mint supply");
    if (knownVaults.has(h.address)) vault += amount;
    else owners.set(h.owner, (owners.get(h.owner) ?? 0n) + amount);
  }
  const amounts = [...owners.values()].sort((a, b) => a > b ? -1 : a < b ? 1 : 0);
  const sum = amounts.reduce((a, b) => a + b, 0n);
  const pct = (n: bigint) => new Decimal(n.toString()).div(supply).mul(100).toFixed(6);
  return { observedAccountCount: holders.length, observedNonVaultOwnerCount: owners.size, observedBaseUnits: observed.toString(),
    knownVaultBaseUnits: vault.toString(), knownVaultPctOfSupply: pct(vault), observedNonVaultPctOfSupply: pct(sum),
    largestObservedNonVaultOwnerBaseUnits: (amounts[0] ?? 0n).toString(), largestObservedNonVaultOwnerPct: pct(amounts[0] ?? 0n),
    top10ObservedNonVaultOwnersPct: pct(amounts.slice(0, 10).reduce((a, b) => a + b, 0n)), fullBeneficialOwnershipVerified: false as const,
    limitation: "Top-20 token accounts are a bounded sample, not a complete holder graph. Owners may control additional accounts or related wallets; unknown vesting/treasury/custody accounts are not automatically excluded." };
}

export interface RpcEvidence { id: string; method: string; params: unknown[]; rpcHost: string; fetchedAt: string; sha256: string; response: unknown }
const reads = new Set(["getGenesisHash", "getMultipleAccounts", "getAccountInfo", "getTokenLargestAccounts", "getTokenAccountsByOwner", "getMinimumBalanceForRentExemption", "getBalance", "getLatestBlockhash", "getFeeForMessage", "getRecentPrioritizationFees", "getBlockTime"]);
export class SecurityRpc {
  evidence: RpcEvidence[] = [];
  private count = 0;
  private nextAt = 0;
  private verified = false;
  constructor(private endpoint: string, private fetcher: typeof fetch = fetch) {
    const u = new URL(endpoint); if (u.protocol !== "https:" || u.username || u.password) throw new Error("HTTPS RPC required");
  }
  async call(method: string, params: unknown[]): Promise<unknown> {
    if (!reads.has(method)) throw new Error("Only read-only RPC methods are permitted");
    if (!this.verified && method !== "getGenesisHash") await this.call("getGenesisHash", []);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (++this.count > 150) throw new Error("RPC read budget exceeded");
      const delay = Math.max(0, this.nextAt - Date.now());
      this.nextAt = Date.now() + delay + 400;
      if (delay) await new Promise(r => setTimeout(r, delay));
      const response = await this.fetcher(this.endpoint, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: this.count, method, params }), signal: AbortSignal.timeout(15000) });
      if (response.status === 429 && attempt < 2) { await response.body?.cancel(); await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!response.ok) {
        await response.body?.cancel();
        this.evidence.push({ id: `rpc-${this.count}`, method, params, rpcHost: new URL(this.endpoint).hostname, fetchedAt: new Date().toISOString(), sha256: "unavailable", response: { httpStatus: response.status } });
        throw new Error(`RPC read HTTP ${response.status}`);
      }
      const body = await response.text(); if (body.length > 4_000_000) throw new Error("RPC response exceeds evidence size limit");
      const data: unknown = JSON.parse(body), envelope = row(data);
      this.evidence.push({ id: `rpc-${this.count}`, method, params, rpcHost: new URL(this.endpoint).hostname, fetchedAt: new Date().toISOString(), sha256: createHash("sha256").update(body).digest("hex"), response: data });
      if (envelope.error || !Object.hasOwn(envelope, "result")) throw new Error(`RPC ${method} returned an error`);
      if (method === "getGenesisHash") { if (envelope.result !== MAINNET) throw new Error("Mainnet RPC required"); this.verified = true; }
      return envelope.result;
    }
    throw new Error("RPC read attempts exhausted");
  }
}
