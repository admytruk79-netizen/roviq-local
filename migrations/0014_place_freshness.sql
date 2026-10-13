-- Additive and repeatable: existing places, credentials and editorial decisions are unchanged.
CREATE TABLE IF NOT EXISTS place_details (
 place_id INTEGER PRIMARY KEY REFERENCES places(id),
 operational_status TEXT NOT NULL DEFAULT 'unknown' CHECK(operational_status IN ('unknown','open','temporarily_closed','permanently_closed')),
 hours_json TEXT,
 timezone TEXT,
 parking TEXT,
 accessibility TEXT,
 verified_at TEXT,
 source_url TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_place_details_verified ON place_details(verified_at);
CREATE INDEX IF NOT EXISTS idx_places_public_geo ON places(status,is_hidden,lat,lng,id);

CREATE TABLE IF NOT EXISTS saved_places (
 contributor_id INTEGER NOT NULL REFERENCES contributors(id),
 place_id INTEGER NOT NULL REFERENCES places(id),
 saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(contributor_id,place_id)
);
CREATE TABLE IF NOT EXISTS security_audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_handle TEXT NOT NULL,
 contributor_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
