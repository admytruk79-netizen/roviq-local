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

class NearbyPlacesScreen(carContext: CarContext) : Screen(carContext) {
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
                places = RoviqApi.loadApprovedPlaces().take(12)
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
            .setTitle("ROVIQ Local")
            .setHeaderAction(Action.APP_ICON)
            .setCurrentLocationEnabled(true)

        if (loading) return builder.setLoading(true).build()

        val list = ItemList.Builder()
        if (places.isEmpty()) {
            list.addItem(
                Row.Builder()
                    .setTitle(error ?: "No nearby ROVIQ places yet")
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
                val subtitle = buildString {
                    if (place.driversPick) append("★ ROVIQ Pick")
                    else append(place.category.replaceFirstChar { it.uppercase() })
                    place.address?.let { append(" · ").append(it) }
                }
                list.addItem(
                    Row.Builder()
                        .setTitle(place.name)
                        .addText(subtitle)
                        .setBrowsable(true)
                        .setMetadata(Metadata.Builder().setPlace(mapPlace).build())
                        .setOnClickListener { screenManager.push(PlaceDetailScreen(carContext, place)) }
                        .build()
                )
            }
        }

        return builder.setItemList(list.build()).build()
    }
}
