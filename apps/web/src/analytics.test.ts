import { describe, expect, it } from "vitest";
import { track } from "./analytics";

describe("analytics", () => {
  it("sends nothing without an id or when do not track is set", () => {
    expect(track("view", {}, { analyticsId: "" })).toBeNull();
    expect(track("view", {}, { analyticsId: "abc", doNotTrack: "1" })).toBeNull();
    expect(track("view", { page: "home" }, { analyticsId: "abc" })?.eventName).toBe("view");
  });
});