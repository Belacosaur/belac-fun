import { fetchPositionsForOwner } from "@orca-so/whirlpools";
import { address, createDefaultRpcTransport, createSolanaRpcFromTransport } from "@solana/kit";
import type { PlatformBalance } from "../../../packages/contracts/src/studio.js";

export const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PUMP_PROGRAMS = ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"];
const PROBE_AMOUNT = "10000000";
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid upstream object");
  return value as Record<string, unknown>;
}
async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Read API unavailable");
  return response.json();
}

export function normalizeSwapQuote(input: unknown, venue: "jupiter" | "raydium"): PlatformBalance {
  const body = record(input);
  if (venue === "raydium" && body.success !== true) throw new Error("Quote failed");
  const quote = venue === "raydium" ? record(body.data) : body;
  const amount = venue === "raydium" ? quote.inputAmount : quote.inAmount;
  const output = venue === "raydium" ? quote.outputAmount : quote.outAmount;
  if (quote.inputMint !== SOL_MINT || quote.outputMint !== USDC_MINT || amount !== PROBE_AMOUNT ||
    typeof output !== "string" || !/^[0-9]+$/.test(output) || BigInt(output) <= 0n ||
    !Array.isArray(quote.routePlan) || quote.routePlan.length === 0) throw new Error("Invalid quote");
  return { status: "needs_setup", valueUsd: null, positionCount: null,
    connection: { scope: "quotes", detail: "Live SOL/USDC quote probe · no transaction built" },
    detail: venue === "jupiter" ? "Quote API connected · choose hold token and allocation" : "Quote API connected · choose trading tokens and attribution rules" };
}

export async function readSwapQuote(venue: "jupiter" | "raydium", jupiterApiKey?: string): Promise<PlatformBalance> {
  const query = new URLSearchParams({ inputMint: SOL_MINT, outputMint: USDC_MINT, amount: PROBE_AMOUNT, slippageBps: "50" });
  if (venue === "raydium") query.set("txVersion", "V0");
  const base = venue === "jupiter" ? "https://api.jup.ag/swap/v1/quote" : "https://transaction-v1.raydium.io/compute/swap-base-in";
  const headers = venue === "jupiter" && jupiterApiKey ? { "x-api-key": jupiterApiKey } : undefined;
  return normalizeSwapQuote(await getJson(`${base}?${query}`, { headers }), venue);
}

export function summarizeOrcaPositions(input: unknown[]): PlatformBalance {
  const positions = input.flatMap((entry) => {
    const item = record(entry);
    if (item.isPositionBundle === false) return [item];
    if (item.isPositionBundle !== true || !Array.isArray(item.positions)) throw new Error("Invalid Orca bundle");
    return item.positions.map(record);
  }).map((item) => {
    const data = record(item.data);
    if (typeof item.address !== "string" || typeof data.whirlpool !== "string" ||
      typeof data.liquidity !== "bigint" || data.liquidity < 0n ||
      !Number.isSafeInteger(data.tickLowerIndex) || !Number.isSafeInteger(data.tickUpperIndex) ||
      Number(data.tickLowerIndex) >= Number(data.tickUpperIndex)) throw new Error("Invalid Orca position");
    return { address: item.address, pool: data.whirlpool, liquidity: data.liquidity.toString(),
      lowerTick: Number(data.tickLowerIndex), upperTick: Number(data.tickUpperIndex) };
  });
  if (new Set(positions.map((p) => p.address)).size !== positions.length) throw new Error("Duplicate Orca positions");
  return { status: positions.length ? "ready" : "empty", positionCount: positions.length,
    valueUsd: positions.length ? null : "0", positions,
    connection: { scope: "positions", detail: "Official Whirlpools SDK · SPL and Token-2022 positions and bundles" },
    detail: positions.length ? `${positions.length} Orca positions · USD and fee reconciliation pending` : "No Orca positions · choose pool and price range" };
}

/** Constrain the SDK to read methods and one deadline across all its requests. */
export async function readOrcaPositions(owner: string, rpcUrl: string): Promise<PlatformBalance> {
  const transport = createDefaultRpcTransport({ url: rpcUrl });
  const deadline = AbortSignal.timeout(20_000);
  const rpc = createSolanaRpcFromTransport(async (config) => {
    const method = record(config.payload).method;
    if (!["getGenesisHash", "getTokenAccountsByOwner", "getMultipleAccounts"].includes(String(method))) throw new Error("Unsupported read method");
    return transport({ ...config, signal: config.signal ? AbortSignal.any([config.signal, deadline]) : deadline });
  });
  if (await rpc.getGenesisHash().send() !== MAINNET_GENESIS) throw new Error("RPC must use mainnet-beta");
  // Official SDK default is WhirlpoolDeployment.mainnet, not devnet.
  return summarizeOrcaPositions(await fetchPositionsForOwner(rpc, address(owner)));
}

export async function readPumpPrograms(rpcUrl: string): Promise<NonNullable<PlatformBalance["connection"]>> {
  const rpc = async (method: string, params: unknown[]) => {
    const body = record(await getJson(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
    if (body.error || body.result === undefined) throw new Error("RPC read failed");
    return body.result;
  };
  if (await rpc("getGenesisHash", []) !== MAINNET_GENESIS) throw new Error("RPC must use mainnet-beta");
  const result = record(await rpc("getMultipleAccounts", [PUMP_PROGRAMS, { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 0, length: 0 } }]));
  if (!Array.isArray(result.value) || result.value.length !== 2 || result.value.some((p) => record(p).executable !== true)) throw new Error("Pump programs unavailable");
  return { scope: "program_accounts", detail: "Pump and PumpSwap programs verified on mainnet · wallet token reader connected" };
}
