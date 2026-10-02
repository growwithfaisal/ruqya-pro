-- Optional accounts: a username and a password the phone has already stretched, and a copy of the reader's progress.
-- No email. The progress is stored sealed with a key that lives only as a Worker secret.
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  salt          TEXT NOT NULL,
  auth_hash     TEXT NOT NULL,           -- sha256(salt:auth); auth is what the phone derived from the password
  fails         INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 0,
  data          TEXT,                    -- iv.ciphertext (base64url), the progress JSON sealed with DATA_KEY
  data_at       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,          -- sha256 of the secret token the phone holds
  account_id  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id, created_at);

INSERT OR IGNORE INTO meta (k, n) VALUES ('accounts', 0);
