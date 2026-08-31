-- Add Jebale Coffee's Portland Lovejoy location to the approved ROVIQ Local catalog.
-- Sources: Jebale Coffee official site; current business listing for 1350 NW Lovejoy St, Portland, OR 97209.
INSERT INTO places (
  name,
  category,
  category_key,
  description,
  why_stop,
  recommended_for,
  local_tip,
  lat,
  lng,
  address,
  country_code,
  country,
  region,
  city,
  locality,
  postal_code,
  market_slug,
  timezone,
  hours,
  status,
  submitted_by,
  updated_at,
  verified_at,
  is_hidden,
  trust_level,
  verification_status
)
SELECT
  'Jebale Coffee',
  'coffee',
  'coffee',
  'Specialty coffee shop focused on sustainably sourced, single-origin Ugandan coffee and direct relationships with farming communities.',
  'A distinctive Northwest Portland stop for Ugandan specialty coffee, house-made flavors and a compact neighborhood cafe experience.',
  'Specialty coffee drinkers, Pearl District walkers and anyone looking for an independent Portland coffee stop.',
  'Jebale''s Portland location is at 1350 NW Lovejoy St, in the former Nossa Familia space near NW 13th and Lovejoy.',
  45.5298248,
  -122.6848475,
  '1350 NW Lovejoy St, Portland, OR 97209',
  'US',
  'United States',
  'Oregon',
  'Portland',
  'Pearl District',
  '97209',
  'us-or-portland',
  'America/Los_Angeles',
  'Mon-Thu 7 AM-4 PM; Fri 7 AM-3 PM; Sat-Sun 9 AM-1 PM',
  'approved',
  'Oleksandr Dmytruk',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0,
  'roviq',
  'trusted'
WHERE NOT EXISTS (
  SELECT 1
  FROM places
  WHERE lower(name) = 'jebale coffee'
    AND ABS(lat - 45.5298248) < 0.0002
    AND ABS(lng - -122.6848475) < 0.0002
);
