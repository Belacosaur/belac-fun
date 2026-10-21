import type { Station } from "./room-model";

export interface StationTheme {
  ink: string;
  accent: string;
  chart: string;
  wash: string;
  hardware: string;
  robot: string;
  background: string;
  dark: boolean;
  foreground?: string;
  muted?: string;
  positive?: string;
  negative?: string;
}

// Accent colours checked against official public sites on 2026-10-20.
// Screen palettes follow the platform interfaces; light washes tint the studio furniture.
// Logos retain their original colours; their provenance is in public/station/logo-sources.json.
const themes: Record<string, StationTheme> = {
  // Orca's public site uses a yellow mark; Ript tokens match its deployed web app.
  orca: { ink: "#26251e", accent: "#ffce4f", chart: "#ffce4f", wash: "#faf4df", hardware: "#29281f", robot: "#ede0b3", background: "#171714", dark: true },
  ript: { ink: "#05070a", accent: "#ff7a1a", chart: "#ff9d3d", wash: "#fff0e3", hardware: "#0f1219", robot: "#f0c9a8", background: "#05070a", dark: true, foreground: "#f4f1ec", muted: "#b8b2aa" },
  // https://jup.ag — primary green / dark green interface
  jupiter: { ink: "#182921", accent: "#acf47d", chart: "#acf47d", wash: "#edf5e7", hardware: "#1b2621", robot: "#d4e8c4", background: "#0c1418", dark: true },
  // https://axiom.trade — Start Trading button rgb(82,111,255)
  axiom: { ink: "#181c30", accent: "#526fff", chart: "#526fff", wash: "#edf0ff", hardware: "#181c30", robot: "#cbd3f4", background: "#08090d", dark: true },
  // https://www.pacifica.fi — ocean blue / ice cyan
  pacifica: { ink: "#082c3a", accent: "#61d7ef", chart: "#61d7ef", wash: "#e8f6fa", hardware: "#143242", robot: "#c2e7ee", background: "#07111c", dark: true },
  // BULK trading interface, sampled from the user's 2026-10-20 reference.
  bulk: { ink: "#2b2a25", accent: "#97868a", chart: "#c6b6ba", wash: "#edece3", hardware: "#2b2a25", robot: "#e5dfd1", background: "#37352b", dark: true, foreground: "#fffeef", muted: "#c6b6ba", positive: "#02ffe3", negative: "#ff866f" },
  // https://www.meteora.ag — --dt-button-primary
  meteora: { ink: "#1e1f35", accent: "#f54b00", chart: "#f55832", wash: "#fff0e8", hardware: "#2a2a38", robot: "#f1cfb9", background: "#181825", dark: true },
  // Kamino lending interface, sampled from the user's 2026-10-20 reference.
  kamino: { ink: "#1c2d4b", accent: "#5cc5ff", chart: "#85ffff", wash: "#e5eef3", hardware: "#263f60", robot: "#c2e6ff", background: "#21304f", dark: true, foreground: "#f7f8ff", muted: "#aac8e6", positive: "#85ffff" },
  // https://pump.fun — --color-bg-accent / --color-text-on-accent
  pump: { ink: "#052e16", accent: "#86efac", chart: "#86efac", wash: "#e9f8ed", hardware: "#18191b", robot: "#c8ebd2", background: "#111113", dark: true },
  // https://raydium.io — --brand-gradient endpoints
  raydium: { ink: "#181f35", accent: "#7748fc", chart: "#22d1f8", wash: "#f0ecfc", hardware: "#1c243e", robot: "#d6cdf2", background: "#0b1022", dark: true },
  // https://trojan.com — monochrome horse, black surface, #f7f8f9 type
  trojan: { ink: "#161a20", accent: "#737c87", chart: "#f7f8f9", wash: "#edf0f3", hardware: "#1b2027", robot: "#d9dde2", background: "#03070a", dark: true },
};

const wildcard: StationTheme = { ink: "#343b37", accent: "#a7b2a6", chart: "#657563", wash: "#eef1eb", hardware: "#39443c", robot: "#d9dfd2", background: "#f5f7f2", dark: false };

export function stationTheme(station: Station): StationTheme {
  return themes[station.logo ?? ""] ?? wildcard;
}
