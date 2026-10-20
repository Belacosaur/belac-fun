CREATE TYPE "user_role" AS ENUM ('owner', 'editor', 'viewer');
--> statement-breakpoint
CREATE TABLE "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "r2_key" text,
  "mime" text NOT NULL,
  "bytes" integer NOT NULL,
  "sha256" text NOT NULL,
  "width" integer,
  "height" integer,
  "alt_text" text NOT NULL,
  "state" text NOT NULL,
  CONSTRAINT "media_assets_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "content_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "challenge_id" uuid,
  "slug" text NOT NULL,
  "content_type" text NOT NULL,
  "title" text NOT NULL,
  "body_md" text NOT NULL,
  "status" text NOT NULL,
  "scheduled_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "cover_asset_id" uuid,
  "poster_url" text,
  CONSTRAINT "content_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_cover_asset_id_media_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "social_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_id" uuid NOT NULL,
  "platform" text NOT NULL,
  "url" text NOT NULL,
  "remote_post_id" text,
  "published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_content_id_content_posts_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_posts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "social_metric_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "social_post_id" uuid NOT NULL,
  "measured_at" timestamp with time zone NOT NULL,
  "views" integer,
  "impressions" integer,
  "reposts" integer,
  "likes" integer,
  "comments" integer,
  "profile_visits" integer,
  "clicks" integer,
  "provenance" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_metric_snapshots" ADD CONSTRAINT "social_metric_snapshots_social_post_id_social_posts_id_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_posts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_provider_sub" text NOT NULL,
  "role" "user_role" NOT NULL,
  "state" text NOT NULL,
  CONSTRAINT "users_identity_provider_sub_unique" UNIQUE("identity_provider_sub")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "diff_jsonb" jsonb
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_name" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "window_end" timestamp with time zone NOT NULL,
  "state" text NOT NULL,
  "attempts" integer NOT NULL,
  "completed_at" timestamp with time zone,
  "metrics_jsonb" jsonb
);
