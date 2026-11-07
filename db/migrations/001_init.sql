-- FoodDecode 2.0 — initial schema (SQLite). Sensitive columns (*_enc) hold AES-256-GCM ciphertext.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,           -- SHA-256 of the session token; the token itself is never stored
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data_enc    TEXT NOT NULL,              -- encrypted HealthProfile JSON (AAD = user id + purpose)
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_history (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_enc    TEXT NOT NULL,              -- encrypted {summary, snapshot}
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_history_user ON profile_history(user_id, created_at);

CREATE TABLE IF NOT EXISTS consents (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('health_data','cloud_ocr','scan_history')),
  granted     INTEGER NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language    TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi','ta')),
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_enc    TEXT NOT NULL,              -- encrypted {kind, productId | product snapshot, amount}
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scans_user ON scans(user_id, created_at);

CREATE TABLE IF NOT EXISTS comparisons (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_enc    TEXT NOT NULL,              -- encrypted {a, b, mode, amount}
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comparisons_user ON comparisons(user_id, created_at);

CREATE TABLE IF NOT EXISTS corrections (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  field       TEXT NOT NULL,
  value       TEXT NOT NULL,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'submitted',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_cache (
  barcode     TEXT PRIMARY KEY,
  data        TEXT NOT NULL,              -- normalised public product data (not user data)
  source      TEXT NOT NULL,
  fetched_at  TEXT NOT NULL
);
