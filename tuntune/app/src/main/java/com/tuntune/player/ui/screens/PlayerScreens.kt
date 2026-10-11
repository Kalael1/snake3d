package com.tuntune.player.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import com.tuntune.player.PlayerUiState
import com.tuntune.player.QueueEntry
import com.tuntune.player.ui.components.Artwork
import com.tuntune.player.ui.components.ArtworkCache
import com.tuntune.player.ui.components.CircleIcon
import com.tuntune.player.ui.components.averageColor
import com.tuntune.player.ui.components.formatDuration
import com.tuntune.player.ui.components.placeholderColor
import com.tuntune.player.ui.theme.TT
import kotlinx.coroutines.delay

/** Kapağın renginden koyu bir tema rengi çıkarır (Spotify'daki gibi). */
@Composable
fun rememberArtColor(albumId: Long, loadArt: Boolean = true): Color {
    val context = LocalContext.current
    val initial = (if (loadArt) ArtworkCache.peekColor(albumId) else null) ?: placeholderColor(albumId)
    val raw by produceState(initial, albumId, loadArt) {
        value = (if (loadArt) ArtworkCache.color(context, albumId) else null) ?: placeholderColor(albumId)
    }
    val target = lerp(raw, Color.Black, 0.45f)
    val animated by animateColorAsState(target, tween(600), label = "artColor")
    return animated
}

@Composable
fun MiniPlayer(
    state: PlayerUiState,
    isFavorite: Boolean,
    onOpen: () -> Unit,
    onPlayPause: () -> Unit,
    onToggleFavorite: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color = rememberArtColor(state.albumId)
    Column(
        modifier
            .padding(horizontal = 8.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(color)
            .clickable(onClick = onOpen),
    ) {
        Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Artwork(state.albumId, Modifier.size(40.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(state.title, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis, color = TT.TextPrimary)
                Text(state.artist, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis, color = TT.TextSecondary)
            }
            IconButton(onClick = onToggleFavorite) {
                Icon(
                    if (isFavorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    contentDescription = "Beğen",
                    tint = if (isFavorite) TT.Accent else TT.TextPrimary,
                )
            }
            IconButton(onClick = onPlayPause) {
                Icon(
                    if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    contentDescription = if (state.isPlaying) "Duraklat" else "Çal",
                    tint = TT.TextPrimary,
                    modifier = Modifier.size(30.dp),
                )
            }
        }
        val progress = if (state.durationMs > 0) state.positionMs.toFloat() / state.durationMs else 0f
        LinearProgressIndicator(
            progress = { progress.coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(2.dp).padding(horizontal = 8.dp),
            color = TT.TextPrimary,
            trackColor = Color.White.copy(alpha = 0.25f),
        )
    }
}

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
    val color = rememberArtColor(state.albumId)
    var dragging by remember { mutableStateOf(false) }
    var dragValue by remember { mutableFloatStateOf(0f) }
    var showSleep by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(color, TT.Background)))
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) {
                Icon(Icons.Rounded.KeyboardArrowDown, "Kapat", tint = TT.TextPrimary, modifier = Modifier.size(32.dp))
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("ŞU AN ÇALIYOR", style = MaterialTheme.typography.labelMedium, color = TT.TextSecondary)
                Text(albumName, style = MaterialTheme.typography.labelLarge, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            IconButton(onClick = onOpenQueue) {
                Icon(Icons.Rounded.QueueMusic, "Sıradakiler", tint = TT.TextPrimary)
            }
        }

        Spacer(Modifier.weight(1f))
        Artwork(state.albumId, Modifier.fillMaxWidth().aspectRatio(1f), corner = 8.dp, iconScale = 0.3f)
        Spacer(Modifier.weight(1f))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(state.title, style = MaterialTheme.typography.headlineMedium, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    state.artist,
                    style = MaterialTheme.typography.bodyLarge,
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
                    tint = if (isFavorite) TT.Accent else TT.TextPrimary,
                    modifier = Modifier.size(28.dp),
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        val duration = state.durationMs.coerceAtLeast(1)
        val shown = if (dragging) dragValue else (state.positionMs.toFloat() / duration).coerceIn(0f, 1f)
        Slider(
            value = shown,
            onValueChange = { dragging = true; dragValue = it },
            onValueChangeFinished = { onSeek((dragValue * duration).toLong()); dragging = false },
            colors = SliderDefaults.colors(
                thumbColor = TT.TextPrimary,
                activeTrackColor = TT.TextPrimary,
                inactiveTrackColor = Color.White.copy(alpha = 0.25f),
            ),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatDuration((shown * duration).toLong()), style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
            Text(formatDuration(state.durationMs), style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
        }

        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onToggleShuffle) {
                Icon(Icons.Rounded.Shuffle, "Karıştır", tint = if (state.shuffle) TT.Accent else TT.TextPrimary)
            }
            IconButton(onClick = onPrevious, modifier = Modifier.size(56.dp)) {
                Icon(Icons.Rounded.SkipPrevious, "Önceki", tint = TT.TextPrimary, modifier = Modifier.size(40.dp))
            }
            CircleIcon(
                icon = if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                background = TT.TextPrimary,
                tint = Color.Black,
                size = 68.dp,
                onClick = onPlayPause,
                contentDescription = if (state.isPlaying) "Duraklat" else "Çal",
            )
            IconButton(onClick = onNext, modifier = Modifier.size(56.dp)) {
                Icon(Icons.Rounded.SkipNext, "Sonraki", tint = TT.TextPrimary, modifier = Modifier.size(40.dp))
            }
            IconButton(onClick = onCycleRepeat) {
                Icon(
                    if (state.repeatMode == Player.REPEAT_MODE_ONE) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat,
                    "Tekrarla",
                    tint = if (state.repeatMode == Player.REPEAT_MODE_OFF) TT.TextPrimary else TT.Accent,
                )
            }
        }

        Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            SleepTimerButton(sleepTimerEndsAt) { showSleep = true }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = onOpenQueue) {
                Icon(Icons.Rounded.QueueMusic, "Sıradakiler", tint = TT.TextPrimary)
            }
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
    val remaining by produceState<Long?>(null, endsAt) {
        while (endsAt != null) {
            value = (endsAt - System.currentTimeMillis()).coerceAtLeast(0)
            delay(1_000)
        }
        value = null
    }
    Row(
        Modifier.clip(RoundedCornerShape(50)).clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Bedtime, "Uyku zamanlayıcısı", tint = if (endsAt != null) TT.Accent else TT.TextPrimary)
        remaining?.let {
            Spacer(Modifier.width(6.dp))
            Text(formatDuration(it), color = TT.Accent, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun SleepTimerDialog(active: Boolean, onDismiss: () -> Unit, onPick: (Int?) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TT.SurfaceHigh,
        title = { Text("Uyku zamanlayıcısı") },
        text = {
            Column {
                listOf(5, 15, 30, 45, 60, 90).forEach { min ->
                    Text(
                        "$min dakika",
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.fillMaxWidth().clickable { onPick(min) }.padding(vertical = 12.dp),
                    )
                }
                if (active) {
                    Text(
                        "Zamanlayıcıyı kapat",
                        color = TT.Accent,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.fillMaxWidth().clickable { onPick(null) }.padding(vertical = 12.dp),
                    )
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Kapat", color = TT.TextSecondary) } },
    )
}

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
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) { Icon(Icons.Rounded.KeyboardArrowDown, "Kapat", tint = TT.TextPrimary) }
            Text("Sıradakiler", style = MaterialTheme.typography.titleLarge, color = TT.TextPrimary)
        }
        LazyColumn(Modifier.fillMaxSize()) {
            if (state.hasSong) {
                item {
                    Text("Şu an çalıyor", style = MaterialTheme.typography.titleMedium, color = TT.TextPrimary, modifier = Modifier.padding(16.dp))
                    QueueRow(state.title, state.artist, state.albumId, highlight = true, onClick = {}, onRemove = null)
                }
            }
            if (state.upNext.isNotEmpty()) {
                item {
                    Text(
                        if (state.shuffle) "Sıradakiler (karışık)" else "Sıradakiler",
                        style = MaterialTheme.typography.titleMedium,
                        color = TT.TextPrimary,
                        modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 8.dp),
                    )
                }
                itemsIndexed(state.upNext, key = { i, e -> "${e.mediaIndex}-$i" }) { _, entry ->
                    QueueRow(entry.title, entry.artist, entry.albumId, highlight = false, onClick = { onPlay(entry) }, onRemove = { onRemove(entry) })
                }
            }
        }
    }
}

@Composable
private fun QueueRow(title: String, artist: String, albumId: Long, highlight: Boolean, onClick: () -> Unit, onRemove: (() -> Unit)?) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(start = 16.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp)) { Artwork(albumId, Modifier.fillMaxSize()) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = if (highlight) TT.Accent else TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(artist, color = TT.TextSecondary, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (onRemove != null) {
            IconButton(onClick = onRemove) { Icon(Icons.Rounded.Close, "Sıradan çıkar", tint = TT.TextSecondary) }
        }
    }
}
