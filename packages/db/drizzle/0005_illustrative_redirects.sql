ALTER TABLE "campaigns" ADD COLUMN "is_illustrative" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
  "from_slug" text PRIMARY KEY NOT NULL,
  "to_slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
