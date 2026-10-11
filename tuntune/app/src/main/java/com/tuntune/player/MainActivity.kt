package com.tuntune.player

import android.Manifest
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.view.WindowManager
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
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

    /** TUNTUNE kilit ekranı görünüyor mu? */
    private val lockVisible = mutableStateOf(false)
    private val keyguard by lazy { getSystemService(KeyguardManager::class.java) }

    /** Ekran kapanınca bir sonraki açılışta kilit ekranımız gelsin. */
    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (!viewModel.store.lockScreen.value) return
            lockVisible.value = true
            // Başka bir ekrandaysak TUNTUNE'u öne getir: ekran açılınca ilk o görünsün.
            if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                try {
                    startActivity(
                        Intent(this@MainActivity, MainActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    )
                } catch (_: Exception) {
                }
            }
        }
    }

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

        ContextCompat.registerReceiver(
            this, screenOffReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        // Kilit ekranı ayarı değişince sistem kilidinin üzerinde görünme iznini güncelle.
        lifecycleScope.launch {
            viewModel.store.lockScreen.collect { enabled ->
                showOverSystemLock(enabled)
                if (!enabled) lockVisible.value = false
            }
        }

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
                    lockVisible = lockVisible.value,
                    onUnlock = ::unlockScreen,
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Sistem kilitliyken açıldıysak kilit ekranımızı göster (kilit atlatılamasın).
        if (viewModel.store.lockScreen.value && keyguard.isKeyguardLocked) lockVisible.value = true
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

    override fun onDestroy() {
        unregisterReceiver(screenOffReceiver)
        super.onDestroy()
    }

    private fun showOverSystemLock(enabled: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(enabled)
        } else {
            @Suppress("DEPRECATION")
            if (enabled) window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        }
    }

    /** Yukarı kaydırınca: telefonda şifre varsa önce şifre sorulur. */
    private fun unlockScreen() {
        if (keyguard.isKeyguardLocked) {
            keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() {
                    lockVisible.value = false
                }
            })
        } else {
            lockVisible.value = false
        }
    }
}
