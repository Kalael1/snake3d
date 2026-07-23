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
const ARENA_SIZE = 2000;
const TICK_RATE = 15;

const players = {};
const activeTrails = []; // { id, playerId, x, z, angle, age }

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
        const setByName = (p && p.name) || (data && data.name) || 'Bir sürücü';
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
        const skinId = typeof data === 'object' && data.skinId ? data.skinId : 'sport';
        const half = (ARENA_SIZE / 2) - 30;

        players[socket.id] = {
            id: socket.id,
            isBot: false,
            name: name || 'Driver #' + socket.id.substring(0, 4),
            skinId,
            x: round1((Math.random() - 0.5) * 2 * half),
            z: round1((Math.random() - 0.5) * 2 * half),
            angle: Math.random() * Math.PI * 2,
            driftScore: 0
        };

        socket.emit('init', { id: socket.id, arenaSize: ARENA_SIZE });
    });

    socket.on('playerInput', (data) => {
        const p = players[socket.id];
        if (!p || !data) return;
        if (typeof data.x === 'number') {
            p.x = round1(data.x);
            p.z = round1(data.z);
            p.angle = round1(data.angle || 0);
            if (typeof data.driftScore === 'number') p.driftScore = data.driftScore;
            if (data.skinId) p.skinId = data.skinId;

            // Handle Tron trail emission from player
            if (data.emittingTrail) {
                const seg = {
                    id: socket.id + '_' + Date.now(),
                    playerId: socket.id,
                    x: p.x,
                    z: p.z,
                    angle: p.angle,
                    age: 0
                };
                activeTrails.push(seg);
                socket.broadcast.emit('trailEmitted', seg);
            }
        }
    });

    socket.on('chatMessage', (data) => {
        const p = players[socket.id];
        if (!p || !data || !data.text) return;
        io.emit('chatReceived', { id: socket.id, name: p.name, text: data.text.substring(0, 60), isEmoji: !!data.isEmoji });
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// ============== GAME LOOP ==============
const TICK_MS = 1000 / TICK_RATE;
const limit = ARENA_SIZE / 2 - 5;

setInterval(() => {
    const dt = TICK_MS / 1000;

    // Age server-side trails
    for (let i = activeTrails.length - 1; i >= 0; i--) {
        activeTrails[i].age += dt;
        if (activeTrails[i].age > 4.0) {
            activeTrails.splice(i, 1);
        }
    }

    // 1. WALL DEATH
    for (const id in players) {
        const p = players[id];
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            io.to(id).emit('gameOver', { reason: '💥 Duvara çarptın!' });
            delete players[id];
        }
    }

    // 2. TRON LIGHT TRAIL COLLISION
    for (const id in players) {
        const p = players[id];
        if (!p) continue;

        for (let i = 0; i < activeTrails.length; i++) {
            const seg = activeTrails[i];
            if (seg.playerId === id && seg.age < 0.8) continue; // Don't hit your own fresh trail

            const dx = p.x - seg.x;
            const dz = p.z - seg.z;
            if (dx * dx + dz * dz < 5.0) { // Collision radius ~2.2 units
                const owner = players[seg.playerId];
                const killerName = owner ? owner.name : 'Tron Neon İzi';
                
                io.to(id).emit('gameOver', { reason: `⚡ ${killerName}'nin Tron Neon İzi'ne çarptın ve patladın!` });
                if (owner) owner.driftScore += 300; // Bonus score for killing player with trail!

                delete players[id];
                break;
            }
        }
    }

    // 3. BROADCAST SNAPSHOT
    io.volatile.emit('gameState', { players });
}, TICK_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`⚡ Tron.io Server Active on port ${PORT}`);
});
