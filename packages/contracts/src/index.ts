import { z } from "zod";

export const campaignStateSchema = z.enum(["draft", "scheduled", "active", "frozen", "closed"]);

export const challengeStateSchema = z.enum([
  "planned",
  "live",
  "paused",
  "closed",
  "invalidated",
]);

export const sourceStatusSchema = z.enum([
  "verified_onchain",
  "verified_provider",
  "manual_evidence",
  "unverified",
]);

/** Source status plus `estimated` for indicative manual or price-only marks. */
export const qualitySchema = z.enum([
  "verified_onchain",
  "verified_provider",
  "manual_evidence",
  "unverified",
  "estimated",
]);

export const ledgerEventTypeSchema = z.enum([
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

export const roleSchema = z.enum(["owner", "editor", "viewer"]);

export const moneySchema = z.string().regex(/^-?\d+(\.\d+)?$/);

const isoDateTimeSchema = z.string().datetime();

const financialFields = {
  isIllustrative: z.boolean(),
  asOf: isoDateTimeSchema,
  quality: qualitySchema,
};

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});

export const campaignSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  state: campaignStateSchema,
  equityUsd: moneySchema,
  netPnlUsd: moneySchema,
  ...financialFields,
});

export const leaderboardRowSchema = z.object({
  rank: z.number().int().positive(),
  slug: z.string(),
  providerName: z.string(),
  allocationUsd: moneySchema,
  equityUsd: moneySchema,
  netPnlUsd: moneySchema,
  returnPct: moneySchema,
  ...financialFields,
});

export const challengeDetailSchema = z.object({
  slug: z.string(),
  provider: z.object({
    slug: z.string(),
    name: z.string(),
  }),
  state: challengeStateSchema,
  allocationUsd: moneySchema,
  equityUsd: moneySchema,
  netPnlUsd: moneySchema,
  returnPct: moneySchema,
  ...financialFields,
});

export const transactionRowSchema = z.object({
  id: z.string(),
  eventType: ledgerEventTypeSchema,
  effectiveAt: isoDateTimeSchema,
  valueUsd: moneySchema,
  ...financialFields,
});

export const positionRowSchema = z.object({
  instrumentKey: z.string(),
  quantity: moneySchema,
  equityUsd: moneySchema,
  ...financialFields,
});

export const contentCardSchema = z.object({
  slug: z.string(),
  title: z.string(),
  contentType: z.enum(["daily_update", "weekly_recap", "provider_story", "short_video", "site_note"]),
  publishedAt: isoDateTimeSchema.nullable(),
});

export const siteStatusSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  asOf: isoDateTimeSchema,
});

export type CampaignState = z.infer<typeof campaignStateSchema>;
export type ChallengeState = z.infer<typeof challengeStateSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type Quality = z.infer<typeof qualitySchema>;
export type LedgerEventType = z.infer<typeof ledgerEventTypeSchema>;
export type Role = z.infer<typeof roleSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type CampaignSummary = z.infer<typeof campaignSummarySchema>;
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;
export type ChallengeDetail = z.infer<typeof challengeDetailSchema>;
export type TransactionRow = z.infer<typeof transactionRowSchema>;
export type PositionRow = z.infer<typeof positionRowSchema>;
export type ContentCard = z.infer<typeof contentCardSchema>;
export type SiteStatus = z.infer<typeof siteStatusSchema>;
