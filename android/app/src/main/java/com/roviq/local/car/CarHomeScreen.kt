package com.roviq.local.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template

class CarHomeScreen(carContext: CarContext) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val list = ItemList.Builder()
            .addItem(menuRow("Nearby", "Useful ROVIQ places around you") {
                screenManager.push(NearbyPlacesScreen(carContext, title = "Nearby"))
            })
            .addItem(menuRow("ROVIQ Picks", "Driver-picked and editorial favourites") {
                screenManager.push(NearbyPlacesScreen(carContext, title = "ROVIQ Picks", driversPickOnly = true))
            })
            .addItem(menuRow("Coffee", "Trusted coffee stops") {
                screenManager.push(NearbyPlacesScreen(carContext, title = "Coffee", category = "coffee"))
            })
            .addItem(menuRow("Food", "Useful food stops") {
                screenManager.push(NearbyPlacesScreen(carContext, title = "Food", category = "food"))
            })
            .addItem(menuRow("Nature", "Parks, viewpoints and outdoor stops") {
                screenManager.push(NearbyPlacesScreen(carContext, title = "Nature", category = "nature"))
            })
            .build()

        return ListTemplate.Builder()
            .setTitle("ROVIQ Local")
            .setHeaderAction(Action.APP_ICON)
            .setSingleList(list)
            .build()
    }

    private fun menuRow(title: String, subtitle: String, onClick: () -> Unit): Row =
        Row.Builder()
            .setTitle(title)
            .addText(subtitle)
            .setBrowsable(true)
            .setOnClickListener(onClick)
            .build()
}
