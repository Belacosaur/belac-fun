import {afterEach,expect,it,vi} from "vitest";
import {readFile} from "node:fs/promises";
import {syncStudio} from "./studio-sync.js";
import {readSolEntry} from "./entry-sol.js";
import {CHALLENGE} from "../../../packages/contracts/src/challenge.js";
import type {StudioSnapshot} from "../../../packages/contracts/src/studio.js";
import type {StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
vi.mock("./entry-sol.js",()=>({readSolEntry:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks();});
it("keeps destination-wallet history when the configured address still points to the recovered source",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockRejectedValue(Error("offline")));const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8")),inventory=fixture.plan.after;
 const performance={stationId:1,entrySignature:"confirmed-entry",history:[{at:"2026-10-20T00:00:00Z",valueUsd:"10"}]};const previous={version:1,address:inventory.destination,network:"mainnet-beta",generatedAt:"before",wallet:{status:"ready",data:{sol:"0.01",slot:1,tokens:[],valueUsd:null,unpricedAssets:1,recentTransactions:[]},lastSuccessAt:"before"},platforms:[{id:1,strategyKey:CHALLENGE[0]!.key,provider:CHALLENGE[0]!.provider,observation:{status:"ready",data:{status:"ready",valueUsd:"10",positionCount:1,detail:"prior",performance},lastSuccessAt:"before"}}]} as unknown as StudioSnapshot;
 vi.mocked(readSolEntry).mockResolvedValue({status:"ready",valueUsd:"10.01",positionCount:1,detail:"WSOL hold",executionEnabled:false});const r={wallet:inventory.destination,stationId:1,signature:"confirmed-entry",plan:{wallet:inventory.destination,stationId:1}} as StationEntryReceipt;
 const next=await syncStudio(inventory.source,"https://rpc.example",previous,{recovery:{inventory,complete:true},entryReceipts:[r]});expect(next.address).toBe(inventory.destination);expect(next.wallet.data).toBe(previous.wallet.data);expect(readSolEntry).toHaveBeenCalledWith(r,"https://rpc.example",performance,expect.any(String));expect(next.platforms.find(p=>p.id===1)?.observation.data?.positionCount).toBe(1);expect(next.platforms.find(p=>p.id===6)?.observation.data?.closed).toBe(true);expect(next.accounting).toBeUndefined();
});
it("does not observe new entry receipts while recovery remains incomplete",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockRejectedValue(Error("offline")));const fixture=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));await syncStudio(fixture.plan.source,"https://rpc.example",undefined,{recovery:{inventory:fixture.plan.after,complete:false},entryReceipts:[{wallet:fixture.plan.destination,stationId:1} as StationEntryReceipt]});expect(readSolEntry).not.toHaveBeenCalled();
});
