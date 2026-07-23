import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { SpyfallGame } from './spyfallGame.js';

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
const spyfallGame = new SpyfallGame(
    io,
    (room) => Array.from(io.sockets.adapter.rooms.get(room) || []),
    (id) => players[id] || { name: 'Oyuncu' }
);

const footballState = { ball: { x: 700, y: 400, vx: 0, vy: 0 }, redScore: 0, blueScore: 0 };
const BALL_RADIUS = 25;
const PLAYER_RADIUS = 30;

function round1(n) { return Math.round(n * 10) / 10; }

// ============== SHARED ARENA SCREEN (YouTube jukebox) ==============
const SCREEN_COOLDOWN_MS = 2 * 60 * 1000; // Global: a new video can only be set every 2 minutes
let screenVideo = null;                    // { videoId, setByName, setAt }

const STATE_FILE = join(__dirname, 'server-state.json');
try {
    if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf8');
        screenVideo = JSON.parse(data).screenVideo;
        if (screenVideo) {
            // Adjust setAt so the cooldown doesn't reset to 0 exactly, but it keeps the video
            // If it's been more than 2 minutes, we can just reset setAt to Date.now() - cooldown
            const now = Date.now();
            if (now - screenVideo.setAt > SCREEN_COOLDOWN_MS) {
                screenVideo.setAt = now - SCREEN_COOLDOWN_MS;
            }
        }
    }
} catch (e) {
    console.error('Failed to load server state:', e);
}

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

        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify({ screenVideo }));
        } catch (e) {
            console.error('Failed to save server state:', e);
        }

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
        const hatId = typeof data === 'object' && data.hatId ? data.hatId : 'none';
        const glassesId = typeof data === 'object' && data.glassesId ? data.glassesId : 'none';

        players[socket.id] = {
            id: socket.id,
            name: name || 'Player #' + socket.id.substring(0, 4),
            skinId,
            hatId,
            glassesId,
            expression: 'normal',
            room: 'lobby',
            x: 400,
            y: 300,
            vx: 0,
            vy: 0,
            score: 0
        };

        socket.join('lobby');
        socket.emit('init', { id: socket.id });
    });

    socket.on('changeRoom', (newRoom) => {
        const p = players[socket.id];
        if (!p) return;
        
        if (p.room === 'spyfall' && newRoom !== 'spyfall') {
            spyfallGame.playerLeft(socket.id);
        }
        
        socket.leave(p.room);
        p.room = newRoom;
        socket.join(newRoom);
        
        if (newRoom === 'spyfall') {
            spyfallGame.broadcast();
        }
    });
    
    socket.on('spyfall_action', (data) => {
        if (!data) return;
        if (data.action === 'start') spyfallGame.start();
        else if (data.action === 'ask') spyfallGame.askQuestion(socket.id, data.toId, data.question);
        else if (data.action === 'vote') spyfallGame.voteEliminate(socket.id, data.targetId);
        else if (data.action === 'night_kill') spyfallGame.spyKill(socket.id, data.targetId);
        else if (data.action === 'force_night') spyfallGame.triggerNight();
    });

    socket.on('joinFootballTeam', (team) => {
        const p = players[socket.id];
        if (p) {
            p.team = team;
            // Place player in their team's half
            p.x = team === 'red' ? 350 : 1050;
            p.y = 400;
        }
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
            if (data.hatId) p.hatId = data.hatId;
            if (data.glassesId) p.glassesId = data.glassesId;
            if (data.expression) p.expression = data.expression;
        }
    });

    socket.on('chatMessage', (data) => {
        const p = players[socket.id];
        if (!p || !data) return;
        const text = typeof data === 'string' ? data : (data.text || '');
        const isEmoji = typeof data === 'object' ? !!data.isEmoji : false;
        if (!text) return;

        io.to(p.room).emit('chatReceived', { id: socket.id, name: p.name, text: text.substring(0, 60), isEmoji });
    });

    socket.on('playerAction', (data) => {
        const p = players[socket.id];
        if (!p || !data || !data.action) return;
        // Broadcast the action to everyone in the same room
        socket.to(p.room).emit('playerAction', { id: socket.id, action: data.action });
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        spyfallGame.playerLeft(socket.id);
        delete players[socket.id];
    });
});

// ============== GAME LOOP ==============
const TICK_MS = 1000 / TICK_RATE;

setInterval(() => {
    try {
        const rooms = ['lobby', 'beach', 'coffeeshop', 'disco', 'spyfall', 'football'];
        rooms.forEach(room => {
            const roomPlayers = {};
            for (let id in players) {
                if (players[id].room === room) {
                    roomPlayers[id] = players[id];
                }
            }
            
            if (room === 'football') {
                const fPlayers = Object.values(roomPlayers);
                if (fPlayers.length > 0) {
                    let ball = footballState.ball;
                    ball.vx *= 0.98;
                    ball.vy *= 0.98;
                    
                    fPlayers.forEach(p => {
                        let dx = ball.x - p.x;
                        let dy = ball.y - p.y;
                        let dist = Math.sqrt(dx*dx + dy*dy);
                        let minDist = BALL_RADIUS + PLAYER_RADIUS;
                        if (dist < minDist && dist > 0) {
                            let nx = dx / dist;
                            let ny = dy / dist;
                            let pSpeed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
                            let force = Math.max(6, pSpeed * 1.5);
                            ball.vx += nx * force;
                            ball.vy += ny * force;
                            let overlap = minDist - dist;
                            ball.x += nx * overlap;
                            ball.y += ny * overlap;
                        }
                    });
                    
                    ball.x += ball.vx;
                    ball.y += ball.vy;
                    
                    const W = 1400, H = 800;
                    const goalTop = H/2 - 150, goalBottom = H/2 + 150;
                    
                    if (ball.x < BALL_RADIUS) {
                        if (ball.y > goalTop && ball.y < goalBottom) {
                            footballState.blueScore++;
                            ball.x = W/2; ball.y = H/2; ball.vx = 0; ball.vy = 0;
                            io.to('football').emit('goal', { team: 'blue', score: footballState });
                        } else {
                            ball.x = BALL_RADIUS; ball.vx *= -0.8;
                        }
                    } else if (ball.x > W - BALL_RADIUS) {
                        if (ball.y > goalTop && ball.y < goalBottom) {
                            footballState.redScore++;
                            ball.x = W/2; ball.y = H/2; ball.vx = 0; ball.vy = 0;
                            io.to('football').emit('goal', { team: 'red', score: footballState });
                        } else {
                            ball.x = W - BALL_RADIUS; ball.vx *= -0.8;
                        }
                    }
                    if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy *= -0.8; }
                    else if (ball.y > H - BALL_RADIUS) { ball.y = H - BALL_RADIUS; ball.vy *= -0.8; }
                }
                io.to(room).emit('state', { players: roomPlayers, footballState });
            } else {
                io.to(room).emit('state', roomPlayers);
            }
        });
    } catch (err) {
        console.error("Error in game loop broadcast:", err);
    }
}, TICK_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Countryballs Server Active on port ${PORT}`);
});
