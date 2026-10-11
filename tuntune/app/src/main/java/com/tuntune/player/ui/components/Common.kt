package com.tuntune.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.QueueMusic
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tuntune.player.data.Playlist
import com.tuntune.player.data.Song
import com.tuntune.player.ui.theme.Chamfer
import com.tuntune.player.ui.theme.TT

/** Şarkı menüsündeki eylemler; ekranların hepsi aynı menüyü kullanır. */
interface SongActions {
    fun playNext(song: Song)
    fun addToQueue(song: Song)
    fun addToPlaylist(song: Song)
    fun toggleFavorite(song: Song)
    fun isFavorite(song: Song): Boolean
    fun openAlbum(albumId: Long)
    fun openArtist(name: String)
}

val LocalSongActions = staticCompositionLocalOf<SongActions> { error("SongActions yok") }

fun formatDuration(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

fun formatTotal(songs: List<Song>): String {
    val min = songs.sumOf { it.durationMs } / 60_000
    val dur = if (min >= 60) "${min / 60}H ${min % 60}M" else "${min}M"
    return "${songs.size} TRACKS · $dur"
}

data class ExtraMenuItem(val label: String, val icon: ImageVector, val onClick: () -> Unit)

private val ThumbShape = Chamfer(6.dp)

@Composable
fun SongRow(
    song: Song,
    isCurrent: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    index: Int? = null,
    showArt: Boolean = true,
    extraMenu: List<ExtraMenuItem> = emptyList(),
    hideAlbumLink: Boolean = false,
    hideArtistLink: Boolean = false,
) {
    val actions = LocalSongActions.current
    val accent = TT.Accent
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(start = 16.dp, top = 6.dp, bottom = 6.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Çalan şarkıda solda neon çizgi
        Box(Modifier.width(2.dp).height(40.dp).background(if (isCurrent) accent else Color.Transparent))
        Spacer(Modifier.width(8.dp))
        if (index != null) {
            Text(
                "%02d".format(index),
                style = MaterialTheme.typography.labelLarge,
                color = if (isCurrent) accent else TT.TextDim,
                modifier = Modifier.width(30.dp),
            )
        }
        if (showArt) {
            Artwork(song.albumId, Modifier.size(46.dp), shape = ThumbShape)
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(
                song.title,
                style = MaterialTheme.typography.bodyLarge,
                color = if (isCurrent) accent else TT.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (actions.isFavorite(song)) {
                    Icon(Icons.Rounded.Favorite, null, tint = accent, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(4.dp))
                }
                Text(
                    song.artist.uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = TT.TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Text(formatDuration(song.durationMs), style = MaterialTheme.typography.labelMedium, color = TT.TextDim)
        Box {
            IconButton(onClick = { menuOpen = true }) {
                Icon(Icons.Rounded.MoreVert, contentDescription = "Seçenekler", tint = TT.TextSecondary)
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                MenuItem("Sonra çal", Icons.Rounded.PlaylistPlay) { menuOpen = false; actions.playNext(song) }
                MenuItem("Sıraya ekle", Icons.Rounded.QueueMusic) { menuOpen = false; actions.addToQueue(song) }
                MenuItem("Çalma listesine ekle", Icons.Rounded.PlaylistAdd) { menuOpen = false; actions.addToPlaylist(song) }
                val fav = actions.isFavorite(song)
                MenuItem(
                    if (fav) "Beğenilenlerden çıkar" else "Beğen",
                    if (fav) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                ) { menuOpen = false; actions.toggleFavorite(song) }
                if (!hideAlbumLink) MenuItem("Albüme git", Icons.Rounded.Album) { menuOpen = false; actions.openAlbum(song.albumId) }
                if (!hideArtistLink) MenuItem("Sanatçıya git", Icons.Rounded.Person) { menuOpen = false; actions.openArtist(song.artist) }
                extraMenu.forEach { extra -> MenuItem(extra.label, extra.icon) { menuOpen = false; extra.onClick() } }
            }
        }
    }
}

@Composable
private fun MenuItem(label: String, icon: ImageVector, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(label, style = MaterialTheme.typography.bodyMedium) },
        leadingIcon = { Icon(icon, null, tint = TT.TextSecondary) },
        onClick = onClick,
    )
}

@Composable
fun EmptyState(icon: ImageVector, title: String, message: String, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(84.dp).panel(), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = TT.TextSecondary, modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(title.uppercase(), style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary)
        Spacer(Modifier.height(6.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = TT.TextSecondary)
    }
}

@Composable
private fun ttFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = TT.Accent,
    unfocusedBorderColor = TT.LineBright,
    cursorColor = TT.Accent,
    focusedLabelColor = TT.Accent,
)

@Composable
private fun DialogTitle(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("//", color = TT.Accent, style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.width(8.dp))
        Text(text.uppercase(), style = MaterialTheme.typography.titleSmall)
    }
}

@Composable
private fun DialogAction(text: String, onClick: () -> Unit, primary: Boolean = true, enabled: Boolean = true) {
    TextButton(onClick = onClick, enabled = enabled) {
        Text(
            text.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = if (!enabled) TT.TextDim else if (primary) TT.Accent else TT.TextSecondary,
        )
    }
}

@Composable
fun CyberDialog(
    title: String,
    onDismiss: () -> Unit,
    confirmText: String? = null,
    confirmEnabled: Boolean = true,
    onConfirm: () -> Unit = {},
    dismissText: String = "Vazgeç",
    content: @Composable () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TT.Panel,
        title = { DialogTitle(title) },
        text = content,
        confirmButton = { if (confirmText != null) DialogAction(confirmText, onConfirm, enabled = confirmEnabled) },
        dismissButton = { DialogAction(dismissText, onDismiss, primary = false) },
    )
}

@Composable
fun TextInputDialog(
    title: String,
    initial: String = "",
    confirmText: String = "Kaydet",
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var text by remember { mutableStateOf(initial) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    CyberDialog(
        title = title,
        onDismiss = onDismiss,
        confirmText = confirmText,
        confirmEnabled = text.isNotBlank(),
        onConfirm = { onConfirm(text) },
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            singleLine = true,
            colors = ttFieldColors(),
            textStyle = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.fillMaxWidth().focusRequester(focus),
        )
    }
}

@Composable
fun AddToPlaylistDialog(
    playlists: List<Playlist>,
    onDismiss: () -> Unit,
    onPick: (Playlist) -> Unit,
    onCreateNew: () -> Unit,
) {
    CyberDialog(title = "Çalma listesine ekle", onDismiss = onDismiss, dismissText = "Kapat") {
        LazyColumn(Modifier.heightIn(max = 360.dp)) {
            item {
                Row(
                    Modifier.fillMaxWidth().clickable(onClick = onCreateNew).padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(44.dp).panel(border = TT.LineBright, shape = ThumbShape), contentAlignment = Alignment.Center) {
                        Icon(Icons.Rounded.Add, null, tint = TT.Accent)
                    }
                    Spacer(Modifier.width(12.dp))
                    Text("YENİ ÇALMA LİSTESİ", style = MaterialTheme.typography.labelLarge)
                }
            }
            items(playlists, key = { it.id }) { p ->
                Row(
                    Modifier.fillMaxWidth().clickable { onPick(p) }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PlaylistCover(p, Modifier.size(44.dp))
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(p.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        HudLabel("${p.songIds.size} tracks")
                    }
                }
            }
        }
    }
}

@Composable
fun PlaylistCover(playlist: Playlist, modifier: Modifier = Modifier, corner: Dp = 6.dp) {
    Box(modifier.panel(color = TT.PanelHigh, border = TT.Line, shape = Chamfer(corner)), contentAlignment = Alignment.Center) {
        PlaceholderArt(Icons.Rounded.QueueMusic, iconScale = 0.4f, tint = TT.TextSecondary)
    }
}

@Composable
fun PinDialog(
    title: String,
    message: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
    error: String? = null,
) {
    var pin by remember { mutableStateOf("") }
    CyberDialog(
        title = title,
        onDismiss = onDismiss,
        confirmText = "Tamam",
        confirmEnabled = pin.length >= 4,
        onConfirm = { onConfirm(pin) },
    ) {
        Column {
            Text(message, color = TT.TextSecondary, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = pin,
                onValueChange = { if (it.length <= 8 && it.all(Char::isDigit)) pin = it },
                singleLine = true,
                label = { Text("PIN") },
                isError = error != null,
                supportingText = if (error != null) { { Text(error) } } else null,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                colors = ttFieldColors(),
            )
        }
    }
}
