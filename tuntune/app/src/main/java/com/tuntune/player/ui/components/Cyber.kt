package com.tuntune.player.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.composed
import androidx.compose.ui.platform.LocalView
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tuntune.player.ui.theme.Chamfer
import com.tuntune.player.ui.theme.TT
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlinx.coroutines.isActive

// ------------------------------------------------------------------ Dokunma hissi

/** Basınca titreşim + içeri çökme animasyonu. Tüm TUNTUNE butonları bunu kullanır. */
fun Modifier.cyberClickable(
    enabled: Boolean = true,
    interactionSource: MutableInteractionSource? = null,
    pressedScale: Float = 0.95f,
    onClick: () -> Unit,
): Modifier = composed {
    val view = LocalView.current
    val source = interactionSource ?: remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = spring(dampingRatio = 0.45f, stiffness = 900f),
        label = "press",
    )
    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .clickable(interactionSource = source, indication = LocalIndication.current, enabled = enabled) {
            view.performHapticFeedback(
                HapticFeedbackConstants.VIRTUAL_KEY,
                @Suppress("DEPRECATION") HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING,
            )
            onClick()
        }
}

// ------------------------------------------------------------------ Paneller ve etiketler

/** Pahlı köşeli, ince çerçeveli panel. */
fun Modifier.panel(
    color: Color = TT.Panel,
    border: Color? = TT.Line,
    shape: Shape = Chamfer(10.dp),
): Modifier = this
    .clip(shape)
    .background(color, shape)
    .then(if (border != null) Modifier.border(1.dp, border, shape) else Modifier)

/** Küçük, büyük harfli, geniş aralıklı HUD etiketi. */
@Composable
fun HudLabel(text: String, modifier: Modifier = Modifier, color: Color = TT.TextSecondary) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}

/** "// 02  ALBUMS ────────■" tarzı bölüm başlığı. */
@Composable
fun SectionHeader(index: Int, title: String, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 28.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("//", color = TT.Accent, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.width(6.dp))
        Text("%02d".format(index), color = TT.TextDim, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.width(10.dp))
        Text(title.uppercase(), style = MaterialTheme.typography.titleSmall, color = TT.TextPrimary)
        Spacer(Modifier.width(12.dp))
        Box(Modifier.weight(1f).height(1.dp).background(TT.Line))
        Spacer(Modifier.width(4.dp))
        Box(Modifier.size(5.dp).background(TT.LineBright))
    }
}

/** Pahlı köşeli simge butonu. */
@Composable
fun CyberIconButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    tint: Color = TT.TextPrimary,
    fill: Color = Color.Transparent,
    border: Color? = TT.Line,
    cut: Dp = 8.dp,
    iconScale: Float = 0.5f,
) {
    val shape = Chamfer(cut)
    val accent = TT.Accent
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val borderColor = if (pressed) accent else border
    Box(
        modifier
            .size(size)
            .cyberClickable(interactionSource = source, pressedScale = 0.9f, onClick = onClick)
            .clip(shape)
            .background(if (pressed && fill == Color.Transparent) accent.copy(alpha = 0.12f) else fill)
            .then(if (borderColor != null) Modifier.border(if (pressed) 1.5.dp else 1.dp, borderColor, shape) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription, tint = tint, modifier = Modifier.size(size * iconScale))
    }
}

/** Yazılı, pahlı buton ("PLAY", "SHUFFLE" gibi). */
@Composable
fun CyberButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    filled: Boolean = true,
) {
    val accent = TT.Accent
    val shape = Chamfer(8.dp)
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Row(
        modifier
            .height(44.dp)
            .cyberClickable(interactionSource = source, pressedScale = 0.94f, onClick = onClick)
            .clip(shape)
            .background(if (filled) accent else if (pressed) accent.copy(alpha = 0.12f) else Color.Transparent)
            .then(if (!filled) Modifier.border(1.dp, if (pressed) accent else TT.LineBright, shape) else Modifier)
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val color = if (filled) Color.Black else TT.TextPrimary
        if (icon != null) {
            Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text.uppercase(), color = color, style = MaterialTheme.typography.labelLarge)
    }
}

// ------------------------------------------------------------------ Süslemeler

/** Nokta ızgarası. */
@Composable
fun DotGrid(cols: Int, rows: Int, modifier: Modifier = Modifier, color: Color = TT.LineBright, spacing: Dp = 8.dp, dot: Dp = 2.dp) {
    Canvas(modifier.size(spacing * cols, spacing * rows)) {
        val s = spacing.toPx()
        val r = dot.toPx() / 2f
        for (x in 0 until cols) for (y in 0 until rows) {
            drawCircle(color, r, Offset(s * x + s / 2f, s * y + s / 2f))
        }
    }
}

/** Köşeye bakan ince ok (referanstaki ↖ ↘ işaretleri). [angle]: 0 = sağa, 90 = aşağı. */
@Composable
fun HudArrow(modifier: Modifier = Modifier, angle: Float = -135f, color: Color = TT.TextSecondary, length: Dp = 36.dp) {
    Canvas(modifier.size(length).rotate(angle)) {
        val stroke = 1.5.dp.toPx()
        val y = size.height / 2f
        drawLine(color, Offset(0f, y), Offset(size.width, y), stroke)
        val head = 7.dp.toPx()
        val tip = Offset(size.width, y)
        drawLine(color, tip, Offset(tip.x - head, y - head), stroke, StrokeCap.Square)
        drawLine(color, tip, Offset(tip.x - head, y + head), stroke, StrokeCap.Square)
    }
}

/** Metni dikey yazar (alttan yukarı). */
fun Modifier.verticalText(): Modifier = this
    .layout { measurable, constraints ->
        val placeable = measurable.measure(
            Constraints(maxWidth = if (constraints.hasBoundedHeight) constraints.maxHeight else Constraints.Infinity)
        )
        layout(placeable.height, placeable.width) {
            placeable.place(
                x = -(placeable.width - placeable.height) / 2,
                y = (placeable.width - placeable.height) / 2,
            )
        }
    }
    .rotate(-90f)

/** Çapraz çizgili ilerleme çubuğu ("/////////"). */
@Composable
fun HatchBar(progress: Float, modifier: Modifier = Modifier, color: Color = TT.Accent, track: Color = TT.Line) {
    Canvas(modifier) {
        val step = 5.dp.toPx()
        val stroke = 1.6.dp.toPx()
        val slant = size.height * 0.55f
        val limit = size.width * progress.coerceIn(0f, 1f)
        var x = 0f
        while (x < size.width - slant) {
            drawLine(if (x <= limit) color else track, Offset(x + slant, 0f), Offset(x, size.height), stroke)
            x += step
        }
    }
}

/** Dokunarak ve sürükleyerek konum seçilebilen çizgili çubuk. */
@Composable
fun HatchSeekBar(
    value: Float,
    onValueChange: (Float) -> Unit,
    onValueChangeFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val change by rememberUpdatedState(onValueChange)
    val finished by rememberUpdatedState(onValueChangeFinished)
    Box(
        modifier
            .height(32.dp)
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    change((offset.x / size.width).coerceIn(0f, 1f))
                    finished()
                }
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { change((it.x / size.width).coerceIn(0f, 1f)) },
                    onDragEnd = { finished() },
                    onDragCancel = { finished() },
                ) { pointer, _ -> change((pointer.position.x / size.width).coerceIn(0f, 1f)) }
            },
        contentAlignment = Alignment.Center,
    ) {
        HatchBar(value, Modifier.fillMaxWidth().height(12.dp))
    }
}

// ------------------------------------------------------------------ Dönen CD

private const val DISC_PERIOD_MS = 6000 // bir tur: 6 saniye
private val EaseInToSpin = CubicBezierEasing(0.4f, 0f, 1f, 1f)
private val EaseOutOfSpin = CubicBezierEasing(0.33f, 1f, 0.68f, 1f)

/**
 * Ortasında albüm kapağı olan CD. Müzik çalarken akıcı döner, durunca yavaşlayarak durur.
 * Dönüş sadece çizim katmanında yapılır; ekran yeniden hesaplanmaz.
 */
@Composable
fun rememberDiscRotation(isPlaying: Boolean): Animatable<Float, AnimationVector1D> {
    val rotation = remember { Animatable(0f) }
    LaunchedEffect(isPlaying) {
        if (isPlaying) {
            rotation.snapTo(rotation.value % 360f)
            rotation.animateTo(rotation.value + 36f, tween(1000, easing = EaseInToSpin))
            while (isActive) {
                rotation.animateTo(rotation.value + 360f, tween(DISC_PERIOD_MS, easing = LinearEasing))
                rotation.snapTo(rotation.value % 360f)
            }
        } else {
            rotation.animateTo(rotation.value + 30f, tween(1500, easing = EaseOutOfSpin))
        }
    }
    return rotation
}

@Composable
fun SpinningDisc(albumId: Long, isPlaying: Boolean, modifier: Modifier = Modifier, detailed: Boolean = true) {
    val rotation = rememberDiscRotation(isPlaying)

    Box(modifier.aspectRatio(1f)) {
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer { rotationZ = rotation.value },
        ) {
            // Gümüş kenar
            Box(Modifier.fillMaxSize().clip(CircleShape).background(TT.Disc))
            // Kapak (CD'nin üzerine basılmış gibi)
            Artwork(
                albumId,
                Modifier.fillMaxSize().padding(if (detailed) 6.dp else 2.dp),
                shape = CircleShape,
                iconScale = 0.3f,
            )
            // Orta etiket: çizgili halka + siyah göbek
            Canvas(Modifier.fillMaxSize()) {
                val c = center
                val r = size.minDimension / 2f
                val label = r * (if (detailed) 0.34f else 0.38f)
                drawCircle(TT.Disc, label, c)
                if (detailed) {
                    val ticks = 72
                    val inner = r * 0.18f
                    val outer = r * 0.30f
                    val stroke = (r * 0.012f).coerceAtLeast(1f)
                    for (i in 0 until ticks) {
                        val a = (2 * PI * i / ticks).toFloat()
                        val dx = cos(a)
                        val dy = sin(a)
                        drawLine(
                            Color.Black,
                            Offset(c.x + dx * inner, c.y + dy * inner),
                            Offset(c.x + dx * outer, c.y + dy * outer),
                            stroke,
                        )
                    }
                }
                val hub = r * (if (detailed) 0.14f else 0.2f)
                drawCircle(Color.Black, hub, c)
                // göbekteki ibre: dönüşü belli eder
                drawLine(TT.Disc, c, Offset(c.x - hub * 0.55f, c.y - hub * 0.55f), (hub * 0.12f).coerceAtLeast(1.5f), StrokeCap.Round)
                drawCircle(TT.Disc, hub * 0.2f, c)
                // ince iç kenar çizgisi
                drawCircle(Color.Black.copy(alpha = 0.35f), r - 1f, c, style = Stroke(1.2f))
            }
        }
    }
}

/** CD'nin etrafındaki ilerleme yayı. [progress] okunması çizim aşamasında olur (akıcı). */
@Composable
fun ProgressRing(progress: () -> Float, modifier: Modifier = Modifier, color: Color = TT.Accent, track: Color = TT.Line) {
    Canvas(modifier) {
        val stroke = 3.dp.toPx()
        val inset = stroke
        val start = 135f + 20f // sol altta boşluk bırak
        val sweepAll = 360f - 40f
        val arcSize = androidx.compose.ui.geometry.Size(size.width - inset * 2, size.height - inset * 2)
        val topLeft = Offset(inset, inset)
        drawArc(track, start, sweepAll, false, topLeft, arcSize, style = Stroke(1.dp.toPx()))
        drawArc(color, start, sweepAll * progress().coerceIn(0f, 1f), false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Butt))
        // boşluğun iki ucundaki işaretler
        val r = arcSize.width / 2f
        for (deg in listOf(start, start + sweepAll)) {
            val a = Math.toRadians(deg.toDouble())
            val p = Offset(center.x + (r * cos(a)).toFloat(), center.y + (r * sin(a)).toFloat())
            drawCircle(TT.LineBright, 3.dp.toPx(), p)
        }
    }
}

/** Referanstaki köşe üçgeni. */
@Composable
fun CornerTriangle(modifier: Modifier = Modifier, color: Color = TT.TextSecondary, side: Dp = 10.dp) {
    Canvas(modifier.size(side)) {
        val p = Path().apply {
            moveTo(0f, size.height)
            lineTo(0f, 0f)
            lineTo(size.width, size.height)
            close()
        }
        drawPath(p, color)
    }
}

/** Sadece çizgilerden oluşan (outline) CD. Kilit ekranı için. */
@Composable
fun OutlineDisc(isPlaying: Boolean, modifier: Modifier = Modifier, color: Color = TT.TextPrimary) {
    val rotation = rememberDiscRotation(isPlaying)
    Canvas(
        modifier
            .aspectRatio(1f)
            .graphicsLayer { rotationZ = rotation.value },
    ) {
        val c = center
        val r = size.minDimension / 2f
        val sw = 1.5.dp.toPx()
        // dış kenar ve oluklar
        drawCircle(color, r - sw, c, style = Stroke(sw * 1.6f))
        drawCircle(color.copy(alpha = 0.35f), r * 0.86f, c, style = Stroke(sw))
        drawCircle(color.copy(alpha = 0.22f), r * 0.70f, c, style = Stroke(sw))
        // dönüşü belli eden yay parçaları
        val groove = r * 0.78f
        val gTopLeft = Offset(c.x - groove, c.y - groove)
        val gSize = androidx.compose.ui.geometry.Size(groove * 2, groove * 2)
        drawArc(color.copy(alpha = 0.8f), 10f, 55f, false, gTopLeft, gSize, style = Stroke(sw * 1.4f))
        drawArc(color.copy(alpha = 0.8f), 190f, 55f, false, gTopLeft, gSize, style = Stroke(sw * 1.4f))
        // çizgili halka
        val ticks = 72
        val inner = r * 0.30f
        val outer = r * 0.46f
        for (i in 0 until ticks) {
            val a = (2 * PI * i / ticks).toFloat()
            val dx = cos(a)
            val dy = sin(a)
            drawLine(color, Offset(c.x + dx * inner, c.y + dy * inner), Offset(c.x + dx * outer, c.y + dy * outer), sw)
        }
        // göbek ve ibre
        drawCircle(color, r * 0.18f, c, style = Stroke(sw * 1.6f))
        drawLine(color, c, Offset(c.x - r * 0.13f, c.y - r * 0.13f), sw * 1.6f, StrokeCap.Round)
        drawCircle(color, r * 0.03f, c)
    }
}
