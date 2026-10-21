import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Block, KeyboardKeys, Plant } from "./StationScene";
import { moneyUsd, pnlMoney, strategySummary, statusLabel, useStudio, connectionLabel } from "./live-data";
import type { Station } from "./room-model";
import { stationTheme, type StationTheme } from "./station-themes";

// The rear screen needs extra physical width to match the nearer desk from the centre POV.
const displayWidth = 7.7;
const displayHeight = (displayWidth - .16) * 9 / 16 + .16;
const displayPosition: [number, number, number] = [-.09, 4.25, -1.96];

export function StationCubicle({ station, history, running }: { station: Station; history: number[]; running: boolean }) {
  const theme = stationTheme(station);
  return <group name={`station-${station.id}-clean-cubicle`}>
    <Block at={[0, .025, -.3]} size={[7.4, .05, 4.6]} color="#dce3e4" rough={.95} radius={.02}/>
    {/* A shallow surround follows the display with equal margins on all four sides. */}
    <Block at={[displayPosition[0], displayPosition[1], -2.15]} size={[displayWidth + .4, displayHeight + .4, .18]} color="#e5e9e8" radius={.09} rough={.85}/>
    <StationDisplay station={station} theme={theme} history={history} running={running}/>
    {/* Low boundaries establish the bay without enclosing the seated character. */}
    {[-3.7, 3.7].map((x) => <group key={x}>
      <Block at={[x, .5, -.65]} size={[.11, .95, 3.5]} color="#d6dedf" radius={.04} rough={.8}/>
      <Block at={[x, .985, -.65]} size={[.12, .035, 3.5]} color={theme.accent} radius={.01}/>
    </group>)}
    <StationDesk theme={theme}/>
    <group position={[-.21, 0, -.5]} scale={.8}><Plant/></group>
  </group>;
}

function StationDisplay({ station, theme, history, running }: { station: Station; theme: StationTheme; history: number[]; running: boolean }) {
  const live = useStudio();
  const observation = live.snapshot?.platforms.find((p) => p.id === station.id)?.observation;
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!station.logo) return;
    const image = new Image();
    image.onload = () => setLogo(image);
    image.src = `/station/${station.logo}.png`;
    return () => { image.onload = null; };
  }, [station.logo]);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1536; canvas.height = 864;
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }, []);
  useEffect(() => {
    const c = (texture.image as HTMLCanvasElement).getContext("2d")!;
    const value = observation?.data?.valueUsd;
    const performance = observation?.data?.performance;
    const lending = observation?.data?.lending;
    const damm = observation?.data?.damm;
    const pnl = performance?.pnlUsd ?? lending?.pnlUsd;
    const gain = pnl != null ? Number(pnl) : null;
    const foreground = theme.foreground ?? (theme.dark ? "#f7f8f9" : theme.ink);
    const muted = theme.muted ?? (theme.dark ? "#a6b3c2" : "#5f7183");
    const text = (value: string, x: number, y: number, size: number, color = foreground, weight = 400) => {
      c.fillStyle = color; c.font = `${weight} ${size}px "Segoe UI", sans-serif`; c.fillText(value, x, y);
    };
    c.fillStyle = theme.background; c.fillRect(0, 0, 1536, 864);
    if (logo) {
      const scale = 62 / Math.max(logo.width, logo.height);
      c.drawImage(logo, 101 - logo.width * scale / 2, 68 - logo.height * scale / 2, logo.width * scale, logo.height * scale);
    } else {
      c.fillStyle = theme.wash; c.beginPath(); c.roundRect(70, 37, 62, 62, 12); c.fill();
      text("?", 88, 84, 43, theme.ink, 600);
    }
    text(station.provider, 151, 85, station.provider.length > 14 ? 34 : 40, foreground, 600);
    const methodX = Math.max(425, 151 + c.measureText(station.provider).width + 48);
    const method = station.method;
    let methodSize = 30;
    c.font = `400 ${methodSize}px "Segoe UI", sans-serif`;
    while (methodSize > 18 && c.measureText(method).width > 1230 - methodX) {
      methodSize--; c.font = `400 ${methodSize}px "Segoe UI", sans-serif`;
    }
    text(method, methodX, 83, methodSize, muted, 400);
    c.textAlign = "right"; text("READ ONLY", 1466, 85, 27, muted, 500); c.textAlign = "left";
    c.strokeStyle = theme.dark ? "#ffffff25" : "#d4e1e9"; c.lineWidth = 2; c.beginPath(); c.moveTo(70, 125); c.lineTo(1466, 125); c.stroke();
    text(damm ? "PLANNED STRATEGY BUDGET" : lending?.state === "prepared" ? "PLANNED USDC DEPOSIT" : performance ? "POSITION + RESIDUAL CASH" : "OBSERVED VALUE", 70, 199, 26, muted, 500);
    text(moneyUsd(damm?.plannedUsdc ?? (lending?.state === "prepared" ? lending.plannedUsdc : value)), 60, 353, 153, foreground, 550);
    text("STRATEGY P&L", 1030, 199, 26, muted, 500);
    text(pnlMoney(pnl), 1027, 295, 66, gain === null ? foreground : gain < 0 ? "#f28489" : "#69cda6", 500);
    text(performance ? `${Number(performance.pnlPct) >= 0 ? "+" : ""}${Number(performance.pnlPct).toFixed(3)}% since entry` : lending?.state === "active" ? "Since confirmed entry" : "No active allocation", 1032, 350, 27, muted);
    const samples = (performance?.history ?? lending?.history)?.map(h => Number(h.valueUsd)) ?? [];
    const left = 74, right = performance || lending || damm ? 940 : 1460, top = 465, bottom = 650;
    const min = Math.min(...samples) - .001, max = Math.max(...samples) + .001;
    const points = samples.map((v, i) => [left + i * (right - left) / Math.max(samples.length - 1, 1), bottom - (v - min) / (max - min) * (bottom - top)] as const);
    for (let i = 0; i < 3; i++) { const y = top + i * (bottom - top) / 2; c.strokeStyle = theme.dark ? "#ffffff16" : "#dce7ec"; c.lineWidth = 1; c.beginPath(); c.moveTo(left, y); c.lineTo(right, y); c.stroke(); }
    const fill = c.createLinearGradient(0, top, 0, bottom); fill.addColorStop(0, `${theme.accent}30`); fill.addColorStop(1, `${theme.accent}00`);
    c.beginPath(); c.moveTo(left, bottom); points.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(right, bottom); c.closePath(); c.fillStyle = fill; c.fill();
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = theme.chart; c.lineWidth = 5; c.lineJoin = "round"; c.stroke();
    const last = points.at(-1); if (last) { c.beginPath(); c.arc(last[0], last[1], 7, 0, Math.PI * 2); c.fillStyle = theme.chart; c.fill(); }
    if (performance && !lending) {
      text(performance.stationId === 1 ? strategySummary(performance) : `LP: ${Number(performance.principalSol).toFixed(8)} SOL + ${Number(performance.principalUsdc).toFixed(6)} USDC`, 74, 415, 29, foreground, 500);
      text(`ALLOCATION  ${moneyUsd(performance.allocationUsd)}`, 1030, 455, 30, foreground, 600);
      text(`Entry cost  ${moneyUsd(performance.entryCostUsdc)}`, 1030, 502, 26, muted);
      text(`Cash  ${Number(performance.cashUsdc).toFixed(6)} USDC`, 1030, 550, 26, muted);
      if (performance.stationId === 8 || performance.stationId === 5) {
        text(`Accrued fees  ${pnlMoney(performance.accruedFeesUsd)}`, 1030, 598, 26, muted);
        text(`${moneyUsd(performance.lowerPrice)}–${moneyUsd(performance.upperPrice)} · ${performance.inRange ? "In range" : "Out of range"}`, 1030, 646, 26, foreground);
      }
      text(`${statusLabel(observation, live.stale)} · marked value · fee pool excluded`, 70, 720, 26, muted);
      if (samples.length < 2) text("Collecting measured history", 74, 540, 27, muted);
    } else if (damm) {
      const p = damm.preparation;
      text("DAMM v2 · entry + withdrawal simulated", 74, 415, 33, foreground, 500);
      text(`${p.plannedSol} SOL + ${p.plannedUsdc} USDC`, 74, 510, 31, foreground);
      text("Proposed inventory · funds remain in wallet", 74, 558, 27, muted);
      text(`MAX SPEND  ${p.maxSpendUsdc} USDC`, 1030, 455, 27, foreground, 600);
      text(`${moneyUsd(damm.lowerPriceUsd)}–${moneyUsd(damm.upperPriceUsd)} range`, 1030, 502, 26, muted);
      text(`Pool SOL  ${moneyUsd(damm.poolPriceUsd)}`, 1030, 550, 26, muted);
      text(`Rent  ${p.rentSol} SOL`, 1030, 598, 25, muted);
      text(`Entry fee  ${p.entryFeeSol} SOL`, 1030, 646, 25, muted);
      text("Awaiting review · refresh quote before entry · SOL fee pool separate", 70, 720, 26, muted);
    } else if (lending) {
      text(lending.state === "prepared" ? "Simulated · awaiting review" : statusLabel(observation, live.stale), 74, 415, 36, foreground, 500);
      text(lending.state === "prepared" ? "Funds remain in the wallet" : `${lending.redeemableUsdc} USDC · receipt-token value`, 74, 520, 29, muted);
      text(`Supply APY  ${lending.supplyApy == null ? "Unavailable" : `${(Number(lending.supplyApy) * 100).toFixed(2)}%`}`, 1030, 455, 28, foreground, 600);
      text("Variable rate · no borrowing", 1030, 502, 26, muted);
      text(`Receipts  ${(Number(lending.receiptAtoms) / 1e6).toFixed(6)}`, 1030, 550, 26, muted);
      if (lending.entry || lending.preparation) {
        text(`Rent  ${lending.entry?.accountRentSol ?? lending.preparation!.rentSol} SOL`, 1030, 598, 25, muted);
        text(`Entry fee  ${lending.entry?.networkFeeSol ?? lending.preparation!.entryFeeSol} SOL`, 1030, 646, 25, muted);
      }
      text(`${statusLabel(observation, live.stale)} · SOL costs from separate fee pool`, 70, 720, 26, muted);
    } else {
      text(station.id === 9 ? "Custom pack pending" : "Execution disabled", 74, 510, 50, foreground, 500);
      const detail = observation?.message ?? "Waiting for the first verified sync";
      text(detail.length > 76 ? `${detail.slice(0, 73)}…` : detail, 74, 570, 27, muted);
      text(connectionLabel(observation, live.stale), 74, 638, 28, muted);
      text("Planned allocation $10 · no active strategy P&L", 70, 720, 28, muted);
    }
    c.fillStyle = theme.dark ? theme.hardware : theme.wash; c.fillRect(0, 770, 1536, 94);
    text(station.id === 9 ? "CUSTOM PACK PENDING" : "SOLANA MAINNET", 70, 828, 29, foreground, 500);
    c.textAlign = "right"; text(observation?.lastSuccessAt ? `${live.stale || observation.status === "unavailable" ? "LAST GOOD" : "SYNCED"} ${new Date(observation.lastSuccessAt).toLocaleTimeString()}` : "AWAITING CONNECTION", 1466, 828, 25, muted, 500); c.textAlign = "left";
    texture.needsUpdate = true;
  }, [texture, history, running, logo, station, theme, observation, live.stale]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={displayPosition} name={`station-${station.id}-results-display`}>
    <Block at={[0, 0, -.23]} size={[.6, .35, .4]} color="#5f7183" metal={.7}/>
    <Block at={[0, 0, 0]} size={[displayWidth, displayHeight, .14]} radius={.055} color={theme.ink} rough={.45}/>
    <mesh position={[0, 0, .077]}><planeGeometry args={[displayWidth - .16, displayHeight - .16]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
  </group>;
}

function StationDesk({ theme }: { theme: StationTheme }) {
  return <group>
    <Block at={[-.08, 1.08, -.08]} size={[6.85, .16, 1.65]} radius={.075} color="#e6ecee" rough={.48}/>
    <Block at={[-.08, .97, -.08]} size={[6.62, .045, 1.46]} radius={.02} color={theme.accent} metal={.25}/>
    {/* One storage cabinet anchors the left; the right remains open for chair movement. */}
    <Block at={[-2.12, .49, -.15]} size={[.85, .94, 1.18]} radius={.055} color={theme.ink}/>
    {[.37, .72].map((y) => <Block key={y} at={[-2.12, y, .45]} size={[.66, .015, .015]} radius={.004} color="#5f7183"/>)}
    <Block at={[2.45, .49, -.3]} size={[.16, .94, 1]} radius={.035} color={theme.hardware}/>
    <Block at={[-2.12, .045, -.15]} size={[.75, .07, 1.08]} color="#5f7183" metal={.7} radius={.015}/>
    <Block at={[2.45, .045, -.3]} size={[.28, .07, 1.06]} color="#5f7183" metal={.7} radius={.015}/>
    <Block at={[2.06, 1.181, .24]} size={[1.7, .022, .9]} radius={.035} color={theme.wash} rough={.95} rotation={[0, .25, 0]}/>
    <group position={[2.05, 1.21, .31]} rotation={[0, -2.5, 0]}>
      <Block at={[0, 0, 0]} size={[1.14, .06, .4]} radius={.025} color="#c7d7e2"/><KeyboardKeys/>
    </group>
    <Block at={[1.34, 1.23, .5]} size={[.18, .09, .29]} radius={.06} color="#e5edf2" rotation={[0, -2.5, 0]}/>
    <Block at={[-1.9, 1.19, .02]} size={[.4, .04, .55]} radius={.015} color={theme.ink} rotation={[0, -.12, 0]}/>
    <Block at={[-1.9, 1.214, .02]} size={[.37, .008, .52]} radius={.003} color="#ecf1f3" rotation={[0, -.12, 0]}/>
    <mesh position={[-2.45, 1.32, .12]} castShadow><cylinderGeometry args={[.10, .09, .28, 40]}/><meshStandardMaterial color={theme.wash} roughness={.28}/></mesh>
    <mesh position={[-2.45, 1.463, .12]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.08, 32]}/><meshStandardMaterial color="#352a25"/></mesh>
  </group>;
}
