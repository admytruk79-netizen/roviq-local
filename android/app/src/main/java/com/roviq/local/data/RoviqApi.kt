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

object RoviqApi {
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
