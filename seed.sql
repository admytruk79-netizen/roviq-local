-- Initial approved places for Roviq Local (Portland, OR).
--
-- Coordinates for well-known landmarks (Multnomah Falls, Crystal Springs
-- Rhododendron Garden) are accurate. Coordinates for smaller shops/carts
-- are best-effort neighborhood-level approximations placed at the named
-- street/area from the curated list -- double check each one in /admin
-- (or a map) before relying on pin-exact placement, and correct any that
-- are off.
--
-- is_drivers_pick is left at the default (0) for all rows: only you know
-- which of these are your actual picks, so flag your favorites via the
-- /admin queue (or a quick UPDATE) rather than have this seed guess.

INSERT INTO places (name, category, description, lat, lng, address, status) VALUES
('Asylum Food Carts', 'food', 'SE Portland cart pod, a reliable stop for a quick, good meal.', 45.5039, -122.6425, 'SE Hawthorne Blvd, Portland, OR', 'approved'),
('Division/Clinton Food Carts', 'food', 'Cart pod along the Division/Clinton corridor, wide variety, easy pickup.', 45.5046, -122.6134, 'SE Division St & SE 50th Ave, Portland, OR', 'approved'),
('Mississippi Ave Food Carts', 'food', 'North Portland cart cluster on Mississippi Ave, good late-night options.', 45.5559, -122.6752, 'N Mississippi Ave, Portland, OR', 'approved'),
('Coava Coffee Roasters', 'coffee', 'Third-wave roaster on SE Grand, industrial-cozy space, excellent pour-over.', 45.5083, -122.6577, 'SE Grand Ave, Portland, OR', 'approved'),
('Case Study Coffee', 'coffee', 'Clean, minimalist cafe with reliably great espresso.', 45.5046, -122.6280, 'SE Division St, Portland, OR', 'approved'),
('Rose City Coffee', 'coffee', 'Neighborhood coffee shop in Rose City Park, low-key and welcoming.', 45.5372, -122.5978, 'NE Sandy Blvd, Portland, OR', 'approved'),
('Harder Day Coffee', 'coffee', 'Small-batch neighborhood roaster, good spot to recharge between rides.', 45.4980, -122.6100, 'SE Portland, OR', 'approved'),
('Autumn Coffee', 'coffee', 'North Portland cafe with a warm, plant-filled space.', 45.5588, -122.6890, 'N Portland, OR', 'approved'),
('JoLa Coffee', 'coffee', 'NE Portland coffee shop, good for a fast, quality stop.', 45.5460, -122.6300, 'NE Portland, OR', 'approved'),
('Kray''s Coffee', 'coffee', 'Ukrainian-owned, cozy, great pastries and lavender lattes. Riders always ask about it.', 45.6540, -122.5860, '7809 NE Vancouver Plaza Dr, Vancouver, WA', 'approved'),
('Lake Oswego Coffee House', 'coffee', 'Cozy suburban cafe south of the city, worth the detour for Lake Oswego drop-offs.', 45.4207, -122.6706, 'Lake Oswego, OR', 'approved'),
('Ken''s Artisan Bakery', 'food', 'NW 21st bakery, excellent pastries and bread, long-standing Portland favorite.', 45.5297, -122.6980, 'NW 21st Ave, Portland, OR', 'approved'),
('Friendship Kitchen', 'food', 'Comfort-food spot, generous portions, good for a real meal between rides.', 45.5050, -122.6450, 'SE Portland, OR', 'approved'),
('Breakside Brewery', 'breweries', 'North Portland brewery with a solid rotating lineup and a good taproom.', 45.5589, -122.6755, 'N Portland, OR', 'approved'),
('Crystal Springs Rhododendron Garden', 'nature', 'Quiet, well-kept garden in SE Portland -- a nice slow-down stop.', 45.4753, -122.6383, 'SE 28th Ave, Portland, OR', 'approved'),
('Multnomah Falls', 'nature', 'The tallest waterfall in Oregon, a must-see stop on the Historic Columbia River Highway.', 45.5763, -122.1158, 'Columbia River Gorge, OR', 'approved'),
('New Renaissance Bookshop', 'culture', 'NW Portland independent bookshop with a strong metaphysical/wellness section.', 45.5314, -122.6980, 'NW 23rd Ave, Portland, OR', 'approved'),
('Literary Arts Cafe', 'culture', 'Downtown literary nonprofit space with readings and a quiet cafe corner.', 45.5185, -122.6785, 'Downtown Portland, OR', 'approved'),
('Papa Haydn''s', 'food', 'NW Portland restaurant famous for its dessert case -- a classic Portland stop.', 45.5309, -122.6976, 'NW 23rd Ave, Portland, OR', 'approved'),
('Crust Collective', 'breweries', 'Detroit-style pizza and beer at Ruse Brewing, good patio for groups.', 45.5330, -122.6990, 'NW Slabtown, Portland, OR', 'approved');
