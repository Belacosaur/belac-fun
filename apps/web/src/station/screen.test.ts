import {expect,it,vi} from "vitest";
import type {CanvasTexture} from "three";
import {paintOverview} from "./screen";
import type {LiveStudio} from "./live-data";
it("paints the recovered wallet balance and all ten closed, zero-value positions",()=>{
 const text:string[]=[];const noop=()=>{};
 const context={fillRect:noop,fillText:(s:string)=>text.push(s),beginPath:noop,roundRect:noop,fill:noop,stroke:noop,moveTo:noop,lineTo:noop};
 const texture={image:{getContext:()=>context},needsUpdate:false} as unknown as CanvasTexture;
 const live={stale:false,error:false,loading:false,refresh:vi.fn(),snapshot:{recovery:{complete:true},wallet:{data:{sol:"0.975157821",valueUsd:"103.05"}},platforms:Array.from({length:10},(_,i)=>({id:i+1,observation:{status:"empty",data:{closed:true,valueUsd:"0",positionCount:0,executionEnabled:false}}}))}} as unknown as LiveStudio;
 paintOverview(texture,[],false,live);
 expect(text).toContain("NEW WALLET BALANCE · RECOVERY COMPLETE");expect(text).toContain("$103.05");expect(text).toContain("0.975157821 SOL");
 expect(text.filter(t=>t==="Closed")).toHaveLength(10);expect(text.filter(t=>t==="$0.00")).toHaveLength(10);
 expect(text).not.toContain("Waiting for verified allocation data");expect(text).toContain("All positions closed · execution off");
});
