import { test, expect } from "@playwright/test";

test("bird's-eye supports orbit, zoom, pan and reset without breaking station visits", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/station");
  const scene = page.locator(".studio-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.getByRole("button", { name: "Refresh data" }).click();
  await page.screenshot({ path: "../../artifacts/orbital-centre.png" });
  await page.getByRole("button", { name: /Bird.s-eye/ }).click();
  const marker = page.getByRole("button", { name: "Visit Jupiter Swap", exact: true });
  const point = async () => {
    const bounds = await marker.boundingBox();
    if (!bounds) throw new Error("Projected station marker is missing");
    return { x: bounds.x, y: bounds.y };
  };
  const distanceFrom = async (origin: { x: number; y: number }) => {
    // A software-rendered WebGL frame can take seconds under tracing. Read one
    // coherent box per sample instead of spending the timeout on two queries.
    const current = await point();
    return Math.hypot(current.x - origin.x, current.y - origin.y);
  };
  await expect(marker).toBeVisible();
  await page.screenshot({ path: "../../artifacts/orbital-birdseye.png" });
  const original = await point();
  const drag = async (button: "left" | "right", dx: number, dy: number) => {
    await page.mouse.move(220, 320);
    await page.mouse.down({ button });
    await page.mouse.move(220 + dx, 320 + dy, { steps: 12 });
    await page.mouse.up({ button });
  };
  await drag("left", 240, 80);
  await expect.poll(() => distanceFrom(original), { timeout: 15000 }).toBeGreaterThan(20);
  const rotated = await point();
  await page.mouse.move(220, 320);
  await page.mouse.wheel(0, -450);
  await expect.poll(() => distanceFrom(rotated), { timeout: 15000 }).toBeGreaterThan(10);
  const zoomed = await point();
  await drag("right", 100, 60);
  await expect.poll(() => distanceFrom(zoomed), { timeout: 15000 }).toBeGreaterThan(20);
  await page.screenshot({ path: "../../artifacts/room-camera-orbit.png" });
  await page.getByRole("button", { name: /Reset view/ }).click();
  await expect.poll(() => distanceFrom(original), { timeout: 15000 }).toBeLessThan(2);
  // Space has no floor boundary: visitors can inspect the platform's underside.
  await page.mouse.move(220, 650);
  await page.mouse.down();
  await page.mouse.move(220, 390, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".room-map-label")).toHaveCount(0);
  await page.screenshot({ path: "../../artifacts/orbital-underside.png" });
  await page.getByRole("button", { name: /Reset view/ }).click();
  await page.getByRole("button", { name: "Station 6: Kamino", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view", "centre");
  await expect(scene).toHaveAttribute("data-active-station", "6");
  await expect(scene).toHaveAttribute("data-agent-pose", "greeting", { timeout: 15000 });
  await page.getByRole("button", { name: /Bird.s-eye/ }).click();
  await expect(page.locator(".room-map-label")).toHaveCount(11);
  // A sky-only region stays still with reduced motion, then drifts when enabled.
  const sky = { x: 1350, y: 110, width: 180, height: 180 };
  const still = await page.screenshot({ clip: sky });
  await page.waitForTimeout(1000);
  expect((await page.screenshot({ clip: sky })).equals(still)).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const moving = await page.screenshot({ clip: sky });
  await expect.poll(async () => (await page.screenshot({ clip: sky })).equals(moving), { timeout: 10000 }).toBe(false);
  expect(errors).toEqual([]);
});
