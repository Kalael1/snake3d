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

// Game Constants
const ARENA_SIZE = 500;
const MAX_FOODS = 500;

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

        players[socket.id] = {
            id: socket.id,
            name: name || 'Yılan #' + socket.id.substring(0, 4),
            x: spawnX,
            z: spawnZ,
            angle: 0,
            isBoosting: false,
            score: 0,
            colorHue: Math.random(),
            body: []
        };

        for (let i = 1; i <= 8; i++) {
            players[socket.id].body.push({
                x: spawnX,
                z: spawnZ - i * 1.3,
                angle: 0
            });
        }

        socket.emit('init', {
            id: socket.id,
            arenaSize: ARENA_SIZE,
            foods: foods
        });
    });

    // Receive Synced Head Position & Body from Client
    socket.on('playerInput', (data) => {
        const player = players[socket.id];
        if (!player || !data) return;

        if (typeof data.x === 'number' && typeof data.z === 'number') {
            player.x = data.x;
            player.z = data.z;
            player.angle = data.angle || 0;
            player.isBoosting = !!data.isBoosting;

            if (Array.isArray(data.body)) {
                player.body = data.body;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        const player = players[socket.id];
        if (player) {
            if (player.body) {
                player.body.forEach(seg => {
                    foods.push({
                        id: 'food_' + Math.random().toString(36).substring(2, 9),
                        x: seg.x,
                        z: seg.z,
                        color: foodColors[Math.floor(Math.random() * foodColors.length)]
                    });
                });
            }
            delete players[socket.id];
        }
    });
});

// Server Tick Loop (30 Ticks/sec)
const TICK_RATE = 30;

setInterval(() => {
    const playerIds = Object.keys(players);

    // 1. Check Food Collisions & Wall Collisions for Each Active Player
    playerIds.forEach(id => {
        const p = players[id];
        if (!p) return;

        // Boundary Check (Die if hit wall)
        const limit = ARENA_SIZE / 2 - 2.0;
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
            io.to(id).emit('gameOver', { reason: 'Harita sınırına çarptın!' });
            delete players[id];
            return;
        }

        // Food Eating Check
        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            const dx = p.x - f.x;
            const dz = p.z - f.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 2.5) { // 2.5 radius threshold for eating food
                p.score += 10;
                
                // Respawn eaten food
                foods.splice(i, 1);
                foods.push(spawnFood());
                
                // Notify client to grow local snake
                io.to(id).emit('foodEaten', { score: p.score });
            }
        }
    });

    // 2. Snake vs Snake Collision (Snake.io mechanic)
    const aliveIds = Object.keys(players);
    aliveIds.forEach(idA => {
        const pA = players[idA];
        if (!pA) return;

        aliveIds.forEach(idB => {
            if (idA === idB) return; // Skip self collision
            const pB = players[idB];
            if (!pB || !pB.body) return;

            // Check if head of Player A collides with any body segment of Player B
            for (const segB of pB.body) {
                const dx = pA.x - segB.x;
                const dz = pA.z - segB.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 2.0) { // Collision threshold
                    // Player A dies!
                    io.to(idA).emit('gameOver', { reason: `${pB.name} oyuncusuna çarptın!` });
                    
                    // Spawn food where Player A died
                    if (pA.body) {
                        pA.body.forEach(seg => {
                            foods.push({
                                id: 'food_' + Math.random().toString(36).substring(2, 9),
                                x: seg.x,
                                z: seg.z,
                                color: foodColors[Math.floor(Math.random() * foodColors.length)]
                            });
                        });
                    }

                    delete players[idA];
                    break;
                }
            }
        });
    });

    // 3. Broadcast State to All Clients
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
