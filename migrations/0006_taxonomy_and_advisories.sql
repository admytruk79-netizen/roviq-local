-- Extensible ROVIQ Local taxonomy and Journey Advisory expansion.
-- Apply after 0005_commercial_trust_layers.sql.
-- `category` remains the launch-era broad category for compatibility.
-- `category_key` stores the richer product taxonomy used by new submissions.

ALTER TABLE places ADD COLUMN category_key TEXT;
UPDATE places SET category_key = category WHERE category_key IS NULL;
CREATE INDEX IF NOT EXISTS idx_places_category_key ON places(category_key);

-- 0005 creates journey_advisories. Extend it here with geographic and submission fields
-- required by the public reporting workflow and admin queue.
ALTER TABLE journey_advisories ADD COLUMN city TEXT;
ALTER TABLE journey_advisories ADD COLUMN country_code TEXT;
ALTER TABLE journey_advisories ADD COLUMN lat REAL;
ALTER TABLE journey_advisories ADD COLUMN lng REAL;
ALTER TABLE journey_advisories ADD COLUMN address TEXT;
ALTER TABLE journey_advisories ADD COLUMN photo_url TEXT;
ALTER TABLE journey_advisories ADD COLUMN submitted_by TEXT;
ALTER TABLE journey_advisories ADD COLUMN moderation_note TEXT;

CREATE INDEX IF NOT EXISTS idx_journey_advisories_status ON journey_advisories(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_advisories_market ON journey_advisories(market_slug, status);
CREATE INDEX IF NOT EXISTS idx_journey_advisories_place ON journey_advisories(place_id, status);
