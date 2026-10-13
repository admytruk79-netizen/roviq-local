# Backend API v2

The API remains additive: existing web, Android and iOS clients still receive `places` and the existing display fields. New responses include `api_version: 2` and request correlation header `X-Request-ID`.

## Nearby and pagination

`GET /api/places?lat=45.52&lng=-122.67&radius_km=50&category=coffee&limit=50&offset=0`

- Known temporary/permanent closures are excluded from discovery by default; use `include_closed=1` to inspect them. Public details remain available.
- Coordinates must be supplied together; latitude −90..90, longitude −180..180, radius 1..250 km. Invalid values return 400.
- Category uses the canonical category key. Country, city and market restrictions apply together with coordinates; missing geography is not assumed to be Portland.
- Date-line crossing and polar bounding boxes are supported. True spherical distance is calculated over candidate batches before selecting a result page. Nearby order is distance, then ID; editorial Pick indicators remain separate.
- `limit` defaults to 500, maximum 500; `offset` defaults to zero. `pagination` contains `total`, `has_more`, and `next_offset`.
- The query reads at most 10,000 geographic candidates. Larger candidate sets return 422 `scope_too_broad`, asking for a smaller radius/category/market rather than returning an inaccurate first 500. This is a bounded first-stage implementation; a dedicated indexed geospatial database is the next step for very dense markets.
- Offset pages are not a frozen catalog snapshot. Concurrent editorial changes can alter page membership.

## Freshness and useful stop details

Public list/detail records include `operational_status`, `open_now`, `opening_hours`, `parking`, `accessibility`, and `verification` (`state`, `last_verified_at`, `stale_after_days`, `source_url`). Unknown fields are null. Verification expires after 90 days. Open-now is calculated only for current verified data with a valid timezone and structured hours, or a verified explicit closure. Existing hours text is never guessed into a schedule.

`PATCH /api/admin/places/:id/details` requires an individual scoped moderator token or the existing super-admin escape hatch. Example body:

```json
{
  "operational_status": "open",
  "timezone": "America/Los_Angeles",
  "opening_hours": [{"day": 1, "start": "09:00", "end": "17:00"}],
  "parking": "Street parking nearby",
  "accessibility": "Step-free entrance",
  "source_url": "https://example.org/hours",
  "verify_now": true
}
```

A schedule describes the whole week; omitted days are treated as closed. Do not enter partial schedules as complete weekly hours. Days are Sunday=0 to Saturday=6. Windows can cross midnight. Omit unknown accessibility/parking details rather than inventing them. `verify_now` requires an HTTPS evidence source. Changing details without verification invalidates the old detail verification. Updates and their moderation audit entry commit atomically. Existing catalog places are not automatically marked verified by this release.

## Accounts and saved places

Individual contributor tokens already exist and are SHA-256 hashed at rest. City curators are permitted to moderate; every field of an assignment restricts access. Provisioning validates assignments before granting privileges, replaces previous active assignments when rotating credentials, and records credential changes in a security audit table. The existing ADMIN_PASSCODE remains a migration escape hatch; switch day-to-day moderation to individual tokens.

- `GET /api/saved`: account's approved visible saved places.
- `POST /api/saved`: body `{"place_id":123}`, idempotent save (up to 500).
- `DELETE /api/saved/:id`: idempotent removal for the authenticated account only.

Send `Authorization: Bearer <individual token>`. No shared-passcode favorites and no cross-account reads. The current visitor UI still saves locally; authenticated client sync/sign-in UI is a separate integration. No visitor accounts were created automatically.

## Operations and recovery

Public API requests have per-IP Cloudflare rate limits of 300/minute; admin and write requests share a 30/minute limit. Limits are per Cloudflare location, not a globally strict quota. Clients should honor 429 `Retry-After` and retain safe last-known data.

Worker observability samples 10% of invocations. Application logs carry request ID, route, method, status and elapsed time, without query strings, coordinates, credentials or request bodies. Cloudflare platform logging may include its own request metadata; review account log access and retention separately.

`/api/health` checks database access and the required catalog/detail tables and returns 503 when unavailable without exposing internal SQL errors. GitHub's periodic health workflow checks availability every 15 minutes; workflow failures are visible through normal repository notifications. No separate external alert destination was configured.

Deployment records a D1 Time Travel bookmark and applies the repeatable additive `0014_place_freshness.sql` migration before the new Worker. No table is dropped and no existing place data is rewritten. Restore capability/retention follows your Cloudflare plan; perform a documented restore drill on an isolated copy before relying on a production rollback. This release does not claim a completed restore drill.

Regression tests: `npm test` on Node 24. Covers real SQLite queries, geographic boundaries, nearest-before-limit, pagination validation, freshness/timezones, scope escalation, credential rotation, account isolation and request limiting. Deployment smoke checks the actual live API schema and contracts.
