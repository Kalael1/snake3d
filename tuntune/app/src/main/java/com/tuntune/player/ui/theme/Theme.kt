package com.tuntune.player.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object TT {
    val Background = Color(0xFF121212)
    val Surface = Color(0xFF181818)
    val SurfaceHigh = Color(0xFF282828)
    val Accent = Color(0xFF1ED760)
    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFFB3B3B3)
    val Divider = Color(0xFF2A2A2A)
}

private val colors = darkColorScheme(
    primary = TT.Accent,
    onPrimary = Color.Black,
    secondary = TT.Accent,
    background = TT.Background,
    onBackground = TT.TextPrimary,
    surface = TT.Surface,
    onSurface = TT.TextPrimary,
    surfaceVariant = TT.SurfaceHigh,
    onSurfaceVariant = TT.TextSecondary,
    surfaceContainer = TT.SurfaceHigh,
    surfaceContainerHigh = TT.SurfaceHigh,
    surfaceContainerHighest = Color(0xFF333333),
    outline = TT.Divider,
)

private val typography = Typography(
    headlineLarge = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp),
    bodySmall = TextStyle(fontSize = 12.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
)

@Composable
fun TunTuneTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
