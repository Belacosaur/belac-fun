CREATE TABLE IF NOT EXISTS station_entry_attempts (
 id uuid PRIMARY KEY, wallet text NOT NULL, station_id integer NOT NULL CHECK(station_id IN (1,6,8)),
 state text NOT NULL CHECK(state IN ('preparing','ready','signing','submitted','confirmed','failed','expired','cancelled','unknown')),
 mint text, plan jsonb, signature text UNIQUE, receipt jsonb, error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS station_entry_wallet_lock ON station_entry_attempts(wallet)
 WHERE state IN ('preparing','ready','signing','submitted','unknown');
CREATE UNIQUE INDEX IF NOT EXISTS station_entry_position_lock ON station_entry_attempts(wallet,station_id)
 WHERE state='confirmed';
