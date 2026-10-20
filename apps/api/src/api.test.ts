import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { applyMigrations } from "@belac/db/migrate";
import { seed } from "@belac/db/seed";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildApp } from "./app.js";
import { campaignEquity, rankRows } from "./queries.js";

describe("campaign math", () => {
  it("sums 10.10 and 10.20 as 20.30 and keeps a null out of the sum", () => {
    const totals = campaignEquity([
      { equity_usd: "10.10" },
      { equity_usd: "10.20" },
      { equity_usd: null },
    ]);
    expect(totals.equityUsd).toBe("20.30");
    expect(totals.coverage).toEqual({ valued: 2, total: 3 });
  });

  it("ranks decimal ties as 1, 1, 3 and 1, 2, 2, 4", () => {
    const tiedLead = rankRows(
      [{ pnl_usd: "10.00" }, { pnl_usd: "10.0" }, { pnl_usd: "9.00" }],
      "pnl_usd",
    ).map((row) => row.rank);
    expect(tiedLead).toEqual([1, 1, 3]);
    const tiedMiddle = rankRows(
      [{ pnl_usd: "8" }, { pnl_usd: "10" }, { pnl_usd: "9.00" }, { pnl_usd: "9" }],
      "pnl_usd",
    ).map((row) => row.rank);
    expect(tiedMiddle).toEqual([1, 2, 2, 4]);
  });
});

describe("openapi", () => {
  it("lists public routes and hides the documentation UI in production", async () => {
    const local = buildApp({ APP_ENV: "local" });
    const specResponse = await local.inject({ method: "GET", url: "/openapi.json" });
    const spec = specResponse.json() as { paths?: Record<string, unknown> };
    expect(spec.paths?.["/v1/campaigns/current"]).toBeDefined();
    expect(spec.paths?.["/v1/campaigns/{slug}/leaderboard"]).toBeDefined();
    const ui = await local.inject({ method: "GET", url: "/documentation" });
    expect(ui.statusCode).toBe(200);
    await local.close();
    const production = buildApp({ APP_ENV: "production" });
    const hidden = await production.inject({ method: "GET", url: "/documentation" });
    expect(hidden.statusCode).toBe(404);
    await production.close();
  });
});

describe("api", () => {
  it("returns a validation envelope for a bad query", async () => {
    const app = buildApp({ APP_ENV: "local", ALLOWED_ORIGINS: "http://localhost:5173" });
    const response = await app.inject({
      method: "GET",
      url: "/v1/campaigns/demo/leaderboard?metric=nope",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
    expect(response.json().error.requestId).toEqual(expect.any(String));
    await app.close();
  });

  it("rejects anonymous admin calls", async () => {
    const app = buildApp({ APP_ENV: "local", AUTH_MODE: "local_bypass" });
    const response = await app.inject({ method: "POST", url: "/v1/admin/jobs/snapshot/run" });
    expect(response.statusCode).toBe(401);
    expect(response.headers["cache-control"]).toContain("no-store");
    await app.close();
  });

  it("sends a security header", async () => {
    const app = buildApp({ APP_ENV: "local" });
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    await app.close();
  });

  it("returns 503 for timeline and content when the database is missing", async () => {
    const app = buildApp({ APP_ENV: "local" });
    const timeline = await app.inject({ method: "GET", url: "/v1/campaigns/demo/timeline?granularity=hour" });
    const content = await app.inject({ method: "GET", url: "/v1/content" });
    expect(timeline.statusCode).toBe(503);
    expect(content.statusCode).toBe(503);
    await app.close();
  });

  it("returns 404 for an unknown job and 503 when the database is missing", async () => {
    const app = buildApp({ APP_ENV: "local", AUTH_MODE: "local_bypass" });
    const headers = { "x-belac-dev-user": "owner-1", "x-belac-dev-role": "owner" };
    const unknown = await app.inject({ method: "POST", url: "/v1/admin/jobs/nope/run", headers });
    const missing = await app.inject({ method: "POST", url: "/v1/admin/jobs/snapshot/run", headers });
    expect(unknown.statusCode).toBe(404);
    expect(missing.statusCode).toBe(503);
    await app.close();
  });
});

describe("seeded api", () => {
  let connectionString = "";
  let started: Awaited<ReturnType<PostgreSqlContainer["start"]>>;

  beforeAll(async () => {
    started = await new PostgreSqlContainer("postgres:16-alpine").start();
    connectionString = started.getConnectionUri();
    await applyMigrations(connectionString);
    const pool = new pg.Pool({ connectionString });
    await seed(drizzle(pool));
    await pool.end();
  }, 180_000);

  afterAll(async () => {
    await started.stop();
  });

  it("marks the demo campaign as illustrative", async () => {
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString, ALLOWED_ORIGINS: "http://localhost:5173" });
    const response = await app.inject({ method: "GET", url: "/v1/campaigns/demo/summary" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.isIllustrative).toBe(true);
    const etag = response.headers.etag;
    const cached = await app.inject({
      method: "GET",
      url: "/v1/campaigns/demo/summary",
      headers: { "if-none-match": String(etag) },
    });
    expect(cached.statusCode).toBe(304);
    await app.close();
  });

  it("returns the stored illustrative flag on the summary and a transaction", async () => {
    const pool = new pg.Pool({ connectionString });
    const client = await pool.connect();
    const campaign = await client.query(
      `insert into campaigns (slug, name, starts_at, ends_at, state, policy_version, base_currency, is_illustrative)
       values ('real', 'Real', now(), now() + interval '1 day', 'draft', '1', 'USD', false)
       returning id`,
    );
    const provider = await client.query(
      `insert into providers (slug, name, homepage_url, status) values ('real-provider', 'Real', 'https://example.com', 'unreviewed') returning id`,
    );
    const challenge = await client.query(
      `insert into challenges (campaign_id, provider_id, slug, strategy_type, state, allocation_usd, begins_at, ends_at, rank_order)
       values ($1, $2, 'real-a', 'spot', 'planned', 10, now(), now() + interval '1 day', 1)
       returning id`,
      [campaign.rows[0].id, provider.rows[0].id],
    );
    const asset = await client.query(`select id from assets limit 1`);
    const source = await client.query(
      `insert into source_records (challenge_id, source_type, external_id, status, observed_at, fetched_at, payload_hash)
       values ($1, 'manual', 'real-deposit', 'unverified', now(), now(), 'real') returning id`,
      [challenge.rows[0].id],
    );
    const event = await client.query(
      `insert into ledger_events (challenge_id, source_id, event_type, effective_at, recorded_at, external_key, status)
       values ($1, $2, 'deposit', now(), now(), 'real-deposit', 'recorded') returning id`,
      [challenge.rows[0].id, source.rows[0].id],
    );
    await client.query(
      `insert into ledger_entries (event_id, asset_id, signed_amount, value_usd, cost_usd, leg_type)
       values ($1, $2, 1, 1, 1, 'inflow')`,
      [event.rows[0].id, asset.rows[0].id],
    );
    client.release();
    await pool.end();

    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString });
    const summary = await app.inject({ method: "GET", url: "/v1/campaigns/real/summary" });
    const transactions = await app.inject({ method: "GET", url: "/v1/challenges/real-a/transactions" });
    expect(summary.json().data.isIllustrative).toBe(false);
    expect(transactions.json().data.items[0].isIllustrative).toBe(false);
    await app.close();
  });

  it("returns one bucket per hour", async () => {
    const pool = new pg.Pool({ connectionString });
    const challenge = await pool.query(`select id from challenges where slug = 'demo-a'`);
    await pool.query(
      `insert into valuation_snapshots (challenge_id, observed_at, equity_usd, pnl_usd, pnl_pct, quality, calc_version)
       values ($1, '2026-10-20T01:00:00.000Z', 10.10, 0, 0, 'unverified', 'fix-hour'),
              ($1, '2026-10-20T02:00:00.000Z', 10.20, 0, 0, 'unverified', 'fix-hour')`,
      [challenge.rows[0].id],
    );
    await pool.end();
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString });
    const response = await app.inject({
      method: "GET",
      url: "/v1/campaigns/demo/timeline?granularity=hour&from=2026-10-20T01:00:00.000Z&to=2026-10-20T02:00:00.000Z",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(2);
    await app.close();
  });

  it("publishes a draft and returns 404 for an unknown post", async () => {
    const pool = new pg.Pool({ connectionString });
    const campaign = await pool.query(`select id from campaigns where slug = 'demo'`);
    await pool.query(
      `insert into users (identity_provider_sub, role, state) values ('editor-1', 'editor', 'active')`,
    );
    const post = await pool.query(
      `insert into content_posts (campaign_id, slug, content_type, title, body_md, status)
       values ($1, 'draft-note', 'note', 'Draft', 'Body', 'draft') returning id`,
      [campaign.rows[0].id],
    );
    await pool.end();
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString, AUTH_MODE: "local_bypass" });
    const missing = await app.inject({
      method: "POST",
      url: "/v1/admin/content/00000000-0000-4000-8000-000000000099/publish",
      headers: { "x-belac-dev-user": "editor-1", "x-belac-dev-role": "editor" },
    });
    const published = await app.inject({
      method: "POST",
      url: `/v1/admin/content/${post.rows[0].id}/publish`,
      headers: { "x-belac-dev-user": "editor-1", "x-belac-dev-role": "editor", "content-type": "application/json" },
      payload: {},
    });
    expect(missing.statusCode).toBe(404);
    expect(published.statusCode).toBe(200);
    expect(published.json().data.status).toBe("published");
    expect(published.json().data.published_at).toBeTruthy();
    await app.close();
  });

  it("returns 304 for the leaderboard when the etag matches", async () => {
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString });
    const response = await app.inject({ method: "GET", url: "/v1/campaigns/demo/leaderboard" });
    const cached = await app.inject({
      method: "GET",
      url: "/v1/campaigns/demo/leaderboard",
      headers: { "if-none-match": String(response.headers.etag) },
    });
    expect(cached.statusCode).toBe(304);
    await app.close();
  });

  it("previews without inserting, commits, reverses without changing the original, and amends allocation", async () => {
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString, AUTH_MODE: "local_bypass" });
    const headers = { "x-belac-dev-user": "editor-1", "x-belac-dev-role": "owner", "content-type": "application/json" };
    const pool = new pg.Pool({ connectionString });
    const before = await pool.query(`select count(*)::int as count from ledger_events`);
    const preview = await app.inject({
      method: "POST",
      url: "/v1/admin/ledger/preview",
      headers,
      payload: { currentEquityUsd: "10.00", valueUsd: "1.00" },
    });
    const afterPreview = await pool.query(`select count(*)::int as count from ledger_events`);
    expect(preview.statusCode).toBe(200);
    expect(preview.json().data.equityDeltaUsd).toBe("1.00");
    expect(afterPreview.rows[0].count).toBe(before.rows[0].count);
    const challenge = await pool.query(`select id from challenges where slug = 'demo-a'`);
    const asset = await pool.query(`select id from assets limit 1`);
    const committed = await app.inject({
      method: "POST",
      url: "/v1/admin/ledger/commit",
      headers,
      payload: {
        challengeId: challenge.rows[0].id,
        assetId: asset.rows[0].id,
        eventType: "deposit",
        signedAmount: "1",
        valueUsd: "1",
        costUsd: "1",
        externalKey: "fix-commit",
        reason: "manual deposit",
      },
    });
    expect(committed.statusCode).toBe(200);
    const eventId = committed.json().data.id as string;
    const original = await pool.query(`select signed_amount from ledger_entries where event_id = $1`, [eventId]);
    const reversed = await app.inject({
      method: "POST",
      url: `/v1/admin/ledger/${eventId}/reverse`,
      headers,
      payload: { reason: "correct the deposit" },
    });
    const still = await pool.query(`select signed_amount from ledger_entries where event_id = $1`, [eventId]);
    expect(reversed.statusCode).toBe(200);
    expect(String(still.rows[0].signed_amount)).toBe(String(original.rows[0].signed_amount));
    const locked = await app.inject({
      method: "POST",
      url: `/v1/admin/challenges/${challenge.rows[0].id}/allocation`,
      headers,
      payload: { allocationUsd: "11" },
    });
    const amended = await app.inject({
      method: "POST",
      url: `/v1/admin/challenges/${challenge.rows[0].id}/amend-allocation`,
      headers,
      payload: { allocationUsd: "11.00", reason: "owner amendment" },
    });
    expect(locked.statusCode).toBe(409);
    expect(amended.statusCode).toBe(200);
    await pool.end();
    await app.close();
  });

  it("returns 409 when a severe reconciliation issue is open", async () => {
    const pool = new pg.Pool({ connectionString });
    const challenge = await pool.query(`select id from challenges where slug = 'demo-a'`);
    await pool.query(
      `insert into reconciliation_issues (challenge_id, severity, kind, state, opened_at)
       values ($1, 'high', 'disagreement', 'open', now())`,
      [challenge.rows[0].id],
    );
    const post = await pool.query(`select id from content_posts where slug = 'draft-note'`);
    await pool.end();
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString, AUTH_MODE: "local_bypass" });
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/content/${post.rows[0].id}/publish`,
      headers: { "x-belac-dev-user": "editor-1", "x-belac-dev-role": "editor", "content-type": "application/json" },
      payload: {},
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("runs the snapshot job for an owner", async () => {
    const pool = new pg.Pool({ connectionString });
    await pool.query(
      `insert into users (identity_provider_sub, role, state) values ('owner-1', 'owner', 'active') on conflict (identity_provider_sub) do nothing`,
    );
    await pool.end();
    const app = buildApp({ APP_ENV: "local", DATABASE_URL: connectionString, AUTH_MODE: "local_bypass" });
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/jobs/snapshot/run",
      headers: { "x-belac-dev-user": "owner-1", "x-belac-dev-role": "owner" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.state).toBe("succeeded");
    await app.close();
  });
});
