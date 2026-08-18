-- ROVIQ Local AI maintenance foundation.
-- AI proposes factual changes; it does not silently edit approved place knowledge.

ALTER TABLE places ADD COLUMN website_url TEXT;
ALTER TABLE places ADD COLUMN verification_source TEXT;
ALTER TABLE places ADD COLUMN confidence_score REAL;
ALTER TABLE places ADD COLUMN ai_review_status TEXT DEFAULT 'not_reviewed';
ALTER TABLE places ADD COLUMN suspected_change TEXT;
ALTER TABLE places ADD COLUMN last_ai_review_at TEXT;

CREATE TABLE IF NOT EXISTS ai_maintenance_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id),
  issue_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','resolved')),
  confidence REAL,
  priority INTEGER NOT NULL DEFAULT 50,
  source_type TEXT,
  source_url TEXT,
  current_snapshot TEXT,
  observed_snapshot TEXT,
  ai_result TEXT,
  proposed_changes TEXT,
  explanation TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_maintenance_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_queue_place ON ai_maintenance_queue(place_id, status);

CREATE TABLE IF NOT EXISTS ai_source_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id),
  source_type TEXT NOT NULL,
  source_url TEXT,
  payload TEXT NOT NULL,
  observed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_observations_place ON ai_source_observations(place_id, observed_at DESC);
