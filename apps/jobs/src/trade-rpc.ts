import assert from "node:assert/strict";
export type TradeRpc = <T>(method: string, params: unknown[]) => Promise<T>;
/** Deliberately excludes sendTransaction and every signer/key operation. */
export function tradeRpc(endpoint: string, fetcher: typeof fetch = fetch): TradeRpc {
  const url = new URL(endpoint); assert(url.protocol === "https:" && !url.username && !url.password);
  const reads = new Set(["getGenesisHash", "getMultipleAccounts", "getBlockTime", "getLatestBlockhash", "getFeeForMessage", "simulateTransaction", "getBlockHeight", "getSignatureStatuses", "getTransaction"]);
  return async <T>(method: string, params: unknown[]): Promise<T> => {
    assert(reads.has(method), "Only reads and unsigned simulations allowed");
    if (method === "simulateTransaction") {
      const opts = params[1] as { sigVerify: boolean; replaceRecentBlockhash: boolean };
      assert(opts.sigVerify === false && opts.replaceRecentBlockhash === false);
      const wire = Buffer.from(params[0] as string, "base64"); assert(wire.subarray(1, 1 + wire[0]! * 64).equals(Buffer.alloc(wire[0]! * 64)));
    }
    const response = await fetcher(endpoint, { method: "POST", redirect: "error", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20000) });
    assert(response.ok, "RPC unavailable"); const body = await response.json() as { error?: unknown; result: T }; assert(!body.error, "RPC request failed"); return body.result;
  };
}
