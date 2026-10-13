# Android Auto

ROVIQ has a native Android for Cars POI interface in android/app, sharing the public catalog with the phone app. The current phone wrapper is WebView-based, not a generated TWA.

The car service declares the POI category and MAP_TEMPLATES permission. Nearby requests foreground phone location, supplies coordinates/radius to the backend, sorts by distance and observes the host place-list limit. Picking a stop displays its editorial reason and hands coordinates to a navigation application. Driver recommendation does not automatically mean ROVIQ Pick.

Experimental RoviqNavigationScreen remains in source but is not exposed by this release configuration. The service no longer declares navigation or instrument-cluster categories. Virtual video is not exposed in the car UI. This follows PRODUCT_CONSTITUTION.md's discovery-plus-navigation-handoff scope.

Car category declarations do not establish Google approval. Test on Desktop Head Unit and hardware and complete current Google car-app quality review. See NATIVE_READINESS.md for builds, limits and the iOS/CarPlay companion.
