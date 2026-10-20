CREATE TYPE "valuation_quality" AS ENUM (
  'verified_onchain',
  'verified_provider',
  'manual_evidence',
  'unverified',
  'estimated'
);
--> statement-breakpoint
CREATE TABLE "positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "instrument_key" text NOT NULL,
  "asset_id" uuid NOT NULL,
  "state" text NOT NULL,
  "opened_at" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "position_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "position_id" uuid NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "quantity" numeric(38, 18) NOT NULL,
  "mark_usd" numeric(24, 10) NOT NULL,
  "collateral_usd" numeric(24, 10) NOT NULL,
  "debt_usd" numeric(24, 10) NOT NULL,
  "unrealized_pnl_usd" numeric(24, 10) NOT NULL,
  "liquidation_usd" numeric(24, 10),
  "source_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_source_id_source_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "price_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "source_name" text NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "price_usd" numeric(24, 10) NOT NULL,
  "confidence_jsonb" jsonb
);
--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "valuation_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "equity_usd" numeric(24, 10) NOT NULL,
  "pnl_usd" numeric(24, 10) NOT NULL,
  "pnl_pct" numeric(24, 10) NOT NULL,
  "quality" "valuation_quality" NOT NULL,
  "calc_version" text NOT NULL,
  CONSTRAINT "valuation_snapshots_challenge_observed_calc" UNIQUE("challenge_id", "observed_at", "calc_version")
);
--> statement-breakpoint
ALTER TABLE "valuation_snapshots" ADD CONSTRAINT "valuation_snapshots_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "reconciliation_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "severity" text NOT NULL,
  "kind" text NOT NULL,
  "detail_jsonb" jsonb,
  "state" text NOT NULL,
  "opened_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
