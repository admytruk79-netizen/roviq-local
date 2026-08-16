-- ROVIQ Local commercial, entitlement and evidence-based trust foundations.
-- These tables establish the data model without forcing unfinished features into the public UI.

CREATE TABLE IF NOT EXISTS local_partner_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL UNIQUE REFERENCES shops(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','paused','suspended','ended')),
  tier TEXT NOT NULL DEFAULT 'partner' CHECK(tier IN ('partner','partner_pro')),
  claimed_at TEXT,
  approved_at TEXT,
  approved_by TEXT,
  public_partner_badge INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_partner_status ON local_partner_profiles(status, tier);

CREATE TABLE IF NOT EXISTS local_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_profile_id INTEGER NOT NULL REFERENCES local_partner_profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL DEFAULT 'all' CHECK(audience IN ('all','member','professional_driver','trusted_contributor')),
  offer_type TEXT NOT NULL DEFAULT 'benefit' CHECK(offer_type IN ('benefit','percent','fixed','perk')),
  value_text TEXT,
  terms TEXT,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_offers_active ON local_offers(active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS local_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_key TEXT NOT NULL,
  entitlement_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','google_play','app_store','partner','promotion')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','grace','expired','revoked')),
  starts_at TEXT,
  ends_at TEXT,
  external_reference TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  UNIQUE(subject_key, entitlement_key, source)
);

CREATE INDEX IF NOT EXISTS idx_local_entitlements_subject ON local_entitlements(subject_key, status);

CREATE TABLE IF NOT EXISTS local_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  market_slug TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','plus','admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS local_collection_items (
  collection_id INTEGER NOT NULL REFERENCES local_collections(id),
  place_id INTEGER NOT NULL REFERENCES places(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  editorial_note TEXT,
  PRIMARY KEY(collection_id, place_id)
);

CREATE TABLE IF NOT EXISTS journey_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER REFERENCES places(id),
  market_slug TEXT,
  advisory_type TEXT NOT NULL CHECK(advisory_type IN ('access','road','parking','seasonal','closure','pedestrian','official')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  evidence_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','expired','rejected','withdrawn')),
  starts_at TEXT,
  expires_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_journey_advisories_place ON journey_advisories(place_id, status);
CREATE INDEX IF NOT EXISTS idx_journey_advisories_market ON journey_advisories(market_slug, status);

CREATE TABLE IF NOT EXISTS verification_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id),
  verification_type TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence_source TEXT,
  evidence_reference TEXT,
  verified_by TEXT,
  verified_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_place ON verification_records(place_id, status);

CREATE TABLE IF NOT EXISTS commercial_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_handle TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commercial_audit_entity ON commercial_audit_events(entity_type, entity_id, created_at DESC);
