-- Extensible ROVIQ Local taxonomy without rebuilding the legacy places table.
-- `category` remains the launch-era broad category for compatibility.
-- `category_key` stores the richer product taxonomy used by new submissions.

ALTER TABLE places ADD COLUMN category_key TEXT;

UPDATE places SET category_key = category WHERE category_key IS NULL;
CREATE INDEX IF NOT EXISTS idx_places_category_key ON places(category_key);

CREATE TABLE IF NOT EXISTS journey_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER REFERENCES places(id),
  market_slug TEXT,
  city TEXT,
  country_code TEXT,
  lat REAL,
  lng REAL,
  address TEXT,
  advisory_type TEXT NOT NULL CHECK(advisory_type IN ('access','road','parking','seasonal','closure','pedestrian','accessibility','official','other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  photo_url TEXT,
  submitted_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','expired','rejected','withdrawn')),
  starts_at TEXT,
  expires_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  moderation_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_journey_advisories_status ON journey_advisories(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_advisories_market ON journey_advisories(market_slug, status);
CREATE INDEX IF NOT EXISTS idx_journey_advisories_place ON journey_advisories(place_id, status);
