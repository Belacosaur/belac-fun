import { test, expect } from "@playwright/test";
import { STATIONS } from "../src/station/room-model";

test("all branded stations render and greet with the shared layout", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/station/") && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/station");
  const scene = page.locator(".studio-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.getByRole("button", { name: "Pause simulation" }).click();
  for (const station of STATIONS) {
    await page.getByRole("button", { name: `Station ${station.id}: ${station.provider}`, exact: true }).click();
    await expect(scene).toHaveAttribute("data-active-station", String(station.id));
    await expect(scene).toHaveAttribute("data-agent-pose", "greeting", { timeout: 15000 });
    // Capture each canvas to review logo contrast, long headings and character clearance.
    await page.screenshot({ path: `../../artifacts/station-branding-${station.id}.png` });
  }
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(scene).toHaveAttribute("data-active-station", "0");
  await page.screenshot({ path: "../../artifacts/station-branding-overview.png" });
  await page.getByRole("button", { name: /Bird.s-eye/ }).click();
  await expect(scene).toHaveAttribute("data-view", "birdseye");
  await expect(page.locator(".room-map-label")).toHaveCount(11);
  await page.screenshot({ path: "../../artifacts/station-branding-room.png" });
  expect(errors).toEqual([]);
});
