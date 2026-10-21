import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type pg from "pg";
import { TradeStore } from "./trade-store.js";
import { buildMeteoraEntry } from "./meteora-builder.js";
import { verifyMeteoraReceipt, verifyFailedMeteoraFee, type ChainTransaction } from "./meteora-receipt.js";
import { METEORA_ACCOUNTS } from "./meteora-builder.js";
import { tradeRpc } from "./trade-rpc.js";
/** Background preparation and read-only reconciliation; never signs or broadcasts. */
export async function startTradePreparation(pool: pg.Pool, endpoint: string, apiKey?: string) {
  await pool.query(await readFile(new URL("../../../packages/db/drizzle/0009_wallet_trades.sql", import.meta.url), "utf8"));
  const store = new TradeStore(pool), rpc = tradeRpc(endpoint); let stopping = false, timer: ReturnType<typeof setTimeout>;
  assert.equal(await rpc("getGenesisHash", []), "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", "Preparation and recovery require mainnet");
  async function tick() {
    try {
      const a = await store.claim();
      if (a) { try { const fees = await pool.query("select coalesce(sum(lamports),0)::text as total from wallet_trade_fee_events where wallet=$1", [a.wallet]); await store.publish(a.id, await buildMeteoraEntry({ wallet: a.wallet, station: a.station, mint: a.mint }, endpoint, apiKey, fetch, METEORA_ACCOUNTS.feePool-BigInt(fees.rows[0].total))); } catch { await store.fail(a.id); } }
      for (const t of await store.pending()) {
        if (!t.plan) continue;
        try {
          const height = await tradeRpc("https://api.mainnet-beta.solana.com")<number>("getBlockHeight", [{ commitment: "finalized" }]);
          if (!t.signature) {
            // The frontend may have closed during signing. Never automatically retry a potentially signed message.
            if (height > t.plan.lastValidBlockHeight + 32) {
              const existing = await rpc<{ value: unknown[] }>("getMultipleAccounts", [[t.plan.position], { encoding: "base64", commitment: "finalized" }]);
              if (existing.value[0] === null) await store.mark(t.id, "expired"); else await store.mark(t.id, "unknown", "Position exists; receipt recovery required");
            }
            continue;
          }
          const status = (await rpc<{ value: ({ err: unknown; confirmationStatus: string } | null)[] }>("getSignatureStatuses", [[t.signature], { searchTransactionHistory: true }])).value[0];
          if (status?.confirmationStatus === "finalized") {
            if (status.err) {
              const tx = await rpc<ChainTransaction | null>("getTransaction", [t.signature, { encoding: "base64", commitment: "finalized", maxSupportedTransactionVersion: 0 }]);
              if (!tx) continue;
              const actualFee = verifyFailedMeteoraFee(t.plan, t.signature, tx);
              // Failed fills still consumed gas; retain actual fee separately from strategy principal.
              await pool.query("insert into wallet_trade_fee_events(signature,wallet,lamports) values($1,$2,$3) on conflict do nothing", [t.signature, t.wallet, actualFee]);
              await store.mark(t.id, "failed", "Transaction failed on chain; actual network fee recorded");
            } else await store.reconcile(t.id, await verifyMeteoraReceipt(t.plan, t.signature, rpc));
          } else if (status?.confirmationStatus === "confirmed") await store.mark(t.id, "confirmed");
          else if (!status && height > t.plan.lastValidBlockHeight + 32) {
            const existing = await rpc<{ value: unknown[] }>("getMultipleAccounts", [[t.plan.position], { encoding: "base64", commitment: "finalized" }]);
            await store.mark(t.id, existing.value[0] === null ? "expired" : "unknown", existing.value[0] === null ? null : "Receipt recovery required");
          }
        } catch { await store.mark(t.id, "unknown", "Awaiting verified chain reconciliation. Do not repeat the trade."); }
      }
    } catch { console.error(JSON.stringify({ event: "trade_preparation_retry" })); }
    if (!stopping) timer = setTimeout(tick, 2000);
  }
  void tick(); return () => { stopping = true; clearTimeout(timer); };
}
