import {render,screen,fireEvent,waitFor,cleanup} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {readFile} from "node:fs/promises";
import {Recovery} from "./Recovery";
const mock=vi.hoisted(()=>({wallets:[] as unknown[],events:[] as string[],sign:vi.fn()}));
vi.mock("@wallet-standard/app",()=>({getWallets:()=>({get:()=>mock.wallets,on:()=>()=>undefined})}));
vi.mock("./recovery-wallet",()=>({validateRecoveryPlan:async()=>{},verifyRecoveryContext:async()=>{mock.events.push("validate");},verifyRecoverySignature:async()=>"public-signature",recoveryRpc:async()=>{mock.events.push("broadcast");return "public-signature";}}));
const fixture=JSON.parse(await readFile("../jobs/src/fixtures/recovery-orca-mainnet.json","utf8"));
beforeEach(()=>{mock.wallets=[];mock.events=[];mock.sign.mockReset();});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("pins the destination, requires the old account, and has no signing action before a reviewed simulation",()=>{
 render(<Recovery/>);expect(screen.getByRole("heading",{name:"Exit and recover."})).toBeInTheDocument();
 expect(screen.getByText("3nJzqZMc4WsGhCmD7vG2SmUzHDyD3Q58vxLbWUvUjSLX")).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Connect old wallet"})).toBeDisabled();
 expect(screen.queryByRole("button",{name:/Sign this step/})).not.toBeInTheDocument();
});
function owner(){
 const account={address:fixture.plan.source};mock.wallets=[{name:"Test Solflare",accounts:[account],features:{"standard:connect":{connect:async()=>({accounts:[account]})},"solana:signMessage":{signMessage:async()=>[{signature:new Uint8Array(64)}]},"solana:signTransaction":{signTransaction:async()=>{mock.events.push("wallet");return mock.sign();}}}}];
 let attempt:unknown=null;const plan={...fixture.plan,expiresAt:new Date(Date.now()+45000).toISOString()};
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>{let data:unknown;const path=url.split("/v1/")[1];mock.events.push(path!);
  if(path==="recovery/wallet/challenge")data={id:"nonce",message:"Login only"};else if(path==="recovery/wallet/session")data={token:"owner"};else if(path==="recovery/status")data={inventory:plan.before,attempt,history:[]};else if(path==="recovery/prepare"){attempt={id:plan.id,state:"ready",plan,signature:null,error:null};data=attempt;}else data={accepted:true};
  return new Response(JSON.stringify({data}),{status:200});
 }));
}
async function review(){render(<Recovery/>);fireEvent.click(screen.getByRole("button",{name:"Connect old wallet"}));await waitFor(()=>expect(screen.getByText("Live recovery inventory")).toBeInTheDocument());fireEvent.click(screen.getByRole("button",{name:"Prepare next step"}));await waitFor(()=>expect(screen.getByRole("button",{name:"Sign this step in Solflare"})).toBeEnabled());}
it("never broadcasts a rejected wallet signature and prevents another signing prompt",async()=>{
 owner();mock.sign.mockRejectedValue(new Error("Owner rejected"));await review();fireEvent.click(screen.getByRole("button",{name:"Sign this step in Solflare"}));await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("Owner rejected"));expect(mock.events).not.toContain("broadcast");expect(screen.queryByRole("button",{name:"Sign this step in Solflare"})).not.toBeInTheDocument();
});
it("persists the public signature before the browser broadcasts the owner-approved transaction",async()=>{
 owner();mock.sign.mockResolvedValue([{signedTransaction:new Uint8Array([1,2])}]);await review();fireEvent.click(screen.getByRole("button",{name:"Sign this step in Solflare"}));await waitFor(()=>expect(mock.events).toContain("broadcast"));const signature=mock.events.findIndex(x=>x.endsWith("/signature"));expect(signature).toBeGreaterThan(mock.events.indexOf("wallet"));expect(signature).toBeLessThan(mock.events.indexOf("broadcast"));
});
