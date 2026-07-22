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
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    perMessageDeflate: false
});

const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
    const indexPath = join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Build in progress. Please refresh.");
    }
});

// ============== GAME CONSTANTS ==============
const ARENA_SIZE = 500;
const MAX_FOODS = 120;        // DOWN from 500 — massive perf gain
const TICK_RATE = 15;          // DOWN from 30 — halves network load
const DESIRED_ROOM_SIZE = 5;   // DOWN from 8 — fewer entities

const botNames = ['CyberViper', 'ShadowSnake', 'Bot Efe', 'Bot Can', 'AlphaCobra'];
const botSkins = ['classic', 'neon', 'fire', 'golden', 'shadow'];

const players = {};
let foods = [];
const foodColors = [0xff0055, 0x00ffcc, 0xffff00, 0xaa00ff, 0xff8800, 0x00ffaa];

function round1(num) {
    return Math.round(num * 10) / 10;
}

function spawnFood(id = null, value = 2, isBig = false) {
    const halfSize = (ARENA_SIZE / 2) - 10;
    return {
        id: id || 'f_' + Math.random().toString(36).substring(2, 7),
        x: round1((Math.random() - 0.5) * 2 * halfSize),
        z: round1((Math.random() - 0.5) * 2 * halfSize),
        color: foodColors[Math.floor(Math.random() * foodColors.length)],
        value: value,
        isBig: isBig
    };
}

for (let i = 0; i < MAX_FOODS; i++) {
    foods.push(spawnFood());
}

// ============== BOT MANAGEMENT ==============
function getRealPlayersCount() {
    let count = 0;
    for (const id in players) { if (!players[id].isBot) count++; }
    return count;
}
function getBotPlayersCount() {
    let count = 0;
    for (const id in players) { if (players[id].isBot) count++; }
    return count;
}

function spawnBot() {
    const botId = 'bot_' + Math.random().toString(36).substring(2, 7);
    const halfSize = (ARENA_SIZE / 2) - 30;
    players[botId] = {
        id: botId,
        isBot: true,
        name: `🤖 ${botNames[Math.floor(Math.random() * botNames.length)]}`,
        skinId: botSkins[Math.floor(Math.random() * botSkins.length)],
        x: round1((Math.random() - 0.5) * 2 * halfSize),
        z: round1((Math.random() - 0.5) * 2 * halfSize),
        angle: Math.random() * Math.PI * 2,
        isBoosting: false,
        score: Math.floor(Math.random() * 40),
        _botTimer: 0
    };
}

function removeOneBot() {
    for (const id in players) {
        if (players[id].isBot) { delete players[id]; return; }
    }
}

function balanceBots() {
    const needed = Math.max(0, DESIRED_ROOM_SIZE - getRealPlayersCount());
    const current = getBotPlayersCount();
    if (current < needed) {
        for (let i = 0; i < needed - current; i++) spawnBot();
    } else if (current > needed) {
        for (let i = 0; i < current - needed; i++) removeOneBot();
    }
}

// ============== SOCKET CONNECTIONS ==============
io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    socket.on('join', (data) => {
        const name = typeof data === 'string' ? data : (data.name || 'Oyuncu');
        const skinId = typeof data === 'object' && data.skinId ? data.skinId : 'classic';
        const halfSize = (ARENA_SIZE / 2) - 20;

        players[socket.id] = {
            id: socket.id,
            isBot: false,
            name: name || 'Yılan #' + socket.id.substring(0, 4),
            skinId: skinId,
            x: round1((Math.random() - 0.5) * 2 * halfSize),
            z: round1((Math.random() - 0.5) * 2 * halfSize),
            angle: 0,
            isBoosting: false,
            score: 0
        };

        balanceBots();

        socket.emit('init', {
            id: socket.id,
            arenaSize: ARENA_SIZE,
            foods: foods
        });
    });

    socket.on('playerInput', (data) => {
        const player = players[socket.id];
        if (!player || !data) return;
        if (typeof data.x === 'number' && typeof data.z === 'number') {
            player.x = round1(data.x);
            player.z = round1(data.z);
            player.angle = round1(data.angle || 0);
            player.isBoosting = !!data.isBoosting;
            if (data.skinId) player.skinId = data.skinId;
        }
    });

    socket.on('chatMessage', (data) => {
        const player = players[socket.id];
        if (!player || !data || !data.text) return;
        io.emit('chatReceived', {
            id: socket.id,
            name: player.name,
            text: data.text.substring(0, 60),
            isEmoji: !!data.isEmoji
        });
    });

    socket.on('eatFood', (data) => {
        const player = players[socket.id];
        if (!player || !data || !data.foodId) return;
        const idx = foods.findIndex(f => f.id === data.foodId);
        if (idx !== -1) {
            player.score += foods[idx].value || 2;
            const newFood = spawnFood();
            foods.splice(idx, 1);
            foods.push(newFood);
            io.emit('foodRemoved', { foodId: data.foodId, newFood: newFood });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Disconnected: ${socket.id}`);
        const player = players[socket.id];
        if (player) {
            const dropCount = Math.min(12, 5 + Math.floor((player.score || 0) / 50));
            for (let i = 0; i < dropCount; i++) {
                const drop = spawnFood(null, 15, true);
                drop.x = round1(player.x + (Math.random() - 0.5) * 15);
                drop.z = round1(player.z + (Math.random() - 0.5) * 15);
                foods.push(drop);
                io.emit('foodRemoved', { foodId: null, newFood: drop });
            }
            delete players[socket.id];
        }
        balanceBots();
    });
});

balanceBots();

// ============== GAME LOOP (15 TICKS/SEC) ==============
const TICK_MS = 1000 / TICK_RATE;
const BOT_SPEED = 18;

setInterval(() => {
    // 1. BOT AI
    for (const id in players) {
        const bot = players[id];
        if (!bot.isBot) continue;

        bot._botTimer = (bot._botTimer || 0) + 1;
        if (bot._botTimer > 30) {
            bot._botTimer = 0;
            const distFromCenter = Math.sqrt(bot.x * bot.x + bot.z * bot.z);
            if (distFromCenter > 180) {
                bot.angle = Math.atan2(-bot.x, -bot.z);
            } else {
                bot.angle += (Math.random() - 0.5) * 1.5;
            }
        }

        const dt = TICK_MS / 1000;
        bot.x = round1(bot.x + Math.sin(bot.angle) * BOT_SPEED * dt);
        bot.z = round1(bot.z + Math.cos(bot.angle) * BOT_SPEED * dt);

        // Bot food eat (check only nearest 20 foods for perf)
        for (let i = 0, checked = 0; i < foods.length && checked < 20; i++) {
            const f = foods[i];
            const dx = bot.x - f.x;
            const dz = bot.z - f.z;
            if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue;
            checked++;
            if (dx * dx + dz * dz < 9.0) {
                bot.score += f.value || 2;
                const newFood = spawnFood();
                const eatenId = f.id;
                foods.splice(i, 1);
                foods.push(newFood);
                io.emit('foodRemoved', { foodId: eatenId, newFood: newFood });
                break;
            }
        }
    }

    // 2. WALL DEATH
    const limit = ARENA_SIZE / 2 - 5.0;
    for (const id in players) {
        const p = players[id];
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            if (!p.isBot) io.to(id).emit('gameOver', { reason: 'Harita sınırına çarptın!' });
            delete players[id];
            balanceBots();
        }
    }

    // 3. SNAKE VS SNAKE (simple head-head only for perf)
    const ids = Object.keys(players);
    for (let a = 0; a < ids.length; a++) {
        const pA = players[ids[a]];
        if (!pA) continue;
        for (let b = a + 1; b < ids.length; b++) {
            const pB = players[ids[b]];
            if (!pB) continue;
            const dx = pA.x - pB.x;
            const dz = pA.z - pB.z;
            if (dx * dx + dz * dz < 5.0) {
                if (!pA.isBot) io.to(ids[a]).emit('gameOver', { reason: `${pB.name} oyuncusuna çarptın!` });
                if (!pB.isBot) io.to(ids[b]).emit('gameOver', { reason: `${pA.name} oyuncusuna çarptın!` });
                delete players[ids[a]];
                delete players[ids[b]];
                balanceBots();
            }
        }
    }

    // 4. BROADCAST STATE
    io.volatile.emit('gameState', { players });
}, TICK_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Snake3D Server Active on port ${PORT} (${TICK_RATE} ticks/sec, ${MAX_FOODS} foods, ${DESIRED_ROOM_SIZE} room size)`);
});
