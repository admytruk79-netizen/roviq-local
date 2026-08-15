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
ROVIQ Local is a POI discovery product, not a navigation engine. Selecting Navigate should hand the destination to a navigation-capable app/system. Do not declare the navigation category or navigation-template permission unless ROVIQ later becomes a genuine turn-by-turn navigation app.

## Voice
After the POI car experience is stable, add App Actions for Cars so users can invoke nearby ROVIQ places by voice. This is a later enhancement, not a launch blocker.

## Build order
1. Finish and deploy the phone/TWA app at its final HTTPS domain.
2. Generate the Android project with Bubblewrap/PWABuilder and settle the final package name/signing key.
3. Add the car library dependency and `CarAppService` to that generated project.
4. Test using Android Auto Desktop Head Unit and Android Automotive emulator.
5. Complete car-specific quality review and Play declarations.

This sequencing avoids creating a second Android package or signing identity that would later have to be merged with the TWA.
