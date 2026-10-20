import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "./App";

const routes: Array<[path: string, heading: string]> = [
  ["/", "Home"],
  ["/challenge", "Challenge"],
  ["/challenge/sample", "Challenge"],
  ["/leaderboard", "Leaderboard"],
  ["/episodes", "Episodes"],
  ["/episodes/sample", "Episode"],
  ["/methodology", "Methodology"],
  ["/about", "About"],
  ["/status", "Status"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/admin", "Admin"],
];

describe("routes", () => {
  it.each(routes)("%s renders %s", (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });
});
