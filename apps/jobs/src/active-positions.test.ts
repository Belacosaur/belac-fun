import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Decimal } from "decimal.js";
import { readActivePositions, ACTIVE_ENTRIES } from "./active-positions.js";
import type { MeteoraReceipt } from "../../../packages/contracts/src/trades.js";
import type { PlatformBalance, StrategyPerformance } from "../../../packages/contracts/src/studio.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/active-positions-mainnet.json", import.meta.url), "utf8"));
const now = "2026-10-21T01:05:00.000Z";
function reader(mutate?: (value: typeof fixture.result) => void) {
  return { call: async (method: string, params: unknown[]) => {
    if (method === "getGenesisHash") return "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
    if (method === "getBlockTime") return Math.floor(Date.parse(now)/1000)-5;
    expect(method).toBe("getMultipleAccounts"); expect(params[0]).toEqual(fixture.addresses);
    const value = structuredClone(fixture.result); mutate?.(value); return value;
  } };
}
describe("funded position attribution", () => {
  it("accounts for a verified Meteora entry without spending the SOL hold or double-counting residuals", async () => {
    const entry: MeteoraReceipt = { wallet: ACTIVE_ENTRIES.wallet, pool: "pool", position: "position", mint: "mint", nft: "nft", liquidity: "100", signature: "signature", at: now, slot: 1, spentUsdcAtoms: "9900000", residualWsolAtoms: "300000", rentLamports: "7223760", feeLamports: "11000" };
    const performance = { stationId: 5, entrySignature: entry.signature, equityUsd: "9.99" } as StrategyPerformance;
    const balance: PlatformBalance = { status: "ready", valueUsd: "9.99", positionCount: 1, performance, executionEnabled: false, detail: "verified fixture" };
    const changed = reader(r => {
      r.value[0].lamports -= 7234760;
      for (const [i, delta] of [[1, -9900000n], [2, 300000n]] as const) { const b = Buffer.from(r.value[i].data[0], "base64"); b.writeBigUInt64LE(b.readBigUInt64LE(64) + delta, 64); r.value[i].data[0] = b.toString("base64"); }
    });
    const a = await readActivePositions(ACTIVE_ENTRIES.wallet, "https://rpc.example", undefined, changed, now, undefined, { entry, balance });
    expect(a.allocatedUsd).toBe("30.000000"); expect(a.unallocatedUsdc).toBe("70.000000");
    expect(a.feePool.availableSol).toBe("0.014118480"); expect(a.unattributedSol).toBe("0.000000000"); expect(a.unattributedUsdc).toBe("0.000000");
    expect(a.strategies.find(s => s.stationId === 1)?.solAmount).toBe("0.093680067");
    expect(a.strategies.find(s => s.stationId === 8)?.residualSol).toBe("0.000209636");
    expect(a.strategies.filter(s => s.stationId === 5)).toHaveLength(1);
    expect(new Decimal(a.equityUsd).eq(new Decimal(a.strategies[0]!.equityUsd).add(a.strategies[1]!.equityUsd).add("9.99").add(70))).toBe(true);
  });
  it("values only purchased SOL and reconciles the fee reserve separately", async () => {
    const a = await readActivePositions(ACTIVE_ENTRIES.wallet, "https://rpc.example", undefined, reader(), now);
    const hold = a.strategies[0]!;
    expect(hold.allocationUsd).toBe("10"); expect(hold.solAmount).toBe("0.093680067");
    expect(new Decimal(hold.equityUsd).sub(new Decimal(hold.solAmount).mul(a.solPriceUsd)).abs().lt("0.00000001")).toBe(true);
    expect(new Decimal(hold.pnlUsd).eq(new Decimal(hold.equityUsd).sub(10))).toBe(true);
    expect(a.feePool.availableSol).toBe("0.021353240");
    expect(a.feePool.accountCapitalSol).toBe("0.008631960"); expect(a.feePool.networkFeesSol).toBe("0.000015800");
    expect(a.unallocatedUsdc).toBe("80.000000"); expect(a.surplusUsdc).toBe("0.000100");
    expect(new Decimal(a.equityUsd).eq(new Decimal(a.strategies[0]!.equityUsd).add(a.strategies[1]!.equityUsd).add(80))).toBe(true);
    expect(new Decimal(a.pnlUsd).eq(new Decimal(a.equityUsd).sub(100))).toBe(true);
    expect(a.strategies.every(s => s.executionEnabled === false)).toBe(true);
  });
  it("includes current LP inventory, accrued fees, and station-owned residual tokens exactly once", async () => {
    const a = await readActivePositions(ACTIVE_ENTRIES.wallet, "https://rpc.example", undefined, reader(), now), lp = a.strategies[1]!;
    expect(lp.cashUsdc).toBe("0.077548"); expect(lp.residualSol).toBe("0.000209636");
    expect(lp.principalSol).toBe("0.042900437"); expect(lp.principalUsdc).toBe("5.323284");
    expect(lp.accruedFeesSol).toBe("0.000000405"); expect(lp.accruedFeesUsdc).toBe("0.000007");
    const value = new Decimal(lp.principalSol!).add(lp.accruedFeesSol!).add(lp.residualSol!).mul(a.solPriceUsd).add(lp.principalUsdc!).add(lp.accruedFeesUsdc!).add(lp.cashUsdc);
    expect(new Decimal(lp.equityUsd).sub(value).abs().lt("0.00000001")).toBe(true);
    expect(lp.positionAddress).toBe(ACTIVE_ENTRIES.orca.position); expect(lp.inRange).toBe(true);
    expect(lp.history).toEqual([{ at: now, valueUsd: lp.equityUsd }]);
  });
  it("keeps unrelated deposits outside strategy returns and fee-pool profit", async () => {
    const extra = reader(v => { v.value[0].lamports += 1000000000; const b = Buffer.from(v.value[1].data[0], "base64"); b.writeBigUInt64LE(90077648n, 64); v.value[1].data[0] = b.toString("base64"); });
    const a = await readActivePositions(ACTIVE_ENTRIES.wallet, "https://rpc.example", undefined, extra, now);
    expect(a.unattributedSol).toBe("1.000000000"); expect(a.unattributedUsdc).toBe("10.000000"); expect(a.feePool.availableSol).toBe("0.021353240");
  });
  it("fails closed on missing or transferred NFT, changed position, wrong network or inventory shortfall", async () => {
    for (const mutate of [
      (v: typeof fixture.result) => { v.value[4] = null; },
      (v: typeof fixture.result) => { const b=Buffer.from(v.value[4].data[0],"base64");b.fill(0,32,64);v.value[4].data[0]=b.toString("base64"); },
      (v: typeof fixture.result) => { v.value[3].owner="11111111111111111111111111111111"; },
      (v: typeof fixture.result) => { v.value[0].lamports=1000000; },
      (v: typeof fixture.result) => { const b=Buffer.from(v.value[1].data[0],"base64");b.writeBigUInt64LE(1n,64);v.value[1].data[0]=b.toString("base64"); },
    ]) await expect(readActivePositions(ACTIVE_ENTRIES.wallet, "https://rpc.example", undefined, reader(mutate), now)).rejects.toThrow();
    await expect(readActivePositions("another-wallet", "https://rpc.example", undefined, reader(), now)).rejects.toThrow();
    await expect(readActivePositions(ACTIVE_ENTRIES.wallet, "https://rpc.example", undefined, {call:async()=>"devnet"}, now)).rejects.toThrow();
  });
  it("retains only measured history, rejects older slots and never duplicates a snapshot timestamp", async () => {
    const first=await readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",undefined,reader(),now);
    const same=await readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",first,reader(),now);
    expect(same.strategies[0]!.history).toHaveLength(1);
    const next=await readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",first,reader(v=>{v.context.slot++;}),"2026-10-21T01:06:00.000Z");
    expect(next.strategies[0]!.history).toHaveLength(2);
    await expect(readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",first,reader(v=>{v.context.slot--; }),"2026-10-21T01:06:00.000Z")).rejects.toThrow();
    await expect(readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",first,reader(),"2026-10-21T01:06:00.000Z")).rejects.toThrow();
    await expect(readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",undefined,reader(),"2026-10-21T01:07:00.000Z")).rejects.toThrow();
  });
  it("can reconcile a separately confirmed Kamino entry without double-counting its cash or fee pool",async()=>{
    const entry={signature:"1".repeat(88),at:now,spentUsdcAtoms:"10000000",receiptAtoms:"8295976",networkFeeLamports:"5000",accountRentLamports:"1488440"};
    const balance={executionEnabled:false,valueUsd:"9.999999",status:"ready",lending:{state:"active",receiptAtoms:"8295976",redeemableUsdc:"9.999999",pnlUsd:"-0.000001",slot:fixture.result.context.slot,accruedAt:now}};
    const funded=reader(v=>{v.value[0].lamports-=1493440;const b=Buffer.from(v.value[1].data[0],"base64");b.writeBigUInt64LE(b.readBigUInt64LE(64)-10000000n,64);v.value[1].data[0]=b.toString("base64");});
    const a=await readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",undefined,funded,now,{entry,balance} as never);
    expect(a.allocatedUsd).toBe("30.000000");expect(a.unallocatedUsdc).toBe("70.000000");expect(a.unattributedUsdc).toBe("0.000000");expect(a.feePool.availableSol).toBe("0.019859800");expect(a.feePool.accountCapitalSol).toBe("0.010120400");expect(a.feePool.networkFeesSol).toBe("0.000020800");expect(a.strategies.find(s=>s.stationId===6)?.pnlUsd).toBe("-0.000001000000");expect(a.strategies.every(s=>s.executionEnabled===false)).toBe(true);
    await expect(readActivePositions(ACTIVE_ENTRIES.wallet,"https://rpc.example",undefined,funded,now,{entry,balance:{...balance,lending:{...balance.lending,state:"prepared"}}} as never)).rejects.toThrow();
  });

});
