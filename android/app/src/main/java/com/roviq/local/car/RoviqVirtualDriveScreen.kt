package com.roviq.local.car

import android.location.Location
import android.location.LocationManager
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import com.roviq.local.data.RoviqApi
import com.roviq.local.data.RoviqPlace
import com.roviq.local.data.RoviqRoute
import java.util.concurrent.Executors
import kotlin.math.roundToInt

// A stationary, step-through preview of the route to a place — the car-screen equivalent
// of Virtual Drive on the phone, and the same idea as Google Maps' own route-preview
// (tap through upcoming turns before you actually start driving). Deliberately text/action
// only: no video or image templates are available to POI/Navigation category car apps.
class RoviqVirtualDriveScreen(
    carContext: CarContext,
    private val place: RoviqPlace
) : Screen(carContext) {
    private val executor = Executors.newSingleThreadExecutor()
    private var route: RoviqRoute? = null
    private var loading = true
    private var failed = false
    private var index = 0

    init {
        load()
    }

    private fun load() {
        loading = true
        failed = false
        executor.execute {
            val fix = bestKnownLocation()
            val fetched = if (fix != null) {
                RoviqApi.fetchRoute(fix.latitude, fix.longitude, place.lat, place.lng)
            } else null
            route = fetched
            loading = false
            failed = fetched?.steps.isNullOrEmpty()
            index = 0
            invalidate()
        }
    }

    private fun bestKnownLocation(): Location? {
        return try {
            val manager = carContext.getSystemService(LocationManager::class.java) ?: return null
            manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        } catch (t: SecurityException) {
            null
        }
    }

    override fun onGetTemplate(): Template {
        if (loading) {
            return MessageTemplate.Builder("Building your virtual drive…")
                .setTitle(place.name)
                .setHeaderAction(Action.BACK)
                .build()
        }
        val steps = route?.steps
        if (failed || steps.isNullOrEmpty()) {
            return MessageTemplate.Builder("Could not build a virtual drive for this route right now.")
                .setTitle(place.name)
                .setHeaderAction(Action.BACK)
                .build()
        }

        val current = steps[index]
        val isFirst = index == 0
        val isLast = index == steps.size - 1
        val body = buildString {
            append(cueFor(current))
            if (current.distanceMeters > 0) {
                append("\n\n")
                append(formatDistance(current.distanceMeters))
            }
        }

        val builder = MessageTemplate.Builder(body)
            .setTitle(if (isLast) "Arriving at ${place.name}" else "Virtual Drive · Step ${index + 1} of ${steps.size}")
            .setHeaderAction(Action.BACK)

        if (!isFirst) {
            builder.addAction(
                Action.Builder()
                    .setTitle("◀ Back")
                    .setOnClickListener { index--; invalidate() }
                    .build()
            )
        }
        if (!isLast) {
            builder.addAction(
                Action.Builder()
                    .setTitle("Next ▶")
                    .setOnClickListener { index++; invalidate() }
                    .build()
            )
        } else {
            builder.addAction(
                Action.Builder()
                    .setTitle("Done")
                    .setOnClickListener { screenManager.pop() }
                    .build()
            )
        }
        return builder.build()
    }
}

private fun formatDistance(meters: Double): String {
    return if (meters >= 1000) "${"%.1f".format(meters / 1000.0)} km" else "${meters.roundToInt()} m"
}
