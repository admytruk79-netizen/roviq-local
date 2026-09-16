-- Add Taborhood Cafe in Mt. Tabor to the approved ROVIQ Local catalog.
-- Verified current listing: 6049 SE Stark St, Portland, OR 97215; neighborhood cafe in a converted fire station.
INSERT INTO places (
  name, category, category_key, description, why_stop, recommended_for, local_tip,
  lat, lng, address, country_code, country, region, city, locality, postal_code,
  market_slug, timezone, hours, status, submitted_by, updated_at, verified_at,
  is_hidden, is_drivers_pick, trust_level, verification_status
)
SELECT
  'Taborhood Cafe',
  'coffee',
  'coffee',
  'Neighborhood coffee shop and cafe in Portland''s Mt. Tabor area, set inside a converted fire station.',
  'A genuinely local Mt. Tabor coffee stop with a neighborhood feel, good coffee and an unusual historic setting.',
  'Coffee drinkers, Mt. Tabor visitors, neighborhood walks, casual meetups and a pre- or post-park stop.',
  'Pair it with a visit to Mt. Tabor Park; it is a strong neighborhood stop rather than a generic destination cafe.',
  45.5194,
  -122.6013,
  '6049 SE Stark St, Portland, OR 97215',
  'US',
  'United States',
  'Oregon',
  'Portland',
  'Mt. Tabor',
  '97215',
  'us-or-portland',
  'America/Los_Angeles',
  'Daily 7 AM-4 PM',
  'approved',
  'Oleksandr Dmytruk',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0,
  1,
  'roviq',
  'trusted'
WHERE NOT EXISTS (
  SELECT 1 FROM places
  WHERE lower(name) = 'taborhood cafe'
     OR lower(address) = '6049 se stark st, portland, or 97215'
);

UPDATE places
SET status = 'approved',
    is_hidden = 0,
    is_drivers_pick = 1,
    trust_level = 'roviq',
    verification_status = 'trusted',
    updated_at = CURRENT_TIMESTAMP,
    verified_at = CURRENT_TIMESTAMP
WHERE lower(name) = 'taborhood cafe'
   OR lower(address) = '6049 se stark st, portland, or 97215';
