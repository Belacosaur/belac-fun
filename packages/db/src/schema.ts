import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const campaignState = pgEnum("campaign_state", [
  "draft",
  "scheduled",
  "active",
  "frozen",
  "closed",
]);

export const challengeState = pgEnum("challenge_state", [
  "planned",
  "live",
  "paused",
  "closed",
  "invalidated",
]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }).notNull(),
  state: campaignState("state").notNull(),
  policyVersion: text("policy_version").notNull(),
  baseCurrency: text("base_currency").notNull(),
  isIllustrative: boolean("is_illustrative").notNull().default(false),
});

export const slugRedirects = pgTable("slug_redirects", {
  fromSlug: text("from_slug").primaryKey(),
  toSlug: text("to_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  homepageUrl: text("homepage_url").notNull(),
  xHandle: text("x_handle"),
  status: text("status").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),
});

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id),
    slug: text("slug").notNull().unique(),
    strategyType: text("strategy_type").notNull(),
    state: challengeState("state").notNull(),
    allocationUsd: numeric("allocation_usd", { precision: 24, scale: 8 }).notNull(),
    beginsAt: timestamp("begins_at", { withTimezone: true, mode: "string" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
    rankOrder: integer("rank_order").notNull(),
  },
  (table) => [check("allocation_usd_nonnegative", sql`${table.allocationUsd} >= 0`)],
);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id),
  chain: text("chain").notNull(),
  publicAddress: text("public_address"),
  externalAccountRef: text("external_account_ref"),
  visibility: text("visibility").notNull(),
});

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chain: text("chain").notNull(),
    mintOrSymbol: text("mint_or_symbol").notNull(),
    symbol: text("symbol").notNull(),
    decimals: integer("decimals").notNull(),
    pricingKey: text("pricing_key").notNull(),
  },
  (table) => [unique("assets_chain_mint_or_symbol").on(table.chain, table.mintOrSymbol)],
);

export const sourceStatus = pgEnum("source_status", [
  "verified_onchain",
  "verified_provider",
  "manual_evidence",
  "unverified",
]);

export const ledgerEventType = pgEnum("ledger_event_type", [
  "deposit",
  "withdrawal",
  "buy",
  "sell",
  "swap",
  "fee",
  "borrow",
  "repay",
  "interest",
  "reward",
  "funding",
  "liquidation",
  "lp_add",
  "lp_remove",
  "realized_pnl_adjustment",
  "correction",
]);

export const sourceRecords = pgTable(
  "source_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id),
    sourceType: text("source_type").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    status: sourceStatus("status").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "string" }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }).notNull(),
    payloadHash: text("payload_hash").notNull(),
    metadataJsonb: jsonb("metadata_jsonb"),
  },
  (table) => [
    unique("source_records_source_type_external_id").on(table.sourceType, table.externalId),
    index("source_records_external_id_idx").on(table.externalId),
  ],
);

export const ledgerEvents = pgTable(
  "ledger_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRecords.id),
    eventType: ledgerEventType("event_type").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true, mode: "string" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "string" }).notNull(),
    externalKey: text("external_key").notNull(),
    reversalOf: uuid("reversal_of").references((): AnyPgColumn => ledgerEvents.id),
    status: text("status").notNull(),
  },
  (table) => [
    unique("ledger_events_challenge_id_external_key").on(table.challengeId, table.externalKey),
    index("ledger_events_challenge_effective_at_idx").on(table.challengeId, table.effectiveAt.desc()),
  ],
);

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => ledgerEvents.id),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  signedAmount: numeric("signed_amount", { precision: 38, scale: 18 }).notNull(),
  valueUsd: numeric("value_usd", { precision: 24, scale: 10 }).notNull(),
  costUsd: numeric("cost_usd", { precision: 24, scale: 10 }).notNull(),
  legType: text("leg_type").notNull(),
});

export const valuationQuality = pgEnum("valuation_quality", [
  "verified_onchain",
  "verified_provider",
  "manual_evidence",
  "unverified",
  "estimated",
]);

const usd = { precision: 24, scale: 10 } as const;

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id),
  instrumentKey: text("instrument_key").notNull(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  state: text("state").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "string" }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
});

export const positionSnapshots = pgTable("position_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id")
    .notNull()
    .references(() => positions.id),
  observedAt: timestamp("observed_at", { withTimezone: true, mode: "string" }).notNull(),
  quantity: numeric("quantity", { precision: 38, scale: 18 }).notNull(),
  markUsd: numeric("mark_usd", usd).notNull(),
  collateralUsd: numeric("collateral_usd", usd).notNull(),
  debtUsd: numeric("debt_usd", usd).notNull(),
  unrealizedPnlUsd: numeric("unrealized_pnl_usd", usd).notNull(),
  liquidationUsd: numeric("liquidation_usd", usd),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sourceRecords.id),
});

export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    sourceName: text("source_name").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "string" }).notNull(),
    priceUsd: numeric("price_usd", usd).notNull(),
    confidenceJsonb: jsonb("confidence_jsonb"),
  },
  (table) => [
    index("price_observations_asset_observed_at_idx").on(table.assetId, table.observedAt.desc()),
  ],
);

export const valuationSnapshots = pgTable(
  "valuation_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "string" }).notNull(),
    equityUsd: numeric("equity_usd", usd).notNull(),
    pnlUsd: numeric("pnl_usd", usd).notNull(),
    pnlPct: numeric("pnl_pct", usd).notNull(),
    quality: valuationQuality("quality").notNull(),
    calcVersion: text("calc_version").notNull(),
  },
  (table) => [
    unique("valuation_snapshots_challenge_observed_calc").on(
      table.challengeId,
      table.observedAt,
      table.calcVersion,
    ),
    index("valuation_snapshots_challenge_observed_at_idx").on(
      table.challengeId,
      table.observedAt.desc(),
    ),
  ],
);

export const reconciliationIssues = pgTable("reconciliation_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id),
  severity: text("severity").notNull(),
  kind: text("kind").notNull(),
  detailJsonb: jsonb("detail_jsonb"),
  state: text("state").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const userRole = pgEnum("user_role", ["owner", "editor", "viewer"]);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  r2Key: text("r2_key").unique(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  sha256: text("sha256").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text").notNull(),
  state: text("state").notNull(),
});

export const contentPosts = pgTable(
  "content_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    challengeId: uuid("challenge_id").references(() => challenges.id),
    slug: text("slug").notNull().unique(),
    contentType: text("content_type").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    status: text("status").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "string" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
    coverAssetId: uuid("cover_asset_id").references(() => mediaAssets.id),
    posterUrl: text("poster_url"),
  },
  (table) => [
    index("content_posts_status_published_at_idx").on(table.status, table.publishedAt.desc()),
  ],
);

export const socialPosts = pgTable("social_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id")
    .notNull()
    .references(() => contentPosts.id),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  remotePostId: text("remote_post_id"),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
});

export const socialMetricSnapshots = pgTable("social_metric_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  socialPostId: uuid("social_post_id")
    .notNull()
    .references(() => socialPosts.id),
  measuredAt: timestamp("measured_at", { withTimezone: true, mode: "string" }).notNull(),
  views: integer("views"),
  impressions: integer("impressions"),
  reposts: integer("reposts"),
  likes: integer("likes"),
  comments: integer("comments"),
  profileVisits: integer("profile_visits"),
  clicks: integer("clicks"),
  provenance: text("provenance").notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  identityProviderSub: text("identity_provider_sub").notNull().unique(),
  role: userRole("role").notNull(),
  state: text("state").notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  diffJsonb: jsonb("diff_jsonb"),
});

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true, mode: "string" }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true, mode: "string" }).notNull(),
  state: text("state").notNull(),
  attempts: integer("attempts").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  metricsJsonb: jsonb("metrics_jsonb"),
});
