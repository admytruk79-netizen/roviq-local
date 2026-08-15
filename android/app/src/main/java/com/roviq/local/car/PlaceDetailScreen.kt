package com.roviq.local.car

import android.content.Intent
import android.net.Uri
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import com.roviq.local.data.RoviqPlace

class PlaceDetailScreen(
    carContext: CarContext,
    private val place: RoviqPlace
) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val message = buildString {
            if (place.driversPick) append("★ ROVIQ Pick\n")
            place.description?.let { append(it).append("\n") }
            place.address?.let { append(it).append("\n") }
            place.hours?.let { append(it) }
        }.trim().ifBlank { place.category.replaceFirstChar { it.uppercase() } }

        val navigate = Action.Builder()
            .setTitle("Navigate")
            .setOnClickListener {
                val uri = Uri.parse("geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}(${Uri.encode(place.name)})")
                carContext.startCarApp(Intent(CarContext.ACTION_NAVIGATE, uri))
            }
            .build()

        return MessageTemplate.Builder(message)
            .setTitle(place.name)
            .setHeaderAction(Action.BACK)
            .addAction(navigate)
            .build()
    }
}
