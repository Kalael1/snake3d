package com.tuntune.player.ui.components

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.MediaStore
import android.util.LruCache
import android.util.Size
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import com.tuntune.player.ui.theme.TT
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.tuntune.player.playback.albumArtUri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val ART_SIZE = 400

/** Albüm kapaklarını bir kez yükleyip bellekte tutar. */
object ArtworkCache {
    private val cache = object : LruCache<Long, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: Long, value: Bitmap) = value.byteCount
    }
    private val missing = HashSet<Long>()
    private val colors = HashMap<Long, Color>()

    fun peek(albumId: Long): Bitmap? = cache.get(albumId)

    suspend fun load(context: Context, albumId: Long): Bitmap? {
        if (albumId < 0) return null
        cache.get(albumId)?.let { return it }
        synchronized(missing) { if (albumId in missing) return null }
        val bitmap = withContext(Dispatchers.IO) { decode(context, albumId) }
        if (bitmap != null) cache.put(albumId, bitmap) else synchronized(missing) { missing += albumId }
        return bitmap
    }

    fun clearMisses() = synchronized(missing) { missing.clear() }

    fun peekColor(albumId: Long): Color? = synchronized(colors) { colors[albumId] }

    /** Kapağın ortalama rengi; bir kez hesaplanır, arka planda. */
    suspend fun color(context: Context, albumId: Long): Color? {
        synchronized(colors) { colors[albumId]?.let { return it } }
        val bitmap = load(context, albumId) ?: return null
        val color = withContext(Dispatchers.Default) { bitmap.averageColor() }
        synchronized(colors) { colors[albumId] = color }
        return color
    }

    private fun decode(context: Context, albumId: Long): Bitmap? {
        val resolver = context.contentResolver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val uri = ContentUris.withAppendedId(MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI, albumId)
                return resolver.loadThumbnail(uri, Size(ART_SIZE, ART_SIZE), null)
            } catch (_: Exception) {
            }
        }
        return try {
            resolver.openInputStream(albumArtUri(albumId))?.use { stream ->
                val opts = BitmapFactory.Options().apply { inSampleSize = 1 }
                BitmapFactory.decodeStream(stream, null, opts)?.let { scaleDown(it, ART_SIZE) }
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun scaleDown(bitmap: Bitmap, max: Int): Bitmap {
        val largest = maxOf(bitmap.width, bitmap.height)
        if (largest <= max) return bitmap
        val ratio = max.toFloat() / largest
        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt(), (bitmap.height * ratio).toInt(), true)
    }
}

/** Kapağın ortalama rengi; çalma ekranının arka planı için. */
fun Bitmap.averageColor(): Color {
    val px = Bitmap.createScaledBitmap(this, 1, 1, true).getPixel(0, 0)
    return Color(px)
}

@Composable
fun Artwork(
    albumId: Long,
    modifier: Modifier = Modifier,
    shape: Shape = RectangleShape,
    fallbackIcon: ImageVector = Icons.Rounded.MusicNote,
    iconScale: Float = 0.4f,
) {
    val context = LocalContext.current
    val bitmap by produceState(initialValue = ArtworkCache.peek(albumId), albumId) {
        if (value == null) value = ArtworkCache.load(context, albumId)
    }
    Box(modifier.clip(shape), contentAlignment = Alignment.Center) {
        val bmp = bitmap
        if (bmp != null) {
            Image(bmp.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            PlaceholderArt(icon = fallbackIcon, iconScale = iconScale)
        }
    }
}

/** Kapağı olmayan şarkılar için: koyu panel, ince çizgiler, ortada simge. */
@Composable
fun PlaceholderArt(icon: ImageVector, iconScale: Float = 0.4f, tint: Color = TT.TextDim) {
    Box(
        Modifier
            .fillMaxSize()
            .background(TT.PanelHigh)
            .drawBehind {
                val step = 10.dp.toPx()
                var x = -size.height
                while (x < size.width) {
                    drawLine(TT.Panel, Offset(x, size.height), Offset(x + size.height, 0f), 1.dp.toPx())
                    x += step
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.fillMaxSize(iconScale))
    }
}
