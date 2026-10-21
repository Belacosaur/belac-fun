import { CanvasTexture, SRGBColorSpace, LinearFilter } from "three";
import { dollars } from "./simulation";
import { STATIONS, type Station } from "./room-model";
import { moneyUsd, pnlMoney, statusLabel, feedLabel, type LiveStudio } from "./live-data";

export function createScreenTexture(width = 1920, height = 1160) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

export function paintScreen(texture: CanvasTexture, history: number[], running: boolean, logo: HTMLImageElement | null, station: Station = STATIONS[5]!) {
  const canvas = texture.image as HTMLCanvasElement;
  const c = canvas.getContext("2d");
  if (!c) return;
  const value = history[history.length - 1] ?? 1000;
  const gain = value - 1000;
  const up = gain >= 0;
  const kamino = station.id === 6;
  const green = up ? (kamino ? "#30d69a" : "#c8f5a4") : "#ffb4af";
  c.clearRect(0, 0, 1920, 1160);
  c.fillStyle = (kamino ? "#162136" : "#182921");
  c.fillRect(0, 0, 1920, 1160);
  const glow = c.createRadialGradient(1750, 0, 10, 1750, 0, 1200);
  glow.addColorStop(0, (kamino ? "#212c42" : "#354e3c"));
  glow.addColorStop(1, (kamino ? "#162136" : "#182921"));
  c.fillStyle = glow;
  c.fillRect(0, 0, 1920, 1160);
  const text = (value: string, x: number, y: number, size: number, color = "#f2f5e9", weight = 400) => {
    c.fillStyle = color;
    c.font = `${weight} ${size}px "Segoe UI", sans-serif`;
    c.fillText(value, x, y);
  };
  if (kamino) {
    text("USDC lending", 76, 122, 55, "#e5f6ff", 600);
  } else {
  c.fillStyle = "#f4f6eb";
  c.beginPath(); c.roundRect(76, 66, 78, 78, 20); c.fill();
  if (logo) c.drawImage(logo, 87, 77, 56, 56);
  else text("?", 96, 122, 50, "#213b2b", 700);
  text(station.provider.toUpperCase(), 180, 122, station.provider.length > 12 ? 44 : 54, "#f2f5e9", 650);
  }
  text(`${String(station.id).padStart(2, "0")} / ${station.short}`, 1290, 122, 38, "#c1cbbf", 600);
  c.strokeStyle = (kamino ? "#3b4b63" : "#49604e"); c.lineWidth = 2;
  c.beginPath(); c.moveTo(76, 179); c.lineTo(1844, 179); c.stroke();
  text("POSITION VALUE", 76, 278, 44, (kamino ? "#98b0c1" : "#b5c5b5"));
  text(dollars(value), 67, 462, 190, (kamino ? "#e5f6ff" : "#f3f6ec"), 500);
  c.fillStyle = (kamino ? "#213c42" : "#2f4936");
  c.beginPath(); c.roundRect(78, 503, 630, 82, 41); c.fill();
  text(`${up ? "+" : "−"}${dollars(Math.abs(gain))}    ${up ? "+" : "−"}${(Math.abs(gain) / 10).toFixed(2)}%`, 110, 562, 48, green, 600);
  text("STARTED WITH", 1300, 279, 40, (kamino ? "#98b0c1" : "#b5c5b5"), 600);
  text("$10.00", 1296, 380, 92, (kamino ? "#e5f6ff" : "#f3f6ec"), 500);
  text(station.asset, 1300, 482, 46, "#d7e3ce", 600);
  text(station.method, 1300, 551, station.method.length > 19 ? 31 : 38, (kamino ? "#98b0c1" : "#b5c5b5"));
  const left = 82, right = 1820, top = 626, bottom = 878;
  for (let i = 0; i < 4; i++) {
    const y = top + i * (bottom - top) / 3;
    c.strokeStyle = (kamino ? "#293950" : "#314739"); c.lineWidth = 1;
    c.beginPath(); c.moveTo(left, y); c.lineTo(right, y); c.stroke();
  }
  const min = Math.min(...history) - 1, max = Math.max(...history) + 1;
  const points = history.map((v, i) => [left + i * (right - left) / (history.length - 1), bottom - (v - min) / (max - min) * (bottom - top)] as const);
  const fill = c.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, (kamino ? "#49afe930" : "#a9d88b30")); fill.addColorStop(1, (kamino ? "#49afe900" : "#a9d88b00"));
  c.beginPath(); c.moveTo(left, bottom);
  points.forEach(([x, y]) => c.lineTo(x, y));
  c.lineTo(right, bottom); c.closePath(); c.fillStyle = fill; c.fill();
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.lineWidth = 5; c.lineJoin = "round"; c.strokeStyle = kamino ? "#49afe9" : green; c.stroke();
  const final = points[points.length - 1];
  if (final) {
    c.beginPath(); c.arc(final[0], final[1], 10, 0, Math.PI * 2); c.fillStyle = kamino ? "#49afe9" : green; c.fill();
  }
  text("OPENING POSITION", 78, 951, 36, (kamino ? "#98b0c1" : "#aebfad"), 500);
  text("NOW", 1734, 951, 36, (kamino ? "#98b0c1" : "#aebfad"), 500);
  c.fillStyle = (kamino ? "#212c42" : "#243b2c"); c.fillRect(0, 1011, 1920, 149);
  c.beginPath(); c.arc(93, 1087, 9, 0, Math.PI * 2); c.fillStyle = running ? "#c8f5a4" : "#b8b4c3"; c.fill();
  text(running ? "SIMULATED FEED" : "SIMULATION PAUSED", 121, 1102, 40, "#d7e3ce", 600);
  text("ILLUSTRATIVE DATA", 1360, 1102, 37, (kamino ? "#98b0c1" : "#b5c5b5"));
  texture.needsUpdate = true;
}

export function paintOverview(texture: CanvasTexture, _histories: number[][], _running: boolean, live: LiveStudio) {
  const c = (texture.image as HTMLCanvasElement).getContext("2d")!;
  const ink = "#263b32", muted = "#63736b", purple = "#8961cf";
  const accounting = live.snapshot?.accounting?.data;
  const stale = live.stale || live.snapshot?.accounting?.status === "unavailable";
  c.fillStyle = "#f6f5ef"; c.fillRect(0, 0, 2560, 1280);
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 400) => {
    c.fillStyle = color; c.font = `${weight} ${size}px "Segoe UI", sans-serif`; c.fillText(value, x, y);
  };
  text("BELAC.FUN", 80, 110, 77, ink, 900);
  // The studio's purple eight-spoke mark lives inside the page header.
  c.strokeStyle = purple; c.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 4;
    c.beginPath(); c.moveTo(570 - Math.cos(angle) * 34, 82 - Math.sin(angle) * 34);
    c.lineTo(570 + Math.cos(angle) * 34, 82 + Math.sin(angle) * 34); c.stroke();
  }
  text("THE EXPERIMENT / ALL TEN POSITIONS", 725, 96, 35, muted, 500);
  c.textAlign = "right"; text("MAINNET · READ ONLY", 2480, 96, 31, muted, 500); c.textAlign = "left";
  c.strokeStyle = "#dce1d6"; c.lineWidth = 2; c.beginPath(); c.moveTo(80, 158); c.lineTo(2480, 158); c.stroke();
  text(`${stale ? "LAST KNOWN" : "CHALLENGE"} EQUITY · FEE POOL EXCLUDED`, 82, 226, 25, muted, 500);
  text(moneyUsd(accounting?.equityUsd), 72, 374, 148, ink, 550);
  text("STRATEGY P&L", 1060, 226, 30, muted, 500);
  text(pnlMoney(accounting?.pnlUsd), 1054, 335, 80, accounting && Number(accounting.pnlUsd) < 0 ? "#a15049" : ink, 500);
  text(`${moneyUsd(accounting?.allocatedUsd)} allocated · ${moneyUsd(accounting?.unallocatedUsdc)} unallocated`, 1062, 378, 28, muted);
  text("SEPARATE OPERATING RESERVE", 1900, 226, 27, muted, 500);
  text(accounting ? `${Number(accounting.feePool.availableSol).toFixed(8)} SOL` : "—", 1894, 326, 52, ink, 500);
  text("Network fees + rent tracked separately", 1900, 378, 27, muted);
  for (let col = 0; col < 2; col++) {
    const x = 80 + col * 1230;
    text("POSITION", x + 24, 459, 27, muted, 500);
    c.textAlign = "right";
    text("VALUE", x + 850, 459, 27, muted, 500);
    text("STATUS", x + 1100, 459, 27, muted, 500);
    c.textAlign = "left";
  }
  for (let i = 0; i < STATIONS.length; i++) {
    const station = STATIONS[i]!;
    const observation = live.snapshot?.platforms.find((p) => p.id === station.id)?.observation;
    const col = i < 5 ? 0 : 1, row = i % 5, x = 80 + col * 1230, y = 493 + row * 127;
    c.fillStyle = row % 2 === 0 ? "#eaece3" : "#f0f1ea";
    c.beginPath(); c.roundRect(x, y, 1170, 113, 12); c.fill();
    text(String(station.id).padStart(2, "0"), x + 24, y + 65, 33, purple, 600);
    text(station.provider, x + 105, y + 48, station.provider.length > 14 ? 36 : 41, ink, 600);
    text(station.method, x + 105, y + 88, 29, muted);
    c.textAlign = "right";
    text(moneyUsd(observation?.data?.performance?.equityUsd), x + 810, y + 69, 47, ink, 500);
    text(observation?.data?.performance ? statusLabel(observation, live.stale) : station.id === 9 ? "Pending" : "Execution off", x + 1135, y + 69, 29, muted, 500);
    c.textAlign = "left";
  }
  c.fillStyle = "#e9e3f3"; c.fillRect(0, 1170, 2560, 110);
  text(accounting ? `Operating costs ${accounting.feePool.networkFeesSol} SOL · account capital ${accounting.feePool.accountCapitalSol} SOL` : "Waiting for verified allocation data", 80, 1239, 29, ink, 500);
  c.textAlign = "right";
  text(feedLabel(live), 2480, 1239, 29, muted, 500);
  c.textAlign = "left";
  texture.needsUpdate = true;
}

export function labelTexture(title: string, subtitle: string, color = "#283c33", background = "#ecece2") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = background; c.fillRect(0, 0, 1024, 256);
  c.fillStyle = color; c.font = '600 92px "Segoe UI", sans-serif';
  c.fillText(title, 45, 118);
  c.font = '400 31px "Segoe UI", sans-serif'; c.fillText(subtitle, 49, 190);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
