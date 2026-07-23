const io = (typeof window !== 'undefined' && window.io) ? window.io : function() { return { on: () => {}, emit: () => {} }; };
import { COUNTRYBALLS, getCountryballSkin, HATS, GLASSES } from './src/CountryballRegistry.js';
import { Countryball } from './src/Countryball.js';
import { ParticleSystem } from './src/Particles.js';
import { AudioManager } from './src/AudioManager.js';
import { ProgressionManager } from './src/ProgressionManager.js';

// ============== CANVAS & SCENE SETUP ==============
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ============== SOCKET & MANAGER SETUP ==============
const SOCKET_URL = window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')
    ? 'https://shops-lightning-depending-federal.trycloudflare.com'
    : window.location.origin;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
const progressionManager = new ProgressionManager();
const audioManager = new AudioManager();
const particleSystem = new ParticleSystem();

let localSocketId = null;
let isGameRunning = false;
let bounceScore = 0;
let highscore = parseInt(localStorage.getItem('countryball_highscore') || '0', 10);

// Input state
const keysPressed = {};
const globalMousePos = { x: canvas.width / 2, y: canvas.height / 2 };
const inputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    isMouseDown: false,
    mouseTarget: null
};

// Player & Other Players
let selectedSkinId = localStorage.getItem('countryball_selected_skin') || 'turkey';
let selectedHatId = localStorage.getItem('countryball_selected_hat') || 'none';
let selectedGlassesId = localStorage.getItem('countryball_selected_glasses') || 'none';
const localPlayer = new Countryball(canvas.width / 2, canvas.height / 2, 'OyuncuTopu', selectedSkinId);
localPlayer.setCosmetics(selectedHatId, selectedGlassesId);
const otherPlayers = {}; // id -> Countryball instance

// Bot Countryballs
const botPlayers = [];
function spawnBotCountryballs() {
    botPlayers.length = 0;
    const botSkins = ['poland', 'germany', 'france', 'usa', 'japan', 'brazil', 'uk', 'italy', 'sweden', 'south_korea'];
    const count = 8;
    for (let i = 0; i < count; i++) {
        const skinId = botSkins[i % botSkins.length];
        const angle = (i / count) * Math.PI * 2;
        const dist = Math.min(canvas.width, canvas.height) * 0.32;
        const bot = new Countryball(
            canvas.width / 2 + Math.cos(angle) * dist,
            canvas.height / 2 + Math.sin(angle) * dist,
            botSkins[i % botSkins.length].charAt(0).toUpperCase() + botSkins[i % botSkins.length].slice(1),
            skinId
        );
        // Give each bot a random initial velocity
        const speed = 1.5 + Math.random() * 2.5;
        const dir = Math.random() * Math.PI * 2;
        bot.vx = Math.cos(dir) * speed;
        bot.vy = Math.sin(dir) * speed;
        botPlayers.push(bot);
    }
}
// Spawn bots immediately so canvas shows something even before game start
spawnBotCountryballs();

// ============== DOM ELEMENTS ==============
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const playerNameInput = document.getElementById('player-name');
const scoreElement = document.getElementById('score');
const playerSkinNameEl = document.getElementById('player-skin-name');
const soundBtn = document.getElementById('sound-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const lbList = document.getElementById('lb-list');
const skinCardsGrid = document.getElementById('skin-cards-grid');

const hatSelector = document.getElementById('hat-selector');
const glassesSelector = document.getElementById('glasses-selector');
const radialMenu = document.getElementById('radial-menu');
const radialItems = document.querySelectorAll('.radial-item');

const ingameEditModal = document.getElementById('ingame-edit-modal');
const editPlayerName = document.getElementById('edit-player-name');
const editSkinSelector = document.getElementById('edit-skin-selector');
const editHatSelector = document.getElementById('edit-hat-selector');
const editGlassesSelector = document.getElementById('edit-glasses-selector');
const saveEditBtn = document.getElementById('save-edit-btn');

const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const mobileChatModal = document.getElementById('mobile-chat-modal');
const closeMobileChatBtn = document.getElementById('close-mobile-chat-btn');
const mobileChatInput = document.getElementById('mobile-chat-input');
const mobileSendChatBtn = document.getElementById('mobile-send-chat-btn');
const mobileChatMessages = document.getElementById('mobile-chat-messages');

const openScreenBtn = document.getElementById('open-screen-btn');
const screenPopover = document.getElementById('screen-input-popover');
const screenUrlInput = document.getElementById('screen-url-input');
const screenSetBtn = document.getElementById('screen-set-btn');
const screenStatus = document.getElementById('screen-status');
const jumbotron = document.getElementById('arena-screen-jumbotron');
const jumboIframe = document.getElementById('arena-screen-iframe');
const jumboMuteBtn = document.getElementById('jumbo-mute-btn');
const jumboMinBtn = document.getElementById('jumbo-minimize-btn');

// UI Init
if (playerNameInput) {
    playerNameInput.value = localStorage.getItem('countryball_player_name') || 'OyuncuTopu';
}
if (playerSkinNameEl) {
    const skinInfo = getCountryballSkin(selectedSkinId);
    playerSkinNameEl.innerText = skinInfo.name;
}
if (scoreElement) scoreElement.innerText = bounceScore;

// ============== RENDER COUNTRYBALL SKIN GALLERY ==============
function renderSkinGallery() {
    if (!skinCardsGrid) return;
    skinCardsGrid.innerHTML = '';
    COUNTRYBALLS.forEach(cb => {
        const card = document.createElement('div');
        card.className = `skin-card ${cb.id === selectedSkinId ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="flag-preview">${cb.flagEmoji}</div>
            <span class="skin-title">${cb.name}</span>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedSkinId = cb.id;
            localStorage.setItem('countryball_selected_skin', cb.id);
            localPlayer.setSkin(cb.id);
            if (playerSkinNameEl) playerSkinNameEl.innerText = cb.name;
            if (typeof refreshMenuPreview === 'function') refreshMenuPreview();
        });
        skinCardsGrid.appendChild(card);
    });
}
renderSkinGallery();

// ============== RENDER COSMETICS SELECTORS ==============
if (hatSelector) {
    HATS.forEach(hat => {
        const opt = document.createElement('option');
        opt.value = hat.id; opt.innerText = hat.name;
        hatSelector.appendChild(opt);
    });
    hatSelector.value = selectedHatId;
    hatSelector.addEventListener('change', (e) => {
        selectedHatId = e.target.value;
        localStorage.setItem('countryball_selected_hat', selectedHatId);
        localPlayer.setCosmetics(selectedHatId, selectedGlassesId);
        if (typeof refreshMenuPreview === 'function') refreshMenuPreview();
    });
}

if (glassesSelector) {
    GLASSES.forEach(glass => {
        const opt = document.createElement('option');
        opt.value = glass.id; opt.innerText = glass.name;
        glassesSelector.appendChild(opt);
    });
    glassesSelector.value = selectedGlassesId;
    glassesSelector.addEventListener('change', (e) => {
        selectedGlassesId = e.target.value;
        localStorage.setItem('countryball_selected_glasses', selectedGlassesId);
        localPlayer.setCosmetics(selectedHatId, selectedGlassesId);
        if (typeof refreshMenuPreview === 'function') refreshMenuPreview();
    });
}

// ============== IN-GAME ESC MENU ==============
if (editSkinSelector) {
    COUNTRYBALLS.forEach(cb => {
        const opt = document.createElement('option');
        opt.value = cb.id; opt.innerText = cb.name;
        editSkinSelector.appendChild(opt);
    });
}
if (editHatSelector) {
    HATS.forEach(hat => {
        const opt = document.createElement('option');
        opt.value = hat.id; opt.innerText = hat.name;
        editHatSelector.appendChild(opt);
    });
}
if (editGlassesSelector) {
    GLASSES.forEach(glass => {
        const opt = document.createElement('option');
        opt.value = glass.id; opt.innerText = glass.name;
        editGlassesSelector.appendChild(opt);
    });
}

// ============== PREVIEW RENDERING ==============
window.updatePreviewCanvas = function(canvasId, skinId, hatId, glassesId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 15);
    const mockBall = new Countryball(0, 0, 40, skinId);
    mockBall.setCosmetics(hatId, glassesId);
    mockBall.draw(ctx);
    ctx.restore();
}

window.refreshMenuPreview = function() {
    updatePreviewCanvas('menu-preview-canvas', selectedSkinId, selectedHatId, selectedGlassesId);
}

window.refreshEditPreview = function() {
    const sId = editSkinSelector ? editSkinSelector.value : selectedSkinId;
    const hId = editHatSelector ? editHatSelector.value : selectedHatId;
    const gId = editGlassesSelector ? editGlassesSelector.value : selectedGlassesId;
    updatePreviewCanvas('edit-preview-canvas', sId, hId, gId);
}

if (editSkinSelector) editSkinSelector.addEventListener('change', refreshEditPreview);
if (editHatSelector) editHatSelector.addEventListener('change', refreshEditPreview);
if (editGlassesSelector) editGlassesSelector.addEventListener('change', refreshEditPreview);

// Trigger initial previews
setTimeout(() => {
    refreshMenuPreview();
}, 100);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isGameRunning) {
        if (ingameEditModal.classList.contains('hidden')) {
            // Open menu
            editPlayerName.value = localPlayer.name;
            editSkinSelector.value = selectedSkinId;
            editHatSelector.value = selectedHatId;
            editGlassesSelector.value = selectedGlassesId;
            ingameEditModal.classList.remove('hidden');
            if (typeof refreshEditPreview === 'function') refreshEditPreview();
        } else {
            // Close menu
            ingameEditModal.classList.add('hidden');
        }
    }
});

if (saveEditBtn) {
    saveEditBtn.addEventListener('click', () => {
        const newName = editPlayerName.value.trim() || 'OyuncuTopu';
        selectedSkinId = editSkinSelector.value;
        selectedHatId = editHatSelector.value;
        selectedGlassesId = editGlassesSelector.value;

        localPlayer.name = newName;
        localPlayer.setSkin(selectedSkinId);
        localPlayer.setCosmetics(selectedHatId, selectedGlassesId);

        localStorage.setItem('countryball_player_name', newName);
        localStorage.setItem('countryball_selected_skin', selectedSkinId);
        localStorage.setItem('countryball_selected_hat', selectedHatId);
        localStorage.setItem('countryball_selected_glasses', selectedGlassesId);

        if (playerSkinNameEl) {
            const skinInfo = getCountryballSkin(selectedSkinId);
            playerSkinNameEl.innerText = skinInfo.name;
        }

        if (socket && socket.connected) {
            socket.emit('playerInput', { 
                x: localPlayer.x, y: localPlayer.y, 
                vx: localPlayer.vx, vy: localPlayer.vy, 
                skinId: selectedSkinId, hatId: selectedHatId, glassesId: selectedGlassesId, 
                score: bounceScore 
            });
        }
        
        ingameEditModal.classList.add('hidden');
    });
}

// ============== RADIAL EMOTE MENU ==============
let isRadialMenuOpen = false;

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !isRadialMenuOpen && isGameRunning) {
        if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
        isRadialMenuOpen = true;
        if (radialMenu) radialMenu.classList.remove('hidden');
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyF') {
        isRadialMenuOpen = false;
        if (radialMenu) radialMenu.classList.add('hidden');
    }
});

if (radialItems) {
    radialItems.forEach(item => {
        item.addEventListener('click', () => {
            const emote = item.getAttribute('data-emote');
            localPlayer.expression = emote;
            localPlayer.expressionTimer = 3.0; // Expression lasts 3 seconds
            isRadialMenuOpen = false;
            if (radialMenu) radialMenu.classList.add('hidden');
            
            // Sync immediately
            if (socket && socket.connected) {
                socket.emit('playerInput', { 
                    x: localPlayer.x, y: localPlayer.y, 
                    vx: localPlayer.vx, vy: localPlayer.vy, 
                    skinId: selectedSkinId, hatId: selectedHatId, glassesId: selectedGlassesId, 
                    expression: localPlayer.expression, score: bounceScore 
                });
            }
        });
    });
}

// ============== CHAT & EMOTE SYSTEM ==============
function addChatMessage(sender, text, isSystem = false) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${isSystem ? 'system-msg' : ''}`;
    if (isSystem) {
        div.innerText = text;
    } else {
        div.innerHTML = `<span class="msg-sender">${escapeHtml(sender)}:</span> <span class="msg-text">${escapeHtml(text)}</span>`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (mobileChatMessages) {
        const mDiv = div.cloneNode(true);
        mobileChatMessages.appendChild(mDiv);
        mobileChatMessages.scrollTop = mobileChatMessages.scrollHeight;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sendChat() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (text) {
        addChatMessage(localPlayer.name, text);
        localPlayer.say(text);
        if (socket && socket.connected) {
            socket.emit('chatMessage', { text, sender: localPlayer.name });
        }
        chatInput.value = '';
        chatInput.blur();
    }
}

if (sendChatBtn) sendChatBtn.addEventListener('click', sendChat);
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChat();
    });
}

if (mobileSendChatBtn) {
    mobileSendChatBtn.addEventListener('click', () => {
        if (!mobileChatInput) return;
        const text = mobileChatInput.value.trim();
        if (text) {
            addChatMessage(localPlayer.name, text);
            localPlayer.say(text);
            if (socket && socket.connected) {
                socket.emit('chatMessage', { text, sender: localPlayer.name });
            }
            mobileChatInput.value = '';
            mobileChatInput.blur();
            mobileChatModal.classList.add('hidden');
        }
    });
}

if (closeMobileChatBtn) {
    closeMobileChatBtn.addEventListener('click', () => {
        mobileChatModal.classList.add('hidden');
    });
}

// Quick Emotes
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (emoji) {
            particleSystem.addEmote(localPlayer.x, localPlayer.y - localPlayer.radius - 10, emoji);
            if (socket && socket.connected) {
                socket.emit('chatMessage', { text: emoji, isEmoji: true });
            }
        }
    });
});

// ============== YOUTUBE JUKEBOX MUSIC PLAYER ==============
let isJumboMuted = false;
let isJumboMinimized = false;

if (openScreenBtn) {
    openScreenBtn.addEventListener('click', () => {
        screenPopover.classList.toggle('hidden');
    });
}

function parseYouTubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    const patterns = [
        /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /music\.youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/
    ];
    for (const re of patterns) {
        const m = s.match(re);
        if (m) return m[1];
    }
    return null;
}

function playYouTubeVideo(videoId, title = 'YouTube Müzik') {
    if (!jumboIframe || !jumbotron) return;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&controls=1`;
    jumboIframe.src = embedUrl;
    jumbotron.classList.remove('hidden');
    addChatMessage('SİSTEM', `📺 Arena ekranında müzik çalıyor: ${title}`, true);
}

if (screenSetBtn) {
    screenSetBtn.addEventListener('click', () => {
        const url = screenUrlInput.value;
        const videoId = parseYouTubeId(url);
        if (videoId) {
            playYouTubeVideo(videoId);
            if (socket && socket.connected) {
                socket.emit('setScreenVideo', { url, name: localPlayer.name });
            }
            screenPopover.classList.add('hidden');
            screenUrlInput.value = '';
        } else {
            screenStatus.innerText = '❌ Geçersiz YouTube adresi!';
            setTimeout(() => screenStatus.innerText = '', 3000);
        }
    });
}

if (jumboMuteBtn) {
    jumboMuteBtn.addEventListener('click', () => {
        isJumboMuted = !isJumboMuted;
        jumboMuteBtn.innerText = isJumboMuted ? '🔇' : '🔊';
        if (jumboIframe.contentWindow) {
            const func = isJumboMuted ? 'mute' : 'unMute';
            jumboIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func }), '*');
        }
    });
}

if (jumboMinBtn) {
    jumboMinBtn.addEventListener('click', () => {
        isJumboMinimized = !isJumboMinimized;
        jumbotron.classList.toggle('minimized', isJumboMinimized);
        jumboMinBtn.innerText = isJumboMinimized ? '🗖' : '—';
    });
}

// ============== INPUT EVENT LISTENERS ==============
window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    keysPressed[e.code] = true;

    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputState.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputState.right = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') inputState.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') inputState.down = true;

    // SPACE = DASH / BOOST!
    if (e.code === 'Space') {
        if (localPlayer.dash(globalMousePos)) {
            particleSystem.addSparkles(localPlayer.x, localPlayer.y, '#00f3ff', 16);
            particleSystem.addDashTrail(localPlayer.x, localPlayer.y, localPlayer.radius, '#00f3ff');
            if (socket && socket.connected) {
                socket.emit('playerAction', { action: 'dash' });
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;

    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputState.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputState.right = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') inputState.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') inputState.down = false;
});

canvas.addEventListener('mousedown', (e) => {
    inputState.isMouseDown = true;
    inputState.mouseTarget = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('mousemove', (e) => {
    globalMousePos.x = e.clientX;
    globalMousePos.y = e.clientY;
    if (inputState.isMouseDown) {
        inputState.mouseTarget = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('mouseup', () => {
    inputState.isMouseDown = false;
    inputState.mouseTarget = null;
});

// Touch controls for mobile
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        inputState.isMouseDown = true;
        inputState.mouseTarget = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        globalMousePos.x = e.touches[0].clientX;
        globalMousePos.y = e.touches[0].clientY;
        inputState.mouseTarget = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: true });

canvas.addEventListener('touchend', () => {
    inputState.isMouseDown = false;
    inputState.mouseTarget = null;
});

// Fullscreen & Sound
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    });
}

// ============== SOCKET MULTIPLAYER SYNC ==============
socket.on('connect', () => {
    localSocketId = socket.id;
});

socket.on('screenVideo', (data) => {
    if (data && data.videoId) {
        playYouTubeVideo(data.videoId, data.setByName);
    }
});

socket.on('chatReceived', (data) => {
    if (data.id === localSocketId) return;
    addChatMessage(data.name, data.text);
    if (data.isEmoji) {
        const p = otherPlayers[data.id];
        if (p) particleSystem.addEmote(p.x, p.y - p.radius - 10, data.text);
    } else {
        const p = otherPlayers[data.id];
        if (p) p.say(data.text);
    }
});

socket.on('playerAction', (data) => {
    if (data.action === 'dash') {
        const p = otherPlayers[data.id];
        if (p) {
            particleSystem.addSparkles(p.x, p.y, '#00f3ff', 16);
        }
    }
});

socket.on('state', (players) => {
    updateLeaderboard(players);

    for (const id in players) {
        if (id === localSocketId) continue;
        const p = players[id];
        if (!otherPlayers[id]) {
            otherPlayers[id] = new Countryball(p.x, p.y, p.name || 'Oyuncu', p.skinId || 'turkey');
            addChatMessage('SİSTEM', `⚽ ${p.name || 'Oyuncu'} arenaya katıldı!`, true);
        }
        otherPlayers[id].x = p.x;
        otherPlayers[id].y = p.y;
        otherPlayers[id].vx = p.vx || 0;
        otherPlayers[id].vy = p.vy || 0;
        if (p.skinId && otherPlayers[id].skinId !== p.skinId) {
            otherPlayers[id].setSkin(p.skinId);
        }
        if (p.hatId !== undefined || p.glassesId !== undefined) {
            otherPlayers[id].setCosmetics(p.hatId || 'none', p.glassesId || 'none');
        }
        if (p.expression && otherPlayers[id].expression !== p.expression) {
            otherPlayers[id].expression = p.expression;
            otherPlayers[id].expressionTimer = 3.0;
        }
    }

    for (const id in otherPlayers) {
        if (!players[id]) {
            addChatMessage('SİSTEM', `⚽ ${otherPlayers[id].name} ayrıldı.`, true);
            delete otherPlayers[id];
        }
    }
});

function updateLeaderboard(players) {
    if (!lbList) return;
    lbList.innerHTML = '';
    const list = Object.values(players || {}).slice(0, 5);
    if (list.length === 0) {
        lbList.innerHTML = `<li>1. ${localPlayer.name} (${bounceScore} Sekme)</li>`;
        return;
    }
    list.forEach((p, idx) => {
        const li = document.createElement('li');
        li.innerText = `${idx + 1}. ${p.name || 'Oyuncu'}`;
        lbList.appendChild(li);
    });
}

// ============== GAME START / RESET ==============
function startGame() {
    audioManager.init();
    const playerName = playerNameInput ? (playerNameInput.value.trim() || 'OyuncuTopu') : 'OyuncuTopu';
    localStorage.setItem('countryball_player_name', playerName);
    localPlayer.name = playerName;
    localPlayer.setSkin(selectedSkinId);
    localPlayer.x = canvas.width / 2;
    localPlayer.y = canvas.height / 2;
    localPlayer.vx = 0;
    localPlayer.vy = 0;

    spawnBotCountryballs();

    if (socket && socket.connected) {
        socket.emit('join', { name: playerName, skinId: selectedSkinId, hatId: selectedHatId, glassesId: selectedGlassesId });
    }

    isGameRunning = true;
    if (overlay) overlay.classList.add('hidden');
    addChatMessage('SİSTEM', '⚽ Arenaya girdiniz! WASD / Yön tuşları veya fare ile hareket edin, SPACE ile zıplayıp atılın!', true);
}

if (startBtn) startBtn.addEventListener('click', startGame);

// ============== ELASTIC BALL COLLISION PHYSICS ==============
function checkBallCollision(b1, b2) {
    if (!b1 || !b2) return;
    if (isNaN(b1.x) || isNaN(b1.y) || isNaN(b2.x) || isNaN(b2.y)) return;

    let dx = b2.x - b1.x;
    let dy = b2.y - b1.y;
    let dist = Math.hypot(dx, dy);
    const minDist = b1.radius + b2.radius;

    if (dist < minDist) {
        if (dist < 0.001) {
            dx = 1;
            dy = 0;
            dist = 1;
        }

        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping balls evenly
        const overlap = (minDist - dist) / 2;
        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;

        // Elastic momentum response (Restitution = 0.85)
        const kx = b1.vx - b2.vx;
        const ky = b1.vy - b2.vy;
        const p = (nx * kx + ny * ky);

        if (p > 0) {
            const restitution = 0.85;
            const impulse = p * restitution;

            b1.vx -= impulse * nx;
            b1.vy -= impulse * ny;
            b2.vx += impulse * nx;
            b2.vy += impulse * ny;

            b1.onBounce();
            b2.onBounce();

            // Sparkle particles at impact center
            const impactX = (b1.x + b2.x) / 2;
            const impactY = (b1.y + b2.y) / 2;
            particleSystem.addSparkles(impactX, impactY, '#FEDD00', 6);

            if (b1 === localPlayer || b2 === localPlayer) {
                bounceScore++;
                if (scoreElement) scoreElement.innerText = bounceScore;

                // Emote reaction to high-speed collision (dodge attack)
                const s1 = Math.hypot(b1.vx, b1.vy);
                const s2 = Math.hypot(b2.vx, b2.vy);
                if (b1 === localPlayer && s2 > 10) { // Hit by b2 dash
                    localPlayer.expression = 'sad';
                    localPlayer.expressionTimer = 3.0;
                } else if (b2 === localPlayer && s1 > 10) { // Hit by b1 dash
                    localPlayer.expression = 'sad';
                    localPlayer.expressionTimer = 3.0;
                }
            }
        }
    }
}

// ============== GAME LOOP ==============
let lastTime = performance.now();
let lastNetworkEmitTime = 0;

function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const bounds = { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height };
    const noInput = { left: false, right: false, up: false, down: false, isMouseDown: false, mouseTarget: null };

    // 1. Background
    drawPlaygroundBackground(ctx);

    // Always update & draw bots (even on start screen — they bounce around as decoration)
    botPlayers.forEach(bot => {
        bot.update(delta, noInput, bounds);
    });
    for (let i = 0; i < botPlayers.length; i++) {
        for (let j = i + 1; j < botPlayers.length; j++) {
            checkBallCollision(botPlayers[i], botPlayers[j]);
        }
    }

    // In-game: update local player + collisions
    if (isGameRunning) {
        localPlayer.update(delta, inputState, bounds);

        botPlayers.forEach(bot => checkBallCollision(localPlayer, bot));

        Object.values(otherPlayers).forEach(op => {
            op.update(delta, noInput, bounds);
            checkBallCollision(localPlayer, op);
            if (Math.hypot(op.vx, op.vy) > 5) {
                particleSystem.addDashTrail(op.x, op.y, op.radius, 'rgba(255,255,255,0.4)');
            }
        });

        if (Math.hypot(localPlayer.vx, localPlayer.vy) > 5) {
            particleSystem.addDashTrail(localPlayer.x, localPlayer.y, localPlayer.radius, 'rgba(255,255,255,0.4)');
        }

        if (socket && socket.connected && now - lastNetworkEmitTime > 50) {
            lastNetworkEmitTime = now;
            socket.emit('playerInput', { x: localPlayer.x, y: localPlayer.y, vx: localPlayer.vx, vy: localPlayer.vy, skinId: selectedSkinId, score: bounceScore });
        }
    }

    // 2. Particles
    particleSystem.update(delta);
    particleSystem.draw(ctx);

    // 3. Draw all balls
    botPlayers.forEach(bot => bot.draw(ctx));
    Object.values(otherPlayers).forEach(op => op.draw(ctx));
    if (isGameRunning) localPlayer.draw(ctx, globalMousePos);
}

function drawPlaygroundBackground(ctx) {
    // Soft stylish gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Playful grid pattern
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Outer neon boundary line
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    ctx.restore();
}

// Start Render Loop
requestAnimationFrame(gameLoop);
