import {test,expect} from "@playwright/test";
test("recovery pins its destination and requires an extension wallet before any signing controls appear",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/recover");
 await expect(page.getByRole("heading",{name:"Exit and recover."})).toBeVisible();await expect(page.getByText("3nJzqZMc4WsGhCmD7vG2SmUzHDyD3Q58vxLbWUvUjSLX")).toBeVisible();
 await expect(page.getByRole("button",{name:"Connect old wallet"})).toBeDisabled();await expect(page.getByRole("button",{name:"Sign this step in Solflare"})).toHaveCount(0);
 await page.screenshot({path:"../../artifacts/recovery/review-desktop.png",fullPage:true});await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole("heading",{name:"Exit and recover."})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"../../artifacts/recovery/review-mobile.png",fullPage:true});expect(errors).toEqual([]);
});
