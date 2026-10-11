package com.tuntune.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tuntune.player.data.Album
import com.tuntune.player.data.Artist
import com.tuntune.player.data.Library
import com.tuntune.player.data.Playlist
import com.tuntune.player.data.Song
import com.tuntune.player.ui.components.Artwork
import com.tuntune.player.ui.components.CornerTriangle
import com.tuntune.player.ui.components.CyberButton
import com.tuntune.player.ui.components.CyberIconButton
import com.tuntune.player.ui.components.DotGrid
import com.tuntune.player.ui.components.EmptyState
import com.tuntune.player.ui.components.ExtraMenuItem
import com.tuntune.player.ui.components.HudLabel
import com.tuntune.player.ui.components.PlaceholderArt
import com.tuntune.player.ui.components.PlaylistCover
import com.tuntune.player.ui.components.SectionHeader
import com.tuntune.player.ui.components.SongRow
import com.tuntune.player.ui.components.formatTotal
import com.tuntune.player.ui.components.panel
import com.tuntune.player.ui.theme.Chamfer
import com.tuntune.player.ui.theme.TT
import java.util.Calendar

/** Alttaki mini oynatıcı ve menü için listelerin sonuna boşluk. */
val BottomInset = PaddingValues(bottom = 170.dp)

private val CardShape = Chamfer(10.dp)
private val ThumbShape = Chamfer(8.dp)

// ------------------------------------------------------------------ Sayfa başlığı

@Composable
private fun ScreenHeader(kicker: String, title: String, actions: @Composable () -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 12.dp, top = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            HudLabel(kicker, color = TT.Accent)
            Text(title.uppercase(), style = MaterialTheme.typography.headlineLarge, color = TT.TextPrimary)
        }
        actions()
    }
}

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
    val recentAlbums = remember(recent, library) {
        recent.mapNotNull { library.byId[it]?.albumId }.distinct().mapNotNull { library.album(it) }.take(12)
    }

    LazyColumn(Modifier.fillMaxSize().background(TT.Background), contentPadding = BottomInset) {
        item {
            Row(
                Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 12.dp, top = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Logo kutusu
                Box(
                    Modifier.panel(color = TT.Disc, border = null, shape = Chamfer(6.dp)).padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Text("T_T", style = MaterialTheme.typography.titleLarge, color = Color.Black)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    HudLabel(greeting(), color = TT.Accent)
                    Text("TUNTUNE", style = MaterialTheme.typography.headlineMedium, color = TT.TextPrimary)
                }
                CyberIconButton(Icons.Rounded.Settings, "Ayarlar", onOpenSettings, size = 40.dp)
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                HudLabel(
                    "SYS // ${library.songs.size} TRK · ${library.albums.size} ALB · ${library.artists.size} ART",
                    color = TT.TextDim,
                    modifier = Modifier.weight(1f),
                )
                DotGrid(6, 1, spacing = 6.dp)
            }
        }

        if (library.songs.isEmpty()) {
            item {
                EmptyState(
                    Icons.Rounded.LibraryMusic,
                    "No signal",
                    "Telefonuna MP3 dosyaları kopyala, TUNTUNE onları otomatik bulur.",
                    Modifier.padding(top = 64.dp),
                )
            }
            return@LazyColumn
        }

        // Hızlı erişim kutucukları (2 sütun)
        item {
            val tiles = buildList<@Composable () -> Unit> {
                add { QuickTile(1, "Liked", onOpenFavorites) { IconArt(Icons.Rounded.Favorite) } }
                add { QuickTile(2, "Top played", onOpenMostPlayed) { IconArt(Icons.Rounded.TrendingUp) } }
                playlists.takeLast(4).reversed().forEachIndexed { i, p ->
                    add { QuickTile(3 + i, p.name, { onOpenPlaylist(p.id) }) { PlaylistCover(p, Modifier.fillMaxSize(), corner = 0.dp) } }
                }
            }
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                tiles.chunked(2).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { tile -> Box(Modifier.weight(1f)) { tile() } }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        var section = 1
        if (recentAlbums.isNotEmpty()) {
            val n = section++
            item { SectionHeader(n, "Recent") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(recentAlbums, key = { it.id }) { AlbumCard(it, onClick = { onOpenAlbum(it.id) }) }
                }
            }
        }

        if (mostPlayed.isNotEmpty()) {
            val n = section++
            item { SectionHeader(n, "Top tracks") }
            itemsIndexed(mostPlayed.take(5), key = { _, s -> "top-${s.id}" }) { i, song ->
                SongRow(song, isCurrent = false, onClick = { onPlaySong(song) }, index = i + 1)
            }
        }

        val albumsN = section++
        item { SectionHeader(albumsN, "Albums") }
        item {
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(library.albums.take(20), key = { it.id }) { AlbumCard(it, onClick = { onOpenAlbum(it.id) }) }
            }
        }

        val artistsN = section++
        item { SectionHeader(artistsN, "Artists") }
        item {
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(library.topArtists, key = { it.name }) { ArtistCard(it, onClick = { onOpenArtist(it.name) }) }
            }
        }

        val newN = section
        item { SectionHeader(newN, "New arrivals") }
        itemsIndexed(library.recentlyAdded, key = { _, s -> "new-${s.id}" }) { i, song ->
            SongRow(song, isCurrent = false, onClick = { onPlaySong(song) }, index = i + 1)
        }
    }
}

private fun greeting(): String = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
    in 5..11 -> "◤ GOOD MORNING"
    in 12..17 -> "◤ GOOD AFTERNOON"
    in 18..22 -> "◤ GOOD EVENING"
    else -> "◤ NIGHT MODE"
}

@Composable
private fun IconArt(icon: ImageVector) {
    PlaceholderArt(icon, iconScale = 0.45f, tint = TT.Accent)
}

@Composable
private fun QuickTile(index: Int, title: String, onClick: () -> Unit, art: @Composable () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(60.dp)
            .panel(color = TT.Panel, border = TT.Line, shape = CardShape)
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(60.dp)) { art() }
        Column(Modifier.padding(horizontal = 10.dp)) {
            HudLabel("%02d".format(index), color = TT.TextDim)
            Text(
                title.uppercase(),
                style = MaterialTheme.typography.labelLarge,
                color = TT.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
fun AlbumCard(album: Album, onClick: () -> Unit) {
    Column(Modifier.width(140.dp).clickable(onClick = onClick)) {
        Box {
            Artwork(album.id, Modifier.size(140.dp), shape = CardShape, fallbackIcon = Icons.Rounded.Album)
            CornerTriangle(Modifier.align(Alignment.BottomStart).padding(6.dp), color = TT.Accent, side = 8.dp)
        }
        Spacer(Modifier.height(8.dp))
        Text(album.title, style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        HudLabel(album.artist)
    }
}

@Composable
fun ArtistCard(artist: Artist, onClick: () -> Unit) {
    Column(Modifier.width(116.dp).clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(116.dp).border(1.dp, TT.LineBright, CircleShape).padding(5.dp)) {
            Artwork(artist.songs.first().albumId, Modifier.fillMaxSize(), shape = CircleShape, fallbackIcon = Icons.Rounded.Person)
        }
        Spacer(Modifier.height(8.dp))
        Text(artist.name, style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        HudLabel("Artist", color = TT.TextDim)
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
        item { ScreenHeader("◤ QUERY", "Search") }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("> ŞARKI, SANATÇI, ALBÜM_", style = MaterialTheme.typography.labelLarge, color = TT.TextDim) },
                leadingIcon = { Icon(Icons.Rounded.Search, null, tint = TT.Accent) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(Icons.Rounded.Clear, "Temizle", tint = TT.TextSecondary) }
                },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                shape = CardShape,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = TT.Panel,
                    unfocusedContainerColor = TT.Panel,
                    focusedBorderColor = TT.Accent,
                    unfocusedBorderColor = TT.LineBright,
                    cursorColor = TT.Accent,
                ),
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 16.dp),
            )
        }

        if (q.isEmpty()) {
            item { SectionHeader(1, "Browse artists") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(library.artists, key = { it.name }) { ArtistCard(it, onClick = { onOpenArtist(it.name) }) }
                }
            }
            return@LazyColumn
        }

        if (songs.isEmpty() && albums.isEmpty() && artists.isEmpty()) {
            item { EmptyState(Icons.Rounded.Search, "No match", "\"$query\" bulunamadı. Başka bir kelime dene.") }
        }
        var section = 1
        if (artists.isNotEmpty()) {
            val n = section++
            item { SectionHeader(n, "Artists") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(artists, key = { it.name }) { ArtistCard(it, onClick = { onOpenArtist(it.name) }) }
                }
            }
        }
        if (albums.isNotEmpty()) {
            val n = section++
            item { SectionHeader(n, "Albums") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(albums, key = { it.id }) { AlbumCard(it, onClick = { onOpenAlbum(it.id) }) }
                }
            }
        }
        if (songs.isNotEmpty()) {
            val n = section
            item { SectionHeader(n, "Tracks") }
            itemsIndexed(songs, key = { _, s -> s.id }) { i, song ->
                SongRow(song, isCurrent = song.id == currentSongId, onClick = { onPlay(songs, i) })
            }
        }
    }
}

// ------------------------------------------------------------------ Kitaplık

enum class LibraryFilter(val label: String) { Playlists("Playlists"), Albums("Albums"), Artists("Artists"), Songs("Tracks") }

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
    val accent = TT.Accent

    LazyColumn(Modifier.fillMaxSize().background(TT.Background), contentPadding = BottomInset) {
        item {
            ScreenHeader("◤ COLLECTION", "Library") {
                CyberIconButton(Icons.Rounded.Add, "Çalma listesi oluştur", onCreatePlaylist, size = 40.dp)
                Spacer(Modifier.width(8.dp))
                CyberIconButton(Icons.Rounded.Settings, "Ayarlar", onOpenSettings, size = 40.dp)
            }
        }
        item {
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LibraryFilter.entries.forEachIndexed { i, f ->
                    val selected = f == filter
                    Row(
                        Modifier
                            .panel(
                                color = if (selected) accent else Color.Transparent,
                                border = if (selected) null else TT.LineBright,
                                shape = Chamfer(6.dp),
                            )
                            .clickable { filter = f }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "%02d ".format(i + 1),
                            style = MaterialTheme.typography.labelMedium,
                            color = if (selected) Color.Black.copy(alpha = 0.6f) else TT.TextDim,
                        )
                        Text(
                            f.label.uppercase(),
                            style = MaterialTheme.typography.labelLarge,
                            color = if (selected) Color.Black else TT.TextPrimary,
                        )
                    }
                }
            }
        }

        when (filter) {
            LibraryFilter.Playlists -> {
                item {
                    LibraryRow("Liked tracks", "Playlist · $favoritesCount tracks", onOpenFavorites) { IconArt(Icons.Rounded.Favorite) }
                }
                items(playlists.reversed(), key = { it.id }) { p ->
                    LibraryRow(p.name, "Playlist · ${p.songIds.size} tracks", { onOpenPlaylist(p.id) }) {
                        PlaylistCover(p, Modifier.fillMaxSize(), corner = 0.dp)
                    }
                }
                item {
                    LibraryRow("Yeni çalma listesi", "Create", onCreatePlaylist) {
                        Box(Modifier.fillMaxSize().background(TT.Panel), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.Add, null, tint = accent, modifier = Modifier.size(28.dp))
                        }
                    }
                }
            }
            LibraryFilter.Albums -> items(library.albums, key = { it.id }) { a ->
                LibraryRow(a.title, "Album · ${a.artist}", { onOpenAlbum(a.id) }) {
                    Artwork(a.id, Modifier.fillMaxSize(), fallbackIcon = Icons.Rounded.Album)
                }
            }
            LibraryFilter.Artists -> items(library.artists, key = { it.name }) { a ->
                LibraryRow(a.name, "Artist · ${a.songs.size} tracks", { onOpenArtist(a.name) }, round = true) {
                    Artwork(a.songs.first().albumId, Modifier.fillMaxSize(), shape = CircleShape, fallbackIcon = Icons.Rounded.Person)
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
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(60.dp)
                .then(if (round) Modifier.border(1.dp, TT.LineBright, CircleShape).padding(3.dp).clip(CircleShape) else Modifier.panel(TT.Panel, TT.Line, ThumbShape)),
        ) { art() }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = TT.TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle.isNotEmpty()) HudLabel(subtitle)
        }
    }
}

@Composable
private fun PlayShuffleBar(text: String, onPlay: () -> Unit, onShuffle: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        HudLabel(text, modifier = Modifier.weight(1f))
        CyberIconButton(Icons.Rounded.Shuffle, "Karışık çal", onShuffle, size = 44.dp, tint = TT.TextSecondary)
        Spacer(Modifier.width(8.dp))
        CyberButton("Play", onPlay, icon = Icons.Rounded.PlayArrow)
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
    val kicker: String
    val header: @Composable () -> Unit
    var round = false
    when (kind) {
        is CollectionKind.AlbumKind -> {
            title = kind.album.title
            kicker = "◤ ALBUM · ${kind.album.artist}"
            header = { Artwork(kind.album.id, Modifier.fillMaxSize(), iconScale = 0.35f, fallbackIcon = Icons.Rounded.Album) }
        }
        is CollectionKind.ArtistKind -> {
            title = kind.artist.name
            kicker = "◤ ARTIST · ${kind.artist.albumCount} ALBUMS"
            round = true
            header = { Artwork(kind.artist.songs.first().albumId, Modifier.fillMaxSize(), shape = CircleShape, fallbackIcon = Icons.Rounded.Person) }
        }
        is CollectionKind.PlaylistKind -> {
            title = kind.playlist.name
            kicker = "◤ PLAYLIST"
            header = { PlaylistCover(kind.playlist, Modifier.fillMaxSize(), corner = 0.dp) }
        }
        CollectionKind.Favorites -> {
            title = "Liked tracks"
            kicker = "◤ PLAYLIST"
            header = { IconArt(Icons.Rounded.Favorite) }
        }
        CollectionKind.MostPlayed -> {
            title = "Top played"
            kicker = "◤ FOR YOU"
            header = { IconArt(Icons.Rounded.TrendingUp) }
        }
    }
    var menuOpen by remember { mutableStateOf(false) }
    val playlist = (kind as? CollectionKind.PlaylistKind)?.playlist
    val isAlbum = kind is CollectionKind.AlbumKind

    LazyColumn(Modifier.fillMaxSize().background(TT.Background), contentPadding = BottomInset) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                CyberIconButton(Icons.Rounded.ArrowBack, "Geri", onBack, size = 40.dp)
                Spacer(Modifier.weight(1f))
                DotGrid(5, 2, spacing = 7.dp)
                if (playlist != null) {
                    Spacer(Modifier.width(10.dp))
                    Box {
                        CyberIconButton(Icons.Rounded.MoreVert, "Seçenekler", { menuOpen = true }, size = 40.dp)
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
                Box(
                    Modifier
                        .fillMaxWidth(0.6f)
                        .aspectRatio(1f)
                        .then(
                            if (round) Modifier.border(1.dp, TT.LineBright, CircleShape).padding(6.dp).clip(CircleShape)
                            else Modifier.panel(TT.Panel, TT.LineBright, Chamfer(16.dp))
                        ),
                ) { header() }
            }
        }
        item {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp)) {
                HudLabel(kicker, color = TT.Accent)
                Spacer(Modifier.height(2.dp))
                Text(title, style = MaterialTheme.typography.headlineMedium, color = TT.TextPrimary)
            }
        }
        item {
            PlayShuffleBar(
                text = formatTotal(songs),
                onPlay = { onPlay(songs, 0, false) },
                onShuffle = { onPlay(songs, 0, true) },
            )
        }
        item { Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(1.dp).background(TT.Line)) }

        if (songs.isEmpty()) {
            item {
                EmptyState(
                    Icons.Rounded.MusicNote,
                    "Empty",
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

            SongRow(
                song,
                isCurrent = song.id == currentSongId,
                onClick = { onPlay(songs, i, false) },
                index = if (isAlbum && song.track > 0) song.track else i + 1,
                showArt = !isAlbum,
                extraMenu = extras,
                hideAlbumLink = isAlbum,
                hideArtistLink = kind is CollectionKind.ArtistKind,
            )
        }
    }
}
