import { Decimal } from "decimal.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runWithLock } from "@belac/jobs/lock";
import { freezeLeaderboard, writeSnapshots } from "@belac/jobs/persist";
import { forbidden, readActor, unauthorized, type Actor, type AuthEnv } from "./auth.js";
import type { Database } from "./queries.js";
import { uploadIntent } from "./uploads.js";

function envelope(data: unknown, requestId: string) {
  return { data, meta: { asOf: new Date().toISOString(), quality: "unverified", requestId } };
}

export function registerAdminRoutes(app: FastifyInstance, db: Database | null, env: AuthEnv) {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/admin")) {
      return;
    }
    reply.header("Cache-Control", "private, no-store");
    const actor = await readActor(request, env);
    if (!actor) {
      await reply.send(unauthorized(reply, request.id));
      return;
    }
    request.actor = actor;
  });

  app.post("/v1/admin/content/:id/publish", async (request, reply) => {
    const actor = request.actor as Actor;
    const body = z.object({ override: z.boolean().optional() }).parse(request.body ?? {});
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const existing = await db.query(`select id from content_posts where id = $1`, [id]);
    if (existing.rows.length === 0) {
      reply.code(404);
      return { error: { code: "not_found", message: "Content not found", requestId: request.id } };
    }
    const severe = await db.query(
      `select id from reconciliation_issues where severity = 'high' and state = 'open' limit 1`,
    );
    if (severe.rows.length > 0 && !(body.override === true && actor.role === "owner")) {
      reply.code(409);
      return { error: { code: "reconciliation_open", message: "Severe reconciliation issue is open", requestId: request.id } };
    }
    const updated = await db.query(
      `update content_posts set status = 'published', published_at = now() where id = $1
       returning id, slug, title, status, published_at`,
      [id],
    );
    await db.query(
      `insert into audit_events (actor_id, action, target_type, target_id, reason, created_at, diff_jsonb)
       select id, 'publish', 'content', $2, $3, now(), $4::jsonb from users where identity_provider_sub = $1`,
      [actor.id, id, body.override ? "owner override" : "publish", JSON.stringify({ override: body.override === true })],
    );
    return envelope(updated.rows[0], request.id);
  });

  app.post("/v1/admin/ledger/events", async (request, reply) => {
    reply.code(501);
    return { error: { code: "not_implemented", message: "Use the ledger commit route", requestId: request.id } };
  });

  app.post("/v1/admin/media/upload-intent", async (request, reply) => {
    const body = z.object({ objectKey: z.string().min(1).max(180) }).parse(request.body ?? {});
    const intent = uploadIntent(
      { R2_BUCKET: env.R2_BUCKET, R2_ACCOUNT_ID: env.R2_ACCOUNT_ID },
      body.objectKey,
      () => null,
    );
    if (intent.status === 501) {
      reply.code(501);
      return { error: { code: "not_implemented", message: intent.error, requestId: request.id } };
    }
    return envelope({ url: intent.url, key: intent.key }, request.id);
  });

  app.post("/v1/admin/jobs/:name/run", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role !== "owner") {
      return forbidden(reply, request.id);
    }
    const name = z.string().parse((request.params as { name: string }).name);
    if (name !== "snapshot" && name !== "reconcile" && name !== "freeze") {
      reply.code(404);
      return { error: { code: "not_found", message: "Unknown job", requestId: request.id } };
    }
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    await runWithLock(db, name, async () => {
      if (name === "snapshot") {
        await writeSnapshots(db);
      }
      if (name === "freeze") {
        await freezeLeaderboard(db);
      }
    });
    const row = await db.query(
      `select job_name, state, completed_at from job_runs where job_name = $1 order by completed_at desc nulls last limit 1`,
      [name],
    );
    return envelope(row.rows[0] ?? null, request.id);
  });

  app.post("/v1/admin/ledger/preview", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role === "viewer") {
      return forbidden(reply, request.id);
    }
    const body = z.object({ currentEquityUsd: z.string(), valueUsd: z.string() }).parse(request.body);
    const next = new Decimal(body.currentEquityUsd).plus(body.valueUsd);
    return envelope({ equityDeltaUsd: new Decimal(body.valueUsd).toFixed(2), nextEquityUsd: next.toFixed(2) }, request.id);
  });

  app.post("/v1/admin/ledger/commit", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role === "viewer") {
      return forbidden(reply, request.id);
    }
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const body = z
      .object({
        challengeId: z.string().uuid(),
        assetId: z.string().uuid(),
        eventType: z.string(),
        signedAmount: z.string(),
        valueUsd: z.string(),
        costUsd: z.string(),
        externalKey: z.string(),
        reason: z.string().min(1),
      })
      .parse(request.body);
    const source = await db.query(
      `insert into source_records (challenge_id, source_type, external_id, status, observed_at, fetched_at, payload_hash)
       values ($1, 'manual', $2, 'manual_evidence', now(), now(), $2) returning id`,
      [body.challengeId, body.externalKey],
    );
    const event = await db.query(
      `insert into ledger_events (challenge_id, source_id, event_type, effective_at, recorded_at, external_key, status)
       values ($1, $2, $3, now(), now(), $4, 'recorded') returning id`,
      [body.challengeId, source.rows[0].id, body.eventType, body.externalKey],
    );
    await db.query(
      `insert into ledger_entries (event_id, asset_id, signed_amount, value_usd, cost_usd, leg_type)
       values ($1, $2, $3, $4, $5, 'inflow')`,
      [event.rows[0].id, body.assetId, body.signedAmount, body.valueUsd, body.costUsd],
    );
    await db.query(
      `insert into audit_events (actor_id, action, target_type, target_id, reason, created_at, diff_jsonb)
       select id, 'ledger_commit', 'ledger_event', $2, $3, now(), $4::jsonb from users where identity_provider_sub = $1`,
      [actor.id, event.rows[0].id, body.reason, JSON.stringify({ valueUsd: body.valueUsd })],
    );
    return envelope({ id: event.rows[0].id }, request.id);
  });

  app.post("/v1/admin/ledger/:id/reverse", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role === "viewer") {
      return forbidden(reply, request.id);
    }
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const body = z.object({ reason: z.string().min(1) }).parse(request.body);
    const original = await db.query(
      `select e.id, e.challenge_id, le.asset_id, le.signed_amount, le.value_usd, le.cost_usd
       from ledger_events e join ledger_entries le on le.event_id = e.id where e.id = $1`,
      [id],
    );
    if (original.rows.length === 0) {
      reply.code(404);
      return { error: { code: "not_found", message: "Event not found", requestId: request.id } };
    }
    const row = original.rows[0];
    const before = String(row.signed_amount);
    const source = await db.query(
      `insert into source_records (challenge_id, source_type, external_id, status, observed_at, fetched_at, payload_hash)
       values ($1, 'manual', $2, 'manual_evidence', now(), now(), $2) returning id`,
      [row.challenge_id, `reversal-${id}`],
    );
    const reversal = await db.query(
      `insert into ledger_events (challenge_id, source_id, event_type, effective_at, recorded_at, external_key, reversal_of, status)
       values ($1, $2, 'deposit', now(), now(), $3, $4, 'recorded') returning id`,
      [row.challenge_id, source.rows[0].id, `reversal-${id}`, id],
    );
    const negated = new Decimal(String(row.signed_amount)).negated().toFixed(18);
    await db.query(
      `insert into ledger_entries (event_id, asset_id, signed_amount, value_usd, cost_usd, leg_type)
       values ($1, $2, $3, $4, $5, 'outflow')`,
      [reversal.rows[0].id, row.asset_id, negated, new Decimal(String(row.value_usd)).negated().toFixed(10), row.cost_usd],
    );
    const unchanged = await db.query(`select signed_amount from ledger_entries where event_id = $1`, [id]);
    await db.query(
      `insert into audit_events (actor_id, action, target_type, target_id, reason, created_at, diff_jsonb)
       select id, 'ledger_reversal', 'ledger_event', $2, $3, now(), '{}'::jsonb from users where identity_provider_sub = $1`,
      [actor.id, reversal.rows[0].id, body.reason],
    );
    return envelope({ reversalId: reversal.rows[0].id, originalSignedAmount: String(unchanged.rows[0].signed_amount), before }, request.id);
  });

  app.get("/v1/admin/reconciliation", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const found = await db.query(`select id, severity, kind, state from reconciliation_issues order by opened_at desc`);
    return envelope(found.rows, request.id);
  });

  app.post("/v1/admin/reconciliation/:id/resolve", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role === "viewer") {
      return forbidden(reply, request.id);
    }
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const body = z.object({ note: z.string().min(1) }).parse(request.body);
    const updated = await db.query(
      `update reconciliation_issues set state = 'resolved' where id = $1 returning id, state`,
      [id],
    );
    if (updated.rows.length === 0) {
      reply.code(404);
      return { error: { code: "not_found", message: "Issue not found", requestId: request.id } };
    }
    await db.query(
      `insert into audit_events (actor_id, action, target_type, target_id, reason, created_at, diff_jsonb)
       select id, 'resolve', 'reconciliation', $2, $3, now(), '{}'::jsonb from users where identity_provider_sub = $1`,
      [actor.id, id, body.note],
    );
    return envelope(updated.rows[0], request.id);
  });

  app.get("/v1/admin/audit", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const query = z.object({ action: z.string().optional() }).parse(request.query);
    const found = await db.query(
      `select action, target_type, target_id, reason, created_at from audit_events
       where ($1::text is null or action = $1) order by created_at desc limit 50`,
      [query.action ?? null],
    );
    return envelope(found.rows, request.id);
  });

  app.post("/v1/admin/challenges/:id/allocation", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const events = await db.query(`select id from ledger_events where challenge_id = $1 limit 1`, [id]);
    if (events.rows.length > 0) {
      reply.code(409);
      return { error: { code: "allocation_locked", message: "Use amend-allocation after a ledger event", requestId: request.id } };
    }
    return envelope({ updated: false }, request.id);
  });

  app.post("/v1/admin/challenges/:id/amend-allocation", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role !== "owner") {
      return forbidden(reply, request.id);
    }
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const body = z.object({ allocationUsd: z.string(), reason: z.string().min(1) }).parse(request.body);
    const challenge = await db.query(`select id from challenges where id = $1`, [id]);
    if (challenge.rows.length === 0) {
      reply.code(404);
      return { error: { code: "not_found", message: "Challenge not found", requestId: request.id } };
    }
    await db.query(
      `insert into allocation_amendments (challenge_id, allocation_usd, reason) values ($1, $2, $3)`,
      [id, body.allocationUsd, body.reason],
    );
    await db.query(`update challenges set allocation_usd = $2 where id = $1`, [id, body.allocationUsd]);
    await db.query(
      `insert into audit_events (actor_id, action, target_type, target_id, reason, created_at, diff_jsonb)
       select id, 'amend_allocation', 'challenge', $2, $3, now(), $4::jsonb from users where identity_provider_sub = $1`,
      [actor.id, id, body.reason, JSON.stringify({ allocationUsd: body.allocationUsd })],
    );
    return envelope({ allocationUsd: body.allocationUsd }, request.id);
  });

  app.post("/v1/admin/social/metrics", async (request, reply) => {
    const actor = request.actor as Actor;
    if (actor.role === "viewer") {
      return forbidden(reply, request.id);
    }
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const body = z
      .object({
        contentId: z.string().uuid(),
        url: z.string().url(),
        views: z.number().int().optional(),
      })
      .parse(request.body);
    const post = await db.query(
      `insert into social_posts (content_id, platform, url) values ($1, 'manual', $2) returning id`,
      [body.contentId, body.url],
    );
    const metric = await db.query(
      `insert into social_metric_snapshots (social_post_id, measured_at, views, provenance)
       values ($1, now(), $2, 'manual') returning provenance`,
      [post.rows[0].id, body.views ?? null],
    );
    return envelope({ provenance: metric.rows[0].provenance }, request.id);
  });
}
