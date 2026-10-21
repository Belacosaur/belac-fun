CREATE TABLE IF NOT EXISTS wallet_trade_challenges (
 id uuid PRIMARY KEY, wallet text NOT NULL, origin text NOT NULL, message text NOT NULL,
 expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS wallet_trade_sessions (
 token_hash text PRIMARY KEY, wallet text NOT NULL, origin text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS wallet_trade_attempts (
 id uuid PRIMARY KEY, wallet text NOT NULL, station integer NOT NULL CHECK(station=5), mint text NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','preparing','ready','awaiting_submission','submitted','confirmed','reconciled','failed','expired','unknown','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 plan jsonb, signature text UNIQUE, error text, receipt jsonb,
 CHECK(receipt IS NULL OR state='reconciled')
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_trade_station_lock ON wallet_trade_attempts(wallet,station)
 WHERE state NOT IN ('failed','expired','cancelled');
CREATE INDEX IF NOT EXISTS wallet_trade_queue ON wallet_trade_attempts(state,created_at);
CREATE TABLE IF NOT EXISTS wallet_trade_fee_events (
 signature text PRIMARY KEY, wallet text NOT NULL, lamports bigint NOT NULL CHECK(lamports>0)
);
