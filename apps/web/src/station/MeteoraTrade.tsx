import { useEffect, useRef, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import * as k from "@solana/kit";
import { CHALLENGE_WALLET, type TradeAttempt } from "../../../../packages/contracts/src/trades";
import { browserRpc, decode64, encode64, finishWalletSignature, validateMeteoraPlan, verifyLivePlanContext } from "./trade-wallet";
import "./trade.css";
interface Features {
  "standard:connect": { connect(): Promise<{ accounts: readonly WalletAccount[] }> };
  "solana:signMessage": { signMessage(input: { account: WalletAccount; message: Uint8Array }): Promise<readonly { signature: Uint8Array }[]> };
  "solana:signTransaction": { signTransaction(input: { account: WalletAccount; transaction: Uint8Array; chain: "solana:mainnet" }): Promise<readonly { signedTransaction: Uint8Array }[]> };
}
const api = (import.meta.env.VITE_API_BASE_URL || "https://api.belac.fun").replace(/\/$/, "");
const usdc = (atoms?: string) => atoms ? (Number(atoms) / 1e6).toFixed(6) : "—", sol = (atoms?: string) => atoms ? (Number(atoms) / 1e9).toFixed(9) : "—";
export function MeteoraTrade({ onClose, onRefresh }: { onClose(): void; onRefresh(): void }) {
  const [wallets, setWallets] = useState<readonly Wallet[]>([]), [selection, setSelection] = useState("");
  const [connection, setConnection] = useState<{ wallet: Wallet; account: WalletAccount; token: string } | null>(null);
  const [attempt, setAttempt] = useState<TradeAttempt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [now, setNow] = useState(Date.now());
  const [preparationEnabled,setPreparationEnabled]=useState(false);
  const mint = useRef<k.KeyPairSigner | null>(null), lock = useRef(false), mounted = useRef(true), blocked = useRef(false);
  useEffect(() => {
    mounted.current = true; const registry = getWallets();
    const update = () => setWallets(registry.get().filter(w => ["standard:connect", "solana:signMessage", "solana:signTransaction"].every(f => f in w.features)));
    update(); const a = registry.on("register", update), b = registry.on("unregister", update), timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; a(); b(); clearInterval(timer); };
  }, []);
  async function request<T>(path: string, token?: string, body?: unknown, method?: string): Promise<T> {
    const r = await fetch(`${api}/v1/trades/${path}`, { method: method ?? (body ? "POST" : "GET"), headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
    const result = await r.json(); if (!r.ok) { if (r.status === 401 && token) { blocked.current = true; setConnection(null); } throw new Error(typeof result.error === "string" ? result.error : "Trade service unavailable"); } return result.data as T;
  }
  async function run(action: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Wallet action failed"); } finally { lock.current = false; if (mounted.current) setBusy(false); } }
  async function connect() {
    await run(async () => {
      const wallet = wallets.find(w => w.name === selection) ?? wallets[0]; if (!wallet) throw new Error("Install or enable a Solana Wallet Standard wallet, then reload.");
      const features = wallet.features as unknown as Features, result = await features["standard:connect"].connect();
      const account = result.accounts.find(a => a.address === CHALLENGE_WALLET);
      if (!account) throw new Error(`Select the challenge account in your wallet: ${CHALLENGE_WALLET}. A different wallet cannot control its positions.`);
      const challenge = await request<{ id: string; message: string }>("wallet/challenge", undefined, { wallet: account.address });
      const signed = await features["solana:signMessage"].signMessage({ account, message: new TextEncoder().encode(challenge.message) });
      const session = await request<{ token: string }>("wallet/session", undefined, { id: challenge.id, signature: encode64(signed[0]!.signature) });
      const status=await request<{wallet:string;preparationEnabled:boolean}>("status",session.token);
      if(status.wallet!==CHALLENGE_WALLET)throw new Error("Trade service wallet configuration differs; reconnect after updating the app");
      setPreparationEnabled(status.preparationEnabled);blocked.current=false;
      const c = { wallet, account, token: session.token }; setConnection(c); setAttempt(await request<TradeAttempt | null>("meteora/latest", c.token));
    });
  }
  useEffect(() => {
    if (!connection) return;
    const events = connection.wallet.features["standard:events"] as { on(event: string, listener: () => void): () => void } | undefined;
    return events?.on("change", () => { blocked.current = true; setConnection(null); setError("Wallet changed. Reconnect before continuing; any submitted attempt remains tracked."); });
  }, [connection]);
  useEffect(() => {
    if (!connection || !attempt || ["reconciled", "failed", "cancelled", "expired"].includes(attempt.state)) return;
    let stopped = false; const timer = setInterval(() => { void request<TradeAttempt>(`meteora/${attempt.id}`, connection.token).then(a => { if (!stopped) { setAttempt(a); if (a.state === "reconciled") onRefresh(); } }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : "Status unavailable"); }); }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [connection, attempt?.id, attempt?.state, onRefresh]);
  async function prepare() {
    if (!connection) return; await run(async () => {
      blocked.current = false;
      if (attempt && ["ready", "queued", "preparing"].includes(attempt.state)) await request(`meteora/${attempt.id}/cancel`, connection.token, {}, "POST");
      const signer = await k.generateKeyPairSigner(); mint.current = signer;
      setAttempt(await request<TradeAttempt>("meteora/prepare", connection.token, { mint: signer.address, station: 5, budgetUsdc: "10" }));
    });
  }
  const plan = attempt?.plan, expired = !!plan && now >= Date.parse(plan.expiresAt), recoverable = !attempt || ["failed", "expired", "cancelled"].includes(attempt.state) || attempt.state === "ready";
  async function execute() {
    if (!connection || !attempt?.plan || !mint.current) return;
    await run(async () => {
      const p = attempt.plan!, signer = mint.current!;
      if (blocked.current || connection.account.address !== CHALLENGE_WALLET || !connection.wallet.accounts.some(a => a.address === CHALLENGE_WALLET)) throw new Error("Challenge wallet disconnected");
      await validateMeteoraPlan(p, signer.address); await verifyLivePlanContext(p,connection.token);
      if(blocked.current||!mounted.current||Date.now()>=Date.parse(p.expiresAt))throw new Error("Wallet session changed or review expired. Refresh before signing.");
      await request(`meteora/${attempt.id}/begin`, connection.token, {}, "POST"); setAttempt({ ...attempt, state: "awaiting_submission" });
      const features = connection.wallet.features as unknown as Features;
      const result = await features["solana:signTransaction"].signTransaction({ account: connection.account, transaction: decode64(p.wireBase64), chain: "solana:mainnet" });
      if (blocked.current || !mounted.current) throw new Error("Wallet session changed. No automatic submission; wait for this attempt to expire.");
      if (Date.now() >= Date.parse(p.expiresAt)) throw new Error("Quote expired while the wallet was open. Nothing was submitted; wait for the attempt to expire.");
      const complete = await finishWalletSignature(p, result[0]!.signedTransaction, signer);
      const registered = await request<TradeAttempt>(`meteora/${attempt.id}/signature`, connection.token, { signature: complete.signature, messageHash: p.messageHash }); setAttempt(registered);
      if (Date.now() >= Date.parse(p.expiresAt)) throw new Error("Quote expired before submission. The recorded attempt will expire without being broadcast.");
      await verifyLivePlanContext(p,connection.token);
      if(blocked.current||!mounted.current||!connection.wallet.accounts.some(a=>a.address===CHALLENGE_WALLET))throw new Error("Wallet session changed. Nothing was submitted; wait for the recorded attempt to expire.");
      if(Date.now()>=Date.parse(p.expiresAt))throw new Error("Quote expired during final verification. Nothing was submitted; wait for the recorded attempt to expire.");
      const sent = await browserRpc<string>("sendTransaction", [encode64(complete.wire), { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3, minContextSlot: p.slot }]);
      if (sent !== complete.signature) throw new Error("RPC signature differs. The recorded attempt is being reconciled; do not repeat.");
      mint.current = null; onRefresh();
    });
  }
  return <div className="trade-backdrop"><section className="trade-drawer" role="dialog" aria-modal="true" aria-labelledby="meteora-trade-title">
    <header><div><span className="trade-eyebrow">METEORA · OWNER WALLET</span><h2 id="meteora-trade-title">Review your SOL/USDC entry</h2></div><button onClick={onClose} disabled={busy} aria-label="Close trade review">×</button></header>
    <p>DAMM v2 · $70–$440 pool range. Maximum strategy principal <strong>10 USDC</strong>, including the SOL acquisition. Network fees and rent use the separate SOL fee pool.</p>
    {!connection ? <div className="trade-connect"><label>Wallet<select value={selection} onChange={e => setSelection(e.target.value)}><option value="">Choose your wallet</option>{wallets.map(w => <option key={w.name}>{w.name}</option>)}</select></label><button className="trade-primary" onClick={() => void connect()} disabled={busy || !wallets.length}>{busy ? "Connecting…" : "Connect and authenticate"}</button><small>Login requests a message signature only. Use the challenge account ending <strong>LbWUvUjSLX</strong>. Never enter a seed phrase on this page.</small>{!wallets.length && <p>No compatible wallet detected. Open this page in a browser with your Solana wallet extension enabled.</p>}</div>
      : <><div className="trade-account"><strong>{connection.wallet.name}</strong><span>{CHALLENGE_WALLET}</span></div>
      {!preparationEnabled&&<p className="trade-note" role="status">New wallet connected. Quote preparation is disabled; no position will be opened. Meteora requires USDC funding and USDC/WSOL token-account setup before a fresh review.</p>}
      {attempt && <div className="trade-state" role="status">{({ queued: "Queued for preparation", preparing: "Refreshing quote and simulating", ready: expired ? "Quote expired — refresh required" : "Simulation passed — ready for your review", awaiting_submission: "Waiting for wallet approval or attempt expiry", submitted: "Submitted for chain verification — do not repeat", confirmed: "Confirmed — waiting for finality", reconciled: "Position active — receipt verified", failed: "Attempt failed — no position attributed", expired: "Attempt expired — no position found", unknown: "Outcome needs verification — do not repeat", cancelled: "Unsigned preparation cancelled" })[attempt.state]}</div>}
      {plan && <><dl className="trade-metrics"><div><dt>Simulated spend</dt><dd>{usdc(plan.simulatedSpendUsdcAtoms)} USDC</dd></div><div><dt>Hard maximum spend</dt><dd>{usdc(plan.maxSpendUsdcAtoms)} USDC</dd></div><div><dt>Proposed LP inventory</dt><dd>{sol(plan.principalSolAtoms)} SOL<br/>{usdc(plan.principalUsdcAtoms)} USDC</dd></div>{plan.setupWsol&&<div><dt>WSOL account setup rent</dt><dd>{sol(plan.setupRentLamports)} SOL · included below</dd></div>}<div><dt>Recoverable account rent</dt><dd>{sol(plan.rentLamports)} SOL</dd></div><div><dt>Network fee incl. priority</dt><dd>{sol(plan.feeLamports)} SOL</dd></div><div><dt>Fee pool after entry</dt><dd>{sol(plan.feePoolAfterLamports)} SOL</dd></div></dl><p className="trade-note">Unspent USDC and acquired WSOL stay attributed to this station. Existing native SOL is excluded from strategy principal. Only reviewed network fees and rent may use the separate SOL fee pool.</p><small>Prepared {new Date(plan.preparedAt).toLocaleTimeString()} · {Math.max(0, Math.ceil((Date.parse(plan.expiresAt) - now) / 1000))} seconds left to review. A refresh requires a new review.</small></>}
      {attempt?.signature && <p><a href={`https://solscan.io/tx/${attempt.signature}`} target="_blank" rel="noreferrer">View recorded transaction ↗</a></p>}
      {attempt?.error && <p className="trade-note">{attempt.error}</p>}
      <div className="trade-actions">{recoverable && <button onClick={() => void prepare()} disabled={busy||!preparationEnabled}>{plan ? "Refresh quote and simulation" : "Prepare $10 Meteora entry"}</button>}{attempt?.state === "ready" && <button className="trade-primary" onClick={() => void execute()} disabled={busy || !preparationEnabled || expired || mint.current?.address !== plan?.mint}>{busy ? "Waiting for wallet…" : "Sign and execute in wallet"}</button>}</div>
      {attempt?.state === "ready" && mint.current?.address !== plan?.mint && <small>This preparation was created in another session. Refresh it to create a new position mint before signing.</small>}
      <p className="trade-note">The reviewed transaction creates the WSOL account if needed, then swaps USDC and opens the LP position atomically. Only your explicit wallet signature can authorize this entry. Background execution and every other station's trade controls remain disabled.</p></>}
    {error && <p className="trade-error" role="alert">{error}</p>}
  </section></div>;
}
