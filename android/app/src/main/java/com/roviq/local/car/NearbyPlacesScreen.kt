package com.roviq.local.car

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

    init { load() }

    private fun load() {
        loading = true
        error = null
        executor.execute {
            try {
                places = RoviqApi.loadApprovedPlaces(category, driversPickOnly)
                    .sortedWith(compareByDescending<RoviqPlace> { it.isRoviqPick() }.thenBy { it.name })
                    .take(12)
            } catch (t: Throwable) {
                places = emptyList()
                error = "ROVIQ Local is temporarily unavailable"
            } finally {
                loading = false
                invalidate()
            }
        }
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
            places.forEachIndexed { index, place ->
                val marker = PlaceMarker.Builder().setLabel(((index + 1) % 100).toString()).build()
                val mapPlace = Place.Builder(CarLocation.create(place.lat, place.lng))
                    .setMarker(marker)
                    .build()

                val primary = if (place.isRoviqPick()) "★ ROVIQ PICK" else place.category.uppercase()
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
        driversPick || trustLevel.equals("roviq", ignoreCase = true) || trustLevel.equals("driver", ignoreCase = true)

    private fun compactAddress(address: String): String =
        address.split(',').map { it.trim() }.filter { it.isNotBlank() }.take(2).joinToString(", ")
}
