# ROVIQ Local — Global architecture

ROVIQ Local uses one application and one global place catalog. Portland is the first populated market, not a hard boundary.

## Geographic model

Every place can carry:

- `country_code`
- `country`
- `region`
- `city`
- `locality`
- `postal_code`
- `market_slug`
- `timezone`
- `lat` / `lng`

`market_slug` is a stable human-readable market key such as `us-or-portland`, `us-wa-seattle`, or `ua-kyiv-kyiv`.

## Discovery flow

1. Ask for foreground location only.
2. Query `/api/places` with `lat`, `lng`, and `radius_km`.
3. The API applies a bounding-box database filter, then exact Haversine distance filtering.
4. Driver's Picks remain prioritized, followed by distance.
5. Users can also scope by `country_code`, `city`, or `market` when planning away from their current location.
6. If a market has no results, the product should show an empty-market state and invite a contribution instead of failing.

Examples:

`/api/places?lat=45.52&lng=-122.67&radius_km=25`

`/api/places?country_code=US&city=Seattle`

`/api/places?market=us-or-portland&category=coffee`

## Contribution flow

Geocoding should capture address context along with coordinates. New contributions are stored globally with geographic fields and always enter `pending` moderation status. Duplicate detection remains global by name and coordinate proximity.

## Moderation flow

The admin catalog remains authoritative. Moderation can filter by market/city as the network expands. A future moderator-role layer can assign curators by market without splitting the database.

## Android / car flow

Phone and Android Auto use the same API and data. Android Auto should request only nearby approved places and expose a simplified POI experience: nearby categories, trusted picks, place detail, and navigation handoff. Admin and contribution editing remain off the driving screen.

## Data principles

- One global catalog, no per-city databases.
- Latitude/longitude remain canonical for proximity.
- Geographic text fields support search, admin, analytics, and market expansion.
- Location is foreground/on-demand; no continuous background tracking is required for core ROVIQ Local discovery.
- Portland seed rows are migrated to `US / Oregon / Portland / us-or-portland` without changing existing IDs.
