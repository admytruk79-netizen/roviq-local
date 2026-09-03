-- Add the current Prince Coffee Northwest location to the approved Portland catalog.
-- Source: https://princecoffee.com/pages/locations
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
  'Prince Coffee',
  'coffee',
  'coffee',
  'Woman-owned specialty coffee shop and natural wine bar serving coffee, tea, breakfast, snacks and carefully selected objects.',
  'A polished Northwest Portland stop for specialty coffee, tea, breakfast or a slower evening glass of wine.',
  'Coffee drinkers, casual meetings and anyone exploring Northwest Portland.',
  'The official Northwest location is at 915A NW 19th Ave and is open daily from 7 AM to 8 PM.',
  45.5295621,
  -122.6906353,
  '915A NW 19th Ave, Portland, OR 97209',
  'US',
  'United States',
  'Oregon',
  'Portland',
  'Northwest District',
  '97209',
  'us-or-portland',
  'America/Los_Angeles',
  'Every day 7:00 AM–8:00 PM',
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
  WHERE lower(name) = 'prince coffee'
    AND ABS(lat - 45.5295621) < 0.0002
    AND ABS(lng - -122.6906353) < 0.0002
);
