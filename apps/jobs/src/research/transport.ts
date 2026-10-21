import { createHash } from "node:crypto";
import type { ResearchSource } from "../../../../packages/contracts/src/research.js";
import { POLICY } from "./policy.js";

// Exact read-only surfaces. Not a generic HTTP client or trading API wrapper.
const allowed: Record<string, RegExp[]> = {
  "api.jup.ag": [/^\/tokens\/v2\/(toptraded\/24h|search)$/, /^\/swap\/v1\/quote$/],
  "transaction-v1.raydium.io": [/^\/compute\/swap-base-in$/],
  "api-v3.raydium.io": [/^\/pools\/info\/list$/],
  "api.orca.so": [/^\/v2\/solana\/pools$/],
  "dlmm.datapi.meteora.ag": [/^\/pools$/],
  "api.kamino.finance": [/^\/v2\/kamino-market$/, /^\/kamino-market\/[1-9A-HJ-NP-Za-km-z]{32,44}\/reserves\/metrics$/],
  "api.pacifica.fi": [/^\/api\/v1\/(info|info\/prices|book)$/],
  "perps-api.jup.ag": [/^\/v1\/market-stats$/],
  "api.exchange.coinbase.com": [/^\/products\/[A-Z0-9-]+-USD\/candles$/],
  "raw.githubusercontent.com": [/^\/pump-fun\/pump-public-docs\/main\/README.md$/],
};

export class ResearchClient {
  private cache = new Map<string, Promise<ResearchSource>>();
  private records: ResearchSource[] = [];
  private active = 0;
  private queue: (() => void)[] = [];
  private count = 0;
  private jupiterNextAt = 0;
  constructor(private fetcher: typeof fetch = fetch, private jupiterApiKey?: string) {}
  sources(): ResearchSource[] { return [...this.records]; }

  async get(id: string, address: string): Promise<ResearchSource> {
    const u = new URL(address);
    if (u.protocol !== "https:" || u.username || u.password || u.port || !allowed[u.hostname]?.some(p => p.test(u.pathname))) throw new Error("Research endpoint is not allowlisted");
    if (this.cache.has(address)) return this.cache.get(address)!;
    const task = this.read(id, u);
    this.cache.set(address, task);
    return task;
  }

  private async read(id: string, url: URL): Promise<ResearchSource> {
    if (this.active >= POLICY.transportConcurrency) await new Promise<void>(resolve => this.queue.push(resolve));
    else this.active++;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (this.count >= POLICY.requestLimit) throw new Error("Research request budget exhausted");
          this.count++;
          if (url.hostname === "api.jup.ag") {
            const wait = Math.max(0, this.jupiterNextAt - Date.now());
            this.jupiterNextAt = Date.now() + wait + 1500;
            if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          }
          const timeout = AbortSignal.timeout(POLICY.requestTimeoutMs);
          const response = await this.fetcher(url, { method: "GET", redirect: "error", signal: timeout,
            headers: { Accept: "application/json", ...(url.hostname === "api.jup.ag" && this.jupiterApiKey ? { "x-api-key": this.jupiterApiKey } : {}) } });
          if ((response.status === 429 || response.status >= 500) && attempt < 2) {
            await response.body?.cancel();
            const retry = Math.min(10, Math.max(2 ** (attempt + 1), Number(response.headers.get("Retry-After")) || 1));
            await new Promise(resolve => setTimeout(resolve, retry * 1000)); continue;
          }
          if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
          // Bound decompressed bodies as well as request duration.
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Empty response");
          const chunks: Uint8Array[] = []; let bytes = 0;
          for (;;) {
            const next = await reader.read(); if (next.done) break;
            bytes += next.value.byteLength;
            if (bytes > 4_000_000) { await reader.cancel(); throw new Error("Response exceeds research size limit"); }
            chunks.push(next.value);
          }
          const body = Buffer.concat(chunks).toString("utf8");
          const payload: unknown = url.hostname === "raw.githubusercontent.com" ? body : JSON.parse(body);
          const source: ResearchSource = { id, url: url.toString(), fetchedAt: new Date().toISOString(), status: "ok", payload,
            sha256: createHash("sha256").update(body).digest("hex"), error: null };
          this.records.push(source); return source;
        } catch (error) {
          // Do not persist fetch errors that could contain credentials or private environment URLs.
          const msg = error instanceof Error && /^HTTP \d{3}$/.test(error.message) ? error.message : "Read timed out, exceeded limits, or returned an invalid response";
          const source: ResearchSource = { id, url: url.toString(), fetchedAt: new Date().toISOString(), status: "unavailable", payload: null, sha256: null, error: msg };
          this.records.push(source); return source;
        }
      }
      throw new Error("Unreachable retry state");
    } finally {
      const next = this.queue.shift();
      if (next) next(); else this.active--;
    }
  }
}
