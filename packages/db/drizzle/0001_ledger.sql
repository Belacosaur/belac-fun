CREATE TYPE "source_status" AS ENUM ('verified_onchain', 'verified_provider', 'manual_evidence', 'unverified');
--> statement-breakpoint
CREATE TYPE "ledger_event_type" AS ENUM (
  'deposit',
  'withdrawal',
  'buy',
  'sell',
  'swap',
  'fee',
  'borrow',
  'repay',
  'interest',
  'reward',
  'funding',
  'liquidation',
  'lp_add',
  'lp_remove',
  'realized_pnl_adjustment',
  'correction'
);
--> statement-breakpoint
CREATE TABLE "source_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "source_type" text NOT NULL,
  "external_id" text NOT NULL,
  "external_url" text,
  "status" "source_status" NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL,
  "payload_hash" text NOT NULL,
  "metadata_jsonb" jsonb,
  CONSTRAINT "source_records_source_type_external_id" UNIQUE("source_type", "external_id")
);
--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "ledger_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "event_type" "ledger_event_type" NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "external_key" text NOT NULL,
  "reversal_of" uuid,
  "status" text NOT NULL,
  CONSTRAINT "ledger_events_challenge_id_external_key" UNIQUE("challenge_id", "external_key")
);
--> statement-breakpoint
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_source_id_source_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_reversal_of_fk" FOREIGN KEY ("reversal_of") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "signed_amount" numeric(38, 18) NOT NULL,
  "value_usd" numeric(24, 10) NOT NULL,
  "cost_usd" numeric(24, 10) NOT NULL,
  "leg_type" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_event_id_ledger_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
