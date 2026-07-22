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
        res.status(404).send("Build in progress or 'dist' folder not ready. Please refresh in a few seconds!");
    }
});

// Game Constants
const ARENA_SIZE = 500;
const MAX_FOODS = 500;

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

io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

    socket.on('join', (data) => {
        const name = typeof data === 'string' ? data : (data.name || 'Oyuncu');
        const skinId = typeof data === 'object' && data.skinId ? data.skinId : 'classic';

        const halfSize = (ARENA_SIZE / 2) - 20;
        const spawnX = round1((Math.random() - 0.5) * 2 * halfSize);
        const spawnZ = round1((Math.random() - 0.5) * 2 * halfSize);

        players[socket.id] = {
            id: socket.id,
            name: name || 'Yılan #' + socket.id.substring(0, 4),
            skinId: skinId,
            x: spawnX,
            z: spawnZ,
            angle: 0,
            isBoosting: false,
            score: 0
        };

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
            const eaten = foods[idx];
            const gainedScore = eaten.value || 2;
            player.score += gainedScore;

            const newFood = spawnFood();
            foods.splice(idx, 1);
            foods.push(newFood);

            io.emit('foodRemoved', { foodId: data.foodId, newFood: newFood });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        const player = players[socket.id];
        if (player) {
            // Drop food on death
            const dropCount = Math.min(20, 8 + Math.floor((player.score || 0) / 35));
            for (let i = 0; i < dropCount; i++) {
                const drop = {
                    id: 'f_' + Math.random().toString(36).substring(2, 7),
                    x: round1(player.x + (Math.random() - 0.5) * 15),
                    z: round1(player.z + (Math.random() - 0.5) * 15),
                    color: foodColors[Math.floor(Math.random() * foodColors.length)],
                    value: 15,
                    isBig: true
                };
                foods.push(drop);
                io.emit('foodRemoved', { foodId: null, newFood: drop });
            }
            delete players[socket.id];
        }
    });
});

// High-Frequency Ultra-Light Volatile Network Tick (30 Ticks/sec)
const TICK_RATE = 30;

setInterval(() => {
    const playerIds = Object.keys(players);

    playerIds.forEach(id => {
        const p = players[id];
        if (!p) return;

        const limit = ARENA_SIZE / 2 - 2.0;
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            io.to(id).emit('gameOver', { reason: 'Harita sınırına çarptın!' });
            delete players[id];
        }
    });

    // Snake vs Snake Collision
    const aliveIds = Object.keys(players);
    aliveIds.forEach(idA => {
        const pA = players[idA];
        if (!pA) return;

        aliveIds.forEach(idB => {
            if (idA === idB) return;
            const pB = players[idB];
            if (!pB) return;

            const dx = pA.x - pB.x;
            const dz = pA.z - pB.z;
            if (Math.sqrt(dx * dx + dz * dz) < 2.0) {
                io.to(idA).emit('gameOver', { reason: `${pB.name} oyuncusuna çarptın!` });
                delete players[idA];
            }
        });
    });

    // Ultra-light snapshot (skips body segments entirely, saving 95% payload overhead!)
    io.volatile.emit('gameState', {
        players: players
    });
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🚀 Snake.io 3D Slither-Style Ultra-Light Sunucu Hazır!`);
    console.log(`🌐 Bağlantı adresi: http://localhost:${PORT}`);
    console.log(`================================================`);
});
