import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('Kamino shows a simulated proposal without inventing an allocation or profit',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const body=JSON.parse(await readFile(new URL('./fixtures/kamino-direct-studio.json',import.meta.url),'utf8'));
 body.data.generatedAt=new Date().toISOString();body.meta.stale=false;
 await page.route('**/v1/studio',route=>route.fulfill({json:body}));
 await page.setViewportSize({width:1600,height:1050});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/station');
 const scene=page.locator('.studio-scene');await expect(scene).toHaveAttribute('data-ready','true',{timeout:60000});
 await page.getByRole('button',{name:'Station 6: Kamino',exact:true}).click();await expect(scene).toHaveAttribute('data-active-station','6');
 const proposal=page.getByTestId('kamino-preparation');await expect(proposal).toContainText('Prepared · execution off');await expect(proposal).toContainText('10.000000 USDC');await expect(proposal).toContainText('Receipt tokens 0');await expect(proposal).toContainText('0.001488440 SOL');await expect(proposal).toContainText('0.000005000 SOL');
 await expect(page.getByTestId('strategy-pnl')).toHaveText('—');await expect(page.getByTestId('position-allocation')).toHaveCount(0);
 await expect(scene).toHaveAttribute('data-agent-pose','greeting',{timeout:15000});await page.screenshot({path:'../../artifacts/kamino/2026-10-21/direct/centre.png'});
 await page.getByRole('button',{name:'All positions',exact:false}).click();const rows=page.locator('.positions-table tbody tr');await expect(rows.nth(5)).toContainText('Prepared');await expect(rows.nth(5)).toContainText('Execution off');await expect(rows.nth(5)).not.toContainText('Allocation $10');await expect(rows.nth(8)).toContainText('Pending');await expect(page.getByTestId('fee-pool')).toContainText('0.021353240 SOL available');
 await page.screenshot({path:'../../artifacts/kamino/2026-10-21/direct/details.png'});expect(errors).toEqual([]);
});
