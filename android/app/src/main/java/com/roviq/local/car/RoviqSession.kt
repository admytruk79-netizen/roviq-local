package com.roviq.local.car

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session

class RoviqSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen = CarHomeScreen(carContext)
}
