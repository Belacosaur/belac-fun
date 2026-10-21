import { expect, test } from "@playwright/test";

test("SOL and Orca show attributed positions, P&L and a separate operating reserve", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[]=[]; page.on("pageerror", e=>errors.push(e.message));
  await page.setViewportSize({width:1600,height:1050}); await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/station");
  const scene=page.locator(".studio-scene");
  await expect(scene).toHaveAttribute("data-ready","true",{timeout:60000});
  await expect(page.getByRole("status")).toContainText("3 live positions",{timeout:30000});
  await expect(page.locator(".studio-footer")).toContainText("CHALLENGE EQUITY");
  await expect(page.getByTestId("strategy-pnl")).not.toHaveText("—");
  await page.screenshot({path:"../../artifacts/active-overview.png"});
  await page.getByRole("button",{name:"All positions",exact:false}).click();
  const rows=page.locator(".positions-table tbody tr"); await expect(rows).toHaveCount(10);
  await expect(rows.nth(0)).toContainText("0.093680067 SOL"); await expect(rows.nth(0)).toContainText("Allocation $10.00");
  await expect(rows.nth(7)).toContainText("Allocation $10.00"); await expect(rows.nth(7)).toContainText("0.077548 USDC + 0.000209636 WSOL");
  await expect(rows.nth(7)).toContainText("Live position");
  await expect(page.getByTestId("fee-pool")).toContainText("0.019859400 SOL available");
  await expect(rows.nth(1)).toContainText("Execution off"); await expect(rows.nth(8)).toContainText("Pending");
  await page.screenshot({path:"../../artifacts/active-allocations.png"});
  await page.getByRole("button",{name:"Close positions"}).click();
  for(const [id,name,file] of [[1,"Jupiter Swap","sol"],[8,"Orca","orca"]] as const){
    await page.getByRole("button",{name:`Station ${id}: ${name}`,exact:true}).click();
    await expect(scene).toHaveAttribute("data-active-station",String(id));
    await expect(scene).toHaveAttribute("data-agent-pose","greeting",{timeout:15000});
    await expect(page.getByTestId("position-allocation")).toContainText("Allocation $10.00");
    await expect(page.getByTestId("strategy-pnl")).not.toHaveText("—");
    await page.screenshot({path:`../../artifacts/active-${file}-centre.png`});
  }
  await page.getByRole("button",{name:/Bird.s-eye/}).click();
  await expect(scene).toHaveAttribute("data-view","birdseye");
  await expect(page.getByRole("button",{name:"Visit Orca",exact:true})).toContainText("$");
  await expect(page.getByRole("button",{name:"Visit Jupiter Swap",exact:true})).toContainText("$");
  await expect(page.getByRole("button",{name:"Visit Raydium",exact:true})).toContainText("Execution off");
  await page.screenshot({path:"../../artifacts/active-birdseye.png"});
  expect(errors).toEqual([]);
});
