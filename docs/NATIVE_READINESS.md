# Phone and car integration readiness

## Implemented locally

- Public list and detail APIs return only approved, visible places and display fields; database failures fail closed.
- Phone location retry and manual area coordinates reload the same catalog. Text search and Saved show selectable results. Saved can fetch public details outside the current area.
- Named markers, expanded/pressed filter states, focus outlines, native modal focus containment, and reduced-motion styles.
- Directions hand off coordinates to a navigation provider. Existing experimental guidance code is retained but not selected by the phone Navigate button or Android Auto UI.
- Same-area public catalog fallback is labeled stale, expires after seven days, and stores only one last area. Service worker excludes API/admin/submission responses. This does not provide offline map tiles.
- Android Auto foreground location, distance sorting, host row limits, UI-thread result publication, location timeout/retry, and lifecycle cleanup. Manifest declares POI only. Driver recommendation and ROVIQ Pick remain distinct.
- Android phone wrapper restricts location grants to the configured HTTPS origin and sends external navigation links to another app.
- iOS WKWebView phone wrapper and separate native CarPlay list/detail scene share the HTTPS backend. Phone directions open Apple Maps. CarPlay data handling includes permission denial, location/network failures, distance ordering, cancellation, and host item limits.

## Validation performed

`npm test`: eleven regression cases pass against real in-memory SQLite and mocked browser location/network/storage. Requires Node 22.13+ (node:sqlite); run on Node 24.

All downloaded JavaScript source files passed `node --check`. iOS Info.plist parses. `git diff --check` passes.

## Required validation before release

1. Run the web app with the existing D1 migrations and check actual mobile layouts, map/style load errors, screen readers, reduced motion, safe areas, location denial/retry, empty and stale states, search and multiple saved places. The manual area selector currently uses coordinates; add geocoded city/address lookup for a friendlier next iteration.
2. Android: JDK 17, Android SDK 35, Gradle 8.9. Run `gradle --no-daemon assembleDebug` from android/. Validate Android Auto with Desktop Head Unit and devices, including permission prompts while parked, host row limits, unavailable navigation apps, disconnected phone and background/resume. Verify current Google category/quality requirements; no code can establish store approval.
3. iOS: macOS/Xcode and XcodeGen. `cd ios && xcodegen generate`; then `xcodebuild -project RoviqLocal.xcodeproj -scheme RoviqLocal -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`. Set your development team and final bundle ID for device signing. Add release artwork and test WebKit geolocation on devices.
4. CarPlay: request the appropriate category from Apple. This discovery/POI use case and allowed templates must be confirmed with Apple; approval is not assumed. Add exactly the entitlement Apple grants and its matching provisioning profile. No entitlement is fabricated in this starter. Without it, the phone target can run but CarPlay connection is unavailable. Confirm list/detail and Apple Maps handoff in CarPlay Simulator and hardware.
5. Recheck data migration completeness, rate limiting and privacy/store disclosures before distribution. No deployment, database migration, repository push, signing or store submission was performed.

## Source copy limitations

The GitHub text connector was used because the workspace network proxy could not connect. Upstream PNG icons and MP4 assets could not be downloaded by that connector. Apply the supplied change patch to a normal checkout to preserve those original binary assets; do not deploy this partial source copy as-is. A browser, Android toolchain and Xcode were unavailable here, so the UI and native projects have not been executed.
