import {useEffect,useRef,useState} from "react";
import {getWallets} from "@wallet-standard/app";
import type {Wallet,WalletAccount} from "@wallet-standard/base";
import * as k from "@solana/kit";
import {CHALLENGE_WALLET} from "../../../../packages/contracts/src/trades";
import type {EntryStation,StationEntryAttempt} from "../../../../packages/contracts/src/station-entries";
import {ENTRY_PROPOSALS,ENTRY_RESEARCH} from "../../../../packages/contracts/src/entry-proposals";
import {browserRpc,decode64,encode64} from "./trade-wallet";
import {verifyEntryContext,finishEntrySignature} from "./entry-wallet";
import "./trade.css";
interface Features {
 "standard:connect":{connect():Promise<{accounts:readonly WalletAccount[]}>};
 "solana:signMessage":{signMessage(input:{account:WalletAccount;message:Uint8Array}):Promise<readonly {signature:Uint8Array}[]>};
 "solana:signTransaction":{signTransaction(input:{account:WalletAccount;transaction:Uint8Array;chain:"solana:mainnet"}):Promise<readonly {signedTransaction:Uint8Array}[]>};
}
interface Queue {wallet:string;enabled:boolean;automatedExecutionEnabled:false;attempts:StationEntryAttempt[]}
const api=(import.meta.env.VITE_API_BASE_URL||"https://api.belac.fun").replace(/\/$/,"");
const usdc=(value:string)=>`${(Number(value)/1e6).toFixed(6)} USDC`,sol=(value:string)=>`${(Number(value)/1e9).toFixed(9)} SOL`;
const terminal=new Set(["confirmed","failed","expired","cancelled"]);
export function StationEntries({onClose,onRefresh}:{onClose():void;onRefresh():void}){
 const [wallets,setWallets]=useState<readonly Wallet[]>([]),[selection,setSelection]=useState("");
 const [connection,setConnection]=useState<{wallet:Wallet;account:WalletAccount;token:string}|null>(null);
 const [queue,setQueue]=useState<Queue|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[now,setNow]=useState(Date.now());
 const lock=useRef(false),blocked=useRef(true),mounted=useRef(true),mint=useRef<k.KeyPairSigner|null>(null);
 const active=queue?.attempts.find(a=>!terminal.has(a.state)),plan=active?.plan,expired=!!plan&&Date.parse(plan.expiresAt)<=now;
 useEffect(()=>{mounted.current=true;const registry=getWallets(),update=()=>setWallets(registry.get().filter(w=>["standard:connect","solana:signMessage","solana:signTransaction"].every(f=>f in w.features)));update();const a=registry.on("register",update),b=registry.on("unregister",update),timer=setInterval(()=>setNow(Date.now()),1000);return()=>{mounted.current=false;blocked.current=true;a();b();clearInterval(timer);};},[]);
 async function request<T>(path:string,token?:string,body?:unknown):Promise<T>{
  const r=await fetch(`${api}/v1/${path}`,{method:body===undefined?"GET":"POST",headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(body!==undefined?{"content-type":"application/json"}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(path==="entries/prepare"?90000:25000)});
  const j=await r.json();if(!r.ok){if(r.status===401){blocked.current=true;setConnection(null);}throw Error(typeof j.error==="string"?j.error:"Review service unavailable");}return j.data as T;
 }
 async function load(token:string){const q=await request<Queue>("entries",token);if(q.wallet!==CHALLENGE_WALLET||q.automatedExecutionEnabled!==false)throw Error("Wallet or execution configuration differs; stop and refresh the app");if(mounted.current)setQueue(q);return q;}
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError("");try{await action();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Wallet review failed");}finally{lock.current=false;if(mounted.current)setBusy(false);}}
 async function connect(){await run(async()=>{
  const w=wallets.find(w=>w.name===selection)??wallets[0];if(!w)throw Error("Enable Solflare or another Solana Wallet Standard wallet, then reload.");
  const f=w.features as unknown as Features,result=await f["standard:connect"].connect(),account=result.accounts.find(a=>a.address===CHALLENGE_WALLET);
  if(!account)throw Error(`Select the new challenge wallet in Solflare: ${CHALLENGE_WALLET}`);
  const c=await request<{id:string;message:string}>("trades/wallet/challenge",undefined,{wallet:CHALLENGE_WALLET});
  const signed=await f["solana:signMessage"].signMessage({account,message:new TextEncoder().encode(c.message)});
  const session=await request<{token:string}>("trades/wallet/session",undefined,{id:c.id,signature:encode64(signed[0]!.signature)});
  await load(session.token);blocked.current=false;setConnection({wallet:w,account,token:session.token});
 });}
 useEffect(()=>{if(!connection)return;const events=connection.wallet.features["standard:events"] as {on(event:string,listener:()=>void):()=>void}|undefined;return events?.on("change",()=>{blocked.current=true;setConnection(null);setError("Wallet changed. Reconnect; any submitted entry stays reserved.");});},[connection]);
 useEffect(()=>{if(!connection)return;let stopped=false;const timer=setInterval(()=>{if(lock.current)return;void load(connection.token).then(q=>{if(!stopped&&q.attempts.some(a=>a.state==="confirmed"))onRefresh();}).catch(e=>{if(!stopped)setError(e instanceof Error?e.message:"Status unavailable");});},5000);return()=>{stopped=true;clearInterval(timer);};},[connection,onRefresh]);
 function guard(){if(!connection||blocked.current||!mounted.current||!connection.wallet.accounts.some(a=>a.address===CHALLENGE_WALLET))throw Error("Wallet session changed. Nothing was submitted; reconnect and check the recorded review.");}
 async function prepare(stationId:EntryStation){if(!connection)return;await run(async()=>{guard();
  if(active){if(!["preparing","ready"].includes(active.state))throw Error("Wait for the current transaction to reconcile before preparing another.");await request(`entries/${active.id}/cancel`,connection.token,{});}
  mint.current=stationId===8?await k.generateKeyPairSigner():null;
  try{await request("entries/prepare",connection.token,{stationId,budgetUsdc:"10",...(mint.current?{mint:mint.current.address}:{})});}finally{await load(connection.token);}
 });}
 async function cancel(){if(!connection||!active)return;await run(async()=>{await request(`entries/${active.id}/cancel`,connection.token,{});mint.current=null;await load(connection.token);});}
 async function execute(){if(!connection||!active?.plan)return;await run(async()=>{
  const p=active.plan!,signer=p.stationId===8?mint.current??undefined:undefined;guard();if(p.stationId===8&&signer?.address!==p.mint)throw Error("Refresh this Orca review in this browser session before signing.");
  await verifyEntryContext(p,connection.token,signer?.address);guard();if(Date.now()>=Date.parse(p.expiresAt))throw Error("Review expired; refresh before signing.");
  await request(`entries/${active.id}/begin`,connection.token,{messageHash:p.messageHash});
  setQueue(q=>q?{...q,attempts:q.attempts.map(a=>a.id===active.id?{...a,state:"signing"}:a)}:q);
  const f=connection.wallet.features as unknown as Features,result=await f["solana:signTransaction"].signTransaction({account:connection.account,transaction:decode64(p.wireBase64),chain:"solana:mainnet"});guard();
  const complete=await finishEntrySignature(p,result[0]!.signedTransaction,signer);
  await request(`entries/${active.id}/signature`,connection.token,{signature:complete.signature,messageHash:p.messageHash});await load(connection.token);
  await verifyEntryContext(p,connection.token,signer?.address);guard();if(Date.now()>=Date.parse(p.expiresAt))throw Error("Review expired during final checks. Nothing was submitted; wait for this review to expire.");
  const sent=await browserRpc<string>("sendTransaction",[complete.wire,{encoding:"base64",skipPreflight:false,preflightCommitment:"confirmed",maxRetries:3,minContextSlot:p.slot}]);
  if(sent!==complete.signature)throw Error("Submission response differs; check the recorded transaction before retrying.");mint.current=null;onRefresh();await load(connection.token);
 });}
 const pendingSignature=!!active&&!['ready','preparing'].includes(active.state);
 return <div className="trade-backdrop"><section className="trade-drawer entry-drawer" role="dialog" aria-modal="true" aria-labelledby="entry-title">
  <header><div><span className="trade-eyebrow">OWNER APPROVAL QUEUE</span><h2 id="entry-title">Review each position</h2></div><button onClick={onClose} disabled={busy} aria-label="Close position reviews">×</button></header>
  <p>Maximum <strong>10 USDC principal per station</strong>. SOL fees and recoverable account rent use the separate native SOL pool. Automated execution is disabled.</p>
  {!connection?<div className="trade-connect"><label>Wallet<select value={selection} onChange={e=>setSelection(e.target.value)}><option value="">Choose wallet</option>{wallets.map(w=><option key={w.name}>{w.name}</option>)}</select></label><button className="trade-primary" onClick={()=>void connect()} disabled={busy||!wallets.length}>{busy?"Connecting…":"Connect and authenticate"}</button><small>Use the new wallet ending LbWUvUjSLX. Login signs a message only. Each trade requires a separate approval in Solflare.</small></div>:<><div className="trade-account"><strong>{connection.wallet.name}</strong><span>{CHALLENGE_WALLET}</span></div>{!queue?.enabled&&<p className="trade-note">Unsigned preparation is disabled. You can inspect the queue; no new entry can be signed.</p>}</>}
  {active&&<section className="entry-review" aria-label="Current transaction review"><div className="trade-state" role="status">{active.state==="ready"?(expired?"Review expired — refresh before signing":"Simulation passed — awaiting your review"):active.state==="preparing"?"Refreshing quote and simulation":active.state==="signing"?"Wallet approval started — wait for completion or expiry":active.state==="unknown"?"Outcome needs verification — do not repeat":"Signature recorded — awaiting chain finality"}</div>
   <h3>{ENTRY_PROPOSALS.find(p=>p.id===active.stationId)?.provider}</h3>{plan&&<><p>{plan.summary}</p><dl className="trade-metrics"><div><dt>Simulated principal spend</dt><dd>{usdc(plan.simulatedSpendUsdcAtoms)}</dd></div><div><dt>Hard maximum spend</dt><dd>{usdc(plan.maxSpendUsdcAtoms)}</dd></div><div><dt>Network fee</dt><dd>{sol(plan.feeLamports)}</dd></div><div><dt>Recoverable account rent</dt><dd>{sol(plan.rentLamports)}</dd></div><div><dt>Native SOL fee pool after</dt><dd>{sol(plan.after.nativeLamports)}</dd></div><div><dt>Allocation left as USDC</dt><dd>{usdc(String(10000000n-BigInt(plan.simulatedSpendUsdcAtoms)))}</dd></div>{plan.stationId===1&&<div><dt>Simulated SOL held as WSOL</dt><dd>{sol(String(plan.details.acquiredWsolAtoms))}</dd></div>}{plan.stationId===6&&plan.details.supplyApy!==undefined&&<div><dt>Current variable supply APY</dt><dd>{(Number(plan.details.supplyApy)*100).toFixed(2)}%</dd></div>}{plan.stationId===8&&<div><dt>Proposed SOL price range</dt><dd>${Number(plan.details.lowerPrice).toFixed(2)}–${Number(plan.details.upperPrice).toFixed(2)}</dd></div>}</dl><small>Prepared {new Date(plan.preparedAt).toLocaleTimeString()} · {Math.max(0,Math.ceil((Date.parse(plan.expiresAt)-now)/1000))} seconds left. Quotes refresh for each approval.</small></>}
   {active.signature&&<p><a href={`https://solscan.io/tx/${active.signature}`} target="_blank" rel="noreferrer">Recorded transaction ↗</a></p>}{active.error&&<p className="trade-note">{active.error}</p>}
   <div className="trade-actions">{active.state==="ready"&&<><button className="trade-primary" onClick={()=>void execute()} disabled={busy||expired||!queue?.enabled||(active.stationId===8&&mint.current?.address!==plan?.mint)}>Review and sign in Solflare</button><button onClick={()=>void prepare(active.stationId)} disabled={busy||!queue?.enabled}>Refresh quote and simulation</button></>}{["preparing","ready"].includes(active.state)&&<button onClick={()=>void cancel()} disabled={busy}>Cancel unsigned review</button>}{connection&&pendingSignature&&<button onClick={()=>void run(async()=>{await load(connection.token);onRefresh();})} disabled={busy}>Refresh chain status</button>}</div>
   {active.stationId===8&&active.state==="ready"&&mint.current?.address!==plan?.mint&&<p className="trade-note">This Orca review belongs to another browser session. Refresh it before signing.</p>}
  </section>}
  <div className="entry-list">{ENTRY_PROPOSALS.map(p=>{const confirmed=queue?.attempts.find(a=>a.stationId===p.id&&a.state==="confirmed");const state=confirmed?"Active · receipt verified":p.mode==="entry"?"Ready to prepare":p.mode==="proposal"?"Proposal · WAIT":p.mode==="active"?"Active":p.mode==="paused"?"Paused":"Pending";
   return <article className="entry-card" key={p.id}><div className="entry-card-heading"><strong>{String(p.id).padStart(2,"0")} · {p.provider}</strong><span>{state}</span></div><h3>{p.title}</h3><p>{p.detail}</p>{confirmed&&<a href={`https://solscan.io/tx/${confirmed.signature}`} target="_blank" rel="noreferrer">Verified receipt ↗</a>}{p.mode==="entry"&&!confirmed&&<button onClick={()=>void prepare(p.id as EntryStation)} disabled={!connection||!queue?.enabled||busy||!!active}>Prepare fresh $10 review</button>}</article>;
  })}</div>
  <p className="trade-note">Research scan {ENTRY_RESEARCH.at}: {ENTRY_RESEARCH.sources} sources, {ENTRY_RESEARCH.failedSources} source failures. {ENTRY_RESEARCH.note} Existing positions and their allocation cash are protected during preparation.</p>
  {queue&&queue.attempts.some(a=>['failed','expired','cancelled'].includes(a.state))&&<details><summary>Previous reviews</summary>{queue.attempts.filter(a=>['failed','expired','cancelled'].includes(a.state)).map(a=><p className="trade-note" key={a.id}>Station {a.stationId} · {a.state}{a.error?` · ${a.error}`:""}</p>)}</details>}
  {error&&<p className="trade-error" role="alert">{error}</p>}
 </section></div>;
}
