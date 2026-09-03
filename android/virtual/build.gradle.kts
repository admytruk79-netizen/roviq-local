plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.roviq.local.virtual"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.roviq.local.virtual"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "BASE_URL", "\"${project.findProperty("ROVIQ_BASE_URL") ?: "https://roviq-local2.admytruk79.workers.dev/"}\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }

    signingConfigs {
        create("release") {
            val storePath = System.getenv("ROVIQ_KEYSTORE_PATH")
            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword = System.getenv("ROVIQ_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ROVIQ_KEY_ALIAS")
                keyPassword = System.getenv("ROVIQ_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
}
