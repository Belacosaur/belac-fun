import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Decimal } from "decimal.js";
import { compileCostMessage, summarizeSwapCosts } from "./costs.js";
import { SecurityRpc, TOKEN_2022 } from "./security.js";
import type { ResearchReport } from "../../../../packages/contracts/src/research.js";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Execution must stay disabled");
const prior: ResearchReport = JSON.parse(await readFile("artifacts/research/62211178-1953-4a04-909b-4e85883a43e8.production.json", "utf8"));
const rpc = new SecurityRpc(process.env.DILIGENCE_RPC_URL || "https://api.mainnet-beta.solana.com");
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", SOL = "So11111111111111111111111111111111111111112";
const observations: unknown[] = [], costs: unknown[] = [];
let nextAt = 0;
async function build(input: string, output: string, amount: string) {
  const query = new URLSearchParams({ inputMint: input, outputMint: output, amount, taker: prior.walletAddress, slippageBps: "50", computeUnitPricePercentile: "0", transactionVersion: "0" });
  const url = `https://api.jup.ag/swap/v2/build?${query}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = Math.max(0, nextAt - Date.now()); nextAt = Date.now() + wait + 1800; if (wait) await new Promise(r => setTimeout(r, wait));
    const response = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(20000) });
    if (response.status === 429 && attempt < 2) { await response.body?.cancel(); await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
    const body = await response.text();
    observations.push({ url, fetchedAt: new Date().toISOString(), httpStatus: response.status, sha256: createHash("sha256").update(body).digest("hex"), payload: body });
    if (!response.ok) throw new Error(`Build preview HTTP ${response.status}`);
    const result: Row = JSON.parse(body);
    if (result.inputMint !== input || result.outputMint !== output || result.inAmount !== amount || typeof result.outAmount !== "string" || !/^[1-9][0-9]*$/.test(result.outAmount)) throw new Error("Quote identity/amount mismatch");
    return result;
  }
  throw new Error("Preview rate limited");
}
const selected = prior.stations.filter(s => [1,7].includes(s.id)).flatMap(s => s.shortlisted);
let solUsd = "0";
const fee = async (p: Row) => {
  const message = compileCostMessage(p, prior.walletAddress);
  const result = row(await rpc.call("getFeeForMessage", [message.messageBase64, { commitment: "confirmed" }]));
  if (typeof result.value !== "number" || !Number.isSafeInteger(result.value)) throw new Error("Network fee not available for preview blockhash");
  return { lamports: String(result.value), ...message };
};
try {
  // SOL price conversion is a marked quote, not the capital value of the wallet.
  const price = await build(SOL, USDC, "1000000000"); solUsd = new Decimal(String(price.outAmount)).div(1e6).toString();
  for (const c of selected) {
    const entry: Row = { mint: c.id, label: c.label, observedAt: new Date().toISOString(), allocationUsdc: "10.000000", status: "partial", missing: [] };
    try {
      const buy = await build(USDC, c.id, "10000000"), sell = await build(c.id, USDC, String(buy.outAmount));
      entry.currentBuyOutputBaseUnits = buy.outAmount; entry.currentSellReturnUsdc = new Decimal(String(sell.outAmount)).div(1e6).toFixed(6);
      entry.currentRoundTripQuoteLossUsdc = new Decimal(10).sub(String(entry.currentSellReturnUsdc)).toFixed(6);
      entry.maxQuotedSlippageBpsPerSide = 50;
      entry.buyPriceImpactPct = new Decimal(String(buy.priceImpactPct)).mul(100).toString();
      entry.sellPriceImpactPct = new Decimal(String(sell.priceImpactPct)).mul(100).toString();
      entry.buyRoute = buy.routePlan; entry.sellRoute = sell.routePlan;
      entry.buySetupInstructions = buy.setupInstructions; entry.sellSetupInstructions = sell.setupInstructions;
      entry.baseFeePreviewPolicy = "Current v0 instruction message, API percentile=0 priority-price selection, no extra tip; no guarantee of landing.";
      let bf: Awaited<ReturnType<typeof fee>> | null = null, sf: Awaited<ReturnType<typeof fee>> | null = null;
      try { bf = await fee(buy); entry.buyNetwork = bf; } catch { (entry.missing as string[]).push("Exact buy-message network fee unavailable; no balance/landing validation."); }
      try { sf = await fee(sell); entry.sellNetwork = sf; } catch { (entry.missing as string[]).push("Exact sell-message network fee unavailable; future exit must be re-quoted."); }
      const size = c.metrics.tokenProgram === TOKEN_2022 ? 170 : 165;
      let rent: string | null = null;
      try { rent = String(await rpc.call("getMinimumBalanceForRentExemption", [size, { commitment: "confirmed" }])); } catch { (entry.missing as string[]).push("Current token account rent unavailable from this RPC."); }
      entry.targetTokenAccountBytes = size; entry.targetTokenAccountRentLamports = rent;
      entry.sharedUsdcAtaRequired = true;
      entry.sharedUsdcAtaChargedPerStation = false;
      entry.temporaryWrappedSolRentMayBeRequired = c.id === SOL || JSON.stringify(buy.setupInstructions).includes(SOL) || JSON.stringify(sell.setupInstructions).includes(SOL);
      entry.recoverableRentIsNotExpense = true;
      if (bf && sf && rent) { entry.costs = summarizeSwapCosts("10000000", String(sell.outAmount), bf.lamports, sf.lamports, rent, solUsd); entry.status = "priced-current-message"; }
      entry.limitations = ["Unfunded-wallet preview is not a successful transaction simulation.", "Account existence and rent are rechecked before funding; extra intermediate accounts may be required by the selected route.", "Quote friction already includes route economics; do not add it twice as a fee.", "No future exit, priority fee, failed-transaction cost or slippage outcome is guaranteed."];
    } catch (error) { (entry.missing as string[]).push(error instanceof Error ? error.message : "Preview unavailable"); }
    costs.push(entry);
    await mkdir("artifacts/diligence", { recursive: true });
    await writeFile("artifacts/diligence/swap-costs.json", JSON.stringify({ basedOnRun: prior.runId, observedAt: new Date().toISOString(), executionEnabled: false, ript: "pending", solUsdMark: solUsd, costs, observations, rpc: rpc.evidence }, null, 2));
    console.log(JSON.stringify({ mint: c.id, status: entry.status, quoteLoss: entry.currentRoundTripQuoteLossUsdc, missing: entry.missing }));
  }
} finally {
  await mkdir("artifacts/diligence", { recursive: true });
  await writeFile("artifacts/diligence/swap-costs.json", JSON.stringify({ basedOnRun: prior.runId, observedAt: new Date().toISOString(), executionEnabled: false, ript: "pending", solUsdMark: solUsd, costs, observations, rpc: rpc.evidence }, null, 2));
}
