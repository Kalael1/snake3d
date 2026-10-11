package com.tuntune.player.ui.screens

import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tuntune.player.transfer.TransferHub
import com.tuntune.player.ui.components.CyberButton
import com.tuntune.player.ui.components.CyberIconButton
import com.tuntune.player.ui.components.DotGrid
import com.tuntune.player.ui.components.HatchBar
import com.tuntune.player.ui.components.HudLabel
import com.tuntune.player.ui.components.OutlineDisc
import com.tuntune.player.ui.components.SectionHeader
import com.tuntune.player.ui.components.panel
import com.tuntune.player.ui.theme.Chamfer
import com.tuntune.player.ui.theme.TT

/** Wi-Fi transfer modu: bilgisayardaki TUNTUNE SYNC programı bu ekran açıkken bağlanabilir. */
@Composable
fun TransferScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val status by TransferHub.status.collectAsState()
    val accent = TT.Accent

    // Ekran açıkken alıcı çalışır, çıkınca kapanır.
    DisposableEffect(Unit) {
        TransferHub.start(context)
        onDispose { TransferHub.stop() }
    }
    BackHandler(onBack = onBack)

    val deleteLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {
        TransferHub.clearPendingDeletes()
    }

    LazyColumn(Modifier.fillMaxSize().background(TT.Background), contentPadding = BottomInset) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 16.dp, top = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                CyberIconButton(Icons.Rounded.ArrowBack, "Geri", onBack, size = 40.dp)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    HudLabel("◤ WI-FI LINK", color = accent)
                    Text("TRANSFER", style = MaterialTheme.typography.headlineLarge, color = TT.TextPrimary)
                }
                DotGrid(4, 3, spacing = 7.dp)
            }
        }

        // ---- Bağlantı paneli
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, top = 20.dp)
                    .panel(color = TT.Panel, border = if (status.running) accent else TT.Line, shape = Chamfer(16.dp))
                    .padding(18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                OutlineDisc(
                    isPlaying = status.current != null,
                    modifier = Modifier.fillMaxWidth(0.42f),
                    color = if (status.current != null) accent else TT.TextSecondary,
                )
                Spacer(Modifier.height(16.dp))
                HudLabel(
                    when {
                        status.error != null -> "LINK // ERROR"
                        status.current != null -> "LINK // RECEIVING"
                        status.running -> "LINK // WAITING FOR PC"
                        else -> "LINK // OFFLINE"
                    },
                    color = if (status.error != null) TT.TextSecondary else accent,
                )
                Spacer(Modifier.height(12.dp))
                HudLabel("Pairing code", color = TT.TextDim)
                Text(
                    status.code.toCharArray().joinToString(" "),
                    style = MaterialTheme.typography.displaySmall,
                    color = TT.TextPrimary,
                )
                Spacer(Modifier.height(8.dp))
                HudLabel("Address // ${status.address ?: "Wi-Fi bağlı değil"}", color = TT.TextSecondary)
                status.error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
                }
            }
        }

        // ---- Aktarım durumu
        status.current?.let { p ->
            item {
                Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(p.name, style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        HudLabel("%d%%".format(if (p.total > 0) p.received * 100 / p.total else 0), color = accent)
                    }
                    Spacer(Modifier.height(6.dp))
                    HatchBar(if (p.total > 0) p.received.toFloat() / p.total else 0f, Modifier.fillMaxWidth().height(10.dp))
                }
            }
        }

        // ---- Silme onayı
        if (status.pendingDeletes.isNotEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp, end = 16.dp, top = 16.dp)
                        .panel(color = TT.Panel, border = accent, shape = Chamfer(12.dp))
                        .padding(14.dp),
                ) {
                    HudLabel("◤ DELETE REQUEST // ${status.pendingDeletes.size}", color = accent)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Bilgisayar ${status.pendingDeletes.size} şarkıyı silmek istiyor. Android, TUNTUNE'un eklemediği dosyalar için senin onayını istiyor.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TT.TextSecondary,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CyberButton("Onayla", {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                val pi = MediaStore.createDeleteRequest(context.contentResolver, status.pendingDeletes)
                                deleteLauncher.launch(IntentSenderRequest.Builder(pi.intentSender).build())
                            } else {
                                TransferHub.clearPendingDeletes()
                            }
                        }, icon = Icons.Rounded.DeleteSweep)
                        CyberButton("Vazgeç", { TransferHub.clearPendingDeletes() }, filled = false)
                    }
                }
            }
        }

        // ---- Kayıt
        item { SectionHeader(1, "Log // ${status.received} received") }
        if (status.log.isEmpty()) {
            item {
                Text(
                    "Bilgisayarda TUNTUNE SYNC programını aç. Telefon otomatik bulunur, yukarıdaki kodu gir ve şarkıları gönder.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TT.TextSecondary,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
        items(status.log) { line ->
            Text(
                line,
                style = MaterialTheme.typography.bodyMedium,
                color = if (line.startsWith("✓")) TT.TextPrimary else TT.TextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        item {
            Box(Modifier.fillMaxWidth().padding(16.dp)) {
                HudLabel("Ekrandan çıkınca alıcı kapanır.", color = TT.TextDim)
            }
        }
    }
}
