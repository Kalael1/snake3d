package com.tuntune.player.data

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Telefondaki müzik dosyalarını Android'in medya veritabanından (MediaStore) okur. */
object MusicRepository {

    private const val MIN_DURATION_MS = 10_000L

    suspend fun loadSongs(context: Context): List<Song> = withContext(Dispatchers.IO) {
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ARTIST_ID,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.TRACK,
        )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= ?"
        val args = arrayOf(MIN_DURATION_MS.toString())
        val songs = ArrayList<Song>()

        try {
            context.contentResolver.query(collection, projection, selection, args, null)?.use { c ->
                val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artistCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val artistIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID)
                val albumCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val albumIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                val durationCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val dateCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
                val trackCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)

                while (c.moveToNext()) {
                    val id = c.getLong(idCol)
                    val artist = c.getString(artistCol)
                    songs += Song(
                        id = id,
                        title = c.getString(titleCol)?.takeIf { it.isNotBlank() } ?: "Bilinmeyen şarkı",
                        artist = artist?.takeIf { it.isNotBlank() && it != "<unknown>" } ?: "Bilinmeyen sanatçı",
                        artistId = c.getLong(artistIdCol),
                        album = c.getString(albumCol)?.takeIf { it.isNotBlank() } ?: "Bilinmeyen albüm",
                        albumId = c.getLong(albumIdCol),
                        durationMs = c.getLong(durationCol),
                        uri = ContentUris.withAppendedId(collection, id),
                        dateAdded = c.getLong(dateCol),
                        track = c.getInt(trackCol) % 1000,
                    )
                }
            }
        } catch (_: SecurityException) {
            // İzin verilmemiş; arayüz izin ekranını gösterir.
        }
        songs.sortedBy { it.title.lowercase() }
    }
}
