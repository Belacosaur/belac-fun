/** Public reads and unsigned previews only. Funding advice does not enable execution. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import { address } from "@solana/kit";
import { SecurityRpc, TOKEN_PROGRAM, TOKEN_2022 } from "./security.js";
import { compileCostMessage } from "./costs.js";
import { validatePrepQuote } from "./prep.js";
import type { LiquidityQuote } from "./lp-types.js";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const sdk = createRequire(createRequire(import.meta.url).resolve("@orca-so/whirlpools"));
const client = sdk("@orca-so/whirlpools-client"), core = sdk("@orca-so/whirlpools-core");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const out = new URL("../../../../artifacts/funding/2026-10-21/", import.meta.url);
await mkdir(out, { recursive: true });
if (process.env.EXECUTION_ENABLED !== undefined && process.env.EXECUTION_ENABLED !== "false") throw new Error("Execution must remain disabled");
const metadata = row(JSON.parse(await readFile(root + "docs/integrations/experiment-wallet.public.json", "utf8")));
const wallet = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
if (metadata.publicAddress !== wallet) throw new Error("Wallet metadata mismatch");
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", SOL = "So11111111111111111111111111111111111111112";
const pool = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE", program = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const rpc = new SecurityRpc("https://api.mainnet-beta.solana.com");
const http: unknown[] = [];
const report: Row = { createdAt: new Date().toISOString(), wallet, network: "mainnet-beta", executionEnabled: false, ript: "pending", signed: false, submitted: false,
  fundingTargets: { netUsdcBaseUnits: "20000000", netNativeSolLamports: "30000000", usdc: "20.000000", nativeSol: "0.030000000",
    allocation: { solBuyHoldUsdc: "10.000000", orcaUsdcBudget: "10.000000", separateSolOperatingPool: "0.030000000" }, otherEightStrategyAllocationsFunded: false },
  status: "partial", limitations: ["Only the first two stations are being prepared; the other $80 strategy capital stays outside this funding request.",
    "All 0.03 SOL is operating/account capital, not investment SOL. Investment SOL is acquired later from each station's USDC budget.",
    "Funding is distinct from trading. Position attribution, complete instruction validation and successful funded simulation remain necessary before execution.",
    "0.03 SOL is a chosen capped initial reserve including a buffer, not a prediction that all will be spent or a guarantee of future network costs.",
    "The sender's transfer/withdrawal fees are separate: the stated amounts must arrive net in the wallet."] };
async function get(url: string) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
  const payload = await response.text(); if (payload.length > 2_000_000) throw new Error("Response exceeds bound");
  http.push({ url, retrievedAt: new Date().toISOString(), status: response.status, sha256: createHash("sha256").update(payload).digest("hex"), payload });
  if (!response.ok) throw new Error(`GET HTTP ${response.status}`);
  return row(JSON.parse(payload));
}
try {
  const balance = row(await rpc.call("getBalance", [wallet, { commitment: "confirmed" }]));
  if (typeof balance.value !== "number" || !Number.isSafeInteger(balance.value)) throw new Error("Invalid native balance");
  let usdcBalance = 0n; const tokens: unknown[] = [];
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022]) {
    const owned = row(await rpc.call("getTokenAccountsByOwner", [wallet, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }]));
    if (!Array.isArray(owned.value)) throw new Error("Missing token accounts");
    for (const v of owned.value) {
      const account = row(row(row(row(row(v).account).data).parsed).info), amount = row(account.tokenAmount);
      tokens.push({ address: row(v).pubkey, mint: account.mint, amount: amount.amount });
      if (account.mint === USDC) { if (typeof amount.amount !== "string" || !/^\d+$/.test(amount.amount)) throw new Error("Invalid USDC amount"); usdcBalance += BigInt(amount.amount); }
    }
  }
  report.walletState = { observedAt: new Date().toISOString(), balanceSlot: row(balance.context).slot, nativeSolLamports: String(balance.value), usdcBaseUnits: usdcBalance.toString(), tokenAccounts: tokens };
  report.walletCurrentlyEmpty = balance.value === 0 && tokens.length === 0;
  if (balance.value !== 0 || tokens.length !== 0) throw new Error("Wallet is not empty; attribute current funds before issuing a new funding request");
  const batch = row(await rpc.call("getMultipleAccounts", [[pool], { encoding: "base64", commitment: "confirmed" }]));
  if (!Array.isArray(batch.value)) throw new Error("Missing pool");
  const a = row(batch.value[0]); if (a.owner !== program || a.executable !== false || !Array.isArray(a.data)) throw new Error("Pool owner/state mismatch");
  const state = client.getWhirlpoolDecoder().decode(Buffer.from(String(a.data[0]), "base64"));
  if (state.tokenMintA !== SOL || state.tokenMintB !== USDC || state.tickSpacing !== 4) throw new Error("Pool mint/spacing mismatch");
  const price = core.sqrtPriceToPrice(state.sqrtPrice, 9, 6);
  const lower = core.getInitializableTickIndex(core.priceToTickIndex(price * 0.8, 9, 6), state.tickSpacing, false);
  const upper = core.getInitializableTickIndex(core.priceToTickIndex(price * 1.2, 9, 6), state.tickSpacing, true);
  const starts = [lower, upper].map(t => core.getTickArrayStartTickIndex(t, state.tickSpacing));
  const arrays: string[] = await Promise.all(starts.map(start => client.getTickArrayAddress(address(pool), start, address(program)).then((p: [string, number]) => p[0])));
  const boundaries = row(await rpc.call("getMultipleAccounts", [arrays, { encoding: "base64", commitment: "confirmed" }]));
  if (!Array.isArray(boundaries.value)) throw new Error("Missing boundary states");
  const tickArrays = boundaries.value.map((v, i) => {
    if (v === null) return { address: arrays[i], exists: false };
    const account = row(v); if (account.owner !== program || !Array.isArray(account.data)) throw new Error("Boundary owner mismatch");
    const decoded = client.getTickArrayDecoder().decode(Buffer.from(String(account.data[0]), "base64"));
    if (decoded.whirlpool !== pool || decoded.startTickIndex !== starts[i]) throw new Error("Boundary identity mismatch");
    return { address: arrays[i], exists: true };
  });
  const sqrt = BigInt(state.sqrtPrice), q128 = 1n << 128n;
  const quoteAt = (l: bigint) => core.increaseLiquidityQuote(l, 50, sqrt, lower, upper) as LiquidityQuote;
  const maxValueNumerator = (q: LiquidityQuote) => q.tokenMaxA * sqrt * sqrt * 1000n + q.tokenMaxB * 1000n * q128;
  // Cap the two maximum inputs' marked value at 9.95 USDC, leaving additional prep capacity.
  let low = 0n, high = 2000000000n;
  while (low < high) { const mid = (low + high + 1n) / 2n; if (maxValueNumerator(quoteAt(mid)) <= 9950000n * 1000n * q128) low = mid; else high = mid - 1n; }
  const quote = quoteAt(low);
  if (low <= 0n || maxValueNumerator(quoteAt(low + 1n)) <= 9950000n * 1000n * q128) throw new Error("Quote budget boundary invalid");
  const prep = await get("https://api.jup.ag/swap/v1/quote?" + new URLSearchParams({ inputMint: USDC, outputMint: SOL, amount: quote.tokenMaxA.toString(), swapMode: "ExactOut", slippageBps: "50" }));
  const budget = validatePrepQuote(prep, quote.tokenMaxA.toString(), quote.tokenMaxB.toString(), "10000000");
  report.orca = { pool, slot: row(batch.context).slot, sqrtPriceX64: String(state.sqrtPrice), priceUsdcPerSol: price, lowerTick: lower, upperTick: upper,
    lowerPrice: core.tickIndexToPrice(lower, 9, 6), upperPrice: core.tickIndexToPrice(upper, 9, 6), slippageBps: 50, quote, tickArrays, prepQuote: prep, budget,
    important: "Acquire maximum quoted WSOL from the Orca $10 budget, retain its ATA, then add liquidity. Any excess WSOL/USDC remains attributed to Orca; never draw investment SOL from the operating pool." };
  const rent: Record<string, number> = {};
  for (const size of [165,170,202,216,148]) { const value = await rpc.call("getMinimumBalanceForRentExemption", [size, { commitment: "confirmed" }]); if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("Invalid rent"); rent[String(size)] = value; }
  const positionCapital = Math.max(2394240, rent["216"]!) + 1559040 + rent["202"]! + rent["170"]!;
  const commonAtas = 2 * rent["165"]!, missingArrays = tickArrays.filter(v => !v.exists).length * Math.max(1920960, rent["148"]!);
  const hold = await get("https://api.jup.ag/swap/v2/build?" + new URLSearchParams({ inputMint: USDC, outputMint: SOL, amount: "10000000", taker: wallet, slippageBps: "50", computeUnitPricePercentile: "0", transactionVersion: "0" }));
  if (hold.inputMint !== USDC || hold.outputMint !== SOL || hold.inAmount !== "10000000" || typeof hold.outAmount !== "string") throw new Error("Hold quote identity mismatch");
  const message = compileCostMessage(hold, wallet);
  const fee = row(await rpc.call("getFeeForMessage", [message.messageBase64, { commitment: "confirmed" }]));
  if (typeof fee.value !== "number" || !Number.isSafeInteger(fee.value)) throw new Error("Current hold fee unavailable");
  report.solBuyHold = { inputUsdc: "10.000000", indicatedSolOutput: new Decimal(String(hold.outAmount)).div(1e9).toFixed(9), minimumSolOutput: new Decimal(String(hold.otherAmountThreshold)).div(1e9).toFixed(9), currentMessageFeeLamports: fee.value,
    executionOrder: "Hold purchase first, before retaining Orca WSOL, so a swap cleanup cannot close Orca's funded ATA.", preview: hold, message };
  report.operatingPool = { targetLamports: "30000000", rentReads: rent, positionCapitalLamports: positionCapital, sharedAtaCapitalLamports: commonAtas,
    missingTickArrayCapitalLamports: missingArrays, totalAccountCapitalLamports: positionCapital + commonAtas + missingArrays,
    accountCapitalSol: new Decimal(positionCapital + commonAtas + missingArrays).div(1e9).toFixed(9),
    remainingAfterAccountCapitalLamports: String(30000000 - positionCapital - commonAtas - missingArrays),
    note: "Remainder covers base/priority/failed-transaction costs and closing headroom. Funding sender may pay the USDC ATA rent; do not charge it a second time. Rent recovery is lifecycle-conditional; unspent reserve is not an expense." };
  if (positionCapital + commonAtas + missingArrays + fee.value >= 30000000) throw new Error("Chosen operating reserve insufficient");
  let live: Row | undefined;
  try { live = await get("https://api.belac.fun/v1/studio"); }
  catch (error) { report.publicApiIdentityGap = error instanceof Error ? error.message : "API unavailable"; }
  if (live) {
    if (row(live.data).address !== wallet) throw new Error("Public API wallet mismatch");
    report.publicApiIdentity = { wallet: row(live.data).address, generatedAt: row(live.data).generatedAt, stale: row(live.meta).stale };
  }
  report.status = "funding-amounts-prepared-execution-disabled";
} catch (error) { report.error = error instanceof Error ? error.message : "Funding preview unavailable"; }
finally { report.httpEvidence = http; report.rpcEvidence = rpc.evidence; await writeFile(new URL("funding-preview.json", out), JSON.stringify(report, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)); }
console.log(JSON.stringify({ status: report.status, wallet: report.wallet, walletState: report.walletState, orca: report.orca, operatingPool: report.operatingPool, fundingTargets: report.fundingTargets, error: report.error }, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
