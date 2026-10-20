import { priceSlaMinutes, staleness } from "@belac/jobs/prices";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  campaignBySlug,
  campaignEquity,
  campaignTimeline,
  challengeBySlug,
  contentBySlug,
  contentList,
  currentCampaign,
  latestJobs,
  latestSnapshots,
  moneyString,
  positions,
  providerBySlug,
  rankRows,
  snapshots,
  sources,
  sumColumn,
  transactions,
  type Database,
} from "./queries.js";
import { Decimal } from "decimal.js";

const dayMs = 24 * 60 * 60 * 1000;

function envelope(data: unknown, requestId: string, quality = "unverified") {
  return {
    data,
    meta: { asOf: new Date().toISOString(), quality, requestId },
  };
}

function decimalField(value: unknown) {
  if (value == null) {
    return null;
  }
  return moneyString(new Decimal(String(value)));
}

export function registerPublicRoutes(app: FastifyInstance, db: Database | null) {
  app.get("/v1/campaigns/current", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id, "unavailable");
    }
    const campaign = await currentCampaign(db);
    if (!campaign) {
      reply.code(404);
      return { error: { code: "not_found", message: "No campaign", requestId: request.id } };
    }
    const snaps = await latestSnapshots(db, String(campaign.id));
    const totals = campaignEquity(snaps);
    return envelope(
      {
        slug: campaign.slug,
        name: campaign.name,
        state: campaign.state,
        equityUsd: totals.equityUsd,
        coverage: totals.coverage,
        isIllustrative: campaign.is_illustrative === true,
        asOf: new Date().toISOString(),
      },
      request.id,
    );
  });

  app.get("/v1/campaigns/:slug/summary", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const campaign = await campaignBySlug(db, params.slug);
    if (!campaign) {
      reply.code(404);
      return { error: { code: "not_found", message: "Campaign not found", requestId: request.id } };
    }
    const snaps = await latestSnapshots(db, String(campaign.id));
    const totals = campaignEquity(snaps);
    reply.header("Cache-Control", "public, max-age=30");
    const body = envelope(
      {
        slug: campaign.slug,
        name: campaign.name,
        state: campaign.state,
        equityUsd: totals.equityUsd,
        netPnlUsd: sumColumn(snaps, "pnl_usd"),
        coverage: totals.coverage,
        isIllustrative: campaign.is_illustrative === true,
        quality: "unverified",
      },
      request.id,
    );
    const etag = `"${Buffer.from(JSON.stringify(body.data)).toString("base64url")}"`;
    reply.header("ETag", etag);
    if (request.headers["if-none-match"] === etag) {
      reply.code(304);
      return null;
    }
    return body;
  });

  app.get("/v1/campaigns/:slug/leaderboard", async (request, reply) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const query = z.object({ metric: z.enum(["pnl_usd", "return_pct"]).default("pnl_usd") }).parse(request.query);
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const campaign = await campaignBySlug(db, params.slug);
    if (!campaign) {
      reply.code(404);
      return { error: { code: "not_found", message: "Campaign not found", requestId: request.id } };
    }
    const ranked = rankRows(await latestSnapshots(db, String(campaign.id)), query.metric);
    reply.header("Cache-Control", "public, max-age=30");
    const body = envelope(
      ranked.map((row) => ({
        rank: row.rank,
        slug: row.slug,
        state: row.state,
        providerName: row.provider_name,
        allocationUsd: decimalField(row.allocation_usd),
        equityUsd: decimalField(row.equity_usd),
        netPnlUsd: decimalField(row.pnl_usd),
        returnPct: decimalField(row.pnl_pct),
        quality: row.quality ?? "unverified",
        isIllustrative: campaign.is_illustrative === true,
        asOf: row.observed_at ?? null,
      })),
      request.id,
    );
    const etag = `"${Buffer.from(JSON.stringify(body.data)).toString("base64url")}"`;
    reply.header("ETag", etag);
    if (request.headers["if-none-match"] === etag) {
      reply.code(304);
      return null;
    }
    return body;
  });

  app.get("/v1/campaigns/:slug/leaderboard.csv", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const campaign = await campaignBySlug(db, params.slug);
    if (!campaign) {
      reply.code(404);
      return { error: { code: "not_found", message: "Campaign not found", requestId: request.id } };
    }
    const ranked = rankRows(await latestSnapshots(db, String(campaign.id)), "pnl_usd");
    const asOf = new Date().toISOString();
    const lines = ["rank,slug,as_of,calc_version,source_grade,net_pnl_usd"];
    for (const row of ranked) {
      lines.push(
        [row.rank, row.slug, asOf, row.calc_version ?? "v1", row.quality ?? "unverified", row.pnl_usd ?? ""].join(","),
      );
    }
    reply.header("Content-Type", "text/csv");
    return lines.join("\n");
  });

  app.get("/v1/challenges/:slug", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const challenge = await challengeBySlug(db, params.slug);
    if (!challenge) {
      reply.code(404);
      return { error: { code: "not_found", message: "Challenge not found", requestId: request.id } };
    }
    const snap = (await snapshots(db, String(challenge.id))).at(-1);
    return envelope(
      {
        slug: challenge.slug,
        provider: { slug: challenge.provider_slug, name: challenge.provider_name },
        state: challenge.state,
        allocationUsd: decimalField(challenge.allocation_usd),
        equityUsd: decimalField(snap?.equity_usd),
        netPnlUsd: decimalField(snap?.pnl_usd),
        returnPct: decimalField(snap?.pnl_pct),
        quality: snap?.quality ?? "unverified",
        isIllustrative: challenge.is_illustrative === true,
        asOf: snap?.observed_at ?? new Date().toISOString(),
      },
      request.id,
      String(snap?.quality ?? "unverified"),
    );
  });

  app.get("/v1/challenges/:slug/snapshots", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(request.query);
    if (query.from && query.to && new Date(query.to).getTime() - new Date(query.from).getTime() > 400 * dayMs) {
      reply.code(400);
      return { error: { code: "range_too_wide", message: "Snapshot range exceeds 400 days", requestId: request.id } };
    }
    const challenge = await challengeBySlug(db, params.slug);
    if (!challenge) {
      reply.code(404);
      return { error: { code: "not_found", message: "Challenge not found", requestId: request.id } };
    }
    return envelope(await snapshots(db, String(challenge.id), query.from, query.to), request.id);
  });

  app.get("/v1/challenges/:slug/transactions", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const query = z
      .object({ cursor: z.string().optional(), pageSize: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(request.query);
    const challenge = await challengeBySlug(db, params.slug);
    if (!challenge) {
      reply.code(404);
      return { error: { code: "not_found", message: "Challenge not found", requestId: request.id } };
    }
    const page = await transactions(db, String(challenge.id), query.cursor, query.pageSize);
    return envelope(
      {
        items: page.rows.map((row) => ({
          id: row.id,
          eventType: row.event_type,
          effectiveAt: row.effective_at,
          valueUsd: decimalField(row.value_usd),
          isIllustrative: challenge.is_illustrative === true,
          asOf: row.effective_at,
          quality: "unverified",
        })),
        nextCursor: page.nextCursor,
      },
      request.id,
    );
  });

  app.get("/v1/challenges/:slug/positions", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope([], request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const challenge = await challengeBySlug(db, params.slug);
    if (!challenge) {
      reply.code(404);
      return { error: { code: "not_found", message: "Challenge not found", requestId: request.id } };
    }
    return envelope(await positions(db, String(challenge.id)), request.id);
  });

  app.get("/v1/challenges/:slug/sources", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope([], request.id);
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const challenge = await challengeBySlug(db, params.slug);
    if (!challenge) {
      reply.code(404);
      return { error: { code: "not_found", message: "Challenge not found", requestId: request.id } };
    }
    return envelope(await sources(db, String(challenge.id)), request.id);
  });

  app.get("/v1/campaigns/:slug/timeline", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id, "unavailable");
    }
    const params = z.object({ slug: z.string() }).parse(request.params);
    const query = z
      .object({
        granularity: z.enum(["hour", "day"]).default("day"),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(request.query);
    if (query.from && query.to && new Date(query.to).getTime() - new Date(query.from).getTime() > 400 * dayMs) {
      reply.code(400);
      return { error: { code: "range_too_wide", message: "Timeline range exceeds 400 days", requestId: request.id } };
    }
    const campaign = await campaignBySlug(db, params.slug);
    if (!campaign) {
      reply.code(404);
      return { error: { code: "not_found", message: "Campaign not found", requestId: request.id } };
    }
    const buckets = await campaignTimeline(db, String(campaign.id), query.granularity, query.from, query.to);
    return envelope(
      buckets.map((bucket) => ({ ...bucket, isIllustrative: campaign.is_illustrative === true })),
      request.id,
    );
  });

  app.get("/v1/content", async (request, reply) => {
    if (!db) {
      reply.code(503);
      return envelope(null, request.id, "unavailable");
    }
    return envelope(await contentList(db), request.id);
  });

  app.get("/v1/content/:slug", async (request, reply) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    if (!db) {
      reply.code(404);
      return { error: { code: "not_found", message: "Content not found", requestId: request.id } };
    }
    const item = await contentBySlug(db, params.slug);
    if (!item) {
      reply.code(404);
      return { error: { code: "not_found", message: "Content not found", requestId: request.id } };
    }
    return envelope(item, request.id);
  });

  app.get("/v1/providers/:slug", async (request, reply) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    if (!db) {
      reply.code(404);
      return { error: { code: "not_found", message: "Provider not found", requestId: request.id } };
    }
    const provider = await providerBySlug(db, params.slug);
    if (!provider) {
      reply.code(404);
      return { error: { code: "not_found", message: "Provider not found", requestId: request.id } };
    }
    return envelope(provider, request.id);
  });

  app.get("/v1/site/status", async (request) => {
    const now = new Date().toISOString();
    const jobs = db ? await latestJobs(db) : [];
    return envelope(
      {
        jobs: jobs.map((job) => ({
          name: job.job_name,
          freshness: staleness(job.completed_at ? String(job.completed_at) : null, priceSlaMinutes, now),
        })),
        asOf: now,
      },
      request.id,
    );
  });
}
