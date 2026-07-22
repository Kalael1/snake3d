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
    }
});

// Serve static built files from 'dist' directory
const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback catch-all for SPA routing
app.use((req, res) => {
    const indexPath = join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Build in progress or 'dist' folder not ready. Please refresh in a few seconds!");
    }
});

// Game State
const ARENA_SIZE = 500;
const MAX_FOODS = 500;
const BASE_SPEED = 18;
const BOOST_SPEED = 32;

const players = {};
const foods = [];
const foodColors = [0xff0055, 0x00ffcc, 0xffff00, 0xaa00ff, 0xff8800, 0x00ffaa];

// Spawn Initial Foods
function spawnFood(id = null) {
    const halfSize = (ARENA_SIZE / 2) - 8;
    return {
        id: id || 'food_' + Math.random().toString(36).substring(2, 9),
        x: (Math.random() - 0.5) * 2 * halfSize,
        z: (Math.random() - 0.5) * 2 * halfSize,
        color: foodColors[Math.floor(Math.random() * foodColors.length)]
    };
}

for (let i = 0; i < MAX_FOODS; i++) {
    foods.push(spawnFood());
}

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

    socket.on('join', (name) => {
        const halfSize = (ARENA_SIZE / 2) - 20;
        const spawnX = (Math.random() - 0.5) * 2 * halfSize;
        const spawnZ = (Math.random() - 0.5) * 2 * halfSize;
        const hue = Math.random();

        players[socket.id] = {
            id: socket.id,
            name: name || 'Yılan #' + socket.id.substring(0, 4),
            x: spawnX,
            z: spawnZ,
            angle: Math.random() * Math.PI * 2,
            targetAngle: 0,
            speed: BASE_SPEED,
            isBoosting: false,
            score: 0,
            colorHue: hue,
            body: [],
            length: 8
        };

        for (let i = 1; i <= 8; i++) {
            players[socket.id].body.push({
                x: spawnX,
                z: spawnZ - i * 1.3,
                angle: players[socket.id].angle
            });
        }

        socket.emit('init', {
            id: socket.id,
            arenaSize: ARENA_SIZE,
            foods: foods
        });
    });

    socket.on('playerInput', (data) => {
        const player = players[socket.id];
        if (!player) return;

        if (typeof data.targetAngle === 'number') {
            player.targetAngle = data.targetAngle;
        }
        player.isBoosting = !!data.isBoosting;
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        const player = players[socket.id];
        if (player) {
            player.body.forEach(seg => {
                foods.push({
                    id: 'food_' + Math.random().toString(36).substring(2, 9),
                    x: seg.x,
                    z: seg.z,
                    color: foodColors[Math.floor(Math.random() * foodColors.length)]
                });
            });
            delete players[socket.id];
        }
    });
});

// Authoritative Server Game Loop (30 Ticks/sec)
const TICK_RATE = 30;
const DELTA = 1 / TICK_RATE;

setInterval(() => {
    const playerIds = Object.keys(players);

    playerIds.forEach(id => {
        const p = players[id];
        if (!p) return;

        let angleDiff = p.targetAngle - p.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        p.angle += angleDiff * Math.min(1, 8 * DELTA);

        const speed = p.isBoosting ? BOOST_SPEED : BASE_SPEED;
        const moveDist = speed * DELTA;
        p.x += Math.sin(p.angle) * moveDist;
        p.z += Math.cos(p.angle) * moveDist;

        let prevX = p.x;
        let prevZ = p.z;
        let prevAngle = p.angle;

        const segmentSpacing = 1.3;
        for (let i = 0; i < p.body.length; i++) {
            const seg = p.body[i];
            const dx = prevX - seg.x;
            const dz = prevZ - seg.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > segmentSpacing) {
                const angle = Math.atan2(dx, dz);
                seg.x = prevX - Math.sin(angle) * segmentSpacing;
                seg.z = prevZ - Math.cos(angle) * segmentSpacing;
                seg.angle = angle;
            }

            prevX = seg.x;
            prevZ = seg.z;
            prevAngle = seg.angle;
        }

        const limit = ARENA_SIZE / 2 - 2.0;
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            io.to(id).emit('gameOver', { reason: 'Harita sınırına çarptın!' });
            delete players[id];
            return;
        }

        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            const dx = p.x - f.x;
            const dz = p.z - f.z;
            if (Math.sqrt(dx * dx + dz * dz) < 2.2) {
                p.score += 10;
                p.length++;
                const lastSeg = p.body[p.body.length - 1] || { x: p.x, z: p.z, angle: p.angle };
                p.body.push({ x: lastSeg.x, z: lastSeg.z, angle: lastSeg.angle });

                foods.splice(i, 1);
                foods.push(spawnFood());
            }
        }
    });

    const aliveIds = Object.keys(players);
    aliveIds.forEach(idA => {
        const pA = players[idA];
        if (!pA) return;

        aliveIds.forEach(idB => {
            if (idA === idB) return;
            const pB = players[idB];
            if (!pB) return;

            for (const segB of pB.body) {
                const dx = pA.x - segB.x;
                const dz = pA.z - segB.z;
                if (Math.sqrt(dx * dx + dz * dz) < 2.0) {
                    io.to(idA).emit('gameOver', { reason: `${pB.name} oyuncusuna çarptın!` });
                    
                    pA.body.forEach(seg => {
                        foods.push({
                            id: 'food_' + Math.random().toString(36).substring(2, 9),
                            x: seg.x,
                            z: seg.z,
                            color: foodColors[Math.floor(Math.random() * foodColors.length)]
                        });
                    });

                    delete players[idA];
                    break;
                }
            }
        });
    });

    io.emit('gameState', {
        players: players,
        foods: foods
    });
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🚀 Snake.io 3D Multiplayer Sunucusu Hazır!`);
    console.log(`🌐 Bağlantı adresi: http://localhost:${PORT}`);
    console.log(`================================================`);
});
