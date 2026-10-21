import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionLabel, feedLabel, moneyUsd, pnlMoney, strategySummary, statusLabel, useLiveStudio } from "./live-data";
import { CHALLENGE } from "../../../../packages/contracts/src/challenge";
import type { Observation, PlatformBalance } from "../../../../packages/contracts/src/studio";

afterEach(() => { vi.unstubAllGlobals(); });

describe("live studio feed", () => {
  it("shows small real P&L without rounding it away or turning unknown data into zero", () => {
    expect(pnlMoney("0.00072")).toBe("+$0.0007");
    expect(pnlMoney("-0.0041")).toBe("−$0.0041");
    expect(pnlMoney("-0.000001")).toBe("−$0.000001");
    expect(pnlMoney(null)).toBe("—"); expect(pnlMoney("0")).toBe("$0.00");
  });
  it("presents owned SOL separately from reserves and preserves Orca cash attribution", () => {
    const hold = { stationId: 1, solAmount: "0.093680067", cashUsdc: "0" };
    expect(strategySummary(hold as never)).toContain("0.093680067 SOL");
    const lp = {stationId:8,principalSol:"0.0419",principalUsdc:"5.42",cashUsdc:"0.077548",residualSol:"0.000209636",lowerPrice:"85.3429",upperPrice:"128.0291",inRange:true};
    expect(strategySummary(lp as never)).toContain("SOL/USDC"); expect(strategySummary(lp as never)).toContain("85.34");
  });
  it("distinguishes a working quote API from an unconfigured strategy and stale data", () => {
    const observed: Observation<PlatformBalance> = { status: "needs_setup", checkedAt: "2026-10-20T12:00:00Z", lastSuccessAt: null, message: "Choose a token",
      data: { status: "needs_setup", valueUsd: null, positionCount: null, detail: "Choose a token", connection: { scope: "quotes", detail: "Quote only" } } };
    expect(statusLabel(observed)).toBe("Needs setup");
    expect(connectionLabel(observed)).toBe("Quotes connected");
    expect(connectionLabel({ ...observed, status: "unavailable" })).toBe("Read source unavailable");
    expect(connectionLabel(observed, true)).toBe("Read source unavailable");
    expect(statusLabel({ ...observed, status: "pending" }, true)).toBe("Pending");
  });
  it("keeps a simulated Kamino proposal distinct from a live position and prioritizes stale state",()=>{const o={status:"needs_setup",data:{lending:{state:"prepared"}}} as Observation<PlatformBalance>;expect(statusLabel(o)).toBe("Prepared · execution off");expect(statusLabel(o,true)).toBe("Stale / retrying");expect(statusLabel({...o,data:{...o.data!,lending:{...o.data!.lending!,state:"unattributed"}}})).toBe("Needs entry attribution");});
  it("discards observations from an old lineup even when the station number matches", async () => {
    const observation = { status: "ready", data: { valueUsd: "75" } };
    const data = { version: 1, generatedAt: new Date().toISOString(), wallet: { status: "ready", data: { valueUsd: "0" } },
      platforms: [
        { id: 3, provider: "Pacifica", observation },
        { id: 7, provider: "Pump.fun", strategyKey: CHALLENGE[9].key, observation },
        { id: 4, provider: "Pacifica", strategyKey: CHALLENGE[3].key, observation },
      ] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data, meta: { stale: false } }) }));
    const { result, unmount } = renderHook(useLiveStudio);
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(result.current.snapshot?.platforms.map((p) => p.id)).toEqual([4]);
    unmount();
  });
  it("renders unknown money differently from verified zero", () => {
    expect(moneyUsd(null)).toBe("—");
    expect(moneyUsd("0")).toBe("$0.00");
    expect(moneyUsd("NaN")).toBe("—");
    expect(statusLabel()).toBe("Connecting");
  });
  it("retains real data on a later network failure and labels it stale", async () => {
    const data = { version: 1, generatedAt: new Date().toISOString(), platforms: [], wallet: { status: "ready", data: { sol: "0", valueUsd: "0" } } };
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data, meta: { stale: false } }) }).mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(useLiveStudio);
    await waitFor(() => expect(result.current.snapshot?.wallet.data?.valueUsd).toBe("0"));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.stale).toBe(true);
    expect(result.current.snapshot?.wallet.data?.valueUsd).toBe("0");
    expect(feedLabel(result.current)).toContain("Last known");
    unmount();
  });
});
