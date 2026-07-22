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
const ARENA_SIZE = 500;
const TICK_RATE = 15;
const DESIRED_ROOM_SIZE = 0; // Bots removed per user request!

const players = {};

function round1(n) { return Math.round(n * 10) / 10; }

// ============== SOCKET ==============
io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

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
    // 1. WALL DEATH
    for (const id in players) {
        const p = players[id];
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            io.to(id).emit('gameOver', { reason: '💥 Duvara çarptın!' });
            delete players[id];
        }
    }

    // 2. CAR VS CAR COLLISION
    const ids = Object.keys(players);
    for (let a = 0; a < ids.length; a++) {
        const pA = players[ids[a]];
        if (!pA) continue;
        for (let b = a + 1; b < ids.length; b++) {
            const pB = players[ids[b]];
            if (!pB) continue;
            const dx = pA.x - pB.x;
            const dz = pA.z - pB.z;
            if (dx * dx + dz * dz < 10.0) {
                const dieA = pA.driftScore <= pB.driftScore;
                const dieB = pB.driftScore <= pA.driftScore;

                if (dieA) {
                    io.to(ids[a]).emit('gameOver', { reason: `💥 ${pB.name} ile çarpıştın!` });
                    delete players[ids[a]];
                }
                if (dieB && !dieA) {
                    io.to(ids[b]).emit('gameOver', { reason: `💥 ${pA.name} ile çarpıştın!` });
                    delete players[ids[b]];
                }
            }
        }
    }

    // 3. BROADCAST SNAPSHOT
    io.volatile.emit('gameState', { players });
}, TICK_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🏎️ Drift.io Server Active (No Bots) on port ${PORT}`);
});
