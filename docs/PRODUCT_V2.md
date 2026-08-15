# ROVIQ Local product v2

## Product principle
ROVIQ Local is a small, trusted, driver-informed local guide rather than a general directory. The fast path is: establish location → show useful nearby places → explain why a place is trusted → hand off to navigation.

## User data flow
1. App starts and requests foreground location permission.
2. Approved, non-hidden places are loaded from D1.
3. User filters by category or sorts the list by proximity.
4. Place detail shows trust level, distance/open state, concise rationale, save and directions.
5. Directions hand off to Google Maps, Apple Maps or Waze. ROVIQ does not implement turn-by-turn navigation.

## Contribution data flow
1. Contributor enters place, category, rationale and address.
2. Address is geocoded.
3. API validates required fields and creates a pending place.
4. Curator reviews the queue or opens the full control center.
5. Curator can correct content, set trust level, mark Driver's Pick, verify, approve or reject.
6. Approved and non-hidden records become public.

## Curator control center
`/admin/manage.html` is the authoritative catalogue manager. It supports search, filtering, manual place creation, editing, moderation, trust level, Driver's Pick, verification timestamp, and soft hiding. `/admin/` remains the fast pending queue.

## Trust model
- `roviq`: editorial ROVIQ Pick.
- `driver`: recommended or verified by a ROVIQ driver.
- `community`: community submission that passed moderation.

Trust is editorial context, not a paid ranking. Sponsor status must never silently change trust level or organic rank.

## Freshness
`verified_at` records when a curator last checked a listing. `updated_at` records content edits. The admin UI exposes verification dates so stale listings can be reviewed periodically. Hidden listings remain in the database to preserve history and analytics.

## Moderation and abuse controls
The current shared passcode remains acceptable for a single-curator v1. Before adding multiple moderators, replace it with named authentication and role-based permissions. Add rate limiting and stronger spam controls before broad public contribution campaigns. Manual creation performs a duplicate check by name/proximity.

## GPS and maps
Foreground device geolocation is used for distance and proximity features. Mapbox remains the current map/geocoder provider until a production tile/geocoding provider is deliberately chosen. Do not rely on public OpenStreetMap tile servers as unlimited commercial infrastructure.

## Nielsen / interaction rules
- Always expose system status: locating, loading, submitting, saved, failed.
- Prefer real-world wording over database terminology in the consumer UI.
- Make map/list, close/back, save and directions predictable and reversible.
- Prevent duplicate submissions and validate location data before publishing.
- Keep the consumer interface intentionally minimal; ROVIQ is not Yelp.
- Use visible focus states, large touch targets and reduced-motion support.

## Car-screen architecture
The car surface is a separate native Android for Cars templated UI backed by the same `/api/places` data. It contains discovery and navigation only; admin and contribution stay off the vehicle display.

Car flow: ROVIQ Local → Nearby / ROVIQ Picks / Coffee / Food / Nature → place → Navigate.

The Android phone package should ultimately contain both the TWA phone experience and a native `CarAppService` using the Android for Cars App Library POI category. See `docs/ANDROID_AUTO.md`.

## Deployment sequence
1. Run `migrations/002_product_v2.sql` against the live D1 database.
2. Verify `/admin/manage.html` CRUD and approval behavior.
3. Change the public places query to exclude `is_hidden=1` once migration is live.
4. Finish production map token/domain restrictions.
5. Add 192×192, 512×512 and maskable app icons to the manifest.
6. Package the TWA Android app.
7. Integrate the Android for Cars POI service into that same Android package and test with the Desktop Head Unit before Play submission.
