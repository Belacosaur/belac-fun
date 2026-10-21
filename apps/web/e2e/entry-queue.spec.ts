import {expect,test} from "@playwright/test";
test("owner review queue keeps paused and proposal stations inert",async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto("/station");
 await page.getByRole("button",{name:"Connect wallet / trade review ↗"}).click();
 const dialog=page.getByRole("dialog",{name:"Review each position"});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole("button",{name:"Prepare fresh $10 review"})).toHaveCount(3);
 for(const button of await dialog.getByRole("button",{name:"Prepare fresh $10 review"}).all())await expect(button).toBeDisabled();
 await expect(dialog.getByText("Paused",{exact:true})).toHaveCount(2);
 await expect(dialog.getByText("Proposal · WAIT",{exact:true})).toHaveCount(3);
 await expect(dialog.getByText("Pending",{exact:true})).toHaveCount(1);
 await page.screenshot({path:"../../artifacts/entries/approval-queue.png"});
 await dialog.getByRole("button",{name:"Close position reviews"}).click();await expect(dialog).not.toBeVisible();
});
