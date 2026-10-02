-- One row per phone that turned reminders on.
-- No names, no coordinates, no reminder text: only where to poke and when.
CREATE TABLE IF NOT EXISTS subs (
  id          TEXT PRIMARY KEY,           -- sha256 of the push address
  endpoint    TEXT NOT NULL,              -- the push address (a secret URL from Apple, Google or Mozilla)
  token_hash  TEXT NOT NULL,              -- sha256 of the secret only that phone holds
  times       TEXT NOT NULL,              -- JSON array of epoch seconds, ascending, minute-aligned
  next_at     INTEGER NOT NULL DEFAULT 0, -- the next time in `times`, or 0 when none is left
  shard       INTEGER NOT NULL DEFAULT 0,
  synced_at   INTEGER NOT NULL,
  tested_at   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subs_due ON subs (shard, next_at);

-- A running count, so the sign-up cap does not need to scan the table.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
INSERT OR IGNORE INTO meta (k, n) VALUES ('subs', 0);
