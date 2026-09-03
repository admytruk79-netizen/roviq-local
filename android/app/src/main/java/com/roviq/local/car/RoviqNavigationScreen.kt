package com.roviq.local.car

import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.Distance
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Template
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.NavigationManagerCallback
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.core.content.ContextCompat
import com.roviq.local.data.RoviqApi
import com.roviq.local.data.RoviqPlace
import com.roviq.local.data.RoviqRoute
import com.roviq.local.data.RoviqRouteStep
import java.util.TimeZone
import java.util.concurrent.Executors
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

private const val ARRIVAL_METERS = 35.0
private const val STEP_ADVANCE_METERS = 30.0

private fun haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val r = 6371000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * r * atan2(sqrt(a), sqrt(1 - a))
}

private fun maneuverTypeFor(step: RoviqRouteStep): Int {
    val modifier = step.maneuverModifier.lowercase()
    return when (step.maneuverType.lowercase()) {
        "depart" -> Maneuver.TYPE_STRAIGHT
        "arrive" -> Maneuver.TYPE_DESTINATION_STRAIGHT
        "roundabout", "rotary" -> Maneuver.TYPE_STRAIGHT
        "turn" -> when {
            modifier.contains("sharp left") -> Maneuver.TYPE_TURN_NORMAL_LEFT
            modifier.contains("sharp right") -> Maneuver.TYPE_TURN_NORMAL_RIGHT
            modifier.contains("slight left") -> Maneuver.TYPE_TURN_SLIGHT_LEFT
            modifier.contains("slight right") -> Maneuver.TYPE_TURN_SLIGHT_RIGHT
            modifier.contains("left") -> Maneuver.TYPE_TURN_NORMAL_LEFT
            modifier.contains("right") -> Maneuver.TYPE_TURN_NORMAL_RIGHT
            modifier.contains("uturn") -> Maneuver.TYPE_U_TURN_LEFT
            else -> Maneuver.TYPE_STRAIGHT
        }
        "merge" -> Maneuver.TYPE_MERGE_LEFT
        "fork" -> when {
            modifier.contains("left") -> Maneuver.TYPE_FORK_LEFT
            else -> Maneuver.TYPE_FORK_RIGHT
        }
        else -> Maneuver.TYPE_STRAIGHT
    }
}

internal fun cueFor(step: RoviqRouteStep): String {
    val road = step.name.takeIf { it.isNotBlank() }?.let { " on $it" } ?: ""
    return when (step.maneuverType.lowercase()) {
        "depart" -> "Head out${road}"
        "arrive" -> "Arrive at destination"
        "roundabout", "rotary" -> "Enter the roundabout${road}"
        "turn" -> "Turn ${step.maneuverModifier}${road}".trim()
        else -> step.instruction.takeIf { it.isNotBlank() } ?: "Continue${road}"
    }
}

class RoviqNavigationScreen(
    carContext: CarContext,
    private val place: RoviqPlace
) : Screen(carContext) {
    private val executor = Executors.newSingleThreadExecutor()
    private val navigationManager = carContext.getCarService(NavigationManager::class.java)
    private val locationManager = carContext.getSystemService(LocationManager::class.java)
    private var route: RoviqRoute? = null
    private var loading = true
    private var failed = false
    private var stepIndex = 0
    private var remainingMeters: Double? = null
    private var arrived = false
    private var listening = false

    private val locationListener = LocationListener { location -> onLocation(location) }

    private val navCallback = object : NavigationManagerCallback {
        override fun onStopNavigation() {
            teardown()
            finish()
        }
    }

    init {
        navigationManager.setNavigationManagerCallback(ContextCompat.getMainExecutor(carContext), navCallback)
        loadRoute()
    }

    private fun loadRoute() {
        loading = true
        failed = false
        executor.execute {
            val fix = bestKnownLocation()
            val fetched = if (fix != null) {
                RoviqApi.fetchRoute(fix.latitude, fix.longitude, place.lat, place.lng)
            } else null
            route = fetched
            loading = false
            failed = fetched == null
            if (fetched != null) remainingMeters = fetched.distanceMeters
            invalidate()
            if (fetched != null) startTracking()
        }
    }

    private fun bestKnownLocation(): Location? {
        val manager = locationManager ?: return null
        return try {
            manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        } catch (t: SecurityException) {
            null
        }
    }

    private fun startTracking() {
        if (listening) return
        val manager = locationManager ?: return
        try {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 5f, locationListener, Looper.getMainLooper())
            listening = true
            navigationManager.navigationStarted()
        } catch (t: SecurityException) {
            // Location permission not granted yet; the route stays visible without live tracking.
        }
    }

    private fun stopTracking() {
        if (!listening) return
        try {
            locationManager?.removeUpdates(locationListener)
        } catch (t: SecurityException) {
        }
        listening = false
    }

    private fun teardown() {
        stopTracking()
        try { navigationManager.navigationEnded() } catch (t: Throwable) {}
    }

    private fun onLocation(location: Location) {
        val r = route ?: return
        val toDestination = haversineMeters(location.latitude, location.longitude, place.lat, place.lng)
        remainingMeters = toDestination
        if (toDestination <= ARRIVAL_METERS) {
            if (!arrived) {
                arrived = true
                teardown()
            }
            invalidate()
            return
        }
        val steps = r.steps
        if (stepIndex < steps.size - 1) {
            // Advance once we're near the NEXT maneuver point, not the current step's own
            // location (which is roughly where we already are right after advancing to it —
            // checking that would skip through steps almost instantly).
            val next = steps[stepIndex + 1]
            val nextLat = next.lat
            val nextLng = next.lng
            if (nextLat != null && nextLng != null) {
                val toNext = haversineMeters(location.latitude, location.longitude, nextLat, nextLng)
                if (toNext <= STEP_ADVANCE_METERS) stepIndex++
            }
        }
        invalidate()
    }

    override fun onGetTemplate(): Template {
        val builder = NavigationTemplate.Builder()
        val stopAction = Action.Builder()
            .setTitle("Stop")
            .setOnClickListener {
                teardown()
                finish()
            }
            .build()
        builder.setActionStrip(ActionStrip.Builder().addAction(stopAction).build())

        val r = route
        if (loading) {
            return builder.setNavigationInfo(RoutingInfo.Builder().build()).build()
        }
        if (failed || r == null) {
            return builder.build()
        }

        if (arrived) {
            val destStep = Step.Builder("You have arrived at ${place.name}")
                .setManeuver(Maneuver.Builder(Maneuver.TYPE_DESTINATION_STRAIGHT).build())
                .build()
            builder.setNavigationInfo(
                RoutingInfo.Builder().setCurrentStep(destStep, Distance.create(0.0, Distance.UNIT_METERS)).build()
            )
        } else {
            val steps = r.steps
            val current = steps.getOrNull(stepIndex)
            val next = steps.getOrNull(stepIndex + 1)
            if (current != null) {
                val currentStep = Step.Builder(cueFor(current))
                    .setManeuver(Maneuver.Builder(maneuverTypeFor(current)).build())
                    .build()
                val distanceInStep = min(remainingMeters ?: current.distanceMeters, current.distanceMeters.takeIf { it > 0 } ?: (remainingMeters ?: 0.0))
                val routingInfo = RoutingInfo.Builder()
                    .setCurrentStep(currentStep, Distance.create(distanceInStep, Distance.UNIT_METERS))
                if (next != null) {
                    val nextStep = Step.Builder(cueFor(next))
                        .setManeuver(Maneuver.Builder(maneuverTypeFor(next)).build())
                        .build()
                    routingInfo.setNextStep(nextStep)
                }
                builder.setNavigationInfo(routingInfo.build())
            }

            val meters = remainingMeters ?: r.distanceMeters
            val secondsLeft = if (r.distanceMeters > 0) r.durationSeconds * (meters / r.distanceMeters) else r.durationSeconds
            val eta = DateTimeWithZone.create(
                System.currentTimeMillis() + (secondsLeft * 1000).toLong(),
                TimeZone.getDefault()
            )
            val distanceUnit = if (meters >= 1000) Distance.UNIT_KILOMETERS else Distance.UNIT_METERS
            val displayDistance = if (meters >= 1000) meters / 1000.0 else meters
            builder.setDestinationTravelEstimate(
                TravelEstimate.Builder(Distance.create(displayDistance, distanceUnit), eta).build()
            )
        }

        return builder.build()
    }
}
