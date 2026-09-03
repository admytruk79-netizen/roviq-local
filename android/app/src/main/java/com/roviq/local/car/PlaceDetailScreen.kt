package com.roviq.local.car

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.ParkedOnlyOnClickListener
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
                try {
                    screenManager.push(RoviqNavigationScreen(carContext, place))
                } catch (t: Throwable) {
                    val uri = Uri.parse("geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}(${Uri.encode(place.name)})")
                    carContext.startCarApp(Intent(CarContext.ACTION_NAVIGATE, uri))
                }
            }
            .build()

        // Hands off to the :virtual companion (phone-side, reuses the real cinematic
        // wild-cinematic.js engine) rather than a car-native step-through screen, since
        // video isn't available in any Car App Library template.
        val virtual = Action.Builder()
            .setTitle("Virtual")
            .setOnClickListener(
                ParkedOnlyOnClickListener.create {
                    val uri = Uri.Builder()
                        .scheme("roviqvirtual")
                        .authority("drive")
                        .appendQueryParameter("placeId", place.id.toString())
                        .appendQueryParameter("name", place.name)
                        .appendQueryParameter("lat", place.lat.toString())
                        .appendQueryParameter("lng", place.lng.toString())
                        .build()
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                        .setPackage("com.roviq.local.virtual")
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try {
                        // This opens the companion on the connected phone, not on the car screen.
                        // The ParkedOnlyOnClickListener ensures the host only allows the handoff when safe.
                        carContext.startActivity(intent)
                    } catch (_: ActivityNotFoundException) {
                        // Companion is optional. Keep the supported Navigation/POI experience intact.
                    } catch (_: SecurityException) {
                        // Host/platform policy may reject phone activity launch; navigation remains available.
                    }
                }
            )
            .build()

        return MessageTemplate.Builder(message)
            .setTitle(place.name)
            .setHeaderAction(Action.BACK)
            .addAction(navigate)
            .addAction(virtual)
            .build()
    }
}
