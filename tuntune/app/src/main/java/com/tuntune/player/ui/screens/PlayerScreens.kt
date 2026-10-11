package com.tuntune.player.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bedtime
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import com.tuntune.player.PlayerUiState
import com.tuntune.player.QueueEntry
import com.tuntune.player.ui.components.Artwork
import com.tuntune.player.ui.components.CyberDialog
import com.tuntune.player.ui.components.CyberIconButton
import com.tuntune.player.ui.components.DotGrid
import com.tuntune.player.ui.components.HatchBar
import com.tuntune.player.ui.components.HatchSeekBar
import com.tuntune.player.ui.components.HudArrow
import com.tuntune.player.ui.components.HudLabel
import com.tuntune.player.ui.components.ProgressRing
import com.tuntune.player.ui.components.SpinningDisc
import com.tuntune.player.ui.components.formatDuration
import com.tuntune.player.ui.components.panel
import com.tuntune.player.ui.components.verticalText
import com.tuntune.player.ui.theme.Chamfer
import com.tuntune.player.ui.theme.TT
import kotlinx.coroutines.delay

// ------------------------------------------------------------------ Mini oynatıcı

@Composable
fun MiniPlayer(
    state: PlayerUiState,
    isFavorite: Boolean,
    onOpen: () -> Unit,
    onPlayPause: () -> Unit,
    onToggleFavorite: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = TT.Accent
    Column(
        modifier
            .padding(horizontal = 8.dp)
            .fillMaxWidth()
            .panel(color = TT.Panel, border = TT.Line, shape = Chamfer(12.dp))
            .clickable(onClick = onOpen),
    ) {
        Row(Modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            SpinningDisc(state.albumId, state.isPlaying, Modifier.size(46.dp), detailed = false)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(state.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, color = TT.TextPrimary)
                HudLabel(state.artist)
            }
            IconButton(onClick = onToggleFavorite) {
                Icon(
                    if (isFavorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    contentDescription = "Beğen",
                    tint = if (isFavorite) accent else TT.TextSecondary,
                )
            }
            CyberIconButton(
                icon = if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                contentDescription = if (state.isPlaying) "Duraklat" else "Çal",
                onClick = onPlayPause,
                size = 42.dp,
                tint = Color.Black,
                fill = accent,
                border = null,
                iconScale = 0.6f,
            )
        }
        val progress = if (state.durationMs > 0) state.positionMs.toFloat() / state.durationMs else 0f
        HatchBar(progress, Modifier.fillMaxWidth().height(5.dp).padding(horizontal = 10.dp))
        Spacer(Modifier.height(6.dp))
    }
}

// ------------------------------------------------------------------ Şu an çalıyor

@Composable
fun NowPlayingScreen(
    state: PlayerUiState,
    isFavorite: Boolean,
    albumName: String,
    sleepTimerEndsAt: Long?,
    onClose: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSeek: (Long) -> Unit,
    onToggleShuffle: () -> Unit,
    onCycleRepeat: () -> Unit,
    onToggleFavorite: () -> Unit,
    onOpenQueue: () -> Unit,
    onSetSleepTimer: (Int?) -> Unit,
    onOpenArtist: () -> Unit,
) {
    BackHandler(onBack = onClose)
    val accent = TT.Accent
    var dragging by remember { mutableStateOf(false) }
    var dragValue by remember { mutableFloatStateOf(0f) }
    var showSleep by remember { mutableStateOf(false) }
    val duration = state.durationMs.coerceAtLeast(1)
    val shown = if (dragging) dragValue else (state.positionMs.toFloat() / duration).coerceIn(0f, 1f)

    Column(
        Modifier
            .fillMaxSize()
            .background(TT.Background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        // ---- Üst HUD
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            CyberIconButton(Icons.Rounded.KeyboardArrowDown, "Kapat", onClose, size = 40.dp)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                HudLabel("◤ NOW PLAYING", color = accent)
                Text(
                    albumName.uppercase(),
                    style = MaterialTheme.typography.labelLarge,
                    color = TT.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            CyberIconButton(Icons.Rounded.QueueMusic, "Sıradakiler", onOpenQueue, size = 40.dp)
        }
        Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).background(accent))
            Spacer(Modifier.width(6.dp))
            Box(Modifier.weight(1f).height(1.dp).background(TT.Line))
            Spacer(Modifier.width(6.dp))
            HudLabel("TRK %02d / %02d".format(state.index + 1, state.count.coerceAtLeast(1)), color = TT.TextDim)
        }

        // ---- CD sahnesi
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            Box(Modifier.fillMaxWidth(0.9f).aspectRatio(1f)) {
                ProgressRing(progress = { shown }, modifier = Modifier.fillMaxSize())
                SpinningDisc(state.albumId, state.isPlaying, Modifier.fillMaxSize().padding(16.dp))
            }
            HudArrow(Modifier.align(Alignment.TopStart).padding(top = 8.dp), angle = -135f)
            HudArrow(Modifier.align(Alignment.BottomEnd).padding(bottom = 8.dp), angle = 45f)
            DotGrid(4, 4, Modifier.align(Alignment.TopEnd).padding(top = 8.dp))
            Text(
                "SIDE A // TUNTUNE AUDIO",
                style = MaterialTheme.typography.labelSmall,
                color = TT.TextDim,
                modifier = Modifier.align(Alignment.CenterStart).verticalText(),
            )
        }

        // ---- Şarkı bilgisi
        Row(
            Modifier.fillMaxWidth().panel(color = TT.Panel, border = TT.Line, shape = Chamfer(12.dp)).padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(state.title, style = MaterialTheme.typography.headlineSmall, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    state.artist.uppercase(),
                    style = MaterialTheme.typography.labelLarge,
                    color = TT.TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable(onClick = onOpenArtist),
                )
            }
            IconButton(onClick = onToggleFavorite) {
                Icon(
                    if (isFavorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    "Beğen",
                    tint = if (isFavorite) accent else TT.TextPrimary,
                    modifier = Modifier.size(26.dp),
                )
            }
        }

        // ---- Konum çubuğu
        Spacer(Modifier.height(8.dp))
        HatchSeekBar(
            value = shown,
            onValueChange = { dragging = true; dragValue = it },
            onValueChangeFinished = {
                if (dragging) onSeek((dragValue * duration).toLong())
                dragging = false
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatDuration((shown * duration).toLong()), style = MaterialTheme.typography.labelMedium, color = accent)
            Text(formatDuration(state.durationMs), style = MaterialTheme.typography.labelMedium, color = TT.TextSecondary)
        }

        // ---- Kontroller
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            CyberIconButton(
                Icons.Rounded.Shuffle, "Karıştır", onToggleShuffle,
                tint = if (state.shuffle) accent else TT.TextSecondary,
                border = if (state.shuffle) accent else TT.Line,
            )
            CyberIconButton(Icons.Rounded.SkipPrevious, "Önceki", onPrevious, size = 54.dp, iconScale = 0.55f)
            CyberIconButton(
                if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                if (state.isPlaying) "Duraklat" else "Çal",
                onPlayPause,
                size = 76.dp,
                tint = Color.Black,
                fill = accent,
                border = null,
                cut = 14.dp,
                iconScale = 0.55f,
            )
            CyberIconButton(Icons.Rounded.SkipNext, "Sonraki", onNext, size = 54.dp, iconScale = 0.55f)
            CyberIconButton(
                if (state.repeatMode == Player.REPEAT_MODE_ONE) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat,
                "Tekrarla",
                onCycleRepeat,
                tint = if (state.repeatMode == Player.REPEAT_MODE_OFF) TT.TextSecondary else accent,
                border = if (state.repeatMode == Player.REPEAT_MODE_OFF) TT.Line else accent,
            )
        }

        // ---- Alt satır
        Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            SleepTimerButton(sleepTimerEndsAt) { showSleep = true }
            Spacer(Modifier.width(10.dp))
            Box(Modifier.weight(1f).height(1.dp).background(TT.Line))
            Spacer(Modifier.width(10.dp))
            HudLabel("TT-01", color = TT.TextDim)
        }
    }

    if (showSleep) {
        SleepTimerDialog(
            active = sleepTimerEndsAt != null,
            onDismiss = { showSleep = false },
            onPick = { onSetSleepTimer(it); showSleep = false },
        )
    }
}

@Composable
private fun SleepTimerButton(endsAt: Long?, onClick: () -> Unit) {
    val accent = TT.Accent
    val remaining by produceState<Long?>(null, endsAt) {
        while (endsAt != null) {
            value = (endsAt - System.currentTimeMillis()).coerceAtLeast(0)
            delay(1_000)
        }
        value = null
    }
    Row(
        Modifier
            .panel(color = Color.Transparent, border = if (endsAt != null) accent else TT.Line, shape = Chamfer(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Bedtime, "Uyku zamanlayıcısı", tint = if (endsAt != null) accent else TT.TextSecondary, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        HudLabel(remaining?.let { formatDuration(it) } ?: "SLEEP", color = if (endsAt != null) accent else TT.TextSecondary)
    }
}

@Composable
private fun SleepTimerDialog(active: Boolean, onDismiss: () -> Unit, onPick: (Int?) -> Unit) {
    CyberDialog(title = "Uyku zamanlayıcısı", onDismiss = onDismiss, dismissText = "Kapat") {
        Column {
            listOf(5, 15, 30, 45, 60, 90).forEach { min ->
                Row(
                    Modifier.fillMaxWidth().clickable { onPick(min) }.padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("%02d".format(min), style = MaterialTheme.typography.titleMedium, color = TT.Accent, modifier = Modifier.width(36.dp))
                    Text("DAKİKA", style = MaterialTheme.typography.labelLarge, color = TT.TextPrimary)
                }
            }
            if (active) {
                Text(
                    "ZAMANLAYICIYI KAPAT",
                    color = TT.Accent,
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.fillMaxWidth().clickable { onPick(null) }.padding(vertical = 12.dp),
                )
            }
        }
    }
}

// ------------------------------------------------------------------ Sıradakiler

@Composable
fun QueueScreen(
    state: PlayerUiState,
    onClose: () -> Unit,
    onPlay: (QueueEntry) -> Unit,
    onRemove: (QueueEntry) -> Unit,
) {
    BackHandler(onBack = onClose)
    Column(
        Modifier
            .fillMaxSize()
            .background(TT.Background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            CyberIconButton(Icons.Rounded.KeyboardArrowDown, "Kapat", onClose, size = 40.dp)
            Spacer(Modifier.width(14.dp))
            Column {
                HudLabel("◤ PLAYBACK", color = TT.Accent)
                Text("QUEUE", style = MaterialTheme.typography.headlineSmall, color = TT.TextPrimary)
            }
        }
        LazyColumn(Modifier.fillMaxSize()) {
            if (state.hasSong) {
                item {
                    HudLabel("// NOW", modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp), color = TT.TextDim)
                    QueueRow(0, state.title, state.artist, state.albumId, highlight = true, onClick = {}, onRemove = null)
                }
            }
            if (state.upNext.isNotEmpty()) {
                item {
                    HudLabel(
                        if (state.shuffle) "// UP NEXT · SHUFFLE" else "// UP NEXT",
                        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 8.dp),
                        color = TT.TextDim,
                    )
                }
                itemsIndexed(state.upNext, key = { i, e -> "${e.mediaIndex}-$i" }) { i, entry ->
                    QueueRow(i + 1, entry.title, entry.artist, entry.albumId, highlight = false, onClick = { onPlay(entry) }, onRemove = { onRemove(entry) })
                }
            }
        }
    }
}

@Composable
private fun QueueRow(index: Int, title: String, artist: String, albumId: Long, highlight: Boolean, onClick: () -> Unit, onRemove: (() -> Unit)?) {
    val accent = TT.Accent
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(start = 16.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (highlight) "▶" else "%02d".format(index),
            style = MaterialTheme.typography.labelLarge,
            color = if (highlight) accent else TT.TextDim,
            modifier = Modifier.width(30.dp),
        )
        Artwork(albumId, Modifier.size(44.dp), shape = Chamfer(6.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = if (highlight) accent else TT.TextPrimary, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            HudLabel(artist)
        }
        if (onRemove != null) {
            IconButton(onClick = onRemove) { Icon(Icons.Rounded.Close, "Sıradan çıkar", tint = TT.TextSecondary) }
        }
    }
}
