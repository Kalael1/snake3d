package com.tuntune.player.data

import android.net.Uri

data class Song(
    val id: Long,
    val title: String,
    val artist: String,
    val artistId: Long,
    val album: String,
    val albumId: Long,
    val durationMs: Long,
    val uri: Uri,
    val dateAdded: Long,
    val track: Int,
)

data class Album(
    val id: Long,
    val title: String,
    val artist: String,
    val songs: List<Song>,
)

data class Artist(
    val id: Long,
    val name: String,
    val songs: List<Song>,
) {
    val albumCount: Int get() = songs.map { it.albumId }.distinct().size
}

data class Playlist(
    val id: Long,
    val name: String,
    val songIds: List<Long>,
    val createdAt: Long,
)

/** Kitaplığın tamamı; şarkı listesinden albüm ve sanatçılar türetilir. */
data class Library(
    val songs: List<Song> = emptyList(),
) {
    val byId: Map<Long, Song> = songs.associateBy { it.id }

    val albums: List<Album> = songs
        .groupBy { it.albumId }
        .map { (id, list) ->
            val sorted = list.sortedWith(compareBy({ it.track }, { it.title.lowercase() }))
            Album(id, sorted.first().album, mostCommon(sorted.map { it.artist }), sorted)
        }
        .sortedBy { it.title.lowercase() }

    val artists: List<Artist> = songs
        .groupBy { it.artist }
        .map { (name, list) ->
            Artist(list.first().artistId, name, list.sortedWith(compareBy({ it.album.lowercase() }, { it.track })))
        }
        .sortedBy { it.name.lowercase() }

    fun album(id: Long): Album? = albums.firstOrNull { it.id == id }
    fun artist(name: String): Artist? = artists.firstOrNull { it.name == name }

    private fun mostCommon(values: List<String>): String =
        values.groupingBy { it }.eachCount().maxByOrNull { it.value }?.key ?: ""
}
