package com.tuntune.player

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import com.tuntune.player.kiosk.KioskManager
import com.tuntune.player.ui.TunTuneApp
import com.tuntune.player.ui.theme.AccentTheme
import com.tuntune.player.ui.theme.TunTuneTheme

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()
    private lateinit var kiosk: KioskManager

    /** Arayüzün kiosk durumunu yeniden okuması için sayaç. */
    private val kioskVersion = mutableStateOf(0)
    private val hasPermission = mutableStateOf(false)

    private val permissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        updatePermission()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        kiosk = KioskManager(this)
        updatePermission()
        if (!hasPermission.value) askPermissions()

        setContent {
            val accentName by viewModel.store.accent.collectAsState()
            val accent = AccentTheme.entries.firstOrNull { it.name == accentName } ?: AccentTheme.Yellow
            TunTuneTheme(accent) {
                TunTuneApp(
                    vm = viewModel,
                    hasPermission = hasPermission.value,
                    onRequestPermission = { askPermissions() },
                    kioskVersion = kioskVersion.value,
                    isDeviceOwner = { kiosk.isDeviceOwner },
                    isKioskEnabled = { kiosk.isEnabled },
                    onEnableKiosk = { kiosk.enable(this); updatePermission(); kioskVersion.value++ },
                    onDisableKiosk = { kiosk.disable(this); kioskVersion.value++ },
                    onRemoveKiosk = { kiosk.removeCompletely(this); kioskVersion.value++ },
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        kiosk.lockIfNeeded(this)
        val had = hasPermission.value
        updatePermission()
        if (!had && hasPermission.value) viewModel.refresh()
    }

    private fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.READ_MEDIA_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
        } else {
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

    private fun audioPermission(): String =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Manifest.permission.READ_MEDIA_AUDIO
        else Manifest.permission.READ_EXTERNAL_STORAGE

    private fun updatePermission() {
        val granted = ContextCompat.checkSelfPermission(this, audioPermission()) == PackageManager.PERMISSION_GRANTED
        if (granted && !hasPermission.value) viewModel.refresh()
        hasPermission.value = granted
    }

    private fun askPermissions() {
        permissionLauncher.launch(requiredPermissions())
    }
}
