# ROVIQ Local iOS and CarPlay

Generate the Xcode project using XcodeGen (`xcodegen generate` in this folder). The phone application wraps the deployed HTTPS site; CarPlay uses a separate native place list and coordinate handoff to Apple Maps.

CarPlay eligibility, category-specific templates, entitlements and provisioning require confirmation and approval from Apple. This starter intentionally has no CarPlay signing entitlement. Building the phone target does not prove CarPlay access or compliance.

See ../docs/NATIVE_READINESS.md for validation, signing, simulator commands and remaining work. ios-build.yml supplies unsigned macOS CI validation when these files are added to the upstream repository.
