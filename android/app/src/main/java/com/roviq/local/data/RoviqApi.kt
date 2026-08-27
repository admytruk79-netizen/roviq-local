package com.roviq.local.data

import com.roviq.local.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

data class RoviqPlace(
    val id: Long,
    val name: String,
    val category: String,
    val description: String?,
    val lat: Double,
    val lng: Double,
    val address: String?,
    val hours: String?,
    val driversPick: Boolean,
    val trustLevel: String?
)

data class RoviqRouteStep(
    val distanceMeters: Double,
    val durationSeconds: Double,
    val name: String,
    val instruction: String,
    val maneuverType: String,
    val maneuverModifier: String,
    val lat: Double?,
    val lng: Double?
)

data class RoviqRoute(
    val distanceMeters: Double,
    val durationSeconds: Double,
    val steps: List<RoviqRouteStep>
)

object RoviqApi {
    fun fetchRoute(fromLat: Double, fromLng: Double, toLat: Double, toLng: Double): RoviqRoute? {
        val base = BuildConfig.BASE_URL.trimEnd('/')
        val from = URLEncoder.encode("$fromLng,$fromLat", StandardCharsets.UTF_8.toString())
        val to = URLEncoder.encode("$toLng,$toLat", StandardCharsets.UTF_8.toString())
        val connection = URL("$base/api/route?from=$from&to=$to").openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode !in 200..299) return null
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val root = JSONObject(body)
            val r = root.optJSONObject("route") ?: return null
            val stepsArr = r.optJSONArray("steps")
            val steps = buildList {
                if (stepsArr != null) {
                    for (i in 0 until stepsArr.length()) {
                        val s = stepsArr.getJSONObject(i)
                        val loc = s.optJSONArray("location")
                        add(
                            RoviqRouteStep(
                                distanceMeters = s.optDouble("distance", 0.0),
                                durationSeconds = s.optDouble("duration", 0.0),
                                name = s.optString("name"),
                                instruction = s.optString("instruction"),
                                maneuverType = s.optString("type"),
                                maneuverModifier = s.optString("modifier"),
                                lng = loc?.optDouble(0)?.takeIf { it.isFinite() },
                                lat = loc?.optDouble(1)?.takeIf { it.isFinite() }
                            )
                        )
                    }
                }
            }
            RoviqRoute(
                distanceMeters = r.optDouble("distance", 0.0),
                durationSeconds = r.optDouble("duration", 0.0),
                steps = steps
            )
        } catch (t: Throwable) {
            null
        } finally {
            connection.disconnect()
        }
    }

    fun loadApprovedPlaces(category: String? = null, driversPickOnly: Boolean = false): List<RoviqPlace> {
        val base = BuildConfig.BASE_URL.trimEnd('/')
        val categoryParam = category?.takeIf { it.isNotBlank() }?.let {
            "&category=${URLEncoder.encode(it, StandardCharsets.UTF_8.toString())}"
        } ?: ""
        val connection = URL("$base/api/places?status=approved$categoryParam").openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 7000
            connection.readTimeout = 7000
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode !in 200..299) return emptyList()
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val root = JSONObject(body)
            if (!root.optBoolean("success", false)) return emptyList()
            val arr = root.optJSONArray("places") ?: return emptyList()
            buildList {
                for (i in 0 until arr.length()) {
                    val p = arr.getJSONObject(i)
                    if (p.optInt("is_hidden", 0) == 1) continue
                    val place = RoviqPlace(
                        id = p.optLong("id"),
                        name = p.optString("name"),
                        category = p.optString("category"),
                        description = p.optString("description").takeIf { it.isNotBlank() },
                        lat = p.optDouble("lat"),
                        lng = p.optDouble("lng"),
                        address = p.optString("address").takeIf { it.isNotBlank() },
                        hours = p.optString("hours").takeIf { it.isNotBlank() },
                        driversPick = p.optInt("is_drivers_pick", 0) == 1,
                        trustLevel = p.optString("trust_level").takeIf { it.isNotBlank() }
                    )
                    if (!driversPickOnly || place.driversPick) add(place)
                }
            }
        } finally {
            connection.disconnect()
        }
    }
}
