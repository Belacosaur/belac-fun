import { createContext, useContext, useEffect, useState } from "react";
import { CHALLENGE } from "../../../../packages/contracts/src/challenge";
import type { Observation, PlatformBalance, StrategyPerformance, StudioResponse, StudioSnapshot } from "../../../../packages/contracts/src/studio";

export interface LiveStudio {
  snapshot: StudioSnapshot | null;
  stale: boolean;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}
export const StudioContext = createContext<LiveStudio>({ snapshot: null, stale: true, loading: true, error: false, refresh: () => undefined });
export const useStudio = () => useContext(StudioContext);
export function moneyUsd(value: string | null | undefined) {
  return value != null && Number.isFinite(Number(value))
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value)) : "—";
}
export function pnlMoney(value: string | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value), digits = n !== 0 && Math.abs(n) < .0001 ? 6 : n !== 0 && Math.abs(n) < .01 ? 4 : 2;
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n))}`;
}
export function strategySummary(p: Partial<StrategyPerformance> & Pick<StrategyPerformance, "stationId">) {
  if (p.stationId === 6) return "USDC direct lending · no borrowing";
  return p.stationId === 1 ? `${p.solAmount} SOL · 30-day hold`
    : `SOL/USDC · ${moneyUsd(p.lowerPrice)}–${moneyUsd(p.upperPrice)} · ${p.inRange ? "in range" : "out of range"}`;
}
export function statusLabel(observation?: Observation<PlatformBalance>, stale = false): string {
  if (!observation) return "Connecting";
  if (observation.status === "pending") return "Pending";
  if (stale || observation.status === "unavailable") return "Stale / retrying";
  if (observation.data?.damm?.state === "prepared") return "Prepared · execution off";
  if (observation.data?.lending?.state === "prepared") return "Prepared · execution off";
  if (observation.data?.lending?.state === "unattributed") return "Needs entry attribution";
  if (observation.data?.lending?.state === "active") return "Live position";
  if (observation.data?.performance) return "Live position";
  return { ready: "Connected", empty: "No positions", needs_setup: "Needs setup", pending: "Pending", deferred: "Deferred",
    manual: "Manual", not_indexed: "Not indexed", unavailable: "Retrying" }[observation.status];
}
export function connectionLabel(observation?: Observation<PlatformBalance>, stale = false): string {
  if (!observation) return "Connecting";
  if (observation.status === "pending" || observation.status === "deferred") return "Pending";
  if (stale || observation.status === "unavailable") return "Read source unavailable";
  const scope = observation.data?.connection?.scope;
  return scope ? { quotes: "Quotes connected", positions: "Position reader connected", portfolio: "Portfolio API connected", program_accounts: "Chain reader connected" }[scope] : "Setup pending";
}
export function feedLabel(live: Pick<LiveStudio, "snapshot" | "stale" | "loading" | "error">) {
  if (!live.snapshot) return live.error ? "Connection unavailable" : "Connecting to wallet";
  if (live.stale || live.error) return "Last known data · reconnecting";
  if (live.snapshot.accounting?.status === "unavailable") return "Position data stale · retrying";
  if (live.snapshot.accounting?.status === "ready") return `${live.snapshot.accounting.data?.strategies.length ?? 0} live positions · execution off`;
  if (live.snapshot.wallet.status === "unavailable") return "Wallet source unavailable";
  return "Wallet connected · partial platform coverage";
}
export function useLiveStudio(): LiveStudio {
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverStale, setServerStale] = useState(true);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || "https://belac-fun-production-c49e.up.railway.app").replace(/\/$/, "");
        const response = await fetch(`${base}/v1/studio`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) });
        if (!response.ok) throw new Error("Sync unavailable");
        const body = await response.json() as StudioResponse;
        if (body.data?.version !== 1 || !Array.isArray(body.data.platforms) || !body.data.wallet || !Number.isFinite(Date.parse(body.data.generatedAt))) throw new Error("Invalid sync response");
        const platforms = body.data.platforms.filter((p) =>
          CHALLENGE.some((s) => s.id === p.id && s.key === p.strategyKey && s.provider === p.provider));
        if (!disposed) { setSnapshot({ ...body.data, platforms }); setServerStale(body.meta.stale); setError(false); }
      } catch { if (!disposed) setError(true); }
      finally {
        if (!disposed) { setLoading(false); setNow(Date.now()); timer = setTimeout(poll, 30_000); }
      }
    }
    void poll();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [revision]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(timer); }, []);
  return { snapshot, loading, error, stale: error || serverStale || !snapshot || now - Date.parse(snapshot.generatedAt) > 180_000,
    refresh: () => setRevision((value) => value + 1) };
}
