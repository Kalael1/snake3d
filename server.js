import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000,
    pingTimeout: 5000,
    perMessageDeflate: false
});

const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));
app.use((req, res) => {
    const indexPath = join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send("Build in progress. Refresh soon.");
});

// ============== CONSTANTS ==============
const TICK_RATE = 20;

const players = {};

function round1(n) { return Math.round(n * 10) / 10; }

// ============== SHARED ARENA SCREEN (YouTube jukebox) ==============
const SCREEN_COOLDOWN_MS = 2 * 60 * 1000; // Global: a new video can only be set every 2 minutes
let screenVideo = null;                    // { videoId, setByName, setAt }

function parseYouTubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s; // already a raw id
    const patterns = [
        /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
        /music\.youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/
    ];
    for (const re of patterns) {
        const m = s.match(re);
        if (m) return m[1];
    }
    return null;
}

// ============== SOCKET ==============
io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

    // Bring the newcomer in sync with whatever is currently on the arena screen
    if (screenVideo) {
        socket.emit('screenVideo', {
            videoId: screenVideo.videoId,
            setByName: screenVideo.setByName,
            setAt: screenVideo.setAt,
            remainingMs: Math.max(0, SCREEN_COOLDOWN_MS - (Date.now() - screenVideo.setAt))
        });
    }

    socket.on('setScreenVideo', (data) => {
        const videoId = parseYouTubeId(data && (data.url || data.videoId));
        if (!videoId) {
            socket.emit('screenVideoRejected', { reason: 'invalid' });
            return;
        }

        const now = Date.now();
        if (screenVideo && (now - screenVideo.setAt) < SCREEN_COOLDOWN_MS) {
            socket.emit('screenVideoRejected', {
                reason: 'cooldown',
                remainingMs: SCREEN_COOLDOWN_MS - (now - screenVideo.setAt)
            });
            return;
        }

        const p = players[socket.id];
        const setByName = (p && p.name) || (data && data.name) || 'Bir oyuncu';
        screenVideo = { videoId, setByName, setAt: now };

        io.emit('screenVideo', {
            videoId,
            setByName,
            setAt: now,
            remainingMs: SCREEN_COOLDOWN_MS
        });
        console.log(`[📺] Arena screen -> ${videoId} (by ${setByName})`);
    });

    socket.on('join', (data) => {
        const name = typeof data === 'string' ? data : (data.name || 'Oyuncu');
        const skinId = typeof data === 'object' && data.skinId ? data.skinId : 'turkey';

        players[socket.id] = {
            id: socket.id,
            name: name || 'Player #' + socket.id.substring(0, 4),
            skinId,
            x: 400,
            y: 300,
            vx: 0,
            vy: 0,
            score: 0
        };

        socket.emit('init', { id: socket.id });
    });

    socket.on('playerInput', (data) => {
        const p = players[socket.id];
        if (!p || !data) return;
        if (typeof data.x === 'number') {
            p.x = round1(data.x);
            p.y = round1(data.y || 0);
            p.vx = round1(data.vx || 0);
            p.vy = round1(data.vy || 0);
            if (typeof data.score === 'number') p.score = data.score;
            if (data.skinId) p.skinId = data.skinId;
        }
    });

    socket.on('chatMessage', (data) => {
        const p = players[socket.id];
        if (!p || !data) return;
        const text = typeof data === 'string' ? data : (data.text || '');
        const isEmoji = typeof data === 'object' ? !!data.isEmoji : false;
        if (!text) return;

        io.emit('chatReceived', { id: socket.id, name: p.name, text: text.substring(0, 60), isEmoji });
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// ============== GAME LOOP ==============
const TICK_MS = 1000 / TICK_RATE;

setInterval(() => {
    try {
        // 1. BROADCAST SNAPSHOT
        // Use normal emit instead of volatile to prevent packet drops and ensure delivery
        io.emit('state', players);
    } catch (err) {
        console.error("Error in game loop broadcast:", err);
    }
}, TICK_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Countryballs Server Active on port ${PORT}`);
});
