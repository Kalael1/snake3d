package com.tuntune.player.playback

import android.app.PendingIntent
import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.tuntune.player.MainActivity
import com.tuntune.player.data.LibraryStore
import com.tuntune.player.data.MusicRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Müziği arka planda çalan servis. Ekran kapalıyken, kilit ekranından ve
 * kulaklık tuşlarından kontrol edilebilir.
 */
class PlaybackService : MediaSessionService() {

    private var session: MediaSession? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var store: LibraryStore

    override fun onCreate() {
        super.onCreate()
        store = LibraryStore.get(this)

        val player = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true) // kulaklık çıkınca durdur
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build()

        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                mediaItem?.mediaId?.toLongOrNull()?.let { store.recordPlay(it) }
                saveQueue()
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                // Bozuk dosya: takılmak yerine sıradaki şarkıya geç.
                if (player.hasNextMediaItem()) {
                    player.seekToNextMediaItem()
                    player.prepare()
                    player.play()
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) = saveQueue()
            override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) = saveQueue()
            override fun onRepeatModeChanged(repeatMode: Int) = saveQueue()
            override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) = saveQueue()
        })

        val openApp = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        session = MediaSession.Builder(this, player)
            .setSessionActivity(openApp)
            .setCallback(object : MediaSession.Callback {
                // Arayüzden gelen şarkıların dosya adresini burada yeniden kuruyoruz.
                override fun onAddMediaItems(
                    mediaSession: MediaSession,
                    controller: MediaSession.ControllerInfo,
                    mediaItems: MutableList<MediaItem>,
                ): ListenableFuture<MutableList<MediaItem>> {
                    val resolved = mediaItems.map { item ->
                        val id = item.mediaId.toLongOrNull()
                        if (id == null) item else item.buildUpon().setUri(songUri(id)).build()
                    }.toMutableList()
                    return Futures.immediateFuture(resolved)
                }
            })
            .build()

        restoreQueue(player)

        // Çalarken konumu ara ara kaydet (telefon kapanırsa kaldığı yerden devam etsin).
        scope.launch {
            while (isActive) {
                delay(10_000)
                if (player.isPlaying) saveQueue()
            }
        }
    }

    private fun restoreQueue(player: ExoPlayer) {
        val saved = store.loadQueue() ?: return
        scope.launch {
            val songs = MusicRepository.loadSongs(this@PlaybackService).associateBy { it.id }
            if (player.mediaItemCount > 0) return@launch // bu arada kullanıcı başka bir şey başlattı
            val items = saved.songIds.mapNotNull { songs[it]?.toMediaItem() }
            if (items.isEmpty()) return@launch
            val currentId = saved.songIds.getOrNull(saved.index)
            val index = items.indexOfFirst { it.mediaId == currentId?.toString() }.coerceAtLeast(0)
            val position = if (index == saved.index) saved.positionMs else 0L
            player.setMediaItems(items, index, position)
            player.shuffleModeEnabled = saved.shuffle
            player.repeatMode = saved.repeatMode
            player.prepare()
        }
    }

    private fun saveQueue() {
        val player = session?.player ?: return
        if (player.mediaItemCount == 0) return
        val ids = (0 until player.mediaItemCount).mapNotNull { player.getMediaItemAt(it).mediaId.toLongOrNull() }
        store.saveQueue(
            LibraryStore.SavedQueue(
                songIds = ids,
                index = player.currentMediaItemIndex,
                positionMs = player.currentPosition,
                shuffle = player.shuffleModeEnabled,
                repeatMode = player.repeatMode,
            )
        )
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onTaskRemoved(rootIntent: Intent?) {
        saveQueue()
        val player = session?.player
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        saveQueue()
        scope.cancel()
        session?.run {
            player.release()
            release()
        }
        session = null
        super.onDestroy()
    }
}
