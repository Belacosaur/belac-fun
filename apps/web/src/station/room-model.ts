import { CHALLENGE } from "../../../../packages/contracts/src/challenge";

export interface Station {
  id: number;
  provider: string;
  method: string;
  short: string;
  detail: string;
  asset: string;
  logo: string | null;
  color: string;
  value: number;
}

export const STATIONS: Station[] = CHALLENGE.map((station, index) => ({ ...station, value: [1140, 1080, 1025, 1010, 995, 1003, 930, 890, 850, 1000][index]! }));

export const ROOM_RADIUS = 13.8;
export const BAY_COUNT = 11;
export const STATION_SCALE = .85;
export const BAY_ANGLE = Math.PI * 2 / BAY_COUNT;

export function stationTransform(index: number) {
  const angle = index * BAY_ANGLE;
  return {
    position: [Math.sin(angle) * ROOM_RADIUS, 0, -Math.cos(angle) * ROOM_RADIUS] as [number, number, number],
    rotation: -angle,
  };
}

export function indexAtAngle(angle: number) {
  return ((Math.round(angle / BAY_ANGLE) % BAY_COUNT) + BAY_COUNT) % BAY_COUNT;
}

export function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// Illustration only: fixed-point cents, independent of the financial ledger.
export function initialRoomHistory() {
  return STATIONS.map((station) => Array.from({ length: 16 }, (_, i) =>
    station.id === 10 ? 1000 : Math.round(1000 + (station.value - 1000) * i / 15 + Math.sin(i * 2.3 + station.id) * (i === 0 || i === 15 ? 0 : 4))));
}

export function advanceRoom(histories: number[][], tick: number) {
  const steps = [1, 0, -1, 2, 0, -2, 1, 0];
  return histories.map((history, index) => {
    const last = history[history.length - 1] ?? 1000;
    const change = index === 9 ? 0 : steps[(tick + index * 3) % steps.length] ?? 0;
    return [...history.slice(-35), last + change];
  });
}

export function roomTotal(histories: number[][]) {
  return histories.reduce((total, history) => total + (history[history.length - 1] ?? 1000), 0);
}
