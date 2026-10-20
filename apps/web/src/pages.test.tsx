import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Client } from "./api";
import { App } from "./App";
import { PreviewForm } from "./admin-screens";
import { EquityChart } from "./Chart";

const summary = {
  slug: "demo",
  name: "Demo",
  state: "active",
  equityUsd: "20.30",
  netPnlUsd: "0.30",
  coverage: { valued: 2, total: 2 },
  isIllustrative: true,
};

function client(map: Record<string, unknown>): Client {
  return {
    async get<T>(path: string): Promise<T> {
      const key = Object.keys(map).find((item) => path.startsWith(item));
      if (!key) {
        throw new Error(path);
      }
      return map[key] as T;
    },
    async post() {
      throw new Error("post");
    },
  };
}

describe("public pages", () => {
  it("shows the illustrative banner and portfolio total", async () => {
    render(
      <MemoryRouter>
        <App
          client={client({
            "/v1/campaigns/current": summary,
            "/v1/campaigns/demo/leaderboard": [
              {
                rank: 1,
                slug: "hold",
                providerName: "Jupiter",
                allocationUsd: "10",
                equityUsd: "10.20",
                netPnlUsd: "0.20",
                returnPct: "2.00",
                state: "live",
                quality: "manual_evidence",
                isIllustrative: true,
                asOf: "2026-10-20T00:00:00.000Z",
              },
            ],
          })}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Sample data. Not a real result.")).toBeInTheDocument();
    expect(screen.getByText(/20\.30|\$20\.30/)).toBeInTheDocument();
  });

  it("opens the mobile menu", async () => {
    render(
      <MemoryRouter>
        <App client={client({ "/v1/campaigns/current": { ...summary, state: "draft", isIllustrative: false } })} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("link", { name: "Methodology" })).toBeVisible();
  });

  it("labels chart gaps", () => {
    render(
      <EquityChart
        points={[
          { at: "2026-10-20T00:00:00.000Z", equityUsd: "100", coverage: { valued: 1, total: 1 } },
          { at: "2026-10-21T00:00:00.000Z", equityUsd: null, coverage: { valued: 0, total: 1 } },
        ]}
      />,
    );
    expect(screen.getByText("Gap")).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });
});

describe("admin preview", () => {
  it("shows the next equity from the preview response", async () => {
    render(
      <PreviewForm
        client={{
          async get() {
            throw new Error("get");
          },
          async post<T>() {
            return { nextEquityUsd: "11.00" } as T;
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByText("Next equity 11.00")).toBeInTheDocument();
  });
});

describe("share", () => {
  it("confirms a copied link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <MemoryRouter initialEntries={["/episodes/day-1"]}>
        <App client={client({ "/v1/content/day-1": { slug: "day-1", title: "Day 1", embedUrl: "https://example.com/v" } })} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
