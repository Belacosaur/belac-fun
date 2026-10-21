CREATE TABLE IF NOT EXISTS wallet_recovery_attempts (
 id uuid PRIMARY KEY, wallet text NOT NULL, destination text NOT NULL,
 state text NOT NULL CHECK(state IN ('preparing','ready','signing','submitted','confirmed','failed','expired')),
 plan jsonb, signature text UNIQUE, error text, receipt jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_recovery_active ON wallet_recovery_attempts(wallet)
 WHERE state IN ('preparing','ready','signing','submitted');
