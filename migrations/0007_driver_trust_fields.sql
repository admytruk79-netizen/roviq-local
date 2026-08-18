-- Ties place submissions to a real, authenticated contributor identity instead of
-- free-text "driver identity", and adds the structured driver-recommendation
-- fields the submission form now collects.

ALTER TABLE places ADD COLUMN why_stop TEXT;
ALTER TABLE places ADD COLUMN recommended_for TEXT;
ALTER TABLE places ADD COLUMN local_tip TEXT;
ALTER TABLE places ADD COLUMN contributor_id INTEGER REFERENCES contributors(id);
ALTER TABLE places ADD COLUMN contributor_role TEXT;
ALTER TABLE places ADD COLUMN verification_status TEXT DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_places_contributor ON places(contributor_id);
