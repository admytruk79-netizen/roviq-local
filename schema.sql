-- v1 schema: only `places` is needed for the free curated-guide phase.
-- shops / discounts / redemptions live in migrations/002_shops_sponsorship.sql
-- and should only be applied once the first sponsor signs on.

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('food','coffee','breweries','nature','culture')),
  description TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT,
  photo_url TEXT,
  hours TEXT,
  is_drivers_pick INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected')),
  submitted_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
