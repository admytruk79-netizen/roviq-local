-- ROVIQ Local schema.
-- `places` powers discovery and moderation. Sponsor tables remain dormant until commercial launch.

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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  verified_at TEXT,
  is_hidden INTEGER DEFAULT 0,
  trust_level TEXT DEFAULT 'community' CHECK(trust_level IN ('roviq','driver','community')),
  moderation_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_hidden ON places(is_hidden);
CREATE INDEX IF NOT EXISTS idx_places_verified_at ON places(verified_at);

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id),
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  plan_tier TEXT DEFAULT 'free' CHECK(plan_tier IN ('free','sponsored')),
  sponsor_start_date TEXT,
  sponsor_end_date TEXT
);

CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  terms TEXT,
  code TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_id INTEGER NOT NULL REFERENCES discounts(id),
  redeemed_at TEXT DEFAULT CURRENT_TIMESTAMP
);
