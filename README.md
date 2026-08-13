# Roviq Local

A driver-curated, map-based local guide for rideshare visitors to Portland,
OR. Free for riders, driver-first distribution, sponsorship-funded by shops
later. See the original build brief for full product context.

## Stack

- **Frontend**: static single-page app — plain HTML/CSS/JS, no build step —
  served from `public/`
- **Map**: Mapbox GL JS, lightly re-styled at runtime (muted water/landuse)
  on top of the `light-v11` base style
- **Hosting**: Cloudflare Pages (static assets) + Pages Functions (API
  routes, in `functions/`)
- **Database**: Cloudflare D1 (SQLite)
- **Android**: Trusted Web Activity (TWA) wrapping the live site — see
  [Android packaging](#android-packaging-twa)

## Project layout

```
public/                 Static frontend (deployed as-is by Pages)
  index.html             Welcome screen, map, list view, suggest form, bottom sheet
  admin/                 Passcode-gated curator queue
  css/styles.css         Design system (design tokens + all component styles)
  js/app.js              Map, filters, list, bottom sheet, suggest form, geocoding
  mockups/                Reference mockup (driver submit + curator queue) this build was based on
  manifest.json           Web app manifest (needed for TWA packaging)
functions/               Cloudflare Pages Functions (file-based routing)
  api/places/             GET/POST /api/places, GET /api/places/:id,
                           POST /api/places/:id/view
  api/admin/queue.js       GET /api/admin/queue (curator-only)
  api/admin/places/[id].js PATCH /api/admin/places/:id (curator-only, approve/reject)
  api/config.js            Exposes the public Mapbox token to the client
  _lib/auth.js             Shared passcode-auth helper
schema.sql               v1 schema: places, plus shops/discounts/redemptions
                          (created now per the build brief so no later
                          migration is needed; left empty/unused until a
                          sponsor signs on)
seed.sql                 Initial curated places for Portland
```

## What's already provisioned

- **D1 database**: `roviq-local` (uuid `9a594b6c-0e35-4417-afbc-d072166b3e98`)
  already exists in the connected Cloudflare account, bound as `DB` in
  `wrangler.toml`. All four tables from `schema.sql` (`places`, `shops`,
  `discounts`, `redemptions`) are live on it.
- **Seed data is loaded** — the live database already has the 22 curated
  places from `seed.sql` (3 flagged as driver's picks). Re-running
  `npm run db:seed:remote` would duplicate rows, so only do that against a
  freshly-migrated database.

## What you still need to do

1. **Mapbox account + token** — sign up at mapbox.com, create a **public**
   access token, and restrict it to your Pages domain (Tokens → URL
   restrictions) so it can't be used to run up your bill from elsewhere. It's
   safe to expose this token client-side once restricted — that's how Mapbox
   public tokens are meant to be used.
2. **Connect this repo to Cloudflare Pages** — dashboard → Workers & Pages →
   Create → Pages → Connect to Git → pick `roviq-local`. Build settings:
   framework preset "None", build command empty, build output directory
   `public`. Every push to `main` auto-deploys.
3. **Bind the D1 database to the Pages project** — Pages project → Settings
   → Functions → D1 database bindings → add binding `DB` → select the
   `roviq-local` database. (The `wrangler.toml` binding covers local dev and
   `wrangler` CLI use; Pages' dashboard binding is separate and is what the
   deployed site actually uses.)
4. **Set environment variables/secrets** — Pages project → Settings →
   Environment variables (set for both Production and Preview):
   - `MAPBOX_TOKEN` — the public token from step 1
   - `ADMIN_PASSCODE` — a shared passcode for the `/admin` curator queue
     (mark as "Encrypt")
5. **Add app icons** — `public/manifest.json` currently has an empty `icons`
   array. Add at least a 192×192 and a 512×512 PNG (ideally a maskable
   variant too) under `public/icons/` and reference them in the manifest
   before generating the Android package — Bubblewrap/PWABuilder both
   require valid manifest icons.
6. **Enable Cloudflare Web Analytics** on the Pages project (dashboard
   toggle, no code changes needed) for overall traffic; per-listing views
   are already tracked via `places.view_count`.

## Local development

```bash
npm install
npx wrangler pages dev public --d1=DB
```

Local dev uses a local simulated D1 instance, separate from the remote
database. To apply the schema and seed data locally:

```bash
npm run db:migrate   # applies schema.sql to the local simulated DB
npm run db:seed      # loads seed.sql into the local simulated DB
```

You'll also need local env vars for `MAPBOX_TOKEN` and `ADMIN_PASSCODE` —
`wrangler pages dev` reads these from a `.dev.vars` file (gitignored):

```
MAPBOX_TOKEN=pk.your_token_here
ADMIN_PASSCODE=choose_a_passcode
```

## Working against the remote (production) database

```bash
npm run db:migrate:remote   # applies schema.sql to the live D1 database
npm run db:seed:remote      # loads seed.sql into the live D1 database — run once
```

## API routes

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/places?category=&status=` | GET | none | `status` defaults to `approved` |
| `/api/places/:id` | GET | none | single place |
| `/api/places` | POST | none | driver submission, forces `status='pending'` |
| `/api/places/:id/view` | POST | none | increments `view_count` |
| `/api/admin/queue` | GET | `X-Admin-Passcode` header | all `status='pending'` places |
| `/api/admin/places/:id` | PATCH | `X-Admin-Passcode` header | body `{ "status": "approved" \| "rejected" }`, only updates rows currently `pending` |
| `/api/config` | GET | none | exposes the public Mapbox token to the frontend |

Every route above (except `/api/config`) returns a consistent
`{ "success": true, ... }` / `{ "success": false, "error": "..." }` JSON
shape alongside the appropriate HTTP status code.

Curator auth is intentionally a single shared passcode checked against the
`ADMIN_PASSCODE` env var — this is a single-curator v1 tool, not a
multi-user admin system. `public/admin/` stores the passcode in
`sessionStorage` after a successful check and sends it on every admin
request; it clears on tab close or **Log out**.

## Android packaging (TWA)

Do this only once the Cloudflare-hosted site is live and stable at its
final domain — the TWA points at that URL directly, so there's nothing to
rebuild for routine content/data updates, only for icon/manifest/branding
changes.

1. Finish [step 5 above](#what-you-still-need-to-do) (real manifest icons).
2. Install Bubblewrap: `npm i -g @bubblewrap/cli`
3. `bubblewrap init --manifest https://your-live-domain/manifest.json`
   (or use [PWABuilder](https://www.pwabuilder.com/) if you'd rather not
   install a CLI)
4. Follow the prompts (package name, signing key) and run
   `bubblewrap build` to produce the `.aab`.
5. Submit the `.aab` to your existing Google Play Developer account.

Geolocation uses the standard browser Geolocation API (foreground-only),
which is sufficient for this use case and works inside a TWA without any
native permission wiring.

## Content model notes

- `places.status` starts at `'pending'` for driver submissions and
  `'approved'` for anything inserted directly (e.g. `seed.sql`). Rejected
  places are kept with `status='rejected'`, not deleted.
- `seed.sql` flags Case Study Coffee, Coava Coffee Roasters, and Kray's
  Coffee as `is_drivers_pick=1`. Mark any additional favorites via a direct
  `UPDATE` or a future admin toggle.
- `shops`, `discounts`, and `redemptions` exist in the schema (see
  `schema.sql`) but are deliberately unused and empty for v1 — no shop
  dashboard, QR/discount redemption flow, or payments yet. They're there so
  no migration is needed once the first sponsor signs on.
