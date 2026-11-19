import assert from "node:assert/strict";
import { test } from "node:test";
import type { Database } from "./queries.js";
import { buildNativeFunArchiveApp } from "./native-fun-archive.js";

const rows = [
  { id: "fixture", slug: "fixture", name: "Fixture", state: "active", is_illustrative: false },
];
const db = { async query(sql: string) {
  if (/from campaigns\s/i.test(sql)) return { rows };
  if (/distinct on/i.test(sql)) return { rows: [{slug:"entry",state:"active",provider_name:"Fixture",equity_usd:"10",pnl_usd:"2",pnl_pct:"20"}] };
  if (/from valuation_snapshots v/i.test(sql)) return { rows: [{challenge_id:"one",equity_usd:"10",observed_at:new Date("2026-01-01T00:00:00Z")}] };
  throw new Error("Unexpected SQL");
}};
test("homepage contract and access boundaries", async () => {
  const app = buildNativeFunArchiveApp(db as unknown as Database, {archiveAt:"2026-01-01T00:00:00Z"});
  try {
    const current = await app.inject("/v1/campaigns/current");
    assert.equal(current.statusCode, 200);
    assert.equal(current.headers["x-belac-archive-as-of"],"2026-01-01T00:00:00.000Z");
    assert.equal(current.json().meta.archiveMode,true);
    assert.equal(current.json().data.equityUsd, "10.00");
    const ranks = await app.inject("/v1/campaigns/fixture/leaderboard");
    assert.equal(ranks.statusCode, 200);
    assert.equal(ranks.json().data[0].rank, 1);
    assert.equal(ranks.json().data[0].netPnlUsd, "2.00");
    const timeline = await app.inject("/v1/campaigns/fixture/timeline");
    assert.equal(timeline.statusCode, 200);
    assert.equal(timeline.json().data[0].equityUsd, "10.00");
    const privateRead = await app.inject({url:"/v1/admin/audit",headers:{"x-belac-dev-user":"not-owner","x-belac-dev-role":"owner"}});
    assert.equal(privateRead.statusCode, 401);
    assert.equal(privateRead.headers["cache-control"], "private, no-store");
    assert.equal((await app.inject("/v1/admin/research/latest")).statusCode, 401);
    assert.equal((await app.inject({url:"/v1/admin/reconciliation/fixture/resolve",method:"POST"})).statusCode, 410);
    for(const url of ["/v1/studio","/v1/next-run","/v1/recovery","/v1/trades"]) {
      assert.ok([404,410].includes((await app.inject(url)).statusCode));
    }
  } finally { await app.close(); }
});
