package com.roviq.local.car

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarLocation
import androidx.car.app.model.ItemList
import androidx.car.app.model.Metadata
import androidx.car.app.model.Place
import androidx.car.app.model.PlaceListMapTemplate
import androidx.car.app.model.PlaceMarker
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import com.roviq.local.data.RoviqApi
import com.roviq.local.data.RoviqPlace
import java.util.concurrent.Executors

class NearbyPlacesScreen(
    carContext: CarContext,
    private val title: String = "Nearby",
    private val category: String? = null,
    private val driversPickOnly: Boolean = false
) : Screen(carContext) {
    private val executor = Executors.newSingleThreadExecutor()
    private var loading = true
    private var places: List<RoviqPlace> = emptyList()
    private var error: String? = null

    private val main = Handler(Looper.getMainLooper())
    private val locations = carContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var listener: LocationListener? = null
    private var disposed = false
    private var requestVersion = 0

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                disposed = true
                listener?.let { locations.removeUpdates(it) }
                main.removeCallbacksAndMessages(null)
                executor.shutdownNow()
            }
        })
        load()
    }

    private fun fail(message: String) {
        loading = false
        error = message
        if (!disposed) invalidate()
    }

    private fun load() {
        if (disposed) return
        loading = true
        error = null
        invalidate()
        val permission = Manifest.permission.ACCESS_COARSE_LOCATION
        if (ContextCompat.checkSelfPermission(carContext, permission) != PackageManager.PERMISSION_GRANTED) {
            carContext.requestPermissions(listOf(permission), java.util.concurrent.Executor { main.post(it) }) { approved, _ ->
                if (disposed) return@requestPermissions
                if (approved.contains(permission)) load()
                else fail("Allow location on your phone to find nearby stops")
            }
            return
        }
        listener?.let { locations.removeUpdates(it) }
        val version = ++requestVersion
        val provider = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
            .firstOrNull { locations.isProviderEnabled(it) }
        if (provider == null) { fail("Enable location services on your phone"); return }
        val callback = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                locations.removeUpdates(this)
                if (disposed || version != requestVersion) return
                listener = null
                executor.execute {
                    try {
                        val result = RoviqApi.loadApprovedPlaces(category, driversPickOnly, location.latitude, location.longitude)
                            .sortedBy { it.distanceKm ?: Double.MAX_VALUE }
                        main.post {
                            if (!disposed && version == requestVersion) {
                                places = result
                                loading = false
                                invalidate()
                            }
                        }
                    } catch (_: Exception) {
                        main.post { if (!disposed && version == requestVersion) fail("ROVIQ Local is temporarily unavailable") }
                    }
                }
            }
            override fun onProviderDisabled(provider: String) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
        listener = callback
        try {
            locations.requestSingleUpdate(provider, callback, Looper.getMainLooper())
            main.postDelayed({
                if (!disposed && version == requestVersion && listener === callback) {
                    locations.removeUpdates(callback)
                    listener = null
                    fail("Location timed out. Tap to retry")
                }
            }, 15000)
        } catch (_: SecurityException) { fail("Location permission is required") }
    }

    override fun onGetTemplate(): Template {
        val builder = PlaceListMapTemplate.Builder()
            .setTitle(title)
            .setHeaderAction(Action.BACK)
            .setCurrentLocationEnabled(true)

        if (loading) return builder.setLoading(true).build()

        val list = ItemList.Builder()
        if (places.isEmpty()) {
            list.addItem(
                Row.Builder()
                    .setTitle(error ?: "No ROVIQ stops found here yet")
                    .addText("Tap to retry")
                    .setBrowsable(true)
                    .setOnClickListener { load() }
                    .build()
            )
        } else {
            val limit = carContext.getCarService(androidx.car.app.constraints.ConstraintManager::class.java)
                .getContentLimit(androidx.car.app.constraints.ConstraintManager.CONTENT_LIMIT_TYPE_PLACE_LIST)
            places.take(limit).forEachIndexed { index, place ->
                val marker = PlaceMarker.Builder().setLabel(((index + 1) % 100).toString()).build()
                val mapPlace = Place.Builder(CarLocation.create(place.lat, place.lng))
                    .setMarker(marker)
                    .build()

                val badge = if (place.isRoviqPick()) "★ ROVIQ PICK" else place.category.uppercase()
                val primary = place.distanceKm?.let { "$badge · ${formatMiles(it)}" } ?: badge
                val reason = place.description
                    ?.replace(Regex("\\s+"), " ")
                    ?.trim()
                    ?.take(72)
                    ?.trimEnd('.', ',', ';', ':')
                val secondary = reason ?: place.address?.let { compactAddress(it) }

                val row = Row.Builder()
                    .setTitle(place.name)
                    .addText(primary)
                    .setBrowsable(true)
                    .setMetadata(Metadata.Builder().setPlace(mapPlace).build())
                    .setOnClickListener { screenManager.push(PlaceDetailScreen(carContext, place)) }
                if (!secondary.isNullOrBlank()) row.addText(secondary)
                list.addItem(row.build())
            }
        }

        return builder.setItemList(list.build()).build()
    }

    private fun RoviqPlace.isRoviqPick(): Boolean =
        driversPick || trustLevel.equals("roviq", ignoreCase = true)

    private fun compactAddress(address: String): String =
        address.split(',').map { it.trim() }.filter { it.isNotBlank() }.take(2).joinToString(", ")

    private fun formatMiles(km: Double): String {
        val mi = km * 0.621371
        return if (mi < 10) "%.1f mi".format(mi) else "${Math.round(mi)} mi"
    }
}

