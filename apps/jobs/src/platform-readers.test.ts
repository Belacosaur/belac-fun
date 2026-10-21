import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSwapQuote, summarizeOrcaPositions, readOrcaPositions, readPumpPrograms, MAINNET_GENESIS, SOL_MINT, USDC_MINT } from "./platform-readers.js";

afterEach(() => vi.unstubAllGlobals());

describe("read-only platform connections", () => {
  it("validates quote identity and never turns a connectivity probe into holdings", () => {
    const quote = { inputMint: SOL_MINT, outputMint: USDC_MINT, inAmount: "10000000", outAmount: "1038119", routePlan: [{}] };
    expect(normalizeSwapQuote(quote, "jupiter")).toMatchObject({ status: "needs_setup", valueUsd: null, positionCount: null, connection: { scope: "quotes" } });
    expect(() => normalizeSwapQuote({ ...quote, outputMint: SOL_MINT }, "jupiter")).toThrow();
    expect(() => normalizeSwapQuote({ ...quote, outAmount: "0" }, "jupiter")).toThrow();
    expect(() => normalizeSwapQuote({ success: false, data: quote }, "raydium")).toThrow();
    expect(() => normalizeSwapQuote({ ...quote, routePlan: [] }, "jupiter")).toThrow();
  });
  it("flattens Orca bundles and serializes exact liquidity without inventing USD marks", () => {
    const position = { address: "position-a", data: { whirlpool: "pool-a", liquidity: 9007199254740993n, tickLowerIndex: -64, tickUpperIndex: 64 } };
    const result = summarizeOrcaPositions([{ ...position, isPositionBundle: false }, { isPositionBundle: true, positions: [{ ...position, address: "position-b" }] }]);
    expect(result).toMatchObject({ positionCount: 2, valueUsd: null, connection: { scope: "positions" } });
    expect(result.positions?.[0]?.liquidity).toBe("9007199254740993");
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(summarizeOrcaPositions([])).toMatchObject({ status: "empty", valueUsd: "0", positionCount: 0 });
    expect(() => summarizeOrcaPositions([{ isPositionBundle: true }])).toThrow();
  });
  it("uses only read RPC methods and rejects an incorrectly configured network", async () => {
    // Real getGenesisHash fixture; CAIP chain identifiers use a truncated value.
    const genesis = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
    expect(MAINNET_GENESIS).toBe(genesis);
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body as string);
      methods.push(body.method);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: body.method === "getGenesisHash" ? genesis : { context: { slot: 1 }, value: [] } }), { headers: { "Content-Type": "application/json" } });
    }));
    const result = await readOrcaPositions("HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j", "https://rpc.example");
    expect(result.positionCount).toBe(0);
    expect(methods).toContain("getTokenAccountsByOwner");
    expect(methods.every((m) => ["getGenesisHash", "getTokenAccountsByOwner", "getMultipleAccounts"].includes(m))).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "devnet" }))));
    await expect(readOrcaPositions("HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j", "https://rpc.example")).rejects.toThrow();
  });
  it("requires both Pump programs to be executable before claiming a program connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body as string);
      const result = body.method === "getGenesisHash" ? MAINNET_GENESIS : { value: [{ executable: true }, { executable: false }] };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
    }));
    await expect(readPumpPrograms("https://rpc.example")).rejects.toThrow();
  });
});
