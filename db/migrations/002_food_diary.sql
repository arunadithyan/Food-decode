-- 002: food diary (consumption log) and its own consent.

-- Consents gain a fourth kind, 'food_log'. SQLite cannot alter a CHECK constraint, so the table is rebuilt.
CREATE TABLE consents_new (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('health_data', 'cloud_ocr', 'scan_history', 'food_log')),
  granted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);
INSERT INTO consents_new (user_id, kind, granted, updated_at) SELECT user_id, kind, granted, updated_at FROM consents;
DROP TABLE consents;
ALTER TABLE consents_new RENAME TO consents;
INSERT OR IGNORE INTO consents (user_id, kind, granted, updated_at) SELECT id, 'food_log', 0, created_at FROM users;

-- One row per food eaten. `day` is the user's local calendar date (YYYY-MM-DD); everything else is encrypted.
CREATE TABLE IF NOT EXISTS food_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  data_enc TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS food_log_user_day ON food_log (user_id, day);

-- Diary settings (e.g. the user's own daily calorie target), encrypted.
CREATE TABLE IF NOT EXISTS diary_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data_enc TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
