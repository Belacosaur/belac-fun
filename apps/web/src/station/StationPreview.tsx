import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { RoomScene, type NavigationTarget } from "./RoomScene";
import { type AgentPose } from "./StationScene";
import { STATIONS } from "./room-model";
import { type CameraView } from "./simulation";
import { StudioContext, useLiveStudio, moneyUsd, pnlMoney, strategySummary, statusLabel, feedLabel, connectionLabel } from "./live-data";
import "./station.css";
import {StationEntries} from "./StationEntries";

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    if (this.state.failed) return <div className="station-fallback"><h2>The studio couldn’t open.</h2><p>This preview needs WebGL. Try a browser with hardware acceleration enabled.</p><button onClick={() => window.location.reload()}>Try again</button></div>;
    return this.props.children;
  }
}

const histories: number[][] = Array.from({ length: 10 }, () => []);

export default function StationPreview() {
  const [view, setView] = useState<CameraView>("centre");
  const [cameraReset, setCameraReset] = useState(0);
  const [focused, setFocused] = useState(0);
  const [navigation, setNavigation] = useState<NavigationTarget>({ index: 0, revision: 0 });
  const live = useLiveStudio();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [greetings, setGreetings] = useState<number[]>(Array(10).fill(0));
  const [poses, setPoses] = useState<AgentPose[]>(Array(10).fill("working"));
  const [reducedMotion, setReducedMotion] = useState(false);
  const [credits, setCredits] = useState(false);
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [tradeOpen,setTradeOpen]=useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  const onChoose = useCallback((index: number) => {
    setNavigation((old) => ({ index: (index + 11) % 11, revision: old.revision + 1 }));
    setView("centre");
  }, []);
  const onPoseChange = useCallback((index: number, pose: AgentPose) => {
    setPoses((old) => old[index - 1] === pose ? old : old.map((p, i) => i === index - 1 ? pose : p));
  }, []);
  useEffect(() => {
    document.title = "The Studio — Belac.fun";
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))) return;
      if (event.key === "1") setView("centre");
      if (event.key === "2") setView("birdseye");
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home") {
        event.preventDefault(); onChoose(event.key === "Home" ? 0 : focused + (event.key === "ArrowRight" ? 1 : -1));
      }
      if (event.key === "Escape") { setPositionsOpen(false); setCredits(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focused, onChoose]);
  const station = STATIONS[focused - 1];
  const observation = live.snapshot?.platforms.find((p) => p.id === focused)?.observation;
  const performance = observation?.data?.performance;
  const lending = observation?.data?.lending;
  const damm = observation?.data?.damm;
  const accounting = live.snapshot?.accounting?.data;
  const recovered = live.snapshot?.recovery?.complete;
  const value = station ? performance?.equityUsd ?? observation?.data?.valueUsd : recovered ? live.snapshot?.wallet.data?.valueUsd : accounting?.equityUsd;
  const pnl = station ? performance?.pnlUsd ?? lending?.pnlUsd : accounting?.pnlUsd;
  const agentPose = station ? poses[focused - 1] : "none";
  return <StudioContext.Provider value={live}><div className="station-app room-app">
    <header className="studio-header">
      <a className="studio-brand" href="/" aria-label="Belac.fun home">BELAC.FUN<span>✳</span></a>
      <div className="studio-breadcrumb"><span>THE EXPERIMENT</span><span className="breadcrumb-slash">/</span><strong>THE STUDIO</strong></div>
      <div className="preview-badge"><span/> 10 IDEAS · IN ORBIT</div>
    </header>
    <main className="studio-main">
      {live.snapshot?.recovery&&<p className="position-allocation" style={{position:"absolute",top:8,left:24,zIndex:3}}><a href="/recover">{live.snapshot.recovery.complete?"Recovery complete":"Recovery in progress"} ↗</a> · New wallet {(Number(live.snapshot.recovery.inventory.destinationLamports)/1e9).toFixed(9)} SOL · Automation off</p>}
      <div className="station-caption">
        <div className="station-eyebrow"><span className="station-index">{station ? String(focused).padStart(2, "0") : "◎"}</span>{view === "birdseye" ? "THE WHOLE PICTURE" : station ? station.short : "ALL TEN POSITIONS"}</div>
        <h1>{view === "birdseye" ? "Ten ideas. One orbit." : station?.provider ?? "The experiment so far."}</h1>
        <p>{view === "birdseye" ? "Choose a desk to take a closer look." : performance ? strategySummary(performance) : station ? `${station.method} · execution disabled` : "$100 strategy capital. Fee pool tracked separately."}</p>
        {performance && view === "centre" && <p className="position-allocation" data-testid="position-allocation">Allocation {moneyUsd(performance.allocationUsd)} · {statusLabel(observation, live.stale)}</p>}
        {damm && view === "centre" && <p className="position-allocation" data-testid="meteora-preparation">Prepared · execution off · DAMM v2 SOL/USDC · budget 10 USDC<br/>Maximum spend {damm.preparation.maxSpendUsdc} USDC · range {moneyUsd(damm.lowerPriceUsd)}–{moneyUsd(damm.upperPriceUsd)}<br/>Entry + withdrawal simulated {new Date(damm.preparation.simulatedAt).toLocaleString()} · rent {damm.preparation.rentSol} SOL · entry fee {damm.preparation.entryFeeSol} SOL<br/>Quote refresh required · separate SOL fee pool · no funded Meteora position</p>}
        {lending && view === "centre" && <p className="position-allocation" data-testid="kamino-preparation">{statusLabel(observation, live.stale)} · {lending.entry ? `Deposited ${lending.entry.spentUsdc}` : `Planned ${lending.plannedUsdc}`} USDC · {lending.supplyApy == null ? "Rate unavailable" : `${(Number(lending.supplyApy) * 100).toFixed(2)}% variable APY`}<br/>Receipt tokens {(Number(lending.receiptAtoms) / 1e6).toFixed(6)} · {lending.entry ? <>Confirmed {new Date(lending.entry.at).toLocaleString()} · rent {lending.entry.accountRentSol} SOL · network fee {lending.entry.networkFeeSol} SOL · <a href={`https://solscan.io/tx/${lending.entry.signature}`} target="_blank" rel="noreferrer">Transaction ↗</a></> : lending.preparation && `Simulated ${new Date(lending.preparation.simulatedAt).toLocaleString()} · rent ${lending.preparation.rentSol} SOL · entry fee ${lending.preparation.entryFeeSol} SOL`}</p>}
      </div>
      <div className="studio-scene" data-view={view} data-ready={ready} data-active-station={focused} data-agent-pose={agentPose} aria-label="Interactive orbital platform with ten agents and an overview screen">
        <SceneBoundary onError={onError}>
          <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 2.5, 0], fov: 40, near: .1, far: 2400 }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
            <Suspense fallback={null}>
              <RoomScene view={view} cameraReset={cameraReset} navigation={navigation} histories={histories} running={!live.stale} reducedMotion={reducedMotion} greetings={greetings} onReady={onReady} onFocus={setFocused} onChoose={onChoose} onPoseChange={onPoseChange}/>
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      {!ready && !failed && <div className="studio-loading" role="status"><span className="loading-orbit"/>Opening the studio…</div>}
      <div className="agent-states" hidden>{poses.map((pose, index) => <span key={index} data-agent={index + 1} data-pose={pose}/>)}</div>
      {view === "centre" && <>
        <button className="room-turn room-turn-left" aria-label="Previous station" onClick={() => onChoose(focused - 1)}>‹</button>
        <button className="room-turn room-turn-right" aria-label="Next station" onClick={() => onChoose(focused + 1)}>›</button>
      </>}
      <div className="studio-controls">
        <div className="camera-switch" role="group" aria-label="Camera view">
          <button aria-pressed={view === "centre"} onClick={() => setView("centre")}>◎ Centre view <kbd>1</kbd></button>

          <button aria-pressed={view === "birdseye"} onClick={() => setView("birdseye")}>◇ Bird’s-eye <kbd>2</kbd></button>
        </div>
        {view === "birdseye"
          ? <button className="greet-button" onClick={() => setCameraReset((n) => n + 1)}>Reset view ↺</button>
          : <button className="greet-button" onClick={() => setGreetings((old) => old.map((n, i) => i === focused - 1 ? n + 1 : n))} disabled={!ready || !station}>Say hello ↗</button>}
      </div>
      <div className="view-label">{view === "centre" ? "DRAG TO LOOK AROUND · ← → TURN · HOME OVERVIEW" : "DRAG TO ORBIT · SCROLL TO ZOOM · RIGHT-DRAG TO PAN"}</div>
    </main>
    <nav className="station-rail" aria-label="Studio stations">
      <button aria-label="Overview" aria-current={focused === 0 ? "true" : undefined} onClick={() => onChoose(0)}><span className="rail-overview">◎</span><span>Overview</span></button>
      {STATIONS.map((s) => <button key={s.id} aria-label={`Station ${s.id}: ${s.provider}`} aria-current={focused === s.id ? "true" : undefined} onClick={() => onChoose(s.id)}>
        {s.logo ? <img src={`/station/${s.logo}.png`} alt=""/> : <span className="rail-wildcard">?</span>}<span><small>{String(s.id).padStart(2, "0")}</small>{s.provider}</span>
      </button>)}
    </nav>
    <footer className="studio-footer">
      <button className="trade-open" onClick={()=>setTradeOpen(true)}>Connect wallet / trade review ↗</button>
      <div className="footer-position">{station?.logo ? <img src={`/station/${station.logo}.png`} alt=""/> : <span className="footer-symbol">{station ? "?" : "◎"}</span>}<div><strong>{station?.provider ?? "The experiment"}</strong><span>{station ? statusLabel(observation, live.stale) : recovered ? `${live.snapshot?.wallet.data?.sol ?? "—"} SOL · new wallet` : `${accounting?.feePool.availableSol ?? "—"} SOL fee reserve · separate`}</span></div></div>
      <div className="footer-stat"><span>{station ? "POSITION + CASH" : recovered ? "NEW WALLET BALANCE" : "CHALLENGE EQUITY"}</span><strong>{moneyUsd(value)}</strong></div>
      <div className="footer-stat"><span>STRATEGY P&L</span><strong data-testid="strategy-pnl" className={pnl == null ? undefined : Number(pnl) < 0 ? "result-negative" : "result-positive"} title="Marked value minus starting allocation. Operating fees and future exit costs are separate.">{pnlMoney(pnl)}</strong></div>
      <div className="simulation-control"><button onClick={live.refresh}><span className={!live.stale ? "feed-dot active" : "feed-dot"}/>Refresh data<span aria-hidden="true">↻</span></button><span role="status">{feedLabel(live)}</span></div>
      <button className="positions-button" onClick={() => setPositionsOpen(!positionsOpen)} aria-expanded={positionsOpen}>All positions ↗</button>
      <button className="credits-button" onClick={() => setCredits(!credits)} aria-expanded={credits}>About</button>
    </footer>
    {positionsOpen && <section className="positions-panel" aria-label="All positions">
      <header><div><span>THE EXPERIMENT</span><h2>Every position, in one place.</h2></div><button onClick={() => setPositionsOpen(false)} aria-label="Close positions">×</button></header>
      <div className="positions-total"><span>Challenge equity <strong>{moneyUsd(accounting?.equityUsd)}</strong></span><span>Strategy P&L <strong>{pnlMoney(accounting?.pnlUsd)}</strong></span><span>Unallocated <strong>{moneyUsd(accounting?.unallocatedUsdc)}</strong></span></div>
      <div className="fee-pool" data-testid="fee-pool"><strong>Separate fee pool</strong><span>{accounting?.feePool.availableSol ?? "—"} SOL available · {accounting?.feePool.networkFeesSol ?? "—"} SOL network fees · {accounting?.feePool.accountCapitalSol ?? "—"} SOL account capital</span><small>Excluded from strategy equity and P&L. Sender-funded USDC account capital: {accounting?.feePool.senderFundedAccountCapitalSol ?? "—"} SOL.</small></div>
      {accounting && <p>Funding surplus: {accounting.surplusUsdc} USDC · unassigned deposits: {accounting.unattributedSol} SOL / {accounting.unattributedUsdc} USDC. These are excluded from trading returns.</p>}
      {live.snapshot?.accounting?.status === "unavailable" && <p role="alert">Allocation data is stale or unavailable. Any retained values are from the last successful reconciliation.</p>}
      <div className="positions-table"><table><thead><tr><th>Position / allocation</th><th>Value / P&L</th><th>Connection</th></tr></thead><tbody>{STATIONS.map((s) => {
        const observed = live.snapshot?.platforms.find((p) => p.id === s.id)?.observation;
        const p = observed?.data?.performance;
        return <tr key={s.id}><td><button onClick={() => { onChoose(s.id); setPositionsOpen(false); }}>{s.logo && <img src={`/station/${s.logo}.png`} alt=""/>}<span>{s.provider}<small>{s.method}</small><small>{p ? `Allocation ${moneyUsd(p.allocationUsd)} · ${strategySummary(p)}` : observed?.message ?? "Connecting"}</small>{p?.stationId === 8 && <small>LP {p.principalSol} SOL + {p.principalUsdc} USDC · fees {p.accruedFeesSol} SOL + {p.accruedFeesUsdc} USDC<br/>Cash {p.cashUsdc} USDC + {p.residualSol} WSOL</small>}</span></button></td><td>{moneyUsd(p?.equityUsd ?? observed?.data?.valueUsd)}<small className={p && Number(p.pnlUsd) < 0 ? "result-negative" : "result-positive"}>{pnlMoney(p?.pnlUsd)}</small></td><td><span>{connectionLabel(observed, live.stale)}</span><br/><small>{statusLabel(observed, live.stale)}</small><small>Execution off</small></td></tr>;
      })}</tbody></table></div>
      <p>{recovered ? "All positions closed. Recovered funds are held in the new wallet." : accounting?.valuationBasis ?? "Waiting for verified allocation data."} {accounting?.strategies.length ?? 0} confirmed positions are attributed. All automatic execution remains disabled. Ript is pending a custom challenge pack.</p>
      {live.snapshot && <p><a href={`https://solscan.io/account/${live.snapshot.address}`} target="_blank" rel="noreferrer">{live.snapshot.address}</a><br/>Last sync: {new Date(live.snapshot.generatedAt).toLocaleString()}</p>}
      {Boolean(live.snapshot?.wallet.data?.unpricedAssets) && <p>Raw wallet assets include unpriced tokens or position NFTs. Strategy equity is calculated separately from verified position ownership and inventory.</p>}
      {live.snapshot?.wallet.data && live.snapshot.wallet.data.tokens.length > 0 && <div className="wallet-tokens"><h3>Wallet tokens</h3>{live.snapshot.wallet.data.tokens.map((token) => <p key={token.mint}>{token.amount} · <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noreferrer">{token.mint}</a></p>)}</div>}
    </section>}
    {tradeOpen&&<StationEntries onClose={()=>setTradeOpen(false)} onRefresh={live.refresh}/>}
    {credits && <div className="scene-credits"><strong>The orbital studio.</strong><p>Read-only wallet and platform observations, synced in the background. Platform coverage is partial; unknown values stay blank. Character: RobotExpressive by Quaternius / Tomás Laulhé (CC0), adapted by Don McCurdy. The characters are visual hosts, not trading agents.</p><a href="/station/robot-source.md" target="_blank" rel="noreferrer">Robot attribution ↗</a><p>Procedural nebula adapted from Space 3D by wwwtyro (Unlicense). Camera orbit, pan and zoom reveal the surrounding space. Drift pauses with reduced motion enabled.</p><a href="/station/space-source.md" target="_blank" rel="noreferrer">Space attribution ↗</a><button onClick={() => setCredits(false)} aria-label="Close scene information">×</button></div>}
  </div></StudioContext.Provider>;
}
