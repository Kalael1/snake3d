package com.tuntune.player.ui.screens

import android.content.Context
import android.os.BatteryManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tuntune.player.PlayerUiState
import com.tuntune.player.ui.components.CornerTriangle
import com.tuntune.player.ui.components.CyberIconButton
import com.tuntune.player.ui.components.DotGrid
import com.tuntune.player.ui.components.HatchBar
import com.tuntune.player.ui.components.HudArrow
import com.tuntune.player.ui.components.HudLabel
import com.tuntune.player.ui.components.OutlineDisc
import com.tuntune.player.ui.components.ProgressRing
import com.tuntune.player.ui.components.verticalText
import com.tuntune.player.ui.theme.Chakra
import com.tuntune.player.ui.theme.TT
import java.util.Calendar
import java.util.Locale
import kotlinx.coroutines.delay

private val White = TT.TextPrimary
private val Gray = TT.TextSecondary
private val Dim = TT.TextDim

/**
 * TUNTUNE kilit ekranı: siyah zemin, beyaz çizgiler, dönen outline CD ve HUD saat.
 * Yukarı kaydırınca kilit açılır.
 */
@Composable
fun LockScreen(
    state: PlayerUiState,
    positionMs: () -> Long,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onUnlock: () -> Unit,
) {
    BackHandler {} // kilit ekranında geri tuşu bir şey yapmaz
    val unlock by rememberUpdatedState(onUnlock)
    var drag by remember { mutableFloatStateOf(0f) }

    Box(
        Modifier
            .fillMaxSize()
            .background(TT.Background)
            .pointerInput(Unit) {
                val threshold = 120.dp.toPx()
                detectVerticalDragGestures(
                    onDragStart = { drag = 0f },
                    onDragEnd = {
                        if (drag < -threshold) unlock()
                        drag = 0f
                    },
                    onDragCancel = { drag = 0f },
                ) { _, dy -> drag = (drag + dy).coerceAtMost(0f) }
            },
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    translationY = drag * 0.4f
                    alpha = 1f + (drag / 1200f).coerceAtLeast(-0.6f)
                }
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp),
        ) {
            // ---- Üst HUD
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                HudLabel("◤ TUNTUNE // LOCKED", color = White)
                Spacer(Modifier.weight(1f))
                BatteryLabel()
            }
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(5.dp).background(White))
                Spacer(Modifier.width(6.dp))
                Box(Modifier.weight(1f).height(1.dp).background(TT.Line))
                Spacer(Modifier.width(6.dp))
                DotGrid(6, 1, spacing = 6.dp, color = Dim)
            }

            // ---- Saat
            Spacer(Modifier.height(18.dp))
            LockClock()

            // ---- CD
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Box(Modifier.fillMaxWidth(0.78f)) {
                    ProgressRing(
                        progress = { if (state.durationMs > 0) positionMs().toFloat() / state.durationMs else 0f },
                        modifier = Modifier.matchParentSize(),
                        color = White,
                        track = TT.Line,
                    )
                    OutlineDisc(state.isPlaying, Modifier.fillMaxWidth().padding(14.dp))
                }
                HudArrow(Modifier.align(Alignment.TopStart), angle = -135f, color = Dim)
                HudArrow(Modifier.align(Alignment.BottomEnd), angle = 45f, color = Dim)
                Text(
                    if (state.isPlaying) "SIDE A // PLAYING" else "SIDE A // PAUSED",
                    style = MaterialTheme.typography.labelSmall,
                    color = Dim,
                    modifier = Modifier.align(Alignment.CenterEnd).verticalText(),
                )
            }

            // ---- Şarkı
            if (state.hasSong) {
                Text(
                    state.title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                HudLabel(state.artist, color = Gray, modifier = Modifier.align(Alignment.CenterHorizontally))
                Spacer(Modifier.height(16.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally)) {
                    CyberIconButton(Icons.Rounded.SkipPrevious, "Önceki", onPrevious, size = 52.dp, tint = White, border = TT.LineBright)
                    CyberIconButton(
                        if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                        if (state.isPlaying) "Duraklat" else "Çal",
                        onPlayPause,
                        size = 64.dp,
                        tint = White,
                        border = White,
                        cut = 12.dp,
                    )
                    CyberIconButton(Icons.Rounded.SkipNext, "Sonraki", onNext, size = 52.dp, tint = White, border = TT.LineBright)
                }
            } else {
                HudLabel("NO SIGNAL // QUEUE EMPTY", color = Dim, modifier = Modifier.align(Alignment.CenterHorizontally))
            }

            // ---- Kilit açma
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp, bottom = 14.dp)
                    .clickable { unlock() },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(Icons.Rounded.KeyboardArrowUp, null, tint = White, modifier = Modifier.size(26.dp))
                HudLabel("SWIPE UP TO UNLOCK", color = Gray)
            }
            Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.Bottom) {
                CornerTriangle(color = Dim, side = 8.dp)
                Spacer(Modifier.weight(1f))
                HudLabel("TT-01 // AUDIO SYSTEM", color = Dim)
            }
        }
    }
}

/** Büyük, çizgi (outline) saat + tarih + saniye çubuğu. Sadece kendisi saniyede bir yenilenir. */
@Composable
private fun LockClock() {
    val now by produceState(System.currentTimeMillis()) {
        while (true) {
            value = System.currentTimeMillis()
            delay(1_000 - value % 1_000)
        }
    }
    val cal = remember(now) { Calendar.getInstance().apply { timeInMillis = now } }
    val hh = "%02d".format(cal.get(Calendar.HOUR_OF_DAY))
    val mm = "%02d".format(cal.get(Calendar.MINUTE))
    val ss = cal.get(Calendar.SECOND)
    val day = cal.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.SHORT, Locale.ENGLISH)?.uppercase() ?: ""
    val date = "%02d.%02d.%04d".format(cal.get(Calendar.DAY_OF_MONTH), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.YEAR))

    Column(Modifier.fillMaxWidth()) {
        Text(
            "$hh:$mm",
            style = TextStyle(
                fontFamily = Chakra,
                fontWeight = FontWeight.Bold,
                fontSize = 92.sp,
                letterSpacing = 2.sp,
                drawStyle = Stroke(width = 4f),
            ),
            color = White,
            maxLines = 1,
        )
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            HudLabel("$day // $date", color = Gray)
            Spacer(Modifier.weight(1f))
            HudLabel("SEC %02d".format(ss), color = White)
        }
        Spacer(Modifier.height(8.dp))
        HatchBar(ss / 59f, Modifier.fillMaxWidth().height(9.dp), color = White, track = TT.Line)
    }
}

@Composable
private fun BatteryLabel() {
    val context = LocalContext.current
    val level by produceState(-1) {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        while (true) {
            value = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            delay(60_000)
        }
    }
    if (level >= 0) HudLabel("BAT %d%%".format(level), color = White)
}
