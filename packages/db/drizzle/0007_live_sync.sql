-- Independent of illustrative campaigns. No signing material is stored here.
CREATE TABLE IF NOT EXISTS studio_snapshots (
  wallet_address text PRIMARY KEY,
  observed_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS studio_sync_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL,
  observed_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS studio_sync_history_wallet_time
  ON studio_sync_history (wallet_address, observed_at DESC);
