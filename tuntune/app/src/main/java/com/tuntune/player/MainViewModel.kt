package com.tuntune.player

import android.app.Application
import android.content.ComponentName
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.tuntune.player.data.Library
import com.tuntune.player.data.LibraryStore
import com.tuntune.player.data.MusicRepository
import com.tuntune.player.data.Song
import com.tuntune.player.playback.EXTRA_ALBUM_ID
import com.tuntune.player.playback.PlaybackService
import com.tuntune.player.playback.toMediaItem
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class QueueEntry(val mediaIndex: Int, val songId: Long, val title: String, val artist: String, val albumId: Long)

data class PlayerUiState(
    val songId: Long? = null,
    val title: String = "",
    val artist: String = "",
    val albumId: Long = -1,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val shuffle: Boolean = false,
    val repeatMode: Int = Player.REPEAT_MODE_OFF,
    val upNext: List<QueueEntry> = emptyList(),
) {
    val hasSong: Boolean get() = songId != null
}

class MainViewModel(app: Application) : AndroidViewModel(app) {

    val store = LibraryStore.get(app)

    private val _library = MutableStateFlow(Library())
    val library: StateFlow<Library> = _library.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _player = MutableStateFlow(PlayerUiState())
    val player: StateFlow<PlayerUiState> = _player.asStateFlow()

    private val _sleepTimerEndsAt = MutableStateFlow<Long?>(null)
    val sleepTimerEndsAt: StateFlow<Long?> = _sleepTimerEndsAt.asStateFlow()

    private var controller: MediaController? = null
    private var sleepJob: Job? = null
    private var refreshJob: Job? = null

    private val mediaObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) = refresh(debounce = true)
    }

    init {
        connectController()
        app.contentResolver.registerContentObserver(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, true, mediaObserver)
        viewModelScope.launch {
            while (isActive) {
                delay(500)
                val c = controller ?: continue
                if (c.isPlaying) {
                    _player.value = _player.value.copy(positionMs = c.currentPosition, durationMs = c.duration.coerceAtLeast(0))
                }
            }
        }
    }

    // ---- Kitaplık ----

    fun refresh(debounce: Boolean = false) {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            if (debounce) delay(2_000)
            _loading.value = _library.value.songs.isEmpty()
            _library.value = Library(MusicRepository.loadSongs(getApplication()))
            _loading.value = false
        }
    }

    // ---- Oynatıcı bağlantısı ----

    private fun connectController() {
        val app = getApplication<Application>()
        val token = SessionToken(app, ComponentName(app, PlaybackService::class.java))
        val future = MediaController.Builder(app, token).buildAsync()
        future.addListener({
            val c = try {
                future.get()
            } catch (_: Exception) {
                return@addListener
            }
            controller = c
            c.addListener(object : Player.Listener {
                override fun onEvents(player: Player, events: Player.Events) = syncState()
            })
            syncState()
        }, ContextCompat.getMainExecutor(app))
    }

    private fun syncState() {
        val c = controller ?: return
        val item = c.currentMediaItem
        val meta = c.mediaMetadata
        _player.value = PlayerUiState(
            songId = item?.mediaId?.toLongOrNull(),
            title = meta.title?.toString() ?: "",
            artist = meta.artist?.toString() ?: "",
            albumId = meta.extras?.getLong(EXTRA_ALBUM_ID, -1) ?: -1,
            isPlaying = c.isPlaying,
            positionMs = c.currentPosition,
            durationMs = c.duration.coerceAtLeast(0),
            shuffle = c.shuffleModeEnabled,
            repeatMode = c.repeatMode,
            upNext = buildUpNext(c),
        )
    }

    private fun buildUpNext(c: MediaController): List<QueueEntry> {
        val timeline = c.currentTimeline
        if (timeline.isEmpty) return emptyList()
        val result = ArrayList<QueueEntry>()
        var index = timeline.getNextWindowIndex(c.currentMediaItemIndex, Player.REPEAT_MODE_OFF, c.shuffleModeEnabled)
        while (index != C.INDEX_UNSET && result.size < 200) {
            val item = c.getMediaItemAt(index)
            val id = item.mediaId.toLongOrNull()
            if (id != null) {
                result += QueueEntry(
                    mediaIndex = index,
                    songId = id,
                    title = item.mediaMetadata.title?.toString() ?: "",
                    artist = item.mediaMetadata.artist?.toString() ?: "",
                    albumId = item.mediaMetadata.extras?.getLong(EXTRA_ALBUM_ID, -1) ?: -1,
                )
            }
            index = timeline.getNextWindowIndex(index, Player.REPEAT_MODE_OFF, c.shuffleModeEnabled)
        }
        return result
    }

    // ---- Kontroller ----

    fun play(songs: List<Song>, startIndex: Int = 0, shuffle: Boolean = false) {
        val c = controller ?: return
        if (songs.isEmpty()) return
        c.shuffleModeEnabled = shuffle
        val start = if (shuffle && startIndex == 0) songs.indices.random() else startIndex
        c.setMediaItems(songs.map { it.toMediaItem() }, start.coerceIn(songs.indices), 0)
        c.prepare()
        c.play()
    }

    fun playNext(song: Song) {
        val c = controller ?: return
        if (c.mediaItemCount == 0) return play(listOf(song))
        c.addMediaItem(c.currentMediaItemIndex + 1, song.toMediaItem())
    }

    fun addToQueue(song: Song) {
        val c = controller ?: return
        if (c.mediaItemCount == 0) return play(listOf(song))
        c.addMediaItem(song.toMediaItem())
    }

    fun playFromQueue(mediaIndex: Int) {
        val c = controller ?: return
        c.seekTo(mediaIndex, 0)
        c.play()
    }

    fun removeFromQueue(mediaIndex: Int) {
        controller?.removeMediaItem(mediaIndex)
    }

    fun togglePlayPause() {
        val c = controller ?: return
        if (c.isPlaying) c.pause() else {
            if (c.playbackState == Player.STATE_IDLE) c.prepare()
            if (c.playbackState == Player.STATE_ENDED) c.seekToDefaultPosition()
            c.play()
        }
    }

    fun next() = controller?.seekToNext()

    fun previous() = controller?.seekToPrevious()

    fun seekTo(positionMs: Long) {
        controller?.seekTo(positionMs)
        _player.value = _player.value.copy(positionMs = positionMs)
    }

    fun toggleShuffle() {
        val c = controller ?: return
        c.shuffleModeEnabled = !c.shuffleModeEnabled
    }

    fun cycleRepeat() {
        val c = controller ?: return
        c.repeatMode = when (c.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    // ---- Uyku zamanlayıcısı ----

    fun setSleepTimer(minutes: Int?) {
        sleepJob?.cancel()
        if (minutes == null) {
            _sleepTimerEndsAt.value = null
            return
        }
        val endsAt = System.currentTimeMillis() + minutes * 60_000L
        _sleepTimerEndsAt.value = endsAt
        sleepJob = viewModelScope.launch {
            delay(minutes * 60_000L)
            controller?.pause()
            _sleepTimerEndsAt.value = null
        }
    }

    override fun onCleared() {
        getApplication<Application>().contentResolver.unregisterContentObserver(mediaObserver)
        controller?.release()
        super.onCleared()
    }
}
