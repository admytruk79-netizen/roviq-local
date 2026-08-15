ALTER TABLE places ADD COLUMN updated_at TEXT;
ALTER TABLE places ADD COLUMN verified_at TEXT;
ALTER TABLE places ADD COLUMN is_hidden INTEGER DEFAULT 0;
ALTER TABLE places ADD COLUMN trust_level TEXT DEFAULT 'community' CHECK(trust_level IN ('roviq','driver','community'));
ALTER TABLE places ADD COLUMN moderation_note TEXT;

UPDATE places
SET updated_at = COALESCE(updated_at, created_at),
    verified_at = COALESCE(verified_at, created_at),
    trust_level = CASE WHEN is_drivers_pick = 1 THEN 'driver' ELSE 'community' END
WHERE updated_at IS NULL OR verified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_places_hidden ON places(is_hidden);
CREATE INDEX IF NOT EXISTS idx_places_verified_at ON places(verified_at);
