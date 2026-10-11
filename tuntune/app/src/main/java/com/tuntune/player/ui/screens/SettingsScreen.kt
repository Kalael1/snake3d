package com.tuntune.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Password
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.PhonelinkErase
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material.icons.rounded.ScreenLockPortrait
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tuntune.player.ui.components.CyberDialog
import com.tuntune.player.ui.components.CyberIconButton
import com.tuntune.player.ui.components.HudLabel
import com.tuntune.player.ui.components.PinDialog
import com.tuntune.player.ui.components.SectionHeader
import com.tuntune.player.ui.components.panel
import com.tuntune.player.ui.theme.AccentTheme
import com.tuntune.player.ui.theme.Chamfer
import com.tuntune.player.ui.theme.TT

const val DEVICE_OWNER_COMMAND = "adb shell dpm set-device-owner com.tuntune.player/.kiosk.AdminReceiver"

private enum class PinPurpose { Disable, Remove, ChangeOld, ChangeNew }

@Composable
fun SettingsScreen(
    songCount: Int,
    isDeviceOwner: Boolean,
    kioskEnabled: Boolean,
    currentPin: String,
    usingDefaultPin: Boolean,
    accent: AccentTheme,
    onAccentChange: (AccentTheme) -> Unit,
    lockScreenEnabled: Boolean,
    onLockScreenChange: (Boolean) -> Unit,
    pinEnabled: Boolean,
    onPinChange: (Boolean) -> Unit,
    onOpenTransfer: () -> Unit,
    onBack: () -> Unit,
    onRescan: () -> Unit,
    onEnableKiosk: () -> Unit,
    onDisableKiosk: () -> Unit,
    onRemoveKiosk: () -> Unit,
    onChangePin: (String) -> Unit,
) {
    var pinPurpose by remember { mutableStateOf<PinPurpose?>(null) }
    var pinError by remember { mutableStateOf<String?>(null) }
    var confirmEnable by remember { mutableStateOf(false) }
    var pinDialogKey by remember { mutableIntStateOf(0) }
    val context = LocalContext.current

    Column(
        Modifier
            .fillMaxSize()
            .background(TT.Background)
            .verticalScroll(rememberScrollState())
            .statusBarsPadding()
            .padding(bottom = 170.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            CyberIconButton(Icons.Rounded.ArrowBack, "Geri", onBack, size = 40.dp)
            Spacer(Modifier.width(14.dp))
            Column {
                HudLabel("◤ SYSTEM", color = TT.Accent)
                Text("SETTINGS", style = MaterialTheme.typography.headlineLarge, color = TT.TextPrimary)
            }
        }

        // ---- Tema
        SectionHeader(1, "Theme")
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AccentTheme.entries.forEach { theme ->
                val selected = theme == accent
                Column(
                    Modifier
                        .weight(1f)
                        .panel(color = TT.Panel, border = if (selected) theme.color else TT.Line, shape = Chamfer(8.dp))
                        .clickable { onAccentChange(theme) }
                        .padding(6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier.fillMaxWidth().aspectRatio(1f).panel(color = theme.color, border = null, shape = Chamfer(6.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (selected) Icon(Icons.Rounded.Check, null, tint = Color.Black, modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.height(6.dp))
                    HudLabel(theme.label.substringAfterLast(' '), color = if (selected) theme.color else TT.TextSecondary)
                }
            }
        }
        HudLabel("ACTIVE // ${accent.label}", color = TT.TextDim, modifier = Modifier.padding(start = 16.dp, top = 10.dp))

        // ---- Kitaplık
        SectionHeader(2, "Library")
        SettingRow(Icons.Rounded.Wifi, "Wi-Fi transfer", "Bilgisayardan kablosuz müzik al (TUNTUNE SYNC)", onOpenTransfer)
        SettingRow(Icons.Rounded.Refresh, "Müzikleri yeniden tara", "$songCount şarkı bulundu", onRescan)

        // ---- Telefon
        SectionHeader(3, "Device")
        ToggleRow(
            Icons.Rounded.ScreenLockPortrait,
            "TUNTUNE kilit ekranı",
            "Ekranı açınca siyah-beyaz CD ve saat görünür. Yukarı kaydırınca açılır.",
            checked = lockScreenEnabled,
            onCheckedChange = onLockScreenChange,
        )
        ToggleRow(
            Icons.Rounded.PushPin,
            "Ekran sabitleme (çıkış yok)",
            "TUNTUNE ekrana kilitlenir. Çıkmak için Geri + Son uygulamalar tuşlarını birlikte basılı tut.",
            checked = pinEnabled,
            onCheckedChange = onPinChange,
        )
        SettingRow(Icons.Rounded.PhoneAndroid, "Telefon ayarlarını aç", "Wi-Fi, Bluetooth, ses, ekran parlaklığı") {
            context.startActivity(
                android.content.Intent(android.provider.Settings.ACTION_SETTINGS)
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }

        // ---- Kiosk
        SectionHeader(4, "Kiosk mode")
        when {
            !isDeviceOwner -> {
                InfoText(
                    "Kiosk modu açıldığında telefon sadece TUNTUNE'u gösterir. Bunun için telefonda hiçbir hesap yokken " +
                        "bilgisayardan bir kez şu komutu çalıştır:",
                )
                SelectionContainer {
                    Text(
                        DEVICE_OWNER_COMMAND,
                        fontFamily = FontFamily.Monospace,
                        style = MaterialTheme.typography.bodySmall,
                        color = TT.Accent,
                        modifier = Modifier
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                            .fillMaxWidth()
                            .panel(color = TT.Panel, border = TT.Line, shape = Chamfer(8.dp))
                            .padding(12.dp),
                    )
                }
            }
            !kioskEnabled -> {
                SettingRow(Icons.Rounded.Lock, "Kiosk modunu aç", "Telefon sadece TUNTUNE olarak çalışır") { confirmEnable = true }
            }
            else -> {
                InfoText("Kiosk modu açık. Telefon sadece TUNTUNE'u gösteriyor.")
                SettingRow(Icons.Rounded.LockOpen, "Kiosk modundan çık", "Telefon normal kullanıma döner (PIN gerekir)") {
                    pinError = null; pinDialogKey++; pinPurpose = PinPurpose.Disable
                }
            }
        }
        if (isDeviceOwner) {
            SettingRow(
                Icons.Rounded.Password,
                "PIN'i değiştir",
                if (usingDefaultPin) "Varsayılan PIN kullanılıyor: 0000 — değiştirmen önerilir" else "Kiosk modundan çıkmak için kullanılan PIN",
            ) { pinError = null; pinDialogKey++; pinPurpose = PinPurpose.ChangeOld }
            SettingRow(
                Icons.Rounded.PhonelinkErase,
                "Kiosk yetkisini tamamen kaldır",
                "TUNTUNE'un cihaz sahibi yetkisini bırakır (PIN gerekir)",
            ) { pinError = null; pinDialogKey++; pinPurpose = PinPurpose.Remove }
        }

        // ---- Hakkında
        SectionHeader(5, "About")
        SettingRow(Icons.Rounded.Info, "TUNTUNE 2.0", "Offline audio system // cyber edition", null)
    }

    if (confirmEnable) {
        CyberDialog(
            title = "Kiosk modu açılsın mı?",
            onDismiss = { confirmEnable = false },
            confirmText = "Aç",
            onConfirm = { confirmEnable = false; onEnableKiosk() },
        ) {
            Text(
                "Telefon sadece TUNTUNE'u gösterecek. Çıkmak için Ayarlar → \"Kiosk modundan çık\" ve PIN gerekir." +
                    if (usingDefaultPin) "\n\nPIN şu an 0000. Önce değiştirmen önerilir." else "",
                color = TT.TextSecondary,
            )
        }
    }

    pinPurpose?.let { purpose ->
        key(pinDialogKey) {
            PinDialog(
                title = when (purpose) {
                    PinPurpose.Disable -> "Kiosk modundan çık"
                    PinPurpose.Remove -> "Yetkiyi kaldır"
                    PinPurpose.ChangeOld -> "Mevcut PIN"
                    PinPurpose.ChangeNew -> "Yeni PIN"
                },
                message = if (purpose == PinPurpose.ChangeNew) "En az 4 haneli yeni bir PIN gir." else "Devam etmek için PIN'i gir.",
                error = pinError,
                onDismiss = { pinPurpose = null },
                onConfirm = { pin ->
                    if (purpose == PinPurpose.ChangeNew) {
                        onChangePin(pin)
                        pinPurpose = null
                    } else if (pin != currentPin) {
                        pinError = "PIN yanlış"
                    } else {
                        pinError = null
                        when (purpose) {
                            PinPurpose.Disable -> { pinPurpose = null; onDisableKiosk() }
                            PinPurpose.Remove -> { pinPurpose = null; onRemoveKiosk() }
                            else -> { pinDialogKey++; pinPurpose = PinPurpose.ChangeNew }
                        }
                    }
                },
            )
        }
    }
}

@Composable
private fun InfoText(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        color = TT.TextSecondary,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
    )
}

@Composable
private fun SettingRow(icon: ImageVector, title: String, subtitle: String, onClick: (() -> Unit)?) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .panel(color = TT.Panel, border = TT.Line, shape = Chamfer(10.dp))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = TT.Accent, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
        }
    }
}

@Composable
private fun ToggleRow(icon: ImageVector, title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    val accent = TT.Accent
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .panel(color = TT.Panel, border = if (checked) accent else TT.Line, shape = Chamfer(10.dp))
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = accent, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
        }
        Spacer(Modifier.width(10.dp))
        // ON/OFF anahtarı
        Box(
            Modifier
                .panel(color = if (checked) accent else androidx.compose.ui.graphics.Color.Transparent, border = if (checked) null else TT.LineBright, shape = Chamfer(6.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Text(
                if (checked) "ON" else "OFF",
                style = MaterialTheme.typography.labelLarge,
                color = if (checked) androidx.compose.ui.graphics.Color.Black else TT.TextSecondary,
            )
        }
    }
}
