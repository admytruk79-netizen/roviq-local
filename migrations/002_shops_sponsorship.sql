-- Apply once the first sponsor signs on. Not part of v1.

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
