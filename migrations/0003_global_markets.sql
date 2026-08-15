-- Expand the existing Portland-first database into a global catalog without deleting data.
ALTER TABLE places ADD COLUMN country_code TEXT;
ALTER TABLE places ADD COLUMN country TEXT;
ALTER TABLE places ADD COLUMN region TEXT;
ALTER TABLE places ADD COLUMN city TEXT;
ALTER TABLE places ADD COLUMN locality TEXT;
ALTER TABLE places ADD COLUMN postal_code TEXT;
ALTER TABLE places ADD COLUMN market_slug TEXT;
ALTER TABLE places ADD COLUMN timezone TEXT;

-- Existing seed content is Portland, Oregon.
UPDATE places
SET country_code = COALESCE(country_code, 'US'),
    country = COALESCE(country, 'United States'),
    region = COALESCE(region, 'Oregon'),
    city = COALESCE(city, 'Portland'),
    market_slug = COALESCE(market_slug, 'us-or-portland'),
    timezone = COALESCE(timezone, 'America/Los_Angeles');

CREATE INDEX IF NOT EXISTS idx_places_country_city ON places(country_code, city);
CREATE INDEX IF NOT EXISTS idx_places_market ON places(market_slug);
CREATE INDEX IF NOT EXISTS idx_places_lat_lng ON places(lat, lng);
