package com.tuntune.player.kiosk

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.tuntune.player.MainActivity
import com.tuntune.player.data.LibraryStore

/**
 * Kiosk modu: TUNTUNE telefonun ana ekranı olur ve uygulamadan çıkılamaz.
 *
 * Önce bilgisayardan bir kez şu komut çalıştırılmalı:
 *   adb shell dpm set-device-owner com.tuntune.player/.kiosk.AdminReceiver
 */
class KioskManager(private val context: Context) {

    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val admin = ComponentName(context, AdminReceiver::class.java)
    private val store = LibraryStore.get(context)

    /** ADB komutu çalıştırılmış mı? */
    val isDeviceOwner: Boolean get() = dpm.isDeviceOwnerApp(context.packageName)

    val isEnabled: Boolean get() = isDeviceOwner && store.kioskEnabled

    fun isLocked(activity: Activity): Boolean {
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    }

    /** Kiosk modunu aç: ana ekran yap, izinleri ver, kilitle. */
    fun enable(activity: Activity) {
        if (!isDeviceOwner) return
        dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // Güç menüsü ve üstteki saat/pil bilgisi açık kalsın.
            dpm.setLockTaskFeatures(
                admin,
                DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS or
                    DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO,
            )
        }
        val home = IntentFilter(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        dpm.addPersistentPreferredActivity(admin, home, ComponentName(context, MainActivity::class.java))
        grantPermissions()
        store.kioskEnabled = true
        lockIfNeeded(activity)
    }

    /** Uygulama her öne geldiğinde çağrılır; kiosk açıksa kilitler. */
    fun lockIfNeeded(activity: Activity) {
        if (isEnabled && dpm.isLockTaskPermitted(context.packageName) && !isLocked(activity)) {
            try {
                activity.startLockTask()
            } catch (_: Exception) {
            }
        }
    }

    /** Kiosk modunu kapat: telefon normal kullanıma döner, TUNTUNE cihaz sahibi olarak kalır. */
    fun disable(activity: Activity) {
        store.kioskEnabled = false
        if (isLocked(activity)) {
            try {
                activity.stopLockTask()
            } catch (_: Exception) {
            }
        }
        if (isDeviceOwner) {
            dpm.clearPackagePersistentPreferredActivities(admin, context.packageName)
            dpm.setLockTaskPackages(admin, arrayOf())
        }
    }

    /** Her şeyi geri al: cihaz sahibi yetkisini de bırak. */
    @Suppress("DEPRECATION")
    fun removeCompletely(activity: Activity) {
        disable(activity)
        if (isDeviceOwner) dpm.clearDeviceOwnerApp(context.packageName)
    }

    private fun grantPermissions() {
        val permissions = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.READ_MEDIA_AUDIO)
                add(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }
        permissions.forEach {
            try {
                dpm.setPermissionGrantState(admin, context.packageName, it, DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
            } catch (_: Exception) {
            }
        }
    }
}
