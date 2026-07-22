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
const DESIRED_ROOM_SIZE = 5;
const BOT_SPEED = 25;

const botNames = ['DriftKing', 'TurboBot', 'Bot Efe', 'Bot Can', 'AlphaDrift'];
const botSkins = ['red_classic', 'neon_blue', 'sunset_orange', 'toxic_green', 'cyberpunk_purple'];

const players = {};

function round1(n) { return Math.round(n * 10) / 10; }

// ============== BOT MANAGEMENT ==============
function getRealCount() { let c = 0; for (const id in players) if (!players[id].isBot) c++; return c; }
function getBotCount() { let c = 0; for (const id in players) if (players[id].isBot) c++; return c; }

function spawnBot() {
    const id = 'bot_' + Math.random().toString(36).substring(2, 7);
    const half = (ARENA_SIZE / 2) - 30;
    players[id] = {
        id, isBot: true,
        name: `🤖 ${botNames[Math.floor(Math.random() * botNames.length)]}`,
        skinId: botSkins[Math.floor(Math.random() * botSkins.length)],
        x: round1((Math.random() - 0.5) * 2 * half),
        z: round1((Math.random() - 0.5) * 2 * half),
        angle: Math.random() * Math.PI * 2,
        driftScore: Math.floor(Math.random() * 100),
        _botTimer: 0,
        _botTurnTarget: Math.random() * Math.PI * 2
    };
}

function removeOneBot() { for (const id in players) if (players[id].isBot) { delete players[id]; return; } }

function balanceBots() {
    const needed = Math.max(0, DESIRED_ROOM_SIZE - getRealCount());
    const current = getBotCount();
    if (current < needed) for (let i = 0; i < needed - current; i++) spawnBot();
    else if (current > needed) for (let i = 0; i < current - needed; i++) removeOneBot();
}

// ============== SOCKET ==============
io.on('connection', (socket) => {
    console.log(`[+] ${socket.id}`);

    socket.on('join', (data) => {
        const name = typeof data === 'string' ? data : (data.name || 'Oyuncu');
        const skinId = typeof data === 'object' && data.skinId ? data.skinId : 'red_classic';
        const half = (ARENA_SIZE / 2) - 30;

        players[socket.id] = {
            id: socket.id, isBot: false,
            name: name || 'Driver #' + socket.id.substring(0, 4),
            skinId,
            x: round1((Math.random() - 0.5) * 2 * half),
            z: round1((Math.random() - 0.5) * 2 * half),
            angle: Math.random() * Math.PI * 2,
            driftScore: 0
        };
        balanceBots();
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
        console.log(`[-] ${socket.id}`);
        delete players[socket.id];
        balanceBots();
    });
});

balanceBots();

// ============== GAME LOOP ==============
const TICK_MS = 1000 / TICK_RATE;
const limit = ARENA_SIZE / 2 - 5;

setInterval(() => {
    // 1. BOT AI — simple driving + random turns
    for (const id in players) {
        const bot = players[id];
        if (!bot.isBot) continue;

        bot._botTimer = (bot._botTimer || 0) + 1;

        // Change direction periodically
        if (bot._botTimer > 20 + Math.random() * 40) {
            bot._botTimer = 0;
            const distFromCenter = Math.sqrt(bot.x * bot.x + bot.z * bot.z);
            if (distFromCenter > 180) {
                bot._botTurnTarget = Math.atan2(-bot.x, -bot.z);
            } else {
                bot._botTurnTarget = bot.angle + (Math.random() - 0.5) * 2.5;
            }
        }

        // Smooth steer toward target
        let diff = bot._botTurnTarget - bot.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        bot.angle += diff * 0.15;

        const dt = TICK_MS / 1000;
        bot.x = round1(bot.x + Math.sin(bot.angle) * BOT_SPEED * dt);
        bot.z = round1(bot.z + Math.cos(bot.angle) * BOT_SPEED * dt);

        // Bot drift score simulation
        if (Math.abs(diff) > 0.15) bot.driftScore += Math.floor(Math.abs(diff) * 10);
    }

    // 2. WALL DEATH
    for (const id in players) {
        const p = players[id];
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            if (!p.isBot) io.to(id).emit('gameOver', { reason: '💥 Duvara çarptın!' });
            delete players[id];
            balanceBots();
        }
    }

    // 3. CAR VS CAR COLLISION
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
                // Lower scorer dies
                const dieA = pA.driftScore <= pB.driftScore;
                const dieB = pB.driftScore <= pA.driftScore;

                if (dieA) {
                    if (!pA.isBot) io.to(ids[a]).emit('gameOver', { reason: `💥 ${pB.name} ile çarpıştın!` });
                    delete players[ids[a]];
                }
                if (dieB && !dieA) { // Only if A didn't die (avoid double death when equal)
                    if (!pB.isBot) io.to(ids[b]).emit('gameOver', { reason: `💥 ${pA.name} ile çarpıştın!` });
                    delete players[ids[b]];
                }
                balanceBots();
            }
        }
    }

    // 4. BROADCAST
    io.volatile.emit('gameState', { players });
}, TICK_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🏎️ Drift.io Server Active on port ${PORT} (${TICK_RATE} ticks/sec)`);
});
