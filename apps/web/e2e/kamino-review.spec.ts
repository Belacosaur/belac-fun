import { test, expect } from "@playwright/test";

test("Kamino composition can be reviewed from the centre and at 45 degrees", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.goto("/station");
  const scene = page.locator(".studio-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.getByRole("button", { name: "Station 6: Kamino", exact: true }).click();
  await expect(scene).toHaveAttribute("data-active-station", "6", { timeout: 15000 });
  await expect(scene).toHaveAttribute("data-agent-pose", "greeting", { timeout: 15000 });
  await page.screenshot({ path: "../../artifacts/kamino-composition-centre.png" });
  await page.getByRole("button", { name: /Bird.s-eye/ }).click();
  await expect(scene).toHaveAttribute("data-view", "birdseye");
  await expect(scene).toHaveAttribute("data-agent-pose", "working", { timeout: 15000 });
  await expect(page.locator(".room-map-label")).toHaveCount(11);
  await page.waitForTimeout(2800);
  await page.screenshot({ path: "../../artifacts/kamino-composition-45.png" });
  await page.getByRole("button", { name: "Centre view" }).click();
  await expect(scene).toHaveAttribute("data-agent-pose", "greeting", { timeout: 15000 });
  await page.getByRole("button", { name: "Station 5: Meteora", exact: true }).click();
  await expect(scene).toHaveAttribute("data-active-station", "5", { timeout: 15000 });
  await expect(page.getByRole("button", { name: "45° station", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(scene).toHaveAttribute("data-active-station", "0", { timeout: 15000 });
  await page.getByRole("button", { name: /Bird.s-eye/ }).click();
  await page.waitForTimeout(3200);
  await page.screenshot({ path: "../../artifacts/command-room.png" });
  expect(errors).toEqual([]);
});


test("the custom operator renders for close inspection", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1400, height: 1100 });
  await page.goto("http://127.0.0.1:5186/operator-review.html");
  await expect(page.locator(".label")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "../../artifacts/caleb-robot.png" });
  expect(errors).toEqual([]);
});

test("expanded room frames the overview and keyboard-only command desk", async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/station");
  await expect(page.locator(".studio-scene")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.locator(".studio-scene")).toHaveAttribute("data-active-station", "0");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.getByRole("button", { name: /Bird.s-eye/ }).click();
  await expect(page.locator(".room-map-label")).toHaveCount(11);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "../../artifacts/command-room.png" });
});
