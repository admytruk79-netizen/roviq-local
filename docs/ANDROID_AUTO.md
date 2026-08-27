# Android Auto / Android Automotive plan

ROVIQ Local qualifies as a Point of Interest (POI) app. The vehicle UI must use the Android for Cars App Library rather than trying to display the web/TWA UI directly on the car screen.

## Same backend, two surfaces
- Phone: existing ROVIQ Local web app packaged as a TWA.
- Car: native Android `CarAppService` inside the same Android package.
- Data: both surfaces use the same public `/api/places` endpoint and the same moderation/database pipeline.

## Required Android declarations
The final Android package must:
- depend on stable `androidx.car.app:app` (currently 1.7.0 when this file was written),
- declare `androidx.car.app.MAP_TEMPLATES`,
- declare a `CarAppService` with category `androidx.car.app.category.POI`,
- declare `androidx.car.app.minCarApiLevel`,
- include `com.google.android.gms.car.application` metadata referencing `res/xml/automotive_app_desc.xml`,
- declare `<uses name="template" />` in that descriptor for Android Auto.

## Vehicle UX
Use `PlaceListMapTemplate` (or `MapWithContentTemplate` where appropriate) to expose only low-distraction discovery:
- Nearby
- ROVIQ Picks
- Coffee
- Food
- Nature / useful stops

Each result should show only essential information: name, distance/open state where available, trust marker, and a navigation action. Do not expose contribution forms, admin, long descriptions, account settings or sponsor management on the car display.

## Navigation handoff
The `CarAppService` now declares both `androidx.car.app.category.POI` and `androidx.car.app.category.NAVIGATION` (plus the `NAVIGATION_TEMPLATES` permission), so a single app package serves both roles at once:
- **POI mode** (nearby/picks/category browsing) needs no special approval and works today.
- **Navigation mode** (`RoviqNavigationScreen`, using `NavigationManager`/`NavigationTemplate`) requires Google to grant the restricted Navigation category in Play Console before a real host will actually let it run — this is a Play Console request, not a code change.

`PlaceDetailScreen`'s Navigate action tries to push `RoviqNavigationScreen` first and falls back to the old hand-off (`ACTION_NAVIGATE` to another nav app) if that throws — so the same build works correctly whether or not the Navigation grant has landed yet, with no separate release needed once it does.

Real turn-by-turn reuses the same `/api/route` endpoint the phone app already uses; live position comes from the standard Android `LocationManager` (not `CarHardwareManager`, to avoid a second permission surface), and maneuver-by-maneuver progression is tracked client-side the same way the phone's `checkArrival`/route-progress logic works, not via server-side rerouting.

## Voice
After the POI car experience is stable, add App Actions for Cars so users can invoke nearby ROVIQ places by voice. This is a later enhancement, not a launch blocker.

## Build order
1. Finish and deploy the phone/TWA app at its final HTTPS domain.
2. Generate the Android project with Bubblewrap/PWABuilder and settle the final package name/signing key.
3. Add the car library dependency and `CarAppService` to that generated project.
4. Test using Android Auto Desktop Head Unit and Android Automotive emulator.
5. Complete car-specific quality review and Play declarations.

This sequencing avoids creating a second Android package or signing identity that would later have to be merged with the TWA.
