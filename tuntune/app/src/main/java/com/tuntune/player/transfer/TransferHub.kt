package com.tuntune.player.transfer

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.PowerManager
import android.provider.MediaStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.random.Random

/**
 * Wi-Fi üzerinden bilgisayardan müzik alma.
 *
 * - UDP 8766: bilgisayar "TUNTUNE_DISCOVER" yayını yapar, telefon kendini tanıtır.
 * - HTTP 8765: şarkı listesi, yükleme ve silme. Her istek 4 haneli eşleşme kodunu ister.
 *
 * Sadece transfer ekranı açıkken çalışır; ekrandan çıkınca her şey kapanır.
 */
object TransferHub {

    const val HTTP_PORT = 8765
    const val DISCOVERY_PORT = 8766
    private const val TARGET_FOLDER = "Music/TUNTUNE"
    private val AUDIO_EXTENSIONS = setOf("mp3", "m4a", "aac", "flac", "ogg", "opus", "wav")

    data class Progress(val name: String, val received: Long, val total: Long)

    data class Status(
        val running: Boolean = false,
        val address: String? = null,
        val code: String = "",
        val current: Progress? = null,
        val log: List<String> = emptyList(),
        val received: Int = 0,
        val pendingDeletes: List<Uri> = emptyList(),
        val error: String? = null,
    )

    private val _status = MutableStateFlow(Status())
    val status: StateFlow<Status> = _status.asStateFlow()

    private var appContext: Context? = null
    private var server: ServerSocket? = null
    private var discovery: DatagramSocket? = null
    private var pool: ExecutorService? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    // ------------------------------------------------------------------ Aç / kapat

    @Synchronized
    fun start(context: Context) {
        if (_status.value.running) return
        val ctx = context.applicationContext
        appContext = ctx
        val code = "%04d".format(Random.nextInt(0, 10_000))
        try {
            acquireLocks(ctx)
            val ss = ServerSocket().apply {
                reuseAddress = true
                bind(InetSocketAddress(HTTP_PORT))
            }
            server = ss
            val executor = Executors.newFixedThreadPool(4)
            pool = executor
            Thread({ acceptLoop(ss, executor) }, "tt-http").start()

            val ds = DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(DISCOVERY_PORT))
            }
            discovery = ds
            Thread({ discoveryLoop(ds) }, "tt-discovery").start()

            _status.value = Status(running = true, address = localIp()?.let { "$it:$HTTP_PORT" }, code = code)
        } catch (e: Exception) {
            stop()
            _status.value = Status(error = "Alıcı başlatılamadı: ${e.message}")
        }
    }

    @Synchronized
    fun stop() {
        try { server?.close() } catch (_: Exception) {}
        try { discovery?.close() } catch (_: Exception) {}
        pool?.shutdownNow()
        server = null
        discovery = null
        pool = null
        releaseLocks()
        _status.update { it.copy(running = false, current = null) }
    }

    fun clearPendingDeletes() = _status.update { it.copy(pendingDeletes = emptyList()) }

    private fun acquireLocks(ctx: Context) {
        val wifi = ctx.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("tuntune:discovery").apply { setReferenceCounted(false); acquire() }
        @Suppress("DEPRECATION")
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "tuntune:transfer").apply { setReferenceCounted(false); acquire() }
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tuntune:transfer").apply { setReferenceCounted(false); acquire(60 * 60 * 1000L) }
    }

    private fun releaseLocks() {
        try { multicastLock?.release() } catch (_: Exception) {}
        try { wifiLock?.release() } catch (_: Exception) {}
        try { wakeLock?.release() } catch (_: Exception) {}
        multicastLock = null
        wifiLock = null
        wakeLock = null
    }

    private fun localIp(): String? = try {
        NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback }
            .sortedByDescending { it.name.startsWith("wlan") }
            .flatMap { it.inetAddresses.toList() }
            .firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
            ?.hostAddress
    } catch (_: Exception) {
        null
    }

    private fun log(line: String) = _status.update { it.copy(log = (listOf(line) + it.log).take(40)) }

    // ------------------------------------------------------------------ Keşif (UDP)

    private fun discoveryLoop(ds: DatagramSocket) {
        val buf = ByteArray(256)
        while (!ds.isClosed) {
            try {
                val packet = DatagramPacket(buf, buf.size)
                ds.receive(packet)
                val msg = String(packet.data, 0, packet.length, Charsets.UTF_8)
                if (msg.startsWith("TUNTUNE_DISCOVER")) {
                    val reply = "TUNTUNE|${Build.MODEL}|$HTTP_PORT".toByteArray(Charsets.UTF_8)
                    ds.send(DatagramPacket(reply, reply.size, packet.address, packet.port))
                }
            } catch (_: Exception) {
                if (ds.isClosed) return
            }
        }
    }

    // ------------------------------------------------------------------ HTTP

    private fun acceptLoop(ss: ServerSocket, executor: ExecutorService) {
        while (!ss.isClosed) {
            try {
                val socket = ss.accept()
                executor.execute { handle(socket) }
            } catch (_: Exception) {
                if (ss.isClosed) return
            }
        }
    }

    private fun handle(socket: Socket) {
        socket.use { s ->
            try {
                s.soTimeout = 60_000
                val input = BufferedInputStream(s.getInputStream(), 64 * 1024)
                val out = BufferedOutputStream(s.getOutputStream())
                val requestLine = readLine(input) ?: return
                val parts = requestLine.split(" ")
                val method = parts.getOrElse(0) { "" }
                val target = parts.getOrElse(1) { "/" }
                val headers = HashMap<String, String>()
                while (true) {
                    val line = readLine(input) ?: break
                    if (line.isEmpty()) break
                    val i = line.indexOf(':')
                    if (i > 0) headers[line.substring(0, i).trim().lowercase()] = line.substring(i + 1).trim()
                }
                val path = target.substringBefore('?')
                val query = parseQuery(target.substringAfter('?', ""))

                if (headers["x-tt-code"] != _status.value.code) {
                    respond(out, 401, JSONObject().put("error", "Eşleşme kodu yanlış"))
                    return
                }
                when {
                    method == "GET" && path == "/api/info" -> respond(
                        out, 200,
                        JSONObject()
                            .put("name", Build.MODEL)
                            .put("app", "TUNTUNE")
                            .put("folder", TARGET_FOLDER),
                    )
                    method == "GET" && path == "/api/songs" -> respond(out, 200, JSONObject().put("songs", listSongs()))
                    method == "PUT" && path == "/api/upload" -> upload(input, out, headers, query)
                    method == "DELETE" && path.startsWith("/api/songs/") -> delete(out, path.removePrefix("/api/songs/"))
                    else -> respond(out, 404, JSONObject().put("error", "Bulunamadı"))
                }
            } catch (_: Exception) {
                // bağlantı koptu; bir sonraki isteği bekle
            }
        }
    }

    private fun readLine(input: InputStream): String? {
        val buf = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b == -1) return if (buf.size() == 0) null else buf.toString("UTF-8")
            if (b == '\n'.code) break
            if (b != '\r'.code) buf.write(b)
            if (buf.size() > 16 * 1024) return null
        }
        return buf.toString("UTF-8")
    }

    private fun parseQuery(q: String): Map<String, String> =
        q.split('&').filter { it.contains('=') }.associate {
            val k = it.substringBefore('=')
            val v = it.substringAfter('=')
            URLDecoder.decode(k, "UTF-8") to URLDecoder.decode(v, "UTF-8")
        }

    private fun respond(out: OutputStream, code: Int, body: JSONObject) {
        val bytes = body.toString().toByteArray(Charsets.UTF_8)
        val reason = when (code) { 200 -> "OK"; 401 -> "Unauthorized"; 404 -> "Not Found"; 409 -> "Conflict"; else -> "Error" }
        val head = "HTTP/1.1 $code $reason\r\n" +
            "Content-Type: application/json; charset=utf-8\r\n" +
            "Content-Length: ${bytes.size}\r\n" +
            "Connection: close\r\n\r\n"
        out.write(head.toByteArray(Charsets.UTF_8))
        out.write(bytes)
        out.flush()
    }

    // ------------------------------------------------------------------ İşlemler

    private fun listSongs(): JSONArray {
        val ctx = appContext ?: return JSONArray()
        val arr = JSONArray()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DISPLAY_NAME,
        )
        ctx.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection,
            "${MediaStore.Audio.Media.IS_MUSIC} != 0", null,
            "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE",
        )?.use { c ->
            while (c.moveToNext()) {
                arr.put(
                    JSONObject()
                        .put("id", c.getLong(0))
                        .put("title", c.getString(1) ?: "")
                        .put("artist", c.getString(2) ?: "")
                        .put("album", c.getString(3) ?: "")
                        .put("duration", c.getLong(4))
                        .put("size", c.getLong(5))
                        .put("filename", c.getString(6) ?: "")
                )
            }
        }
        return arr
    }

    private fun upload(input: InputStream, out: OutputStream, headers: Map<String, String>, query: Map<String, String>) {
        val ctx = appContext ?: return
        val length = headers["content-length"]?.toLongOrNull()
        val rawName = query["name"]?.substringAfterLast('/')?.substringAfterLast('\\')?.trim().orEmpty()
        val name = rawName.replace(Regex("[\\\\/:*?\"<>|]"), "_")
        val ext = name.substringAfterLast('.', "").lowercase()

        if (length == null || length <= 0 || name.isEmpty()) {
            respond(out, 400, JSONObject().put("error", "Dosya adı veya boyutu eksik"))
            return
        }
        if (ext !in AUDIO_EXTENSIONS) {
            respond(out, 400, JSONObject().put("error", "Desteklenmeyen dosya türü: .$ext"))
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            respond(out, 400, JSONObject().put("error", "Android 10 veya üstü gerekli"))
            return
        }
        // Aynı isim ve boyutta bir dosya zaten varsa atla
        if (exists(ctx, name, length)) {
            input.skipFully(length)
            log("= $name (zaten var)")
            respond(out, 200, JSONObject().put("ok", true).put("skipped", true))
            return
        }

        val resolver = ctx.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Audio.Media.DISPLAY_NAME, name)
            put(MediaStore.Audio.Media.MIME_TYPE, mimeFor(ext))
            put(MediaStore.Audio.Media.RELATIVE_PATH, TARGET_FOLDER)
            put(MediaStore.Audio.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val uri = resolver.insert(collection, values)
        if (uri == null) {
            respond(out, 500, JSONObject().put("error", "Dosya oluşturulamadı"))
            return
        }
        try {
            resolver.openOutputStream(uri)?.use { os ->
                val buf = ByteArray(64 * 1024)
                var remaining = length
                var received = 0L
                var lastReport = 0L
                while (remaining > 0) {
                    val n = input.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
                    if (n == -1) throw IllegalStateException("Bağlantı yarıda kesildi")
                    os.write(buf, 0, n)
                    remaining -= n
                    received += n
                    if (received - lastReport > 256 * 1024 || remaining == 0L) {
                        lastReport = received
                        _status.update { it.copy(current = Progress(name, received, length)) }
                    }
                }
            } ?: throw IllegalStateException("Dosya yazılamadı")
            values.clear()
            values.put(MediaStore.Audio.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            _status.update { it.copy(current = null, received = it.received + 1) }
            log("✓ $name")
            respond(out, 200, JSONObject().put("ok", true).put("id", ContentUris.parseId(uri)))
        } catch (e: Exception) {
            try { resolver.delete(uri, null, null) } catch (_: Exception) {}
            _status.update { it.copy(current = null) }
            log("✗ $name")
            throw e
        }
    }

    private fun delete(out: OutputStream, idText: String) {
        val ctx = appContext ?: return
        val id = idText.toLongOrNull()
        if (id == null) {
            respond(out, 404, JSONObject().put("error", "Geçersiz şarkı"))
            return
        }
        val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
        try {
            val rows = ctx.contentResolver.delete(uri, null, null)
            if (rows > 0) {
                log("− silindi #$id")
                respond(out, 200, JSONObject().put("ok", true))
            } else {
                respond(out, 404, JSONObject().put("error", "Şarkı bulunamadı"))
            }
        } catch (_: SecurityException) {
            // TUNTUNE'un eklemediği dosyalar için telefonda onay gerekir
            _status.update { it.copy(pendingDeletes = (it.pendingDeletes + uri).distinct()) }
            respond(out, 409, JSONObject().put("ok", false).put("needsConfirm", true).put("error", "Telefonda onay bekliyor"))
        }
    }

    private fun exists(ctx: Context, name: String, size: Long): Boolean =
        ctx.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Audio.Media._ID),
            "${MediaStore.Audio.Media.DISPLAY_NAME} = ? AND ${MediaStore.Audio.Media.SIZE} = ?",
            arrayOf(name, size.toString()),
            null,
        )?.use { it.count > 0 } ?: false

    private fun mimeFor(ext: String) = when (ext) {
        "mp3" -> "audio/mpeg"
        "m4a", "aac" -> "audio/mp4"
        "flac" -> "audio/flac"
        "ogg", "opus" -> "audio/ogg"
        "wav" -> "audio/x-wav"
        else -> "audio/*"
    }

    private fun InputStream.skipFully(count: Long) {
        var left = count
        val buf = ByteArray(64 * 1024)
        while (left > 0) {
            val n = read(buf, 0, minOf(buf.size.toLong(), left).toInt())
            if (n == -1) return
            left -= n
        }
    }
}
