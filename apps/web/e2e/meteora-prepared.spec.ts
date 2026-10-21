import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("Meteora proposal stays separate from the three funded positions and SOL reserve", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const body = JSON.parse(await readFile(new URL("./fixtures/meteora-prepared-studio.json", import.meta.url), "utf8"));
  body.data.generatedAt = new Date().toISOString(); body.meta.stale = false;
  await page.route("**/v1/studio", route => route.fulfill({ json: body }));
  await page.setViewportSize({ width: 1600, height: 1050 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/station"); const scene = page.locator(".studio-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect(page.getByRole("status")).toContainText("3 live positions", { timeout: 30000 });
  await page.getByRole("button", { name: "Station 5: Meteora", exact: true }).click();
  await expect(scene).toHaveAttribute("data-active-station", "5");
  const proposal = page.getByTestId("meteora-preparation");
  await expect(proposal).toContainText("Prepared · execution off");
  await expect(proposal).toContainText("Maximum spend 9.936462 USDC");
  await expect(proposal).toContainText("0.007223760 SOL");
  await expect(proposal).toContainText("no funded Meteora position");
  await expect(page.getByTestId("strategy-pnl")).toHaveText("—");
  await page.screenshot({ path: "../../artifacts/meteora/2026-10-21/prepared-centre.png" });
  await page.getByRole("button", { name: "All positions", exact: false }).click();
  const row = page.locator(".positions-table tbody tr").nth(4);
  await expect(row).toContainText("Prepared · execution off"); await expect(row).not.toContainText("Live position");
  await expect(page.getByTestId("fee-pool")).toContainText("0.019859400 SOL available");
  await expect(page.locator(".positions-total")).toContainText("$70.00");
  expect(errors).toEqual([]);
});
