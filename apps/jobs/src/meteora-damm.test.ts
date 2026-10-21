import { describe, expect, it } from "vitest";
import { dammAmounts, capDammBudget, verifiedDammPool, decodeDamm, readMeteoraDamm, dammPositionInventory, DAMM, type DammAccount } from "./meteora-damm.js";
import { readFile } from "node:fs/promises";
const fixture = JSON.parse(await readFile(new URL("./fixtures/meteora-damm-mainnet.json", import.meta.url), "utf8"));

describe("DAMM bounded proposal", () => {
  it("rounds deposits up and redemptions down without losing the budget cap", () => {
    const p = 3n << 60n, a = 2n << 60n, b = 5n << 60n, l = 1234567890123456789012345678n;
    const deposit = dammAmounts(l, p, a, b, true), exit = dammAmounts(l, p, a, b, false);
    expect(deposit.a - exit.a).toBeLessThanOrEqual(1n);
    expect(deposit.b - exit.b).toBeLessThanOrEqual(1n);
    expect(() => capDammBudget(7_300_000n, 2_700_001n)).toThrow();
    expect(capDammBudget(7_300_000n, 2_700_000n)).toBe(0n);
  });
  it("rejects negative amounts and invalid ranges", () => {
    expect(() => dammAmounts(-1n, 3n, 2n, 4n, true)).toThrow();
    expect(() => dammAmounts(1n, 3n, 4n, 2n, true)).toThrow();
    expect(() => capDammBudget(-1n, 1n)).toThrow();
  });
  it("supports pool boundary inventory", () => {
    expect(dammAmounts(1000n, 1n, 2n, 4n, true).b).toBe(0n);
    expect(dammAmounts(1000n, 5n, 2n, 4n, true).a).toBe(0n);
  });
  it("decodes mainnet pool and simulated owned position with matching inventory", () => {
    const s = verifiedDammPool(fixture.raw.value[3]);
    const p = decodeDamm<{ pool: string; unlocked_liquidity: bigint; permanent_locked_liquidity: bigint }>("Position", fixture.entry[3]);
    expect(p.pool).toBe(DAMM.pool); expect(p.unlocked_liquidity.toString()).toBe(fixture.proposal.liquidity);
    expect(p.permanent_locked_liquidity).toBe(0n);
    const amounts = dammAmounts(p.unlocked_liquidity, s.sqrt_price, s.sqrt_min_price, s.sqrt_max_price, true);
    expect(Number(amounts.a) / 1e9).toBe(fixture.proposal.inventorySol);
    expect(Number(amounts.b) / 1e6).toBe(fixture.proposal.inventoryUsdc);
    expect(() => verifiedDammPool({ ...fixture.raw.value[3], owner: DAMM.token })).toThrow();
    const invalid = structuredClone(fixture.raw.value[3]);
    const bytes = Buffer.from(invalid.data[0], "base64"); bytes[0] ^= 1; invalid.data[0] = bytes.toString("base64");
    expect(() => verifiedDammPool(invalid)).toThrow();
  });
  it("shows only a proposal, never simulated funds as an active allocation or P&L", async () => {
    const methods: string[] = [];
    const fetcher = (async (_url: unknown, init: RequestInit) => {
      const req = JSON.parse(init.body as string); methods.push(req.method);
      const result = req.method === "getGenesisHash" ? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
        : req.method === "getBlockTime" ? Date.parse(fixture.at) / 1000
          : { context: fixture.raw.context, value: fixture.raw.value.slice(3) };
      return new Response(JSON.stringify({ result }));
    }) as typeof fetch;
    const result = await readMeteoraDamm("HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j", "https://rpc.example", fetcher, fixture.at);
    expect(result).toMatchObject({ valueUsd: null, positionCount: null, executionEnabled: false, damm: { state: "prepared", plannedUsdc: "10.000000" } });
    expect(result.performance).toBeUndefined(); expect(result.damm?.preparation.requiresQuoteRefresh).toBe(true);
    expect(new Set(methods)).toEqual(new Set(["getGenesisHash", "getMultipleAccounts", "getBlockTime"]));
  });
  it("tracks only the owned NFT liquidity and rejects a changed or missing owner", () => {
    const pool = verifiedDammPool(fixture.raw.value[3]);
    const position = decodeDamm<{ fee_a_per_token_checkpoint: number[]; fee_b_per_token_checkpoint: number[] }>("Position", fixture.entry[3]);
    // Pool moves during the independent simulation; use its checkpoint as the zero-growth baseline.
    pool.fee_a_per_liquidity = position.fee_a_per_token_checkpoint; pool.fee_b_per_liquidity = position.fee_b_per_token_checkpoint;
    const expected = { mint: fixture.proposal.mint, liquidity: BigInt(fixture.proposal.liquidity) };
    const wallet = "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j";
    const mark = dammPositionInventory(pool, fixture.entry[3], fixture.entry[5], wallet, expected);
    expect(mark.a.toString()).toBe(fixture.proposal.exitReturnedSolAtoms);
    expect(mark.b.toString()).toBe(fixture.proposal.exitReturnedUsdcAtoms);
    expect(mark.feeA).toBe(0n); expect(mark.feeB).toBe(0n);
    expect(() => dammPositionInventory(pool, fixture.entry[3], fixture.entry[5], DAMM.authority, expected)).toThrow();
    expect(() => dammPositionInventory(pool, fixture.entry[3], fixture.entry[5], wallet, { ...expected, liquidity: 1n })).toThrow();
    // One full Q128 accumulator unit earns one atom per raw liquidity unit, saturating to u64.
    pool.fee_a_per_liquidity = Array(32).fill(0); pool.fee_a_per_liquidity[16] = 1;
    position.fee_a_per_token_checkpoint.forEach((x, i) => { pool.fee_a_per_liquidity[i] += x; });
    expect(dammPositionInventory(pool, fixture.entry[3], fixture.entry[5], wallet, expected).feeA).toBe((1n << 64n) - 1n);
  });
  it("rejects stale context and changed vault authority", async () => {
    const run = (corrupt: boolean, age: number) => readMeteoraDamm("HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j", "https://rpc.example", (async (_url: unknown, init: RequestInit) => {
      const req = JSON.parse(init.body as string); const values: DammAccount[] = structuredClone(fixture.raw.value.slice(3));
      if (corrupt) { const b = Buffer.from(values[1]!.data[0]!, "base64"); b.fill(0, 32, 64); values[1]!.data[0] = b.toString("base64"); }
      return new Response(JSON.stringify({ result: req.method === "getGenesisHash" ? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" : req.method === "getBlockTime" ? Date.parse(fixture.at) / 1000 - age : { context: fixture.raw.context, value: values } }));
    }) as typeof fetch, fixture.at);
    await expect(run(false, 100)).rejects.toThrow("Stale DAMM");
    await expect(run(true, 0)).rejects.toThrow();
  });
});
