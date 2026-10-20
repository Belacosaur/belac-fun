CREATE INDEX "ledger_events_challenge_effective_at_idx" ON "ledger_events" ("challenge_id", "effective_at" DESC);
--> statement-breakpoint
CREATE INDEX "price_observations_asset_observed_at_idx" ON "price_observations" ("asset_id", "observed_at" DESC);
--> statement-breakpoint
CREATE INDEX "valuation_snapshots_challenge_observed_at_idx" ON "valuation_snapshots" ("challenge_id", "observed_at" DESC);
--> statement-breakpoint
CREATE INDEX "content_posts_status_published_at_idx" ON "content_posts" ("status", "published_at" DESC);
--> statement-breakpoint
CREATE INDEX "source_records_external_id_idx" ON "source_records" ("external_id");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'belac_app') THEN
    CREATE ROLE belac_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "ledger_events", "ledger_entries" TO belac_app;
--> statement-breakpoint
REVOKE UPDATE (signed_amount, value_usd, cost_usd) ON TABLE "ledger_entries" FROM belac_app;
