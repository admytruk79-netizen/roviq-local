-- Add Caffè Umbria's Portland Market Café to the approved ROVIQ Local catalog.
-- Source: Caffè Umbria official café listing for 200 SW Market St, Suite P106, Portland, OR 97201.
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
  is_drivers_pick,
  trust_level,
  verification_status
)
SELECT
  'Caffè Umbria — Market Café',
  'coffee',
  'coffee',
  'Italian-style espresso bar in Portland''s 200 Market Building, serving traditional espresso drinks, seasonal specials, breakfast and lunch items.',
  'A polished downtown coffee stop with a modern, cozy interior and spacious partially covered, heated outdoor seating.',
  'Espresso drinkers, downtown workers, PSU visitors, Keller Auditorium guests and anyone looking for an Italian-style café stop.',
  'The Market Café is in the 200 Market Building, across from Keller Auditorium and within walking distance of Portland State University and the waterfront.',
  45.5115,
  -122.6788,
  '200 SW Market St, Suite P106, Portland, OR 97201',
  'US',
  'United States',
  'Oregon',
  'Portland',
  'Downtown',
  '97201',
  'us-or-portland',
  'America/Los_Angeles',
  'Mon-Fri 7 AM-5 PM; Sat-Sun 8 AM-3 PM',
  'approved',
  'Oleksandr Dmytruk',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0,
  1,
  'roviq',
  'trusted'
WHERE NOT EXISTS (
  SELECT 1
  FROM places
  WHERE lower(name) LIKE 'caff% umbria%market%'
    OR lower(address) = '200 sw market st, suite p106, portland, or 97201'
);

UPDATE places
SET status = 'approved',
    is_hidden = 0,
    is_drivers_pick = 1,
    trust_level = 'roviq',
    verification_status = 'trusted',
    updated_at = CURRENT_TIMESTAMP,
    verified_at = CURRENT_TIMESTAMP
WHERE lower(name) LIKE 'caff% umbria%market%'
   OR lower(address) = '200 sw market st, suite p106, portland, or 97201';
