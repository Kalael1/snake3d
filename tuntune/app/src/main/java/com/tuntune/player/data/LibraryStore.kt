package com.tuntune.player.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

/**
 * Çalma listeleri, beğenilenler, dinlenme sayıları ve ayarlar.
 * Hepsi telefonda saklanır, internet gerekmez.
 */
class LibraryStore private constructor(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("tuntune", Context.MODE_PRIVATE)

    private val _playlists = MutableStateFlow(readPlaylists())
    val playlists: StateFlow<List<Playlist>> = _playlists.asStateFlow()

    private val _favorites = MutableStateFlow(readIdList(KEY_FAVORITES))
    val favorites: StateFlow<List<Long>> = _favorites.asStateFlow()

    private val _playCounts = MutableStateFlow(readPlayCounts())
    val playCounts: StateFlow<Map<Long, Int>> = _playCounts.asStateFlow()

    private val _recent = MutableStateFlow(readIdList(KEY_RECENT))
    val recent: StateFlow<List<Long>> = _recent.asStateFlow()

    // ---- Çalma listeleri ----

    fun createPlaylist(name: String, songIds: List<Long> = emptyList()): Playlist {
        val playlist = Playlist(System.currentTimeMillis(), name.trim().ifEmpty { "Yeni çalma listesi" }, songIds, System.currentTimeMillis())
        updatePlaylists { it + playlist }
        return playlist
    }

    fun renamePlaylist(id: Long, name: String) = updatePlaylist(id) { it.copy(name = name.trim().ifEmpty { it.name }) }

    fun deletePlaylist(id: Long) = updatePlaylists { list -> list.filterNot { it.id == id } }

    fun addToPlaylist(id: Long, songIds: List<Long>) =
        updatePlaylist(id) { p -> p.copy(songIds = p.songIds + songIds.filterNot { it in p.songIds }) }

    fun removeFromPlaylist(id: Long, index: Int) =
        updatePlaylist(id) { p -> p.copy(songIds = p.songIds.filterIndexed { i, _ -> i != index }) }

    fun moveInPlaylist(id: Long, from: Int, to: Int) = updatePlaylist(id) { p ->
        if (from !in p.songIds.indices || to !in p.songIds.indices) return@updatePlaylist p
        val list = p.songIds.toMutableList()
        list.add(to, list.removeAt(from))
        p.copy(songIds = list)
    }

    private fun updatePlaylist(id: Long, transform: (Playlist) -> Playlist) =
        updatePlaylists { list -> list.map { if (it.id == id) transform(it) else it } }

    private fun updatePlaylists(transform: (List<Playlist>) -> List<Playlist>) {
        val updated = transform(_playlists.value)
        _playlists.value = updated
        val json = JSONArray()
        updated.forEach { p ->
            json.put(JSONObject().apply {
                put("id", p.id)
                put("name", p.name)
                put("createdAt", p.createdAt)
                put("songs", JSONArray(p.songIds))
            })
        }
        prefs.edit().putString(KEY_PLAYLISTS, json.toString()).apply()
    }

    private fun readPlaylists(): List<Playlist> = try {
        val json = JSONArray(prefs.getString(KEY_PLAYLISTS, "[]"))
        (0 until json.length()).map { i ->
            val o = json.getJSONObject(i)
            val songs = o.getJSONArray("songs")
            Playlist(
                id = o.getLong("id"),
                name = o.getString("name"),
                songIds = (0 until songs.length()).map { songs.getLong(it) },
                createdAt = o.optLong("createdAt"),
            )
        }
    } catch (_: Exception) {
        emptyList()
    }

    // ---- Beğenilenler ----

    fun isFavorite(songId: Long) = songId in _favorites.value

    fun toggleFavorite(songId: Long) {
        val current = _favorites.value
        val updated = if (songId in current) current - songId else listOf(songId) + current
        _favorites.value = updated
        writeIdList(KEY_FAVORITES, updated)
    }

    // ---- Dinleme geçmişi ----

    fun recordPlay(songId: Long) {
        val counts = _playCounts.value.toMutableMap()
        counts[songId] = (counts[songId] ?: 0) + 1
        _playCounts.value = counts
        prefs.edit().putString(KEY_PLAY_COUNTS, JSONObject(counts.mapKeys { it.key.toString() }).toString()).apply()

        val recent = (listOf(songId) + _recent.value.filterNot { it == songId }).take(50)
        _recent.value = recent
        writeIdList(KEY_RECENT, recent)
    }

    private fun readPlayCounts(): Map<Long, Int> = try {
        val o = JSONObject(prefs.getString(KEY_PLAY_COUNTS, "{}") ?: "{}")
        o.keys().asSequence().associate { it.toLong() to o.getInt(it) }
    } catch (_: Exception) {
        emptyMap()
    }

    // ---- Kaldığı yerden devam ----

    data class SavedQueue(val songIds: List<Long>, val index: Int, val positionMs: Long, val shuffle: Boolean, val repeatMode: Int)

    fun saveQueue(q: SavedQueue) {
        prefs.edit()
            .putString(KEY_QUEUE, JSONArray(q.songIds).toString())
            .putInt(KEY_QUEUE_INDEX, q.index)
            .putLong(KEY_QUEUE_POS, q.positionMs)
            .putBoolean(KEY_SHUFFLE, q.shuffle)
            .putInt(KEY_REPEAT, q.repeatMode)
            .apply()
    }

    fun loadQueue(): SavedQueue? {
        val ids = readIdList(KEY_QUEUE)
        if (ids.isEmpty()) return null
        return SavedQueue(
            ids,
            prefs.getInt(KEY_QUEUE_INDEX, 0),
            prefs.getLong(KEY_QUEUE_POS, 0),
            prefs.getBoolean(KEY_SHUFFLE, false),
            prefs.getInt(KEY_REPEAT, 0),
        )
    }

    // ---- Tema ----

    private val _accent = MutableStateFlow(prefs.getString(KEY_ACCENT, null))
    /** Seçilen vurgu renginin adı (AccentTheme.name); null = varsayılan. */
    val accent: StateFlow<String?> = _accent.asStateFlow()

    fun setAccent(name: String) {
        _accent.value = name
        prefs.edit().putString(KEY_ACCENT, name).apply()
    }

    // ---- Kilit ekranı ----

    private val _lockScreen = MutableStateFlow(prefs.getBoolean(KEY_LOCK_SCREEN, true))
    /** TUNTUNE'un kendi kilit ekranı açık mı? */
    val lockScreen: StateFlow<Boolean> = _lockScreen.asStateFlow()

    fun setLockScreen(enabled: Boolean) {
        _lockScreen.value = enabled
        prefs.edit().putBoolean(KEY_LOCK_SCREEN, enabled).apply()
    }

    // ---- Ekran sabitleme ----

    private val _pinApp = MutableStateFlow(prefs.getBoolean(KEY_PIN_APP, false))
    /** TUNTUNE ekrana sabitlensin mi (çıkılamasın)? */
    val pinApp: StateFlow<Boolean> = _pinApp.asStateFlow()

    fun setPinApp(enabled: Boolean) {
        _pinApp.value = enabled
        prefs.edit().putBoolean(KEY_PIN_APP, enabled).apply()
    }

    // ---- Kiosk PIN ----

    var kioskPin: String
        get() = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN
        set(value) = prefs.edit().putString(KEY_PIN, value).apply()

    var kioskEnabled: Boolean
        get() = prefs.getBoolean(KEY_KIOSK, false)
        set(value) = prefs.edit().putBoolean(KEY_KIOSK, value).apply()

    // ---- yardımcılar ----

    private fun readIdList(key: String): List<Long> = try {
        val json = JSONArray(prefs.getString(key, "[]"))
        (0 until json.length()).map { json.getLong(it) }
    } catch (_: Exception) {
        emptyList()
    }

    private fun writeIdList(key: String, ids: List<Long>) {
        prefs.edit().putString(key, JSONArray(ids).toString()).apply()
    }

    companion object {
        const val DEFAULT_PIN = "0000"

        private const val KEY_PLAYLISTS = "playlists"
        private const val KEY_FAVORITES = "favorites"
        private const val KEY_PLAY_COUNTS = "play_counts"
        private const val KEY_RECENT = "recent"
        private const val KEY_QUEUE = "queue"
        private const val KEY_QUEUE_INDEX = "queue_index"
        private const val KEY_QUEUE_POS = "queue_pos"
        private const val KEY_SHUFFLE = "shuffle"
        private const val KEY_REPEAT = "repeat"
        private const val KEY_PIN = "kiosk_pin"
        private const val KEY_KIOSK = "kiosk_enabled"
        private const val KEY_ACCENT = "accent"
        private const val KEY_LOCK_SCREEN = "lock_screen"
        private const val KEY_PIN_APP = "pin_app"

        @Volatile private var instance: LibraryStore? = null

        fun get(context: Context): LibraryStore =
            instance ?: synchronized(this) {
                instance ?: LibraryStore(context).also { instance = it }
            }
    }
}
