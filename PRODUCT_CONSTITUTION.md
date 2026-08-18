# ROVIQ Local — Master Product, Experience & Technical Specification

This document is the canonical, authoritative reference for ROVIQ Local. It is
written so that a new developer, a fresh Codex/Claude session, a Figma
designer, or an AI coding agent can open this repository cold and understand:
what the product is, why it exists, how it should feel, what every mode does,
who is allowed to modify data, what AI is and is not allowed to do, and what
must never be destroyed.

If a future change conflicts with this document, the change is wrong until
this document is deliberately revised — not the other way around.

## 1. Mission

Design and build ROVIQ Local, a map-first discovery experience for drivers
and travelers.

Its fundamental question is:

> "What nearby place is actually worth stopping for?"

ROVIQ Local should surface places with character, usefulness, quality,
relevance or genuine local significance rather than simply displaying every
business that exists.

It is **not** intended to replace Google Maps.
It is **not** Yelp.
It is **not** a conventional POI directory.
It is **not** a turn-by-turn navigation product.
It is **not** a social network.
It is **not** a pay-to-rank advertising marketplace.
It is **not** an unrestricted crowdsourced map.

It is a curated discovery layer for movement.

The user should feel that ROVIQ understands: where I am → how I am moving →
what is around me → what is genuinely interesting → what is worth
interrupting my journey for.

## 2. Product philosophy

ROVIQ Local should combine three qualities that are rarely found together:

**Utility + Discovery + Emotion**

- Utility tells the driver where something is.
- Discovery reveals something the driver would otherwise miss.
- Emotion makes finding it feel rewarding.

The application should therefore avoid becoming either a sterile navigation
utility, or an overanimated entertainment interface.

The target is approximately:

- 80% calm automotive instrument
- 15% discovery energy
- 5% surprise

The map should normally be quiet. The interface becomes expressive when the
user interacts with it. That distinction is crucial. ROVIQ should not
continuously scream for attention. It should wake up when touched.

## 3. The automotive metaphor

The visual reference is **not literally** the game Need for Speed. The
useful lesson from automotive games and premium digital cockpits is: **motion
creates state.**

ROVIQ should borrow: cinematic camera transitions, depth, restrained HUD
language, strong location awareness, tactile controls, illuminated
activation states, responsive markers, controlled motion, subtle spatial
energy.

But avoid: arcade graphics, neon overload, speedometers everywhere, fake
gauges, gaming achievements, constant animation, visual noise.

The result should feel like a premium next-generation vehicle discovery
interface, not a racing-game skin. (Lamborghini Miura: beautiful at rest,
exhilarating in motion.)

## 4. The map is the product

Do not design a conventional mobile app and place a map inside it. The map
**is** the canvas. Interface elements float above it.

The map should occupy effectively the entire usable viewport. Navigation,
mode controls and discovery tools should never obscure important map
interaction areas.

Respect: Android system navigation, browser chrome, safe areas, device
cutouts, bottom gesture regions, responsive viewport changes.

**No control should disappear behind the Android navigation area or any
fixed chrome (bottom nav, etc).** This has already been a recurring failure
in this codebase and must be treated as a regression test on every change
that touches layout.

## 5. Mapping architecture

Use MapLibre GL JS + a vector map source rather than trying to force a
raster basemap into the desired visual experience.

MapLibre provides WebGL vector rendering, programmable styles/layers and
camera manipulation. Its camera API supports center, zoom, bearing and
pitch, and `flyTo()` supports smooth spatial transitions.

ROVIQ therefore owns the presentation layer. Road hierarchy, land, water,
labels, POIs and ROVIQ overlays can be styled independently through the
MapLibre style system.

**Do not permanently layer a second legacy raster basemap underneath the
vector map. There must be one authoritative map renderer.**

(Current implementation: Leaflet as the outer map/marker/interaction API,
with a MapLibre GL vector layer — via `@maplibre/maplibre-gl-leaflet` —
mounted inside it as the actual renderer, tiles from Stadia Maps. This
satisfies "one authoritative renderer" as long as the old raster tile layer
is actually removed once the vector layer is confirmed live, not left
running underneath it.)

## 6. Primary experience states

The product has three experiential modes.

### REST

REST is the ambient state. It should be beautiful enough to remain open in a
vehicle without demanding attention.

Visual character: dark charcoal/navy map, low saturation, restrained labels,
minimal chrome, subdued markers, soft location halo, little or no decorative
animation.

REST communicates: "ROVIQ is aware, but not asking anything from you."

### 7. EXPLORE

EXPLORE begins when the user intentionally asks: "What is around me?"

The map wakes. The transition should include subtle camera movement, marker
activation, halo illumination, road emphasis, UI response, optional haptic
feedback.

Discovery controls become available — e.g. Coffee, Food, Nature,
Fuel/Charging, Interesting Stops, ROVIQ Picks, Local, Useful. The exact
taxonomy can evolve without changing the underlying architecture.

Markers should not all appear equally. There must be hierarchy.

### 8. WILD

WILD is the serendipity layer. Its purpose is: "Show me something I
wouldn't normally search for." It is **not** another category filter.

When activated, the interface may briefly produce the honeycomb/energy
visualization. The honeycomb should appear as an activation event, originate
around the user's discovery field, illuminate briefly, reveal unexpected
candidates, then recede.

**It should not continuously crawl around the map while the user pans. It is
a moment of discovery, not wallpaper.**

WILD candidates might include: a remarkable roadside bakery, an unusual
viewpoint, a tiny specialist shop, a local institution, a historic object, an
exceptional independent mechanic, a farm stand, an obscure museum, a
beautiful short detour, an unusual piece of infrastructure.

WILD should create: "What the hell is that? Let's stop." — without becoming
gimmicky.

## 9. User location

The location control is a first-class interaction. Pressing it should:
request/use current location, activate the location halo, smoothly fly the
camera toward the user, settle at an appropriate discovery zoom, briefly
emphasize nearby ROVIQ places.

MapLibre's geolocation support can locate the user and optionally track
movement; its camera can then follow or recenter appropriately.

Do not teleport abruptly unless reduced-motion accessibility requires it.

## 10. Location halo

The user should not simply be represented by Google's familiar blue dot.
Create a ROVIQ location signature.

- Center: precise user position.
- Around it: a subtle breathing halo.

Potential structure: small center point, fine inner ring, diffuse outer
field, occasional activation ripple.

- Idle: almost invisible.
- Interaction: brighter.
- Discovery: slightly expanded.
- WILD: brief energetic response.

The halo communicates: ROVIQ is sensing the environment around you.

## 11. Marker hierarchy

Do not cover the map with identical pins. Markers communicate editorial
meaning.

- **Standard approved place** — quiet, restrained.
- **Strong place** — more visible.
- **ROVIQ Pick** — warm-gold emphasis.
- **New discovery** — temporary accent.
- **User-selected place** — expanded halo/ring.
- **Wild discovery** — distinct temporary reveal.
- **Partner** — may carry a subtle commercial indicator, but partner status
  must never imply editorial quality.

**That separation is fundamental. Commercial relationship ≠ ROVIQ
recommendation.**

## 12. Color psychology

Color should communicate state and meaning, not decoration.

- **Charcoal / near-black** — base environment. Communicates focus,
  precision, automotive instrumentation, reduced visual noise, premium
  character.
- **Deep navy** — adds spatial depth without making the interface pure
  black. Useful for map surfaces, atmospheric transitions and nighttime
  perception.
- **Warm gold** — means curated / exceptional / ROVIQ-selected. Use it
  sparingly. It should never become the general UI color. Scarcity gives
  gold meaning.
- **Electric green / restrained lime** — represents movement, go,
  availability, activation, successful action. Should feel energetic rather
  than fluorescent.
- **Teal** — represents system intelligence, location awareness,
  interaction, energy. Best used for halos, active states, subtle map
  illumination, AI/system cues. Do not flood the interface with teal.
- **Ivory / warm white** — primary text. Softer than pure white against dark
  surfaces.
- **Red** — reserve for warnings, closures, safety issues, errors. Never use
  red merely for visual excitement.

## 13. Daytime mode

Day mode must not simply invert the night interface. Use warm light
stone/grey map surfaces, dark graphite text, restrained teal, muted road
hierarchy. Gold is still reserved for curated places. The screen must remain
readable in bright daylight.

## 14. Night mode

Night mode is the signature experience. Use deep charcoal, navy-black
terrain, muted secondary roads, stronger major-road hierarchy, ivory labels,
teal system activity, gold ROVIQ Picks.

**Avoid excessive glow.** Premium interfaces achieve richness through
contrast and restraint, not by making everything luminous.

## 15. Map/List relationship

Map is primary. List is an alternate representation of the same place
dataset. Never maintain separate Map and List data models. Filters applied
to one must apply to the other.

A place card should prioritize: name, "Why stop here?", distance/context,
category, trust/editorial indicator, image if appropriate, Directions, Save.

**The editorial reason should be more prominent than the postal address.**

## 16. "Why stop here?"

This is one of ROVIQ Local's most important pieces of intellectual
identity.

Do not merely say: "Coffee shop." Say: "Family-run roaster with excellent
espresso and a quiet courtyard two minutes off your route."

Do not say: "Scenic viewpoint." Say: "Five-minute detour with an
unobstructed river overlook and almost no tourist traffic."

The application should explain **why** the interruption is worthwhile.

## 17. Directions

ROVIQ discovers. The navigation provider navigates. Once the user chooses
GO / Directions, hand off coordinates to the appropriate navigation
application.

Coordinates are canonical. Addresses are secondary metadata. ROVIQ should
not prematurely rebuild turn-by-turn navigation.

## 18. Contribution philosophy

ROVIQ should benefit from human knowledge without becoming an uncontrolled
crowdsourced database. Therefore there are different authority levels.

- **Visitor** — can browse, explore, use Wild, view places. Cannot directly
  modify the catalog.
- **Registered driver** — can potentially save places, suggest a place, flag
  incorrect information, submit evidence, recommend an update. Cannot
  directly publish changes.
- **Trusted contributor** — can submit richer updates. Reputation can
  increase based on accepted contributions. Still does not automatically
  control publication.
- **Local curator** — can review submissions, edit metadata, approve/reject,
  hide places, add editorial rationale, manage local collections. Authority
  is geographically scoped.
- **ROVIQ administrator** — full moderation authority. Can manage curators,
  permissions, trust, places, audit records, system configuration.

**AI is not an administrator.** This is essential. AI can research, compare,
structure, flag, suggest and draft. AI should not silently rewrite trusted
public information without provenance and appropriate confidence/approval
rules.

## 19. Submission flow

A driver can suggest a place through: current location, dropped pin, or
search/geocoding. Then provide: name, category, reason it is worth stopping,
optional photograph, optional notes.

The record enters `pending`, not `approved`. A moderation workflow
evaluates it.

## 20. Trust system

ROVIQ should eventually develop contributor reputation. Signals could
include: accepted submissions, accuracy of edits, evidence quality, history,
curator confirmation, duplicate/error rate.

Do not expose proprietary trust formulas publicly. Public users should see
understandable trust outcomes rather than internal scoring mathematics.

## 21. AI information engine

The AI engine should behave like an editorial research assistant operating
continuously behind ROVIQ. Its job is **not** merely chatbot conversation.
Its job is to maintain information quality.

Architecture: **Observe → Retrieve → Compare → Assess → Propose → Verify →
Publish/Queue**

## 22. What AI should monitor

The engine can periodically examine approved places for: business closure,
changed opening hours, changed name, changed category, moved location,
website changes, temporary closure, safety advisories, stale descriptions,
duplicate records, broken links, new evidence.

Cloudflare Cron Triggers can run scheduled Worker jobs, specifically
including periodic maintenance/data collection workloads.

## 23. AI update states

Every machine-generated proposal should carry an internal state, e.g.:
`observed`, `candidate_change`, `needs_evidence`, `high_confidence`,
`human_review`, `approved`, `rejected`, `published`.

**The AI must never obscure where information came from.**

## 24. Confidence policy

- Low-confidence change → queue for curator.
- Conflicting sources → queue for curator.
- Potential safety issue → surface urgently but identify evidence.
- Simple, highly verifiable metadata → may eventually support automated
  updating after the system proves reliable.
- Editorial judgement → human accountable.

AI should assist ROVIQ's judgment, not impersonate it. Automation assists
assessment/prioritization without replacing human accountability.

## 25. AI-generated editorial text

AI can draft "Why stop here?" text, but it should not invent enthusiasm. It
should synthesize verified characteristics.

Bad: "An incredible hidden gem you'll absolutely love!"

Good: "Independent bakery known for laminated pastries, with easy parking
directly off the highway."

ROVIQ voice: specific, calm, useful, observant, slightly adventurous. Never
generic influencer language.

## 26. AI implementation

Use Cloudflare Workers for API/orchestration, D1 for structured
place/moderation records, Workers AI for classification, summarization,
comparison and editorial drafting, and Cron Triggers for periodic
maintenance jobs.

Workers AI can be exposed directly to a Worker through an AI binding
(`env.AI`), while D1 is similarly bound into the Worker environment.

**Do not put AI credentials in browser JavaScript. AI operations occur
server-side.**

## 27. Core database entities

Conceptually maintain: `places`, `place_sources`, `place_changes`,
`submissions`, `moderation_actions`, `contributors`, `contributor_reputation`,
`collections`, `saved_places`, `partners`, `advisories`, `ai_observations`,
`ai_change_proposals`, `audit_log`.

Exact schema may evolve. Do not expose proprietary internal ranking fields
through public APIs.

## 28. Place record

A place should conceptually support: ID, name, latitude, longitude,
category, subcategory, description, `why_stop_here`, editorial status, trust
state, ROVIQ Pick status, partner status (kept separate), photo, website,
phone, hours, source provenance, last verified timestamp, created timestamp,
updated timestamp, visibility, moderation state.

Coordinates remain canonical.

## 29. API philosophy

Public API returns only what the frontend needs. Examples: `GET
/api/local/places`, `GET /api/local/places/:id`, `POST
/api/local/submissions`, `GET /api/local/collections`.

Private/admin endpoints handle: approval, rejection, editing, hiding, trust,
curation, AI proposals.

Never expose: ranking weights, trust formulas, internal AI prompts,
partner-routing rules, private contributor information, moderation secrets.

## 30. Frontend architecture

Keep frontend responsibilities separated:

- **Map engine** — MapLibre.
- **Map style** — ROVIQ style configuration.
- **Data layer** — fetch approved places from ROVIQ API.
- **Interaction controller** — controls REST / EXPLORE / WILD, camera,
  selection, filters, location, haptics.
- **Overlay/UI layer** — controls, cards, navigation and modals.
- **Animation layer** — halos, marker activation, Wild reveal, transitions.

**Do not create another pile of independent scripts all fighting over the
map DOM. There must be one map controller.**

## 31. Camera language

Camera movement is part of the brand. Selecting a place should not
instantly jump. Use a controlled transition: current context → slight pull
→ travel → settle on destination.

MapLibre explicitly supports `flyTo`, `easeTo`, pitch, bearing and animation
parameters, making this interaction native to the rendering architecture
rather than a visual hack.

Keep transitions short enough to remain functional.

## 32. Haptics

Where supported, use subtle tactile feedback for: mode activation, place
selection, Wild activation, Save, recenter.

Never vibrate continuously. Think: click, not buzz. Visual response should
always accompany haptic response because web haptics are not universally
available.

## 33. Bottom navigation

Persistent navigation must remain accessible. Likely core destinations:
Explore, Picks, Saved, Suggest, Profile.

The central ROVIQ action can have greater visual weight if useful, but must
have a defined behavior rather than existing decoratively.

**No dead buttons.** Every visible interactive element must: work, have an
accessible label, have pressed/selected state, have a defined failure state.

## 34. Discover control

Discover should actually expose discovery options. It must never be a
decorative button. Opening it should reveal the discovery/filter layer
without covering the entire map unnecessarily. Selection should immediately
affect visible places.

## 35. ROVIQ Picks

Picks represent stronger editorial confidence. Gold is their visual
signature. ROVIQ Picks should be scarce. If everything becomes a Pick, the
designation becomes meaningless.

## 36. Saved

Saved places belong to the user. Saving should be immediate and tactile.
Later ROVIQ can use saved preferences to improve discovery, but
personalization should not trap users in an algorithmic bubble. WILD exists
partly to counter predictable personalization.

## 37. Android Auto

Android Auto should preserve the information hierarchy and discovery logic,
not all the decorative effects.

Driving interface: large targets, minimal text, limited choices, no
unnecessary animation, voice-friendly actions.

Phone experience can be richer. Vehicle experience must prioritize safety.

## 38. Privacy

ROVIQ should be location-aware without becoming a movement-surveillance
product. Current location may be needed for discovery. Do not automatically
build permanent movement histories merely because the technology allows it.
Store only what is necessary for requested functionality (local-first, no
default movement history).

## 39. Performance

The experience must feel immediate. Priorities: fast initial map render,
progressive place loading, cached style assets, marker clustering where
necessary, minimal blocking JavaScript, lazy images, smooth 60fps
interaction where hardware permits.

Decorative effects must degrade gracefully. A low-powered phone should
receive a simpler ROVIQ experience, not a broken one.

## 40. Accessibility

Support: reduced motion, sufficient contrast, screen-reader labels,
keyboard interaction where applicable, large touch targets, clear selected
states.

If `prefers-reduced-motion` is enabled, cinematic camera effects should
become restrained transitions rather than disappearing functionality.

## 41. Failure behavior

ROVIQ must remain useful when something fails.

- GPS unavailable → allow selected location.
- AI unavailable → catalog still works.
- Wild unavailable → Explore still works.
- Image unavailable → show elegant fallback.
- Map-data problem → show explicit map error/retry state rather than
  silently exposing some ancient legacy map.

**AI should never be a single point of failure.**

## 42. Deployment architecture

Repository is the source of truth: GitHub → deployment → Cloudflare Worker.
Do not casually edit production independently in Cloudflare and GitHub.

Every deployed version should expose a build identifier/commit SHA. Create
`GET /api/version` returning something conceptually like:

```json
{ "commit": "...", "build_time": "...", "environment": "..." }
```

The UI may expose this discreetly in diagnostics. This alone would have
prevented much of the deployment-confusion churn already experienced in this
project.

## 43. Deployment verification

A GitHub commit is not proof of deployment. A successful GitHub workflow is
not proof that the correct frontend is visible. Deployment is complete only
when: build succeeds, Worker deploy succeeds, `/api/version` returns the
expected commit, live HTML references expected assets, map initializes,
places API responds, essential controls work.

**Only then call the build deployed.**

## 44. Design preservation rule

Do not "simplify" ROVIQ into a generic map application. Future developers
and AI agents must preserve: the location halo, automotive character,
REST/EXPLORE/WILD distinction, ROVIQ Picks hierarchy, dark premium visual
identity, gold/teal semantic color system, map-first architecture,
controlled camera motion, discovery philosophy, the "Why stop here?"
editorial layer, moderated contributions, AI-assisted information
maintenance.

These are product characteristics, not optional decoration.

## 45. What must never happen again

Do not:

- replace the approved design with generic UI
- silently restore an old basemap
- leave buttons disconnected
- allow controls beneath system navigation
- make the Wild honeycomb permanently drift with map movement
- use uncontrolled glow everywhere
- show every POI equally
- let visitors directly modify trusted records
- let AI silently rewrite editorial information
- mix paid partnership with editorial recommendation
- publish proprietary scoring logic
- maintain two competing map implementations
- claim a deployment succeeded without checking production

## 46. The emotional test

When someone opens ROVIQ Local for the first time, the reaction should not
merely be: "That's a nice map."

It should be: "This feels like something that belongs in my car." Then:
"What's around me?" Then: "I didn't know that was there."

That three-stage reaction is the experience.

## 47. The product test

Every feature must answer at least one of four questions:

1. Does this help me understand where I am?
2. Does this help me discover something worthwhile?
3. Does this help me decide whether to stop?
4. Does this help ROVIQ maintain trustworthy information?

If the answer to all four is no, seriously question why the feature exists.

## 48. Final build instruction

Do not redesign ROVIQ Local from scratch. First audit the existing
repository, database, APIs, moderation system, deployment configuration and
working functionality. Preserve functioning backend capabilities.

Then consolidate the frontend around: MapLibre + authoritative vector map,
ROVIQ map style, a single interaction controller, REST / EXPLORE / WILD, the
ROVIQ location halo, semantic marker hierarchy, camera choreography,
Map/List synchronization, ROVIQ Picks, Saved, Suggest, moderation, and the
AI maintenance engine.

Implement incrementally. After every stage: build → deploy → verify live
version → mobile test → regression test. Never proceed to the next layer
because code merely exists in GitHub. Proceed because the feature works on
the live product.

---

## A note on the Need for Speed influence

The Need for Speed reference is not the visual identity. It taught the team
how the map should *respond* — motion creates state, energy is earned
through interaction, not worn constantly. The actual ROVIQ identity is
quieter and more sophisticated: calm when idle, alive when engaged.

## A note on the AI engine

The AI engine is not meant to turn ROVIQ into "an AI app." Most users
shouldn't even think about AI. AI is the invisible editorial maintenance
machinery that helps a comparatively small ROVIQ team keep a large
geographic catalog accurate.

Curated human judgment on the surface, machine-assisted maintenance
underneath, and an automotive discovery instrument in between — that
combination is the strongest version of ROVIQ Local, and the standard every
future change should be measured against.
