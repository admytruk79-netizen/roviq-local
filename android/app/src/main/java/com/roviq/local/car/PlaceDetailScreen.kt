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
        val pick = place.driversPick || place.trustLevel.equals("roviq", true) || place.trustLevel.equals("driver", true)
        val message = buildString {
            append(if (pick) "★ ROVIQ PICK" else place.category.uppercase())
            place.description?.let {
                val reason = it.replace(Regex("\\s+"), " ").trim().take(150)
                if (reason.isNotBlank()) append("\n\nWhy stop here? ").append(reason)
            }
            place.address?.let { append("\n\n").append(it) }
            place.hours?.let { append("\n").append(it) }
        }

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
