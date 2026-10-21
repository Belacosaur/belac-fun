const day = 86_400_000;
export function researchInterval(raw?: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(7 * day, Math.max(3_600_000, n)) : day;
}
export function nextResearchDelay(interval: number, lastCompleted: number, now: number, failures: number): number {
  if (failures) return 300_000;
  if (!lastCompleted) return 300_000;
  return Math.max(1000, interval - (now - lastCompleted));
}
