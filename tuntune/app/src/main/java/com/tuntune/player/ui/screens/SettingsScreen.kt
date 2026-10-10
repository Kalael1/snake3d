package com.tuntune.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Password
import androidx.compose.material.icons.rounded.PhonelinkErase
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tuntune.player.ui.components.PinDialog
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

    Column(
        Modifier
            .fillMaxSize()
            .background(TT.Background)
            .verticalScroll(rememberScrollState())
            .statusBarsPadding()
            .padding(bottom = 150.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, "Geri", tint = TT.TextPrimary) }
            Text("Ayarlar", style = MaterialTheme.typography.titleLarge, color = TT.TextPrimary)
        }

        Header("Kitaplık")
        SettingRow(Icons.Rounded.Refresh, "Müzikleri yeniden tara", "$songCount şarkı bulundu", onRescan)

        Header("Kiosk modu (sadece müzik çalar)")
        when {
            !isDeviceOwner -> {
                InfoCard(
                    "Kiosk modu açıldığında telefon sadece TUNTUNE'u gösterir; başka uygulamaya geçilemez. " +
                        "Bunun için telefonda hiçbir hesap (Google, Mi) yokken bilgisayardan bir kez şu komutu çalıştır:",
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
                            .clip(RoundedCornerShape(6.dp))
                            .background(TT.SurfaceHigh)
                            .padding(12.dp),
                    )
                }
            }
            !kioskEnabled -> {
                SettingRow(Icons.Rounded.Lock, "Kiosk modunu aç", "Telefon sadece TUNTUNE olarak çalışır") { confirmEnable = true }
            }
            else -> {
                InfoCard("Kiosk modu açık. Telefon sadece TUNTUNE'u gösteriyor.")
                SettingRow(Icons.Rounded.LockOpen, "Kiosk modundan çık", "Telefon normal kullanıma döner (PIN gerekir)") {
                    pinError = null; pinDialogKey++; pinPurpose = PinPurpose.Disable
                }
            }
        }
        if (isDeviceOwner) {
            SettingRow(
                Icons.Rounded.Password,
                "PIN'i değiştir",
                if (usingDefaultPin) "Şu an varsayılan PIN kullanılıyor: 0000 — değiştirmen önerilir" else "Kiosk modundan çıkmak için kullanılan PIN",
            ) { pinError = null; pinDialogKey++; pinPurpose = PinPurpose.ChangeOld }
            SettingRow(
                Icons.Rounded.PhonelinkErase,
                "Kiosk yetkisini tamamen kaldır",
                "TUNTUNE'un cihaz sahibi yetkisini bırakır (PIN gerekir)",
            ) { pinError = null; pinDialogKey++; pinPurpose = PinPurpose.Remove }
        }

        Header("Hakkında")
        SettingRow(Icons.Rounded.Info, "TUNTUNE 1.0", "Çevrimdışı müzik çalar", null)
    }

    if (confirmEnable) {
        AlertDialog(
            onDismissRequest = { confirmEnable = false },
            containerColor = TT.SurfaceHigh,
            title = { Text("Kiosk modu açılsın mı?") },
            text = {
                Text(
                    "Telefon sadece TUNTUNE'u gösterecek. Çıkmak için Ayarlar → \"Kiosk modundan çık\" ve PIN gerekir." +
                        if (usingDefaultPin) "\n\nPIN şu an 0000. Önce değiştirmen önerilir." else "",
                )
            },
            confirmButton = { TextButton(onClick = { confirmEnable = false; onEnableKiosk() }) { Text("Aç", color = TT.Accent) } },
            dismissButton = { TextButton(onClick = { confirmEnable = false }) { Text("Vazgeç", color = TT.TextSecondary) } },
        )
    }

    pinPurpose?.let { purpose ->
        androidx.compose.runtime.key(pinDialogKey) {
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
private fun Header(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        color = TT.TextPrimary,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 8.dp),
    )
}

@Composable
private fun InfoCard(text: String) {
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
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = TT.TextSecondary, modifier = Modifier.size(24.dp))
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = TT.TextPrimary)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
        }
    }
}
