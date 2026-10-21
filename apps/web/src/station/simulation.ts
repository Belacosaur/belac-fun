// Illustrative cents only. This preview never reads or writes the financial ledger.
export const sampleHistory = [1000, 1000, 1001, 1000, 1001, 1001, 1002, 1002, 1001, 1002, 1003, 1002, 1003];
const sampleSteps = [0, 1, 0, 0, -1, 1, 0, 1, 0, -1, 0, 1];

export function nextSample(history: number[], tick: number): number[] {
  const last = history[history.length - 1] ?? 1000;
  return [...history.slice(-35), last + (sampleSteps[tick % sampleSteps.length] ?? 0)];
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type CameraView = "centre" | "birdseye";
