import { describe, expect, it } from "vitest";
import { STATIONS, stationTransform, indexAtAngle, shortestAngle, initialRoomHistory, advanceRoom, roomTotal, ROOM_RADIUS } from "./room-model";

describe("circular studio", () => {
  it("has ten unique initiatives plus an evenly spaced, inward-facing overview bay", () => {
    expect(STATIONS).toHaveLength(10);
    expect(new Set(STATIONS.map((s) => s.id)).size).toBe(10);
    for (let i = 0; i < 11; i++) {
      const { position, rotation } = stationTransform(i);
      expect(Math.hypot(position[0], position[2])).toBeCloseTo(ROOM_RADIUS);
      // Local +Z is the front of every monitor, pointing back at the central seat.
      expect(Math.sin(rotation) * -position[0] + Math.cos(rotation) * -position[2]).toBeCloseTo(ROOM_RADIUS);
      const next = stationTransform((i + 1) % 11).position;
      expect(Math.hypot(position[0] - next[0], position[2] - next[2])).toBeGreaterThan(5.65 * .85);
    }
    expect(stationTransform(0).position[2]).toBeLessThan(0);
  });
  it("wraps navigation across the overview and takes the short turn across north", () => {
    expect(indexAtAngle(-2 * Math.PI / 11)).toBe(10);
    expect(indexAtAngle(2 * Math.PI)).toBe(0);
    expect(shortestAngle(2 * Math.PI - .1, .1)).toBeCloseTo(.2);
  });
  it("keeps the overview equal to all ten positions and leaves the wildcard reserved", () => {
    let histories = initialRoomHistory();
    for (let tick = 0; tick < 30; tick++) histories = advanceRoom(histories, tick);
    expect(roomTotal(histories)).toBe(histories.reduce((sum, h) => sum + h[h.length - 1]!, 0));
    expect(histories[9]!.every((value) => value === 1000)).toBe(true);
    expect(histories.every((h) => h.every(Number.isInteger))).toBe(true);
  });
});
