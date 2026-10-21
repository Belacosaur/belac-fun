import {expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import {recoveryRent} from "./recovery-store.js";
const f=JSON.parse(await readFile(new URL("./fixtures/recovery-orca-mainnet.json",import.meta.url),"utf8"));
it("counts the native rent reserve, not unsynced SOL deposits, when unwrapping WSOL",()=>{
 const p={...f.plan,closedAccounts:["wsol"],before:{...f.plan.before,accounts:[{address:"wsol",mint:"So11111111111111111111111111111111111111112",amount:"600",lamports:"1000",nativeRentLamports:"200"}]}};
 expect(recoveryRent(p,["wsol"],[1000],[0])).toBe(200n);
});
