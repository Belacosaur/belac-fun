CREATE TYPE "campaign_state" AS ENUM ('draft', 'scheduled', 'active', 'frozen', 'closed');
--> statement-breakpoint
CREATE TYPE "challenge_state" AS ENUM ('planned', 'live', 'paused', 'closed', 'invalidated');
--> statement-breakpoint
CREATE TABLE "campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "state" "campaign_state" NOT NULL,
  "policy_version" text NOT NULL,
  "base_currency" text NOT NULL,
  CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "homepage_url" text NOT NULL,
  "x_handle" text,
  "status" text NOT NULL,
  "verified_at" timestamp with time zone,
  CONSTRAINT "providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "provider_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "strategy_type" text NOT NULL,
  "state" "challenge_state" NOT NULL,
  "allocation_usd" numeric(24, 8) NOT NULL,
  "begins_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "published_at" timestamp with time zone,
  "rank_order" integer NOT NULL,
  CONSTRAINT "challenges_slug_unique" UNIQUE("slug"),
  CONSTRAINT "allocation_usd_nonnegative" CHECK ("allocation_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "chain" text NOT NULL,
  "public_address" text,
  "external_account_ref" text,
  "visibility" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain" text NOT NULL,
  "mint_or_symbol" text NOT NULL,
  "symbol" text NOT NULL,
  "decimals" integer NOT NULL,
  "pricing_key" text NOT NULL,
  CONSTRAINT "assets_chain_mint_or_symbol" UNIQUE("chain","mint_or_symbol")
);
