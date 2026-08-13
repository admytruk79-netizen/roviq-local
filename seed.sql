-- Initial approved places for Roviq Local (Portland, OR).
--
-- Coordinates for well-known landmarks (Multnomah Falls, Crystal Springs
-- Rhododendron Garden) are accurate. Coordinates for smaller shops/carts
-- are best-effort neighborhood-level approximations placed at the named
-- street/area from the curated list -- double check each one in /admin
-- (or a map) before relying on pin-exact placement, and correct any that
-- are off.
--
-- is_drivers_pick is set to 1 for Case Study Coffee, Coava Coffee, and
-- Kray's Coffee per the curator's picks -- everything else defaults to 0.

INSERT INTO places (name, category, description, lat, lng, address, is_drivers_pick, status) VALUES
('Asylum Food Carts', 'food', 'SE Portland cart pod on the east side, a reliable stop for a quick, good meal.', 45.5039, -122.6425, 'SE Hawthorne Blvd, Portland, OR', 0, 'approved'),
('Division/Clinton Food Carts', 'food', 'East-side cart pod along the Division/Clinton corridor, wide variety, easy pickup.', 45.5046, -122.6134, 'SE Division St & SE 50th Ave, Portland, OR', 0, 'approved'),
('Mississippi Ave Food Carts', 'food', 'North Portland cart cluster on Mississippi Ave, good late-night options.', 45.5559, -122.6752, 'N Mississippi Ave, Portland, OR', 0, 'approved'),
('Friendship Kitchen', 'food', 'Vietnamese kitchen paired with Stem Wine Bar on N Mississippi Ave -- a real meal, not a snack.', 45.5570, -122.6755, 'N Mississippi Ave, Portland, OR', 0, 'approved'),
('Crust Collective', 'food', 'Detroit-style pizza and beer inside Ruse Brewing, NW Slabtown -- good patio for groups.', 45.5330, -122.6990, 'NW Slabtown, Portland, OR', 0, 'approved'),
('Ken''s Artisan Bakery', 'food', 'SE Burnside bakery, excellent pastries and bread, long-standing Portland favorite.', 45.5225, -122.6558, 'SE Burnside St, Portland, OR', 0, 'approved'),
('Taco Spot (name TBD)', 'food', 'Placeholder pin for a taco spot along Milwaukie Ave near Westmoreland/Sellwood -- confirm the name and swap this in via /admin.', 45.4680, -122.6480, 'Milwaukie Ave, Westmoreland/Sellwood, Portland, OR', 0, 'approved'),
('Case Study Coffee', 'coffee', 'Clean, minimalist cafe with reliably great espresso.', 45.5046, -122.6280, 'SE Division St, Portland, OR', 1, 'approved'),
('Rose City Coffee', 'coffee', 'Neighborhood coffee shop in Rose City Park, low-key and welcoming.', 45.5372, -122.5978, 'NE Sandy Blvd, Portland, OR', 0, 'approved'),
('Coava Coffee Roasters', 'coffee', 'Third-wave roaster on SE Grand, industrial-cozy space, excellent pour-over.', 45.5083, -122.6577, 'SE Grand Ave, Portland, OR', 1, 'approved'),
('Barista', 'coffee', 'NW 23rd espresso bar, a solid stop while a rider browses the shops nearby.', 45.5307, -122.6984, 'NW 23rd Ave, Portland, OR', 0, 'approved'),
('Harder Day Coffee', 'coffee', 'Small-batch neighborhood roaster in SE Portland, good spot to recharge between rides.', 45.4980, -122.6100, 'SE Portland, OR', 0, 'approved'),
('Autumn Coffee Roasting', 'coffee', 'Concordia neighborhood roaster on NE Killingsworth, warm and plant-filled.', 45.5652, -122.6390, 'NE Killingsworth St, Concordia, Portland, OR', 0, 'approved'),
('JoLa Cafe', 'coffee', 'Johns Landing cafe in SW Portland, a good fast stop on river-side drop-offs.', 45.4790, -122.6720, 'SW Macadam Ave, Johns Landing, Portland, OR', 0, 'approved'),
('Lake Oswego Coffee House & Wine Bar', 'coffee', 'Cozy suburban cafe and wine bar south of the city, worth the detour for Lake Oswego drop-offs.', 45.4207, -122.6706, 'Lake Oswego, OR', 0, 'approved'),
('Kray''s Coffee', 'coffee', 'Ukrainian-owned, cozy, great pastries and lavender lattes. Riders always ask about it.', 45.6540, -122.5860, '7809 NE Vancouver Plaza Dr, Vancouver, WA', 1, 'approved'),
('Breakside Brewery', 'breweries', 'Beaverton taproom with a solid rotating lineup.', 45.4970, -122.8034, 'Cedar Hills Blvd, Beaverton, OR', 0, 'approved'),
('Crystal Springs Rhododendron Garden', 'nature', 'Quiet, well-kept garden in SE Portland -- a nice slow-down stop.', 45.4753, -122.6383, 'SE 28th Ave, Portland, OR', 0, 'approved'),
('Multnomah Falls', 'nature', 'The tallest waterfall in Oregon and anchor of the Columbia Gorge waterfall cluster, a must-see stop on the Historic Columbia River Highway.', 45.5763, -122.1158, 'Columbia River Gorge, OR', 0, 'approved'),
('New Renaissance Bookshop', 'culture', 'NW Portland independent bookshop with a strong metaphysical/wellness section.', 45.5314, -122.6980, 'NW 23rd Ave, Portland, OR', 0, 'approved'),
('Literary Arts Cafe', 'culture', 'Downtown literary nonprofit space on SE Grand Ave with readings and a quiet cafe corner.', 45.5185, -122.6785, 'SE Grand Ave, Portland, OR', 0, 'approved'),
('Papa Haydn''s', 'food', 'NW Portland restaurant famous for its dessert case -- posh but affordable, a classic Portland stop.', 45.5309, -122.6976, 'NW 23rd Ave, Portland, OR', 0, 'approved');
