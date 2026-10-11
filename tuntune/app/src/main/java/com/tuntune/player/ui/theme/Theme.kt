package com.tuntune.player.ui.theme

import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tuntune.player.R

/** Ayarlardan seçilebilen vurgu renkleri. */
enum class AccentTheme(val label: String, val color: Color) {
    Mono("MONO", Color(0xFFF2F2F2)),
    Yellow("NEON YELLOW", Color(0xFFFCEE0A)),
    Cyan("CYBER CYAN", Color(0xFF00F0FF)),
    Pink("NEON PINK", Color(0xFFFF2A6D)),
    Green("TOXIC GREEN", Color(0xFF39FF14)),
}

val LocalAccent = staticCompositionLocalOf { AccentTheme.Yellow.color }

object TT {
    val Background = Color(0xFF000000)
    val Panel = Color(0xFF101216)
    val PanelHigh = Color(0xFF1A1D23)
    val Line = Color(0xFF2A2F37)
    val LineBright = Color(0xFF4A505A)
    val TextPrimary = Color(0xFFE8E8EA)
    val TextSecondary = Color(0xFF8C929B)
    val TextDim = Color(0xFF555B64)
    val Disc = Color(0xFFDCDCDE)

    val Accent: Color
        @Composable @ReadOnlyComposable get() = LocalAccent.current
}

/** Köşeleri 45° kesilmiş endüstriyel panel şekli. Varsayılan: sol üst + sağ alt. */
data class Chamfer(
    val cut: Dp,
    val topStart: Boolean = true,
    val topEnd: Boolean = false,
    val bottomEnd: Boolean = true,
    val bottomStart: Boolean = false,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val c = with(density) { cut.toPx() }.coerceAtMost(minOf(size.width, size.height) / 2f)
        val w = size.width
        val h = size.height
        val path = Path().apply {
            if (topStart) { moveTo(0f, c); lineTo(c, 0f) } else moveTo(0f, 0f)
            if (topEnd) { lineTo(w - c, 0f); lineTo(w, c) } else lineTo(w, 0f)
            if (bottomEnd) { lineTo(w, h - c); lineTo(w - c, h) } else lineTo(w, h)
            if (bottomStart) { lineTo(c, h); lineTo(0f, h - c) } else lineTo(0f, h)
            close()
        }
        return Outline.Generic(path)
    }
}

val Chakra = FontFamily(
    Font(R.font.chakra_regular, FontWeight.Normal),
    Font(R.font.chakra_medium, FontWeight.Medium),
    Font(R.font.chakra_semibold, FontWeight.SemiBold),
    Font(R.font.chakra_bold, FontWeight.Bold),
)

private fun style(size: Int, weight: FontWeight, spacing: Float = 0f) =
    TextStyle(fontFamily = Chakra, fontSize = size.sp, fontWeight = weight, letterSpacing = spacing.sp)

private val typography = Typography(
    displaySmall = style(34, FontWeight.Bold, 2f),
    headlineLarge = style(30, FontWeight.Bold, 1.5f),
    headlineMedium = style(24, FontWeight.Bold, 1f),
    headlineSmall = style(20, FontWeight.Bold, 1f),
    titleLarge = style(19, FontWeight.Bold, 1.5f),
    titleMedium = style(16, FontWeight.SemiBold, 0.5f),
    titleSmall = style(14, FontWeight.SemiBold, 1f),
    bodyLarge = style(16, FontWeight.Medium),
    bodyMedium = style(14, FontWeight.Normal),
    bodySmall = style(12, FontWeight.Normal, 0.3f),
    labelLarge = style(14, FontWeight.SemiBold, 1.5f),
    labelMedium = style(11, FontWeight.SemiBold, 1.5f),
    labelSmall = style(10, FontWeight.Medium, 2.5f),
)

// Material bileşenleri (diyaloglar, menüler, yazı alanları) için aynı kesik köşe görünümü.
private fun cut(size: Dp) = CutCornerShape(topStart = size, bottomEnd = size)

private val shapes = Shapes(
    extraSmall = cut(6.dp),
    small = cut(8.dp),
    medium = cut(10.dp),
    large = cut(12.dp),
    extraLarge = cut(16.dp),
)

@Composable
fun TunTuneTheme(accent: AccentTheme, content: @Composable () -> Unit) {
    val colors = darkColorScheme(
        primary = accent.color,
        onPrimary = Color.Black,
        secondary = accent.color,
        onSecondary = Color.Black,
        background = TT.Background,
        onBackground = TT.TextPrimary,
        surface = TT.Panel,
        onSurface = TT.TextPrimary,
        surfaceVariant = TT.PanelHigh,
        onSurfaceVariant = TT.TextSecondary,
        surfaceContainerLowest = TT.Background,
        surfaceContainerLow = TT.Panel,
        surfaceContainer = TT.PanelHigh,
        surfaceContainerHigh = TT.PanelHigh,
        surfaceContainerHighest = TT.PanelHigh,
        outline = TT.Line,
        outlineVariant = TT.Line,
    )
    CompositionLocalProvider(LocalAccent provides accent.color) {
        MaterialTheme(colorScheme = colors, typography = typography, shapes = shapes, content = content)
    }
}
