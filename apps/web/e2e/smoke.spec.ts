import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const summary = {
  slug: "demo",
  name: "Demo",
  state: "draft",
  equityUsd: "20.30",
  coverage: { valued: 1, total: 2 },
  isIllustrative: true,
};

const row = {
  rank: 1,
  slug: "hold",
  state: "live",
  providerName: "Jupiter",
  allocationUsd: "10",
  equityUsd: "10.20",
  netPnlUsd: "0.20",
  returnPct: "2.00",
  quality: "manual_evidence",
  isIllustrative: true,
  asOf: "2026-10-20T00:00:00.000Z",
};

async function stubApi(page: import("@playwright/test").Page, bodyFor: (path: string) => unknown) {
  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: bodyFor(url.pathname), meta: { asOf: "2026-10-20T00:00:00.000Z", quality: "unverified", requestId: "e2e" } }),
    });
  });
}

test("home shows illustrative or not-started copy", async ({ page }) => {
  await stubApi(page, (path) => (path.endsWith("/leaderboard") ? [row] : summary));
  await page.goto("/");
  await expect(page.getByText("Sample data. Not a real result.")).toBeVisible();
  await expect(page.getByText("The challenge has not started.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("NaN");
});

test("leaderboard opens a challenge with a source badge", async ({ page }) => {
  await stubApi(page, (path) => {
    if (path.endsWith("/leaderboard")) {
      return [row];
    }
    if (path.endsWith("/transactions")) {
      return { items: [] };
    }
    if (path.endsWith("/sources") || path.endsWith("/timeline")) {
      return path.endsWith("/timeline")
        ? [
            { at: "2026-10-20T00:00:00.000Z", equityUsd: "10.20", coverage: { valued: 1, total: 2 } },
            { at: "2026-10-21T00:00:00.000Z", equityUsd: null, coverage: { valued: 0, total: 2 } },
          ]
        : [];
    }
    if (path.includes("/challenges/")) {
      return {
        slug: "hold",
        provider: { slug: "jupiter", name: "Jupiter" },
        state: "live",
        allocationUsd: "10",
        equityUsd: null,
        netPnlUsd: null,
        returnPct: null,
        quality: "manual_evidence",
        isIllustrative: true,
        asOf: "2026-10-20T00:00:00.000Z",
      };
    }
    return summary;
  });
  await page.goto("/leaderboard");
  await page.getByRole("link", { name: "Jupiter" }).click();
  await expect(page.getByText("manual_evidence")).toBeVisible();
  await expect(page.getByText("Value unavailable")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("NaN");
});

test("axe finds no serious violations on home and a challenge", async ({ page }) => {
  await stubApi(page, (path) => (path.endsWith("/leaderboard") ? [row] : path.endsWith("/transactions") ? { items: [] } : path.endsWith("/sources") ? [] : path.endsWith("/timeline") ? [] : path.includes("/challenges/") ? {
    slug: "hold",
    provider: { slug: "jupiter", name: "Jupiter" },
    state: "live",
    allocationUsd: "10",
    equityUsd: "10.20",
    netPnlUsd: "0.20",
    returnPct: "2",
    quality: "manual_evidence",
    isIllustrative: true,
    asOf: "2026-10-20T00:00:00.000Z",
  } : path.endsWith("/timeline") ? [] : path.endsWith("/transactions") ? { items: [] } : path.endsWith("/sources") ? [] : summary));
  await page.goto("/");
  const home = await new AxeBuilder({ page }).analyze();
  expect(home.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  await page.goto("/challenge/hold");
  const challenge = await new AxeBuilder({ page }).analyze();
  expect(challenge.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});
