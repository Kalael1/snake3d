package com.tuntune.player.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tuntune.player.MainViewModel
import com.tuntune.player.data.Playlist
import com.tuntune.player.data.Song
import com.tuntune.player.data.LibraryStore
import com.tuntune.player.ui.components.AddToPlaylistDialog
import com.tuntune.player.ui.components.ArtworkCache
import com.tuntune.player.ui.components.EmptyState
import com.tuntune.player.ui.components.LocalSongActions
import com.tuntune.player.ui.components.CyberButton
import com.tuntune.player.ui.components.CyberDialog
import com.tuntune.player.ui.components.HudLabel
import com.tuntune.player.ui.components.SpinningDisc
import com.tuntune.player.ui.theme.AccentTheme
import com.tuntune.player.ui.components.SongActions
import com.tuntune.player.ui.components.TextInputDialog
import com.tuntune.player.ui.screens.CollectionKind
import com.tuntune.player.ui.screens.CollectionScreen
import com.tuntune.player.ui.screens.HomeScreen
import com.tuntune.player.ui.screens.LibraryScreen
import com.tuntune.player.ui.screens.LockScreen
import com.tuntune.player.ui.screens.MiniPlayer
import com.tuntune.player.ui.screens.NowPlayingScreen
import com.tuntune.player.ui.screens.QueueScreen
import com.tuntune.player.ui.screens.SearchScreen
import com.tuntune.player.ui.screens.SettingsScreen
import com.tuntune.player.ui.theme.TT

enum class Tab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Rounded.Home),
    Search("Search", Icons.Rounded.Search),
    Library("Library", Icons.Rounded.LibraryMusic),
}

sealed interface Route {
    data class AlbumRoute(val id: Long) : Route
    data class ArtistRoute(val name: String) : Route
    data class PlaylistRoute(val id: Long) : Route
    data object FavoritesRoute : Route
    data object MostPlayedRoute : Route
    data object SettingsRoute : Route
}

@Composable
fun TunTuneApp(
    vm: MainViewModel,
    hasPermission: Boolean,
    onRequestPermission: () -> Unit,
    kioskVersion: Int,
    isDeviceOwner: () -> Boolean,
    isKioskEnabled: () -> Boolean,
    onEnableKiosk: () -> Unit,
    onDisableKiosk: () -> Unit,
    onRemoveKiosk: () -> Unit,
    lockVisible: Boolean,
    onUnlock: () -> Unit,
) {
    if (!hasPermission) {
        PermissionScreen(onRequestPermission)
        return
    }

    val library by vm.library.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val player by vm.player.collectAsStateWithLifecycle()
    val playlists by vm.store.playlists.collectAsStateWithLifecycle()
    val favorites by vm.store.favorites.collectAsStateWithLifecycle()
    val recent by vm.store.recent.collectAsStateWithLifecycle()
    val playCounts by vm.store.playCounts.collectAsStateWithLifecycle()
    val sleepEndsAt by vm.sleepTimerEndsAt.collectAsStateWithLifecycle()
    val accentName by vm.store.accent.collectAsStateWithLifecycle()
    val accentTheme = AccentTheme.entries.firstOrNull { it.name == accentName } ?: AccentTheme.Yellow
    val lockScreenEnabled by vm.store.lockScreen.collectAsStateWithLifecycle()
    val pinEnabled by vm.store.pinApp.collectAsStateWithLifecycle()

    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    val stack = remember { mutableStateListOf<Route>() }
    var showNowPlaying by remember { mutableStateOf(false) }
    var showQueue by remember { mutableStateOf(false) }

    // Diyaloglar
    var addToPlaylistSong by remember { mutableStateOf<Song?>(null) }
    var createPlaylistFor by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylist by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf<Playlist?>(null) }
    var deleting by remember { mutableStateOf<Playlist?>(null) }

    val favoriteSet = remember(favorites) { favorites.toHashSet() }
    val mostPlayed = remember(playCounts, library) {
        playCounts.entries.sortedByDescending { it.value }.mapNotNull { library.byId[it.key] }.take(50)
    }

    fun push(route: Route) {
        showNowPlaying = false
        showQueue = false
        stack.add(route)
    }

    val actions = remember(favoriteSet) {
        object : SongActions {
            override fun playNext(song: Song) = vm.playNext(song)
            override fun addToQueue(song: Song) = vm.addToQueue(song)
            override fun addToPlaylist(song: Song) { addToPlaylistSong = song }
            override fun toggleFavorite(song: Song) = vm.store.toggleFavorite(song.id)
            override fun isFavorite(song: Song) = song.id in favoriteSet
            override fun openAlbum(albumId: Long) = push(Route.AlbumRoute(albumId))
            override fun openArtist(name: String) = push(Route.ArtistRoute(name))
        }
    }

    // Geri tuşu uygulamayı asla kapatmaz: önce sayfalar, sonra ana sekme, sonra hiçbir şey.
    BackHandler(enabled = true) {
        if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) else if (tab != Tab.Home) tab = Tab.Home
    }

    val playSongs: (List<Song>, Int) -> Unit = { songs, index -> vm.play(songs, index) }

    CompositionLocalProvider(LocalSongActions provides actions) {
        Box(Modifier.fillMaxSize().background(TT.Background)) {
            // ---- Sayfa içeriği ----
            if (loading && library.songs.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = TT.Accent) }
            } else {
                when (val route = stack.lastOrNull()) {
                    null -> when (tab) {
                        Tab.Home -> HomeScreen(
                            library = library,
                            playlists = playlists,
                            favorites = favorites,
                            recent = recent,
                            mostPlayed = mostPlayed,
                            onOpenFavorites = { push(Route.FavoritesRoute) },
                            onOpenMostPlayed = { push(Route.MostPlayedRoute) },
                            onOpenPlaylist = { push(Route.PlaylistRoute(it)) },
                            onOpenAlbum = { push(Route.AlbumRoute(it)) },
                            onOpenArtist = { push(Route.ArtistRoute(it)) },
                            onOpenSettings = { push(Route.SettingsRoute) },
                            onPlaySong = { vm.play(listOf(it)) },
                        )
                        Tab.Search -> SearchScreen(
                            library = library,
                            currentSongId = player.songId,
                            onPlay = playSongs,
                            onOpenAlbum = { push(Route.AlbumRoute(it)) },
                            onOpenArtist = { push(Route.ArtistRoute(it)) },
                        )
                        Tab.Library -> LibraryScreen(
                            library = library,
                            playlists = playlists,
                            favoritesCount = favorites.count { it in library.byId },
                            currentSongId = player.songId,
                            onOpenFavorites = { push(Route.FavoritesRoute) },
                            onOpenPlaylist = { push(Route.PlaylistRoute(it)) },
                            onOpenAlbum = { push(Route.AlbumRoute(it)) },
                            onOpenArtist = { push(Route.ArtistRoute(it)) },
                            onCreatePlaylist = { createPlaylistFor = null; showCreatePlaylist = true },
                            onOpenSettings = { push(Route.SettingsRoute) },
                            onPlay = playSongs,
                        )
                    }

                    Route.SettingsRoute -> {
                        // kioskVersion değişince bu blok yeniden okunur
                        val owner = remember(kioskVersion) { isDeviceOwner() }
                        val enabled = remember(kioskVersion) { isKioskEnabled() }
                        var pinVersion by remember { mutableStateOf(0) }
                        val pin = remember(pinVersion) { vm.store.kioskPin }
                        SettingsScreen(
                            songCount = library.songs.size,
                            isDeviceOwner = owner,
                            kioskEnabled = enabled,
                            currentPin = pin,
                            usingDefaultPin = pin == LibraryStore.DEFAULT_PIN,
                            onBack = { stack.removeAt(stack.lastIndex) },
                            onRescan = { ArtworkCache.clearMisses(); vm.refresh() },
                            onEnableKiosk = onEnableKiosk,
                            onDisableKiosk = onDisableKiosk,
                            onRemoveKiosk = onRemoveKiosk,
                            onChangePin = { vm.store.kioskPin = it; pinVersion++ },
                            accent = accentTheme,
                            onAccentChange = { vm.store.setAccent(it.name) },
                            lockScreenEnabled = lockScreenEnabled,
                            onLockScreenChange = { vm.store.setLockScreen(it) },
                            pinEnabled = pinEnabled,
                            onPinChange = { vm.store.setPinApp(it) },
                        )
                    }

                    else -> {
                        val (kind, songs) = when (route) {
                            is Route.AlbumRoute -> library.album(route.id)?.let { CollectionKind.AlbumKind(it) to it.songs }
                            is Route.ArtistRoute -> library.artist(route.name)?.let { CollectionKind.ArtistKind(it) to it.songs }
                            is Route.PlaylistRoute -> playlists.firstOrNull { it.id == route.id }?.let { p ->
                                CollectionKind.PlaylistKind(p) to p.songIds.mapNotNull { library.byId[it] }
                            }
                            Route.FavoritesRoute -> CollectionKind.Favorites to favorites.mapNotNull { library.byId[it] }
                            Route.MostPlayedRoute -> CollectionKind.MostPlayed to mostPlayed
                            Route.SettingsRoute, null -> null
                        } ?: (null to emptyList())

                        if (kind == null) {
                            // Silinmiş liste vb. — geri dön
                            BackHandler { stack.removeAt(stack.lastIndex) }
                            EmptyState(Icons.Rounded.MusicNote, "Bulunamadı", "Bu sayfa artık mevcut değil.", Modifier.padding(top = 120.dp))
                        } else {
                            CollectionScreen(
                                kind = kind,
                                songs = songs,
                                currentSongId = player.songId,
                                onBack = { stack.removeAt(stack.lastIndex) },
                                onPlay = { list, index, shuffle -> vm.play(list, index, shuffle) },
                                onRenamePlaylist = { renaming = it },
                                onDeletePlaylist = { deleting = it },
                                onRemoveFromPlaylist = { p, index -> vm.store.removeFromPlaylist(p.id, playlistIndex(p, songs, index, library.byId.keys)) },
                                onMoveInPlaylist = { p, from, to ->
                                    vm.store.moveInPlaylist(p.id, playlistIndex(p, songs, from, library.byId.keys), playlistIndex(p, songs, to, library.byId.keys))
                                },
                            )
                        }
                    }
                }
            }

            // ---- Alt kısım: mini oynatıcı + menü ----
            Column(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, TT.Background.copy(alpha = 0.92f), TT.Background, TT.Background))),
            ) {
                Spacer(Modifier.height(24.dp))
                if (player.hasSong) Isolated {
                    val position by vm.position.collectAsStateWithLifecycle()
                    MiniPlayer(
                        state = player.copy(positionMs = position),
                        isFavorite = player.songId in favoriteSet,
                        onOpen = { showNowPlaying = true },
                        onPlayPause = vm::togglePlayPause,
                        onToggleFavorite = { player.songId?.let { vm.store.toggleFavorite(it) } },
                    )
                }
                BottomBar(tab) { selected ->
                    stack.clear()
                    tab = selected
                }
            }

            // ---- Tam ekran oynatıcı ----
            AnimatedVisibility(
                visible = showNowPlaying && player.hasSong,
                enter = slideInVertically(tween(300)) { it },
                exit = slideOutVertically(tween(250)) { it },
            ) {
                val albumName = player.songId?.let { library.byId[it]?.album } ?: ""
                val position by vm.position.collectAsStateWithLifecycle()
                NowPlayingScreen(
                    state = player.copy(positionMs = position),
                    isFavorite = player.songId in favoriteSet,
                    albumName = albumName,
                    sleepTimerEndsAt = sleepEndsAt,
                    onClose = { showNowPlaying = false },
                    onPlayPause = vm::togglePlayPause,
                    onNext = { vm.next() },
                    onPrevious = { vm.previous() },
                    onSeek = vm::seekTo,
                    onToggleShuffle = vm::toggleShuffle,
                    onCycleRepeat = vm::cycleRepeat,
                    onToggleFavorite = { player.songId?.let { vm.store.toggleFavorite(it) } },
                    onOpenQueue = { showQueue = true },
                    onSetSleepTimer = vm::setSleepTimer,
                    onOpenArtist = { push(Route.ArtistRoute(player.artist)) },
                )
            }

            AnimatedVisibility(
                visible = showQueue,
                enter = slideInVertically(tween(300)) { it },
                exit = slideOutVertically(tween(250)) { it },
            ) {
                QueueScreen(
                    state = player,
                    onClose = { showQueue = false },
                    onPlay = { vm.playFromQueue(it.mediaIndex) },
                    onRemove = { vm.removeFromQueue(it.mediaIndex) },
                )
            }

            // ---- TUNTUNE kilit ekranı (her şeyin üstünde) ----
            AnimatedVisibility(
                visible = lockVisible,
                enter = fadeIn(tween(200)),
                exit = fadeOut(tween(250)) + slideOutVertically(tween(300)) { -it / 3 },
            ) {
                val lockPosition by vm.position.collectAsStateWithLifecycle()
                LockScreen(
                    state = player,
                    positionMs = { lockPosition },
                    onPlayPause = vm::togglePlayPause,
                    onNext = { vm.next() },
                    onPrevious = { vm.previous() },
                    onUnlock = onUnlock,
                )
            }
        }

        // ---- Diyaloglar ----
        addToPlaylistSong?.let { song ->
            AddToPlaylistDialog(
                playlists = playlists,
                onDismiss = { addToPlaylistSong = null },
                onPick = { vm.store.addToPlaylist(it.id, listOf(song.id)); addToPlaylistSong = null },
                onCreateNew = { createPlaylistFor = song; addToPlaylistSong = null; showCreatePlaylist = true },
            )
        }
        if (showCreatePlaylist) {
            TextInputDialog(
                title = "Çalma listene bir isim ver",
                initial = "Çalma listem #${playlists.size + 1}",
                confirmText = "Oluştur",
                onDismiss = { showCreatePlaylist = false },
                onConfirm = { name ->
                    val p = vm.store.createPlaylist(name, listOfNotNull(createPlaylistFor?.id))
                    showCreatePlaylist = false
                    if (createPlaylistFor == null) push(Route.PlaylistRoute(p.id))
                    createPlaylistFor = null
                },
            )
        }
        renaming?.let { p ->
            TextInputDialog(
                title = "Yeniden adlandır",
                initial = p.name,
                onDismiss = { renaming = null },
                onConfirm = { vm.store.renamePlaylist(p.id, it); renaming = null },
            )
        }
        deleting?.let { p ->
            CyberDialog(
                title = "Silinsin mi?",
                onDismiss = { deleting = null },
                confirmText = "Sil",
                onConfirm = {
                    vm.store.deletePlaylist(p.id)
                    deleting = null
                    if (stack.lastOrNull() == Route.PlaylistRoute(p.id)) stack.removeAt(stack.lastIndex)
                },
            ) {
                Text("\"${p.name}\" çalma listesi silinecek. Şarkıların telefonda kalır.", color = TT.TextSecondary)
            }
        }
    }
}

/**
 * Ekrandaki sıra (silinmiş dosyalar gizlenmiş hali) ile kayıtlı listedeki sırayı eşleştirir.
 */
private fun playlistIndex(p: Playlist, shown: List<Song>, shownIndex: Int, existing: Set<Long>): Int {
    var seen = -1
    p.songIds.forEachIndexed { i, id ->
        if (id in existing) {
            seen++
            if (seen == shownIndex) return i
        }
    }
    return shownIndex.coerceIn(0, (p.songIds.size - 1).coerceAtLeast(0))
}

@Composable
private fun BottomBar(selected: Tab, onSelect: (Tab) -> Unit) {
    val accent = TT.Accent
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().padding(top = 8.dp).height(1.dp).background(TT.Line))
        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(top = 2.dp, bottom = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            Tab.entries.forEachIndexed { i, t ->
                val active = t == selected
                Column(
                    Modifier
                        .weight(1f)
                        .clickable { onSelect(t) }
                        .padding(bottom = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // aktif sekmenin üstünde neon blok
                    Box(Modifier.width(28.dp).height(3.dp).background(if (active) accent else Color.Transparent))
                    Spacer(Modifier.height(6.dp))
                    Icon(t.icon, t.label, tint = if (active) accent else TT.TextSecondary, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "%02d %s".format(i + 1, t.label.uppercase()),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (active) TT.TextPrimary else TT.TextDim,
                    )
                }
            }
        }
    }
}

@Composable
private fun PermissionScreen(onRequest: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(TT.Background).padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SpinningDisc(albumId = -1, isPlaying = true, modifier = Modifier.size(160.dp))
        Spacer(Modifier.height(32.dp))
        HudLabel("◤ ACCESS REQUIRED", color = TT.Accent)
        Text("TUNTUNE", style = MaterialTheme.typography.displaySmall, color = TT.TextPrimary)
        Spacer(Modifier.height(12.dp))
        Text(
            "Müziklerini çalabilmek için telefondaki ses dosyalarına erişim izni gerekiyor.",
            style = MaterialTheme.typography.bodyLarge,
            color = TT.TextSecondary,
        )
        Spacer(Modifier.height(32.dp))
        CyberButton("İzin ver", onRequest)
    }
}

/** İçindeki sık değişen değerler sadece bu küçük bölümü yeniden çizdirir. */
@Composable
private fun Isolated(content: @Composable () -> Unit) = content()
