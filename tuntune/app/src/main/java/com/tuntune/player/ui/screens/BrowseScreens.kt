package com.tuntune.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.RemoveCircleOutline
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tuntune.player.data.Album
import com.tuntune.player.data.Artist
import com.tuntune.player.data.Library
import com.tuntune.player.data.Playlist
import com.tuntune.player.data.Song
import com.tuntune.player.ui.components.Artwork
import com.tuntune.player.ui.components.CircleIcon
import com.tuntune.player.ui.components.EmptyState
import com.tuntune.player.ui.components.ExtraMenuItem
import com.tuntune.player.ui.components.PlaceholderArt
import com.tuntune.player.ui.components.PlaylistCover
import com.tuntune.player.ui.components.SectionTitle
import com.tuntune.player.ui.components.SongRow
import com.tuntune.player.ui.components.formatTotal
import com.tuntune.player.ui.theme.TT
import java.util.Calendar

/** Alttaki mini oynatıcı ve menü için listelerin sonuna boşluk. */
val BottomInset = PaddingValues(bottom = 150.dp)

private val LikedGradient = listOf(Color(0xFF450AF5), Color(0xFF8E8EE5))
private val TopGradient = listOf(Color(0xFF1E3264), Color(0xFF1ED760))

// ------------------------------------------------------------------ Ana sayfa

@Composable
fun HomeScreen(
    library: Library,
    playlists: List<Playlist>,
    favorites: List<Long>,
    recent: List<Long>,
    mostPlayed: List<Song>,
    onOpenFavorites: () -> Unit,
    onOpenMostPlayed: () -> Unit,
    onOpenPlaylist: (Long) -> Unit,
    onOpenAlbum: (Long) -> Unit,
    onOpenArtist: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onPlaySong: (Song) -> Unit,
) {
    val recentSongs = recent.mapNotNull { library.byId[it] }
    val recentlyAdded = library.recentlyAdded
    val recentAlbums = remember(recentSongs) { recentSongs.map { it.albumId }.distinct().mapNotNull { library.album(it) }.take(12) }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF1F3B2C), TT.Background), endY = 900f)),
        contentPadding = BottomInset,
    ) {
        item {
            Row(
                Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 4.dp, top = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(greeting(), style = MaterialTheme.typography.headlineMedium, color = TT.TextPrimary, modifier = Modifier.weight(1f))
                IconButton(onClick = onOpenSettings) { Icon(Icons.Rounded.Settings, "Ayarlar", tint = TT.TextPrimary) }
            }
        }

        if (library.songs.isEmpty()) {
            item {
                EmptyState(
                    Icons.Rounded.LibraryMusic,
                    "Henüz müzik yok",
                    "Telefonuna MP3 dosyaları kopyala, TUNTUNE onları otomatik bulur.",
                    Modifier.padding(top = 64.dp),
                )
            }
            return@LazyColumn
        }

        // Hızlı erişim kutucukları (2 sütun)
        item {
            val tiles = buildList<@Composable () -> Unit> {
                add { QuickTile("Beğenilen Şarkılar", onOpenFavorites) { GradientIcon(Icons.Rounded.Favorite, LikedGradient) } }
                add { QuickTile("En Çok Dinlenenler", onOpenMostPlayed) { GradientIcon(Icons.Rounded.TrendingUp, TopGradient) } }
                playlists.takeLast(4).reversed().forEach { p ->
                    add { QuickTile(p.name, { onOpenPlaylist(p.id) }) { PlaylistCover(p, Modifier.fillMaxSize(), corner = 0.dp) } }
                }
            }
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                tiles.chunked(2).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { tile -> Box(Modifier.weight(1f)) { tile() } }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        if (recentAlbums.isNotEmpty()) {
            item { SectionTitle("Son dinlediklerin") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(recentAlbums, key = { it.id }) { AlbumCard(it, onClick = { onOpenAlbum(it.id) }) }
                }
            }
        }

        if (mostPlayed.isNotEmpty()) {
            item { SectionTitle("En çok dinlediklerin") }
            items(mostPlayed.take(5), key = { "top-${it.id}" }) { song ->
                SongRow(song, isCurrent = false, onClick = { onPlaySong(song) })
            }
        }

        item { SectionTitle("Albümler") }
        item {
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                items(library.albums.take(20), key = { it.id }) { AlbumCard(it, onClick = { onOpenAlbum(it.id) }) }
            }
        }

        item { SectionTitle("Sanatçılar") }
        item {
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                items(library.topArtists, key = { it.name }) {
                    ArtistCard(it, onClick = { onOpenArtist(it.name) })
                }
            }
        }

        item { SectionTitle("Son eklenenler") }
        items(recentlyAdded, key = { "new-${it.id}" }) { song ->
            SongRow(song, isCurrent = false, onClick = { onPlaySong(song) })
        }
    }
}

private fun greeting(): String = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
    in 5..11 -> "Günaydın"
    in 12..17 -> "İyi günler"
    in 18..22 -> "İyi akşamlar"
    else -> "İyi geceler"
}

@Composable
private fun QuickTile(title: String, onClick: () -> Unit, art: @Composable () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(Color.White.copy(alpha = 0.08f))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(56.dp)) { art() }
        Text(
            title,
            style = MaterialTheme.typography.labelLarge,
            color = TT.TextPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

@Composable
private fun GradientIcon(icon: ImageVector, colors: List<Color>) {
    PlaceholderArt(seed = 0, icon = icon, iconScale = 0.45f, colors = colors)
}

@Composable
fun AlbumCard(album: Album, onClick: () -> Unit) {
    Column(Modifier.width(140.dp).clickable(onClick = onClick)) {
        Artwork(album.id, Modifier.size(140.dp))
        Spacer(Modifier.height(8.dp))
        Text(album.title, style = MaterialTheme.typography.labelLarge, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(album.artist, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun ArtistCard(artist: Artist, onClick: () -> Unit) {
    Column(Modifier.width(120.dp).clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Artwork(artist.songs.first().albumId, Modifier.size(120.dp).clip(CircleShape), corner = 60.dp, fallbackIcon = Icons.Rounded.Person)
        Spacer(Modifier.height(8.dp))
        Text(artist.name, style = MaterialTheme.typography.labelLarge, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("Sanatçı", style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary)
    }
}

// ------------------------------------------------------------------ Arama

@Composable
fun SearchScreen(
    library: Library,
    currentSongId: Long?,
    onPlay: (List<Song>, Int) -> Unit,
    onOpenAlbum: (Long) -> Unit,
    onOpenArtist: (String) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    val q = query.trim().lowercase()
    val songs = remember(q, library) {
        if (q.isEmpty()) emptyList() else library.songs.filter {
            it.title.lowercase().contains(q) || it.artist.lowercase().contains(q) || it.album.lowercase().contains(q)
        }
    }
    val albums = remember(q, library) { if (q.isEmpty()) emptyList() else library.albums.filter { it.title.lowercase().contains(q) } }
    val artists = remember(q, library) { if (q.isEmpty()) emptyList() else library.artists.filter { it.name.lowercase().contains(q) } }

    LazyColumn(Modifier.fillMaxSize().background(TT.Background), contentPadding = BottomInset) {
        item {
            Text(
                "Ara",
                style = MaterialTheme.typography.headlineMedium,
                color = TT.TextPrimary,
                modifier = Modifier.statusBarsPadding().padding(start = 16.dp, top = 16.dp, bottom = 12.dp),
            )
        }
        item {
            TextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Ne dinlemek istiyorsun?", color = Color(0xFF555555)) },
                leadingIcon = { Icon(Icons.Rounded.Search, null, tint = Color.Black) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(Icons.Rounded.Clear, "Temizle", tint = Color.Black) }
                },
                singleLine = true,
                shape = RoundedCornerShape(6.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedTextColor = Color.Black,
                    unfocusedTextColor = Color.Black,
                    cursorColor = Color.Black,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            )
        }

        if (q.isEmpty()) {
            item { SectionTitle("Sanatçılara göz at") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(library.artists, key = { it.name }) { ArtistCard(it, onClick = { onOpenArtist(it.name) }) }
                }
            }
            return@LazyColumn
        }

        if (songs.isEmpty() && albums.isEmpty() && artists.isEmpty()) {
            item { EmptyState(Icons.Rounded.Search, "\"$query\" bulunamadı", "Yazımı kontrol et ya da başka bir kelime dene.") }
        }
        if (artists.isNotEmpty()) {
            item { SectionTitle("Sanatçılar") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(artists, key = { it.name }) { ArtistCard(it, onClick = { onOpenArtist(it.name) }) }
                }
            }
        }
        if (albums.isNotEmpty()) {
            item { SectionTitle("Albümler") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(albums, key = { it.id }) { AlbumCard(it, onClick = { onOpenAlbum(it.id) }) }
                }
            }
        }
        if (songs.isNotEmpty()) {
            item { SectionTitle("Şarkılar") }
            itemsIndexed(songs, key = { _, s -> s.id }) { i, song ->
                SongRow(song, isCurrent = song.id == currentSongId, onClick = { onPlay(songs, i) })
            }
        }
    }
}

// ------------------------------------------------------------------ Kitaplık

enum class LibraryFilter(val label: String) { Playlists("Çalma listeleri"), Albums("Albümler"), Artists("Sanatçılar"), Songs("Şarkılar") }

@Composable
fun LibraryScreen(
    library: Library,
    playlists: List<Playlist>,
    favoritesCount: Int,
    currentSongId: Long?,
    onOpenFavorites: () -> Unit,
    onOpenPlaylist: (Long) -> Unit,
    onOpenAlbum: (Long) -> Unit,
    onOpenArtist: (String) -> Unit,
    onCreatePlaylist: () -> Unit,
    onOpenSettings: () -> Unit,
    onPlay: (List<Song>, Int) -> Unit,
) {
    var filter by rememberSaveable { mutableStateOf(LibraryFilter.Playlists) }

    LazyColumn(Modifier.fillMaxSize().background(TT.Background), contentPadding = BottomInset) {
        item {
            Row(
                Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 4.dp, top = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Kitaplığın", style = MaterialTheme.typography.headlineMedium, color = TT.TextPrimary, modifier = Modifier.weight(1f))
                IconButton(onClick = onCreatePlaylist) { Icon(Icons.Rounded.Add, "Çalma listesi oluştur", tint = TT.TextPrimary) }
                IconButton(onClick = onOpenSettings) { Icon(Icons.Rounded.Settings, "Ayarlar", tint = TT.TextPrimary) }
            }
        }
        item {
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LibraryFilter.entries.forEach { f ->
                    val selected = f == filter
                    Text(
                        f.label,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (selected) Color.Black else TT.TextPrimary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (selected) TT.Accent else TT.SurfaceHigh)
                            .clickable { filter = f }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                    )
                }
            }
        }

        when (filter) {
            LibraryFilter.Playlists -> {
                item {
                    LibraryRow("Beğenilen Şarkılar", "Çalma listesi · $favoritesCount şarkı", onOpenFavorites) {
                        GradientIcon(Icons.Rounded.Favorite, LikedGradient)
                    }
                }
                items(playlists.reversed(), key = { it.id }) { p ->
                    LibraryRow(p.name, "Çalma listesi · ${p.songIds.size} şarkı", { onOpenPlaylist(p.id) }) {
                        PlaylistCover(p, Modifier.fillMaxSize())
                    }
                }
                item {
                    LibraryRow("Çalma listesi oluştur", "", onCreatePlaylist) {
                        Box(Modifier.fillMaxSize().background(TT.SurfaceHigh), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.Add, null, tint = TT.TextPrimary, modifier = Modifier.size(32.dp))
                        }
                    }
                }
            }
            LibraryFilter.Albums -> items(library.albums, key = { it.id }) { a ->
                LibraryRow(a.title, "Albüm · ${a.artist}", { onOpenAlbum(a.id) }) { Artwork(a.id, Modifier.fillMaxSize()) }
            }
            LibraryFilter.Artists -> items(library.artists, key = { it.name }) { a ->
                LibraryRow(a.name, "Sanatçı · ${a.songs.size} şarkı", { onOpenArtist(a.name) }, round = true) {
                    Artwork(a.songs.first().albumId, Modifier.fillMaxSize(), corner = 32.dp, fallbackIcon = Icons.Rounded.Person)
                }
            }
            LibraryFilter.Songs -> {
                item {
                    PlayShuffleBar(
                        text = formatTotal(library.songs),
                        onPlay = { onPlay(library.songs, 0) },
                        onShuffle = { onPlay(library.songs.shuffled(), 0) },
                    )
                }
                itemsIndexed(library.songs, key = { _, s -> s.id }) { i, song ->
                    SongRow(song, isCurrent = song.id == currentSongId, onClick = { onPlay(library.songs, i) })
                }
            }
        }
    }
}

@Composable
private fun LibraryRow(title: String, subtitle: String, onClick: () -> Unit, round: Boolean = false, art: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(64.dp).clip(if (round) CircleShape else RoundedCornerShape(4.dp))) { art() }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle.isNotEmpty()) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun PlayShuffleBar(text: String, onPlay: () -> Unit, onShuffle: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.bodySmall, color = TT.TextSecondary, modifier = Modifier.weight(1f))
        IconButton(onClick = onShuffle) { Icon(Icons.Rounded.Shuffle, "Karışık çal", tint = TT.TextSecondary, modifier = Modifier.size(28.dp)) }
        Spacer(Modifier.width(8.dp))
        CircleIcon(Icons.Rounded.PlayArrow, TT.Accent, Color.Black, 52.dp, onPlay, "Çal")
    }
}

// ------------------------------------------------------------------ Albüm / sanatçı / çalma listesi sayfası

sealed interface CollectionKind {
    data class AlbumKind(val album: Album) : CollectionKind
    data class ArtistKind(val artist: Artist) : CollectionKind
    data class PlaylistKind(val playlist: Playlist) : CollectionKind
    data object Favorites : CollectionKind
    data object MostPlayed : CollectionKind
}

@Composable
fun CollectionScreen(
    kind: CollectionKind,
    songs: List<Song>,
    currentSongId: Long?,
    onBack: () -> Unit,
    onPlay: (List<Song>, Int, Boolean) -> Unit,
    onRenamePlaylist: (Playlist) -> Unit = {},
    onDeletePlaylist: (Playlist) -> Unit = {},
    onRemoveFromPlaylist: (Playlist, Int) -> Unit = { _, _ -> },
    onMoveInPlaylist: (Playlist, Int, Int) -> Unit = { _, _, _ -> },
) {
    val title: String
    val subtitle: String
    val accentSeed: Long
    var hasAlbumArt = true
    val header: @Composable () -> Unit
    when (kind) {
        is CollectionKind.AlbumKind -> {
            title = kind.album.title
            subtitle = "Albüm · ${kind.album.artist}"
            accentSeed = kind.album.id
            header = { Artwork(kind.album.id, Modifier.fillMaxSize(), iconScale = 0.35f, fallbackIcon = Icons.Rounded.Album) }
        }
        is CollectionKind.ArtistKind -> {
            title = kind.artist.name
            subtitle = "Sanatçı · ${kind.artist.albumCount} albüm"
            accentSeed = kind.artist.songs.first().albumId
            header = {
                Artwork(kind.artist.songs.first().albumId, Modifier.fillMaxSize(), corner = 200.dp, fallbackIcon = Icons.Rounded.Person)
            }
        }
        is CollectionKind.PlaylistKind -> {
            title = kind.playlist.name
            subtitle = "Çalma listesi"
            accentSeed = kind.playlist.id
            hasAlbumArt = false
            header = { PlaylistCover(kind.playlist, Modifier.fillMaxSize()) }
        }
        CollectionKind.Favorites -> {
            title = "Beğenilen Şarkılar"
            subtitle = "Çalma listesi"
            accentSeed = 3
            hasAlbumArt = false
            header = { GradientIcon(Icons.Rounded.Favorite, LikedGradient) }
        }
        CollectionKind.MostPlayed -> {
            title = "En Çok Dinlenenler"
            subtitle = "Senin için"
            accentSeed = 2
            hasAlbumArt = false
            header = { GradientIcon(Icons.Rounded.TrendingUp, TopGradient) }
        }
    }
    val bg = rememberArtColor(accentSeed, loadArt = hasAlbumArt)
    var menuOpen by remember { mutableStateOf(false) }
    val playlist = (kind as? CollectionKind.PlaylistKind)?.playlist

    LazyColumn(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(bg, TT.Background), endY = 1400f)),
        contentPadding = BottomInset,
    ) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, "Geri", tint = TT.TextPrimary) }
                Spacer(Modifier.weight(1f))
                if (playlist != null) {
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Rounded.MoreVert, "Seçenekler", tint = TT.TextPrimary) }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Yeniden adlandır") },
                                leadingIcon = { Icon(Icons.Rounded.Edit, null) },
                                onClick = { menuOpen = false; onRenamePlaylist(playlist) },
                            )
                            DropdownMenuItem(
                                text = { Text("Çalma listesini sil") },
                                leadingIcon = { Icon(Icons.Rounded.Delete, null) },
                                onClick = { menuOpen = false; onDeletePlaylist(playlist) },
                            )
                        }
                    }
                }
            }
        }
        item {
            Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                Box(Modifier.fillMaxWidth(0.62f).aspectRatio(1f).clip(RoundedCornerShape(4.dp))) { header() }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
                Text(title, style = MaterialTheme.typography.headlineMedium, color = TT.TextPrimary, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = TT.TextSecondary)
            }
        }
        item {
            PlayShuffleBar(
                text = formatTotal(songs),
                onPlay = { onPlay(songs, 0, false) },
                onShuffle = { onPlay(songs, 0, true) },
            )
        }

        if (songs.isEmpty()) {
            item {
                EmptyState(
                    Icons.Rounded.MusicNote,
                    "Burada henüz şarkı yok",
                    if (kind is CollectionKind.Favorites) "Şarkıların yanındaki ♥ ile beğendiklerin burada toplanır."
                    else "Şarkı menüsünden \"Çalma listesine ekle\" ile şarkı ekleyebilirsin.",
                )
            }
        }

        itemsIndexed(songs, key = { i, s -> "$i-${s.id}" }) { i, song ->
            val extras = if (playlist != null) buildList {
                if (i > 0) add(ExtraMenuItem("Yukarı taşı", Icons.Rounded.ArrowUpward) { onMoveInPlaylist(playlist, i, i - 1) })
                if (i < songs.lastIndex) add(ExtraMenuItem("Aşağı taşı", Icons.Rounded.ArrowDownward) { onMoveInPlaylist(playlist, i, i + 1) })
                add(ExtraMenuItem("Bu listeden çıkar", Icons.Rounded.RemoveCircleOutline) { onRemoveFromPlaylist(playlist, i) })
            } else emptyList()

            val leading: (@Composable () -> Unit)? = if (kind is CollectionKind.AlbumKind) {
                {
                    Box(Modifier.width(32.dp), contentAlignment = Alignment.Center) {
                        Text(
                            "${if (song.track > 0) song.track else i + 1}",
                            color = if (song.id == currentSongId) TT.Accent else TT.TextSecondary,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            } else null

            SongRow(
                song,
                isCurrent = song.id == currentSongId,
                onClick = { onPlay(songs, i, false) },
                leading = leading,
                extraMenu = extras,
                hideAlbumLink = kind is CollectionKind.AlbumKind,
                hideArtistLink = kind is CollectionKind.ArtistKind,
            )
        }
    }
}
