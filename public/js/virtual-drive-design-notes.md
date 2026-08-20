# ROVIQ Virtual Drive

Virtual Drive is an in-app simulation mode for testing and previewing a selected destination without physically moving. It uses the real road geometry returned by `/api/route`, resamples that route into 100 progress points, and animates the ROVIQ vehicle/GPS puck through those points with the same cinematic follow camera, heading, route glow, ETA/distance HUD and arrival lifecycle as real navigation.

It is deliberately labelled VIRTUAL so it can never be mistaken for live GPS navigation. It does not spoof browser geolocation and does not alter device GPS.
