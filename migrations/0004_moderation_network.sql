-- ROVIQ Local scalable moderation and contributor network

CREATE TABLE IF NOT EXISTS contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK(role IN ('contributor','city_curator','regional_admin','super_admin')),
  reputation_score INTEGER NOT NULL DEFAULT 0,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  approvals_count INTEGER NOT NULL DEFAULT 0,
  rejections_count INTEGER NOT NULL DEFAULT 0,
  trusted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS curator_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL REFERENCES contributors(id),
  country_code TEXT,
  region TEXT,
  city TEXT,
  market_slug TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_curator_market ON curator_assignments(market_slug, active);
CREATE INDEX IF NOT EXISTS idx_curator_city ON curator_assignments(country_code, region, city, active);

CREATE TABLE IF NOT EXISTS moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id),
  action TEXT NOT NULL CHECK(action IN ('submitted','approved','rejected','hidden','restored','edited','changes_requested')),
  reviewer_handle TEXT,
  note TEXT,
  previous_status TEXT,
  new_status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_moderation_place ON moderation_events(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_action ON moderation_events(action, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_slug TEXT,
  city TEXT,
  type TEXT NOT NULL DEFAULT 'pending_submission',
  place_id INTEGER REFERENCES places(id),
  recipient_role TEXT NOT NULL DEFAULT 'curator',
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read','dismissed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON moderation_notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_market ON moderation_notifications(market_slug, status);
