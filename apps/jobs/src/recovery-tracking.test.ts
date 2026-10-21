import {expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import {applyRecoveryTracking} from "./recovery-tracking.js";
import type {StudioSnapshot} from "../../../packages/contracts/src/studio.js";
const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));
it("removes stale active positions and P&L after closure, preserving the recovery source and destination",()=>{
 const snapshot={version:1,address:fixture.plan.source,network:"mainnet-beta",generatedAt:"old",wallet:{},accounting:{data:{equityUsd:"100"}},platforms:[{id:8,observation:{data:{performance:{equityUsd:"10"}}}},{id:6,observation:{data:{performance:{equityUsd:"10"}}}}]} as unknown as StudioSnapshot;
 const result=applyRecoveryTracking(snapshot,fixture.plan.after,false);
 expect(result.accounting).toBeUndefined();expect(result.platforms[0]?.observation.data?.performance).toBeUndefined();expect(result.platforms[0]?.observation.data?.closed).toBe(true);
 expect(result.platforms[1]?.observation.data?.closed).toBe(false);expect(result.recovery?.inventory.destination).toBe(fixture.plan.destination);
});
