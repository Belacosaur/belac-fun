import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { copy } from "./copy";
import { Money } from "./Money";

describe("copy", () => {
  it("includes each required string", () => {
    for (const value of Object.values(copy)) {
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toContain("NaN");
    }
    expect(copy.illustrative).toBe("Sample data. Not a real result.");
    expect(copy.wiped).toContain("$10");
  });
});

describe("Money", () => {
  it("shows unknown instead of zero", () => {
    render(<Money value={null} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows a positive sign", () => {
    render(<Money value="1" />);
    expect(screen.getByText(/\+/)).toBeInTheDocument();
  });
});
