package com.tuntune.player.playback

import android.content.ContentUris
import android.net.Uri
import android.provider.MediaStore
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.tuntune.player.data.Song

private val ALBUM_ART_BASE: Uri = Uri.parse("content://media/external/audio/albumart")

fun albumArtUri(albumId: Long): Uri = ContentUris.withAppendedId(ALBUM_ART_BASE, albumId)

fun songUri(id: Long): Uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)

fun Song.toMediaItem(): MediaItem =
    MediaItem.Builder()
        .setMediaId(id.toString())
        .setUri(uri)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setAlbumTitle(album)
                .setArtworkUri(albumArtUri(albumId))
                .setExtras(android.os.Bundle().apply { putLong(EXTRA_ALBUM_ID, albumId) })
                .setIsPlayable(true)
                .setIsBrowsable(false)
                .build()
        )
        .build()

const val EXTRA_ALBUM_ID = "album_id"
