-- Immutable research output, independent of signing, execution jobs and illustrative campaigns.
CREATE TABLE IF NOT EXISTS research_runs (
  id uuid PRIMARY KEY,
  wallet_address text NOT NULL,
  policy_version text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('complete', 'partial')),
  mode text NOT NULL CHECK (mode = 'dry-run'),
  payload jsonb NOT NULL,
  markdown text NOT NULL,
  CHECK ((payload->>'executionEnabled')::boolean = false)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS research_runs_wallet_time ON research_runs (wallet_address, completed_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS research_observations (
  run_id uuid NOT NULL REFERENCES research_runs(id),
  source_id text NOT NULL,
  url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'unavailable')),
  sha256 text,
  payload jsonb,
  error text,
  PRIMARY KEY (run_id, source_id)
);
