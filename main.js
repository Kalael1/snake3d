import * as THREE from 'three';
import { io } from 'socket.io-client';

import { CityMap } from './src/CityMap.js';
import { DriftCar } from './src/DriftCar.js';
import { OtherCar } from './src/OtherCar.js';
import { AudioManager } from './src/AudioManager.js';
import { SKINS } from './src/SkinRegistry.js';
import { ProgressionManager } from './src/ProgressionManager.js';
import { NameTagManager } from './src/NameTagManager.js';
import { TronTrailManager } from './src/TronTrailManager.js';
import { ExplosionManager } from './src/ExplosionManager.js';
import { ArenaScreen } from './src/ArenaScreen.js';

// ============== SOCKET ==============
const SOCKET_URL = window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')
    ? 'https://boutique-mainly-being-succeed.trycloudflare.com'
    : window.location.origin;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const progressionManager = new ProgressionManager();
const audioManager = new AudioManager();

// ============== SCENE & STABLE HIGH-PERFORMANCE LIGHTING ==============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc4ec); // daytime city sky
scene.fog = new THREE.FogExp2(0xa9cdea, 0.00075);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 800);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
renderer.shadowMap.enabled = false; // Disable GPU shadow map crashes for 100% stability across all devices!
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.getElementById('app').appendChild(renderer.domElement);

const nameTagManager = new NameTagManager(camera, document.getElementById('nametag-container'));

// 1. Neutral sky/ground hemisphere so the city keeps its own colours
const hemiLight = new THREE.HemisphereLight(0xcfe6ff, 0x6b7480, 1.15);
scene.add(hemiLight);

// 2. Primary daylight sun
const dirLight = new THREE.DirectionalLight(0xfff4e0, 2.1);
dirLight.position.set(120, 200, 90);
scene.add(dirLight);

// 3. Soft cool fill (subtle, no heavy tint)
const rimLight = new THREE.DirectionalLight(0x9fbdf0, 0.7);
rimLight.position.set(-120, 100, -100);
scene.add(rimLight);

// 4. Dynamic Car Underglow PointLight
const carUnderglowLight = new THREE.PointLight(0x00f3ff, 12.0, 22);
scene.add(carUnderglowLight);

// 5. Dedicated Car Key Spotlight (Follows car directly from above!)
const carKeySpotlight = new THREE.SpotLight(0xffffff, 16.0, 45, Math.PI / 3, 0.4);
scene.add(carKeySpotlight);

// ============== GAME ENTITIES ==============
const arena = new CityMap(scene);
const localCar = new DriftCar(scene);
localCar.applySkin(progressionManager.selectedSkinId);

const tronTrailManager = new TronTrailManager(scene);
const explosionManager = new ExplosionManager(scene);

const arenaScreen = new ArenaScreen(scene, {
    iframeEl: document.getElementById('arena-screen-iframe'),
    wrapEl: document.getElementById('arena-screen-jumbotron'),
    labelEl: document.getElementById('arena-screen-label')
});

const otherCars = {};

let isGameRunning = false;
let isEmittingTrail = false;
let lastTrailEmitTime = 0;
let localSocketId = null;
let currentPlayersList = [];
let gameStartTime = 0;
let lastNetworkEmitTime = 0;
let hasMovedMouseSinceStart = false;

// ============== DOM ELEMENTS ==============
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const playerNameInput = document.getElementById('player-name');
const overlayDesc = document.getElementById('overlay-desc');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const soundBtn = document.getElementById('sound-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const lbList = document.getElementById('lb-list');

const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');

const gameoverModalOverlay = document.getElementById('gameover-modal-overlay');
const gameoverReasonText = document.getElementById('gameover-reason-text');
const statRank = document.getElementById('stat-rank');
const statScore = document.getElementById('stat-score');
const statTime = document.getElementById('stat-time');
const statHighscore = document.getElementById('stat-highscore');
const restartGameBtn = document.getElementById('restart-game-btn');
const openSkinsBtn = document.getElementById('open-skins-btn');

const skinCardsGrid = document.getElementById('skin-cards-grid');
const skinProgressFill = document.getElementById('skin-progress-bar-fill');
const skinProgressText = document.getElementById('skin-progress-text');

const virtualJoystick = document.getElementById('virtual-joystick');
const joystickKnob = document.getElementById('joystick-knob');

const mobileChatModal = document.getElementById('mobile-chat-modal');
const closeMobileChatBtn = document.getElementById('close-mobile-chat-btn');
const mobileChatInput = document.getElementById('mobile-chat-input');
const mobileSendChatBtn = document.getElementById('mobile-send-chat-btn');
const mobileChatMessages = document.getElementById('mobile-chat-messages');

const ctrlKeyboardBtn = document.getElementById('ctrl-keyboard-btn');
const ctrlMouseBtn = document.getElementById('ctrl-mouse-btn');

const mobileLeftBtn = document.getElementById('mobile-left-btn');
const mobileRightBtn = document.getElementById('mobile-right-btn');
const mobileEngineBtn = document.getElementById('mobile-engine-toggle-btn');

const driftComboEl = document.getElementById('drift-combo');
const driftAngleEl = document.getElementById('drift-angle');

highScoreElement.innerText = progressionManager.highScore;

// ============== CONTROL SCHEME SELECTOR ==============
let selectedControlScheme = localStorage.getItem('drift_control_scheme') || 'keyboard';

function updateControlSchemeUI() {
    if (selectedControlScheme === 'keyboard') {
        if (ctrlKeyboardBtn) ctrlKeyboardBtn.classList.add('active');
        if (ctrlMouseBtn) ctrlMouseBtn.classList.remove('active');
    } else {
        if (ctrlMouseBtn) ctrlMouseBtn.classList.add('active');
        if (ctrlKeyboardBtn) ctrlKeyboardBtn.classList.remove('active');
    }
}
updateControlSchemeUI();

if (ctrlKeyboardBtn) {
    ctrlKeyboardBtn.addEventListener('click', () => {
        selectedControlScheme = 'keyboard';
        localStorage.setItem('drift_control_scheme', 'keyboard');
        updateControlSchemeUI();
    });
}

if (ctrlMouseBtn) {
    ctrlMouseBtn.addEventListener('click', () => {
        selectedControlScheme = 'mouse';
        localStorage.setItem('drift_control_scheme', 'mouse');
        updateControlSchemeUI();
    });
}

// ============== MOBILE EASY TOUCH STEERING BUTTONS ==============
let mobileSteerLeft = false;
let mobileSteerRight = false;

if (mobileLeftBtn) {
    const startLeft = (e) => { e.preventDefault(); mobileSteerLeft = true; mobileLeftBtn.classList.add('active-touch'); };
    const stopLeft = (e) => { e.preventDefault(); mobileSteerLeft = false; mobileLeftBtn.classList.remove('active-touch'); };
    mobileLeftBtn.addEventListener('touchstart', startLeft, { passive: false });
    mobileLeftBtn.addEventListener('touchend', stopLeft, { passive: false });
    mobileLeftBtn.addEventListener('mousedown', startLeft);
    mobileLeftBtn.addEventListener('mouseup', stopLeft);
}

if (mobileRightBtn) {
    const startRight = (e) => { e.preventDefault(); mobileSteerRight = true; mobileRightBtn.classList.add('active-touch'); };
    const stopRight = (e) => { e.preventDefault(); mobileSteerRight = false; mobileRightBtn.classList.remove('active-touch'); };
    mobileRightBtn.addEventListener('touchstart', startRight, { passive: false });
    mobileRightBtn.addEventListener('touchend', stopRight, { passive: false });
    mobileRightBtn.addEventListener('mousedown', startRight);
    mobileRightBtn.addEventListener('mouseup', stopRight);
}

if (mobileEngineBtn) {
    const toggleEngine = (e) => {
        e.preventDefault();
        isEngineOn = !isEngineOn;
        isEmittingTrail = isEngineOn;
        if (!isEngineOn) tronTrailManager.breakPlayerTrail(localSocketId);
    };
    mobileEngineBtn.addEventListener('touchstart', toggleEngine, { passive: false });
    mobileEngineBtn.addEventListener('click', toggleEngine);
}

soundBtn.addEventListener('click', () => {
    const muted = audioManager.toggleMute();
    soundBtn.innerText = muted ? '🔇' : '🔊';
});

function toggleFullscreen() {
    try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const docEl = document.documentElement;
            if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
            else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen().catch(() => {});
            fullscreenBtn.innerText = '🗗';
        } else {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
            fullscreenBtn.innerText = '⛶';
        }
    } catch (e) {}
}
fullscreenBtn.addEventListener('click', toggleFullscreen);

// ============== ARENA SCREEN (SHARED YOUTUBE JUKEBOX) ==============
const SCREEN_COOLDOWN_MS = 2 * 60 * 1000;
const openScreenBtn = document.getElementById('open-screen-btn');
const screenPopover = document.getElementById('screen-input-popover');
const screenUrlInput = document.getElementById('screen-url-input');
const screenSetBtn = document.getElementById('screen-set-btn');
const screenStatus = document.getElementById('screen-status');
const jumbo = document.getElementById('arena-screen-jumbotron');
const jumboMinimizeBtn = document.getElementById('jumbo-minimize-btn');
const jumboMuteBtn = document.getElementById('jumbo-mute-btn');
const arenaScreenIframe = document.getElementById('arena-screen-iframe');

let screenCooldownUntil = 0;
let screenCooldownTimer = null;

function parseYouTubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
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

function fmtMMSS(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function startScreenCooldown(ms) {
    screenCooldownUntil = Date.now() + ms;
    if (screenCooldownTimer) clearInterval(screenCooldownTimer);
    const tick = () => {
        const remaining = screenCooldownUntil - Date.now();
        if (remaining <= 0) {
            clearInterval(screenCooldownTimer);
            screenCooldownTimer = null;
            screenSetBtn.disabled = false;
            screenSetBtn.innerText = '▶ EKRANDA AÇ';
            screenStatus.innerText = '';
            screenStatus.classList.remove('error');
            return;
        }
        screenSetBtn.disabled = true;
        screenSetBtn.innerText = `⏳ ${fmtMMSS(remaining)}`;
        screenStatus.classList.remove('error');
        screenStatus.innerText = `Yeni video için bekle: ${fmtMMSS(remaining)}`;
    };
    tick();
    screenCooldownTimer = setInterval(tick, 500);
}

function showScreenError(msg) {
    screenStatus.classList.add('error');
    screenStatus.innerText = msg;
}

function requestSetVideo() {
    const raw = screenUrlInput.value;
    const videoId = parseYouTubeId(raw);
    if (!videoId) {
        showScreenError('❌ Geçerli bir YouTube linki yapıştır.');
        return;
    }
    if (Date.now() < screenCooldownUntil) {
        showScreenError(`⏳ Yeni video için ${fmtMMSS(screenCooldownUntil - Date.now())} bekle.`);
        return;
    }
    const playerName = playerNameInput ? (playerNameInput.value.trim() || 'Bir sürücü') : 'Bir sürücü';

    if (socket && socket.connected) {
        // Server is authoritative (shared jukebox + global cooldown)
        socket.emit('setScreenVideo', { url: raw, name: playerName });
    } else {
        // Offline / single-player fallback so the screen still works locally
        arenaScreen.setVideo(videoId, playerName);
        startScreenCooldown(SCREEN_COOLDOWN_MS);
    }
    screenUrlInput.value = '';
}

if (openScreenBtn) {
    openScreenBtn.addEventListener('click', () => {
        screenPopover.classList.toggle('hidden');
        if (!screenPopover.classList.contains('hidden')) screenUrlInput.focus();
    });
}
if (screenSetBtn) screenSetBtn.addEventListener('click', requestSetVideo);
if (screenUrlInput) {
    screenUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') requestSetVideo();
    });
}
if (jumboMinimizeBtn) {
    jumboMinimizeBtn.addEventListener('click', () => {
        jumbo.classList.toggle('minimized');
        jumboMinimizeBtn.innerText = jumbo.classList.contains('minimized') ? '▢' : '—';
    });
}
if (jumboMuteBtn) {
    jumboMuteBtn.addEventListener('click', () => {
        // Reload the iframe muted/unmuted by toggling the mute param
        if (!arenaScreen.videoId) return;
        const muted = jumboMuteBtn.dataset.muted === '1';
        jumboMuteBtn.dataset.muted = muted ? '0' : '1';
        jumboMuteBtn.innerText = muted ? '🔊' : '🔇';
        arenaScreenIframe.src =
            `https://www.youtube-nocookie.com/embed/${arenaScreen.videoId}` +
            `?autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=${muted ? 0 : 1}`;
    });
}

// ============== SKIN GALLERY ==============
function renderSkinGallery() {
    if (!skinCardsGrid) return;
    skinCardsGrid.innerHTML = '';
    const highScore = progressionManager.highScore;
    const nextUnlock = progressionManager.getNextUnlock();

    if (nextUnlock) {
        const pct = Math.min(100, Math.floor((highScore / nextUnlock.reqScore) * 100));
        skinProgressText.innerText = `${highScore} / ${nextUnlock.reqScore} Pn (${nextUnlock.name})`;
        skinProgressFill.style.width = `${pct}%`;
    } else {
        skinProgressText.innerText = `👑 TÜM ARABALAR AÇILDI! (${highScore} Rekor)`;
        skinProgressFill.style.width = '100%';
    }

    SKINS.forEach(skin => {
        const isUnlocked = progressionManager.isSkinUnlocked(skin.id);
        const isSelected = progressionManager.selectedSkinId === skin.id;
        const card = document.createElement('div');
        card.className = `skin-card ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;

        let badgeHtml = '';
        if (isSelected) badgeHtml = `<span class="skin-badge active">SEÇİLİ</span>`;
        else if (isUnlocked) badgeHtml = `<span class="skin-badge unlocked">AÇIK</span>`;
        else badgeHtml = `<span class="skin-badge locked-badge">🔒 ${skin.reqScore} Pn</span>`;

        card.innerHTML = `<span class="skin-icon">${skin.icon}</span><span class="skin-title">${skin.name}</span>${badgeHtml}`;
        if (isUnlocked) {
            card.addEventListener('click', () => {
                progressionManager.setSelectedSkin(skin.id);
                localCar.applySkin(skin.id);
                audioManager.playEat();
                renderSkinGallery();
            });
        }
        skinCardsGrid.appendChild(card);
    });
}
renderSkinGallery();

// ============== CHAT SYSTEM ==============
function addChatMessage(sender, text, isSystem = false) {
    const div = document.createElement('div');
    div.className = `chat-msg ${isSystem ? 'system-msg' : ''}`;
    if (isSystem) {
        div.innerText = text;
    } else {
        div.innerHTML = `<span class="msg-sender">${sender}:</span> <span class="msg-text">${escapeHtml(text)}</span>`;
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
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chatMessage', text);
        chatInput.value = '';
    }
}

sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
});

if (mobileSendChatBtn) {
    mobileSendChatBtn.addEventListener('click', () => {
        const text = mobileChatInput.value.trim();
        if (text) {
            socket.emit('chatMessage', text);
            mobileChatInput.value = '';
            mobileChatModal.classList.add('hidden');
        }
    });
}

if (closeMobileChatBtn) {
    closeMobileChatBtn.addEventListener('click', () => {
        mobileChatModal.classList.add('hidden');
    });
}

document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        socket.emit('chatMessage', emoji);
    });
});

// ============== SOCKET EVENT LISTENERS ==============
socket.on('connect', () => {
    localSocketId = socket.id;
});

socket.on('init', (data) => {
    localSocketId = data.id;
});

socket.on('state', (players) => {
    currentPlayersList = Object.values(players);
    updateLeaderboard(players);

    for (const id in players) {
        if (id === localSocketId) continue;
        const p = players[id];
        if (!otherCars[id]) {
            otherCars[id] = new OtherCar(scene, p.id, p.name || 'Sürücü', p.skinId || 'sport', nameTagManager);
            addChatMessage('SİSTEM', `🏎️ ${p.name || 'Sürücü'} arenaya katıldı!`, true);
        }
        otherCars[id].updateState(p.x, p.z, p.angle || 0, p.skinId || 'sport', p.emittingTrail);

        if (p.emittingTrail && p.x !== undefined) {
            tronTrailManager.addSegment(id, p.x, p.z, p.angle || 0);
        }
    }

    for (const id in otherCars) {
        if (!players[id]) {
            addChatMessage('SİSTEM', `🏎️ ${otherCars[id].name} arenadan ayrıldı.`, true);
            otherCars[id].destroy();
            delete otherCars[id];
            tronTrailManager.clearPlayerTrail(id);
        }
    }
});

socket.on('chatBroadcast', (data) => {
    addChatMessage(data.sender, data.text);
    if (otherCars[data.id]) {
        otherCars[data.id].showSpeechBubble(data.text);
    }
});

// Shared arena screen sync
socket.on('screenVideo', (data) => {
    if (!data || !data.videoId) return;
    arenaScreen.setVideo(data.videoId, data.setByName);
    addChatMessage('SİSTEM', `📺 ${data.setByName || 'Bir sürücü'} arena ekranında video açtı!`, true);
    if (typeof data.remainingMs === 'number') startScreenCooldown(data.remainingMs);
});

socket.on('screenVideoRejected', (data) => {
    if (!data) return;
    if (data.reason === 'cooldown') {
        startScreenCooldown(data.remainingMs || SCREEN_COOLDOWN_MS);
        showScreenError(`⏳ Ekran meşgul — ${fmtMMSS(data.remainingMs || 0)} sonra tekrar dene.`);
    } else {
        showScreenError('❌ Geçerli bir YouTube linki yapıştır.');
    }
});

// ============== MOUSE & TOUCH CONTROLS ==============
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
const targetPoint = new THREE.Vector3(0, 0, 0);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

window.addEventListener('resize', () => {
    const w = Math.max(10, window.innerWidth);
    const h = Math.max(10, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});

window.addEventListener('mousemove', (e) => {
    hasMovedMouseSinceStart = true;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    mouse.x = (e.clientX / w) * 2 - 1;
    mouse.y = -(e.clientY / h) * 2 + 1;
});

window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#ui-layer') || e.target.closest('#overlay') || e.target.closest('#gameover-modal-overlay') || e.target.closest('#mobile-touch-controls')) return;
    if (e.button === 0 && isGameRunning) {
        isEmittingTrail = true;
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isEmittingTrail = false;
        tronTrailManager.breakPlayerTrail(localSocketId);
    }
});

let initialPinchDist = null;

window.addEventListener('touchstart', (e) => {
    if (e.target.closest('#ui-layer') || e.target.closest('#overlay') || e.target.closest('#gameover-modal-overlay') || e.target.closest('#mobile-touch-controls')) return;
    if (!isGameRunning) return;

    if (e.touches.length === 1) {
        hasMovedMouseSinceStart = true;
        const t = e.touches[0];
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        mouse.x = (t.clientX / w) * 2 - 1;
        mouse.y = -(t.clientY / h) * 2 + 1;
        isEmittingTrail = true;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isGameRunning) return;
    if (e.touches.length === 1) {
        const t = e.touches[0];
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        mouse.x = (t.clientX / w) * 2 - 1;
        mouse.y = -(t.clientY / h) * 2 + 1;
    } else if (e.touches.length === 2 && initialPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const cd = Math.sqrt(dx * dx + dy * dy);
        targetZoom += (initialPinchDist - cd) * 0.005;
        targetZoom = Math.max(0.4, Math.min(2.5, targetZoom));
        initialPinchDist = cd;
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        initialPinchDist = null;
        isEmittingTrail = false;
        tronTrailManager.breakPlayerTrail(localSocketId);
    }
}, { passive: true });

let isTPSMode = false;
let isEngineOn = true;
let currentZoom = 1.0;
let targetZoom = 1.0;
const keysPressed = {};

window.addEventListener('wheel', (e) => {
    targetZoom += e.deltaY * 0.0015;
    targetZoom = Math.max(0.4, Math.min(2.5, targetZoom));
}, { passive: true });

window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    keysPressed[e.code] = true;
    if (e.code === 'KeyV') isTPSMode = !isTPSMode;
    if (e.code === 'Space') {
        if (selectedControlScheme === 'mouse' && isGameRunning) {
            isEngineOn = !isEngineOn;
            if (isEngineOn) {
                addChatMessage('SİSTEM', '🔥 Motor çalıştırıldı! Fare ile yönlendirin...', true);
            } else {
                addChatMessage('SİSTEM', '🛑 Motor durduruldu.', true);
            }
        }
        isEmittingTrail = true;
    }
    if ((e.code === 'KeyW' || e.code === 'ArrowUp') && selectedControlScheme === 'keyboard') {
        if (!isEngineOn && isGameRunning) {
            isEngineOn = true;
            addChatMessage('SİSTEM', '🔥 Motor çalıştırıldı! İyi sürüşler!', true);
        }
    }
    if (e.code === 'Escape' && isGameRunning) openMenu('Oyun Duraklatıldı');
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
    if (e.code === 'Space') {
        isEmittingTrail = false;
        tronTrailManager.breakPlayerTrail(localSocketId);
    }
});

// ============== GAME OVER & EXPLOSION SYSTEM ==============
function triggerGameOver(reasonText) {
    if (!isGameRunning) return;
    isGameRunning = false;
    isEmittingTrail = false;
    audioManager.playDeath();

    const hp = localCar.getHeadPosition();
    localCar.group.visible = false; // Hide car instantly on crash

    explosionManager.triggerExplosion(hp.x, 0.5, hp.z, () => {
        showGameOverModal(reasonText);
    });
}

function showGameOverModal(reasonText) {
    const finalScore = localCar.getScore();
    progressionManager.saveHighScore(finalScore);
    highScoreElement.innerText = progressionManager.highScore;

    const sec = Math.floor((Date.now() - gameStartTime) / 1000);
    const mins = String(Math.floor(sec / 60)).padStart(2, '0');
    const secs = String(sec % 60).padStart(2, '0');

    const sorted = currentPlayersList.slice().sort((a, b) => (b.driftScore || 0) - (a.driftScore || 0));
    const rank = sorted.findIndex(p => p.id === localSocketId);

    gameoverReasonText.innerText = reasonText;
    statRank.innerText = rank !== -1 ? `#${rank + 1}` : '#1';
    statScore.innerText = finalScore;
    statTime.innerText = `${mins}:${secs}`;
    statHighscore.innerText = progressionManager.highScore;
    gameoverModalOverlay.classList.remove('hidden');

    if (driftComboEl) driftComboEl.classList.add('hidden');
}

restartGameBtn.addEventListener('click', () => { gameoverModalOverlay.classList.add('hidden'); startGame(); });
openSkinsBtn.addEventListener('click', () => { gameoverModalOverlay.classList.add('hidden'); openMenu('Araba Garajı'); });

function updateLeaderboard(sp) {
    const sorted = Object.values(sp).sort((a, b) => (b.driftScore || 0) - (a.driftScore || 0)).slice(0, 5);
    lbList.innerHTML = sorted.map((p, idx) => `<li><span>${idx + 1}. ${p.name || 'Sürücü'}</span><span style="color:#f59e0b">${p.driftScore || 0}</span></li>`).join('') || '<li>Bekleniyor...</li>';
}

function openMenu(reasonText) {
    isGameRunning = false;
    isEmittingTrail = false;
    localCar.group.visible = true;
    explosionManager.clear();
    renderSkinGallery();
    overlayDesc.innerText = reasonText;
    startBtn.innerHTML = '<span class="play-icon">▶</span> SÜRE BAŞLAT';
    overlay.classList.remove('hidden');
}

function startGame() {
    try {
        audioManager.init();
        const playerName = playerNameInput ? (playerNameInput.value.trim() || 'DriftPilotu') : 'DriftPilotu';
        isEngineOn = false; // Car spawns STOPPED until Space is pressed!
        isEmittingTrail = false;

        localCar.reset();
        // Spawn on a clear spot in the city (not inside a building)
        const spawn = arena.findSpawn ? arena.findSpawn() : { x: 0, z: 0 };
        localCar.position.set(spawn.x, 0, spawn.z);
        localCar.group.position.set(spawn.x, 0, spawn.z);
        localCar.group.visible = true;
        explosionManager.clear();
        tronTrailManager.clear();
        gameStartTime = Date.now();
        hasMovedMouseSinceStart = false; // Prevents U-turn crash on spawn!

        // INSTANTLY SNAP CAMERA TO CAR POSITION (0,0,0)
        const hp = localCar.getHeadPosition();
        if (isTPSMode) {
            camera.position.set(hp.x - Math.sin(localCar.heading) * 14, 5.5, hp.z - Math.cos(localCar.heading) * 14);
            camera.lookAt(hp.x, 2.0, hp.z);
        } else {
            camera.position.set(hp.x - Math.sin(localCar.heading) * 12, 22, hp.z - Math.cos(localCar.heading) * 12);
            camera.lookAt(hp.x, 0, hp.z);
        }

        if (socket && socket.connected) {
            socket.emit('join', { name: playerName, skinId: progressionManager.selectedSkinId });
        }

        isGameRunning = true;
        if (overlay) overlay.classList.add('hidden');
        if (gameoverModalOverlay) gameoverModalOverlay.classList.add('hidden');
    } catch (err) {
        console.error("Start Game Error:", err);
        isGameRunning = true;
        if (overlay) overlay.classList.add('hidden');
        if (gameoverModalOverlay) gameoverModalOverlay.classList.add('hidden');
    }
}

startBtn.addEventListener('click', startGame);

// ============== CITY MAP LOADING GATE ==============
startBtn.disabled = true;
const startBtnLabel = startBtn.innerHTML;
startBtn.innerHTML = '<span class="play-icon">⏳</span> HARİTA YÜKLENİYOR...';
arena.ready.then(() => {
    startBtn.disabled = false;
    startBtn.innerHTML = startBtnLabel;
    if (arena.monitor) arenaScreen.setMonitor(arena.monitor);
    console.log(`[🗺️] City map ready — ${arena.buildings.length} collision boxes, monitor: ${arena.monitor ? 'found' : 'MISSING'}`);
}).catch((e) => {
    console.error('City map failed to load:', e);
    startBtn.disabled = false;
    startBtn.innerHTML = startBtnLabel;
});

// ============== RENDER LOOP ==============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const now = Date.now();

    explosionManager.update(delta);
    arenaScreen.update(camera);

    if (isGameRunning) {
        // 1. Raycast for mouse target with NaN & null guards
        raycaster.setFromCamera(mouse, camera);
        const intersectHit = raycaster.ray.intersectPlane(groundPlane, targetPoint);
        if (!intersectHit || isNaN(targetPoint.x) || isNaN(targetPoint.z)) {
            targetPoint.set(0, 0, 0);
        }

        // 2. Control Steering & Engine State
        let steerDir = 0;
        if (keysPressed['KeyA'] || keysPressed['ArrowLeft'] || mobileSteerLeft) steerDir -= 1; // Turn Left (Negative heading)
        if (keysPressed['KeyD'] || keysPressed['ArrowRight'] || mobileSteerRight) steerDir += 1; // Turn Right (Positive heading)

        const controlState = {
            left: !!keysPressed['KeyA'] || !!keysPressed['ArrowLeft'] || mobileSteerLeft,
            right: !!keysPressed['KeyD'] || !!keysPressed['ArrowRight'] || mobileSteerRight,
            forward: !!keysPressed['KeyW'] || !!keysPressed['ArrowUp'],
            backward: !!keysPressed['KeyS'] || !!keysPressed['ArrowDown'],
            steerDir,
            isEngineOn,
            isHandbrake: !!keysPressed['Space'] || !!keysPressed['ShiftLeft'],
            selectedControlScheme
        };

        if (selectedControlScheme === 'keyboard' || !hasMovedMouseSinceStart) {
            localCar.update(delta, null, controlState);
        } else {
            localCar.update(delta, targetPoint, controlState);
        }

        const headPos = localCar.getHeadPosition();
        const driftScore = localCar.getScore();

        // Dynamic Neon Underglow & Overhead Key Spotlight
        const underglowIntensity = isEngineOn ? 12.0 : 2.0;
        carUnderglowLight.intensity = underglowIntensity;
        carUnderglowLight.position.set(headPos.x, 0.4, headPos.z);
        carKeySpotlight.position.set(headPos.x, 18.0, headPos.z);
        carKeySpotlight.target.position.set(headPos.x, 0.5, headPos.z);
        carKeySpotlight.target.updateMatrixWorld();

        // Update traffic cones physics
        arena.updateCones(delta, headPos);

        // 3. Emit Tron Light Trail if engine is ON
        if (isEmittingTrail && now - lastTrailEmitTime > 60) {
            lastTrailEmitTime = now;
            tronTrailManager.addSegment(localSocketId, headPos.x, headPos.z, localCar.heading);
        }

        tronTrailManager.update(delta);

        // 4. Check Collisions (Tron Wall, Barriers, Buildings)
        const isInvincible = (now - gameStartTime) < 3000;
        localCar.group.visible = isInvincible ? (Math.floor(now / 150) % 2 === 0) : true;

        if (!isInvincible) {
            const hitSeg = tronTrailManager.checkCollision(headPos.x, headPos.z, localSocketId);
            if (hitSeg) {
                localCar.currentSpeed *= -0.5;
                localCar.position.x -= Math.sin(localCar.velocityAngle) * 1.0;
                localCar.position.z -= Math.cos(localCar.velocityAngle) * 1.0;
            }

            const hitBarrier = arena.checkBarrierCollision(headPos.x, headPos.z);
            if (hitBarrier) {
                localCar.currentSpeed *= -0.5;
                localCar.position.x -= Math.sin(localCar.velocityAngle) * 1.0;
                localCar.position.z -= Math.cos(localCar.velocityAngle) * 1.0;
            }

            const hitBuilding = arena.checkBuildingCollision(headPos.x, headPos.z, localCar.currentSpeed);
            if (hitBuilding) {
                localCar.currentSpeed *= -0.5;
                localCar.position.x -= Math.sin(localCar.velocityAngle) * 1.0;
                localCar.position.z -= Math.cos(localCar.velocityAngle) * 1.0;
            }

            // Outer arena boundary check
            const maxD = ARENA_SIZE / 2;
            if (Math.abs(headPos.x) > maxD || Math.abs(headPos.z) > maxD) {
                localCar.currentSpeed *= -0.5; // Bounce
                localCar.position.x = Math.max(-maxD + 1.0, Math.min(maxD - 1.0, localCar.position.x));
                localCar.position.z = Math.max(-maxD + 1.0, Math.min(maxD - 1.0, localCar.position.z));
            }
        }

        // 5. Update Minimap Radar HUD
        updateMinimap();

        // 6. Update score display
        scoreElement.innerText = driftScore;
        if (driftScore > progressionManager.highScore) {
            progressionManager.saveHighScore(driftScore);
            highScoreElement.innerText = driftScore;
        }

        // 7. Drift combo display
        if (driftComboEl) {
            if (localCar.isDrifting) {
                driftComboEl.classList.remove('hidden');
                const comboText = localCar.driftCombo > 1 ? ` x${localCar.driftCombo}` : '';
                driftComboEl.innerHTML = `<span class="combo-score">+${Math.floor(localCar.currentDriftScore)}</span><span class="combo-label">DRİFT!${comboText}</span>`;
            } else {
                driftComboEl.classList.add('hidden');
            }
        }

        // 8. Drift angle indicator
        if (driftAngleEl) {
            driftAngleEl.innerText = `${Math.floor(localCar.slipAngle)}°`;
            driftAngleEl.style.color = localCar.slipAngle > 30 ? '#ef4444' : localCar.slipAngle > 10 ? '#f59e0b' : '#6b7280';
        }

        // 9. Wall collision (client-side)
        if (Math.abs(headPos.x) >= arena.halfX - 6 || Math.abs(headPos.z) >= arena.halfZ - 6) {
            localCar.currentSpeed *= -0.5; // Bounce
            localCar.position.x = Math.max(-arena.halfX + 7, Math.min(arena.halfX - 7, localCar.position.x));
            localCar.position.z = Math.max(-arena.halfZ + 7, Math.min(arena.halfZ - 7, localCar.position.z));
        }

        // 10. Car vs car collision
        for (const otherId in otherCars) {
            const rc = otherCars[otherId];
            if (!rc) continue;
            const dx = headPos.x - rc.group.position.x;
            const dz = headPos.z - rc.group.position.z;
            if (dx * dx + dz * dz < 10.0) {
                localCar.currentSpeed *= -0.5;
                localCar.position.x -= Math.sin(localCar.velocityAngle) * 1.5;
                localCar.position.z -= Math.cos(localCar.velocityAngle) * 1.5;
            }
        }

        // 11. Remote car animation
        for (const id in otherCars) otherCars[id].animate(delta);

        // 12. Network emit (20 ticks/sec)
        if (now - lastNetworkEmitTime > 50) {
            lastNetworkEmitTime = now;
            socket.volatile.emit('playerInput', {
                x: Math.round(headPos.x * 10) / 10,
                z: Math.round(headPos.z * 10) / 10,
                angle: Math.round(localCar.currentAngle * 10) / 10,
                skinId: progressionManager.selectedSkinId,
                emittingTrail: isEmittingTrail
            });
        }

        // Camera follow
        currentZoom += (targetZoom - currentZoom) * 0.1;

        if (isTPSMode) {
            const tpsDist = 14 * currentZoom;
            const tpsHeight = 5.5 * currentZoom;

            const camX = headPos.x - Math.sin(localCar.heading) * tpsDist;
            const camZ = headPos.z - Math.cos(localCar.heading) * tpsDist;
            const camY = tpsHeight;

            camera.position.x += (camX - camera.position.x) * 0.2;
            camera.position.y += (camY - camera.position.y) * 0.2;
            camera.position.z += (camZ - camera.position.z) * 0.2;
            camera.lookAt(headPos.x + Math.sin(localCar.heading) * (8 * currentZoom), 2.0 * currentZoom, headPos.z + Math.cos(localCar.heading) * (8 * currentZoom));
        } else {
            const camX = headPos.x - Math.sin(localCar.heading) * 12 * currentZoom;
            const camZ = headPos.z - Math.cos(localCar.heading) * 12 * currentZoom;
            const camY = 22 * currentZoom;

            camera.position.x += (camX - camera.position.x) * 0.15;
            camera.position.y += (camY - camera.position.y) * 0.15;
            camera.position.z += (camZ - camera.position.z) * 0.15;
            camera.lookAt(headPos.x, 0, headPos.z);
        }

        if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
            camera.position.set(headPos.x, 22, headPos.z - 12);
            camera.lookAt(headPos.x, 0, headPos.z);
        }
    } else {
        // MENU MODE: STATIC CALM CAMERA OVERLOOK (ZERO DIZZINESS / NO SPINNING!)
        camera.position.set(0, 48, 58);
        camera.lookAt(0, 0, 0);
    }

    nameTagManager.updatePositions();

    renderer.render(scene, camera);
}

function updateMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 140, 140);

    // Dark Radar Base
    ctx.fillStyle = '#050c18';
    ctx.beginPath();
    ctx.arc(70, 70, 70, 0, Math.PI * 2);
    ctx.fill();

    const hp = localCar.getHeadPosition();
    const mapScale = 140 / arena.size; // origin (world 0,0) maps to radar centre (70,70)

    // 1. Draw Buildings (derived from the city model)
    ctx.fillStyle = '#3a4a63';
    arena.buildings.forEach(b => {
        const bx = 70 + ((b.minX + b.maxX) / 2) * mapScale;
        const bz = 70 + ((b.minZ + b.maxZ) / 2) * mapScale;
        const bw = Math.max(1, (b.maxX - b.minX) * mapScale);
        const bh = Math.max(1, (b.maxZ - b.minZ) * mapScale);
        ctx.fillRect(bx - bw / 2, bz - bh / 2, bw, bh);
    });

    // 2. Draw the video screen marker
    if (arena.monitor) {
        ctx.fillStyle = '#ff2d95';
        ctx.beginPath();
        ctx.arc(70 + arena.monitor.pos.x * mapScale, 70 + arena.monitor.pos.z * mapScale, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. Draw Border
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(70 - arena.halfX * mapScale, 70 - arena.halfZ * mapScale, arena.halfX * 2 * mapScale, arena.halfZ * 2 * mapScale);

    // 5. Draw Multiplayer Opponents (Red Arrows)
    currentPlayersList.forEach(p => {
        if (!p || p.id === localSocketId) return;
        const rx = 70 + (p.x || 0) * mapScale;
        const rz = 70 + (p.z || 0) * mapScale;

        ctx.save();
        ctx.translate(rx, rz);
        ctx.rotate(p.angle || 0);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(3.5, 4);
        ctx.lineTo(-3.5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });

    // 6. Draw Local Player (Cyan Arrow)
    const px = 70 + hp.x * mapScale;
    const pz = 70 + hp.z * mapScale;

    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(localCar.heading);
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

animate();
