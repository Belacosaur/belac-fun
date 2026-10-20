CREATE TABLE "allocation_amendments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL REFERENCES "challenges"("id"),
  "allocation_usd" numeric(24, 10) NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id"),
  "week_start" date NOT NULL,
  "payload" jsonb NOT NULL,
  CONSTRAINT "leaderboard_revisions_campaign_week" UNIQUE ("campaign_id", "week_start")
);
