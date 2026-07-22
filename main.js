import * as THREE from 'three';
import { io } from 'socket.io-client';

import { Arena } from './src/Arena.js';
import { DriftCar } from './src/DriftCar.js';
import { OtherCar } from './src/OtherCar.js';
import { AudioManager } from './src/AudioManager.js';
import { SKINS } from './src/SkinRegistry.js';
import { ProgressionManager } from './src/ProgressionManager.js';
import { NameTagManager } from './src/NameTagManager.js';

// ============== SOCKET ==============
const SOCKET_URL = window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')
    ? 'https://boutique-mainly-being-succeed.trycloudflare.com'
    : window.location.origin;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const progressionManager = new ProgressionManager();
const audioManager = new AudioManager();

// ============== SCENE ==============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 800);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1.0);
renderer.shadowMap.enabled = false;
document.getElementById('app').appendChild(renderer.domElement);

const nameTagManager = new NameTagManager(camera, document.getElementById('nametag-container'));

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1a1a2e, 1.2);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(120, 200, 100);
scene.add(dirLight);

// ============== GAME ENTITIES ==============
const arena = new Arena(scene, 500);
const localCar = new DriftCar(scene);
localCar.applySkin(progressionManager.selectedSkinId);

const otherCars = {};

let isGameRunning = false;
let localSocketId = null;
let gameStartTime = 0;
let currentPlayersList = [];
let lastNetworkEmitTime = 0;

let targetZoom = 1.0;
let currentZoom = 1.0;

window.addEventListener('wheel', (e) => {
    targetZoom += e.deltaY * 0.0015;
    targetZoom = Math.max(0.4, Math.min(2.5, targetZoom));
}, { passive: true });

// ============== DOM ==============
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayDesc = document.getElementById('overlay-desc');
const playerNameInput = document.getElementById('player-name');
const lbList = document.getElementById('lb-list');
const soundBtn = document.getElementById('sound-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const skinCardsGrid = document.getElementById('skin-cards-grid');
const skinProgressText = document.getElementById('skin-progress-text');
const skinProgressFill = document.getElementById('skin-progress-bar-fill');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const mobileBoostBtn = document.getElementById('mobile-boost-btn');
const virtualJoystick = document.getElementById('virtual-joystick');
const joystickKnob = document.getElementById('joystick-knob');

const gameoverModalOverlay = document.getElementById('gameover-modal-overlay');
const gameoverReasonText = document.getElementById('gameover-reason-text');
const statRank = document.getElementById('stat-rank');
const statScore = document.getElementById('stat-score');
const statTime = document.getElementById('stat-time');
const statHighscore = document.getElementById('stat-highscore');
const restartGameBtn = document.getElementById('restart-game-btn');
const openSkinsBtn = document.getElementById('open-skins-btn');

const mobileChatModal = document.getElementById('mobile-chat-modal');
const mobileChatMessages = document.getElementById('mobile-chat-messages');
const mobileChatInput = document.getElementById('mobile-chat-input');
const mobileSendChatBtn = document.getElementById('mobile-send-chat-btn');
const closeMobileChatBtn = document.getElementById('close-mobile-chat-btn');

// Drift combo display
const driftComboEl = document.getElementById('drift-combo');
const driftAngleEl = document.getElementById('drift-angle');

highScoreElement.innerText = progressionManager.highScore;

soundBtn.addEventListener('click', () => {
    const muted = audioManager.toggleMute();
    soundBtn.innerText = muted ? '🔇' : '🔊';
});

function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        requestLandscapeAndFullscreen();
        fullscreenBtn.innerText = '🗗';
    } else {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
        fullscreenBtn.innerText = '⛶';
    }
}
fullscreenBtn.addEventListener('click', toggleFullscreen);

// ============== SKIN GALLERY ==============
function renderSkinGallery() {
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

// ============== CHAT ==============
function sendChatMessage(text, isEmoji = false) {
    const t = text.trim();
    if (!t) return;
    socket.emit('chatMessage', { text: t, isEmoji });
}
sendChatBtn.addEventListener('click', () => { sendChatMessage(chatInput.value); chatInput.value = ''; });
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { sendChatMessage(chatInput.value); chatInput.value = ''; chatInput.blur(); } });
chatInput.addEventListener('focus', () => {
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
        chatInput.blur();
        mobileChatModal.classList.remove('hidden');
        setTimeout(() => mobileChatInput.focus(), 100);
    }
});
closeMobileChatBtn.addEventListener('click', () => mobileChatModal.classList.add('hidden'));
mobileSendChatBtn.addEventListener('click', () => { sendChatMessage(mobileChatInput.value); mobileChatInput.value = ''; mobileChatModal.classList.add('hidden'); });
mobileChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { sendChatMessage(mobileChatInput.value); mobileChatInput.value = ''; mobileChatInput.blur(); mobileChatModal.classList.add('hidden'); } });
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => { const emoji = btn.getAttribute('data-emoji'); if (emoji) sendChatMessage(emoji, true); });
});
socket.on('chatReceived', (data) => {
    if (!data) return;
    const html = `<div class="chat-msg"><span class="sender">${data.name}:</span> ${data.text}</div>`;
    chatMessages.insertAdjacentHTML('beforeend', html);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    mobileChatMessages.insertAdjacentHTML('beforeend', html);
    mobileChatMessages.scrollTop = mobileChatMessages.scrollHeight;
    nameTagManager.showBubble(data.id, data.text, data.isEmoji);
});

// ============== CONTROLS ==============
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const targetPoint = new THREE.Vector3(0, 0, 10);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

let touchStartOrigin = { x: 0, y: 0 };
let initialPinchDist = null;

window.addEventListener('touchstart', (e) => {
    if (!isGameRunning) return;
    if (e.touches.length === 1) {
        if (e.target.closest('#chat-container,#mobile-boost-btn,#sound-btn,#fullscreen-btn,#mobile-chat-modal')) return;
        const t = e.touches[0];
        touchStartOrigin = { x: t.clientX, y: t.clientY };
        virtualJoystick.style.left = `${t.clientX}px`;
        virtualJoystick.style.top = `${t.clientY}px`;
        virtualJoystick.classList.remove('hidden');
        mouse.x = (t.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
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
        mouse.x = (t.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
        const dx = t.clientX - touchStartOrigin.x;
        const dy = t.clientY - touchStartOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const knobDist = Math.min(dist, 45);
        joystickKnob.style.transform = `translate(-50%, -50%) translate(${Math.cos(angle) * knobDist}px, ${Math.sin(angle) * knobDist}px)`;
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
        virtualJoystick.classList.add('hidden');
        joystickKnob.style.transform = 'translate(-50%, -50%)';
        initialPinchDist = null;
    }
}, { passive: true });

// Keyboard Steering & Nitro Boost State
const keysPressed = {};

window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    keysPressed[e.code] = true;
    if (e.code === 'Escape' && isGameRunning) openMenu('Oyun Duraklatıldı');
});

window.addEventListener('keyup', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    keysPressed[e.code] = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============== SOCKET EVENTS ==============
socket.on('init', (data) => { localSocketId = data.id; });

socket.on('gameState', (state) => {
    if (!state) return;
    const sp = state.players || {};
    currentPlayersList = Object.values(sp);

    if (localSocketId && sp[localSocketId]) {
        const pd = sp[localSocketId];
        nameTagManager.createOrUpdateTag(localSocketId, pd.name, localCar.activeSkin.icon, () => localCar.getHeadPosition(), true);
    }

    for (const id in sp) {
        if (id === localSocketId) continue;
        const pd = sp[id];
        if (!otherCars[id]) otherCars[id] = new OtherCar(scene, pd);
        otherCars[id].updateFromServer(pd);
        nameTagManager.createOrUpdateTag(id, pd.name, otherCars[id].activeSkin.icon, () => otherCars[id].group.position, false);
    }

    for (const id in otherCars) {
        if (!sp[id]) {
            otherCars[id].destroy();
            delete otherCars[id];
            nameTagManager.removeTag(id);
        }
    }

    updateLeaderboard(sp);
});

socket.on('gameOver', (data) => { triggerGameOver(data ? data.reason : 'Oyun Bitti!'); });

function triggerGameOver(reasonText) {
    if (!isGameRunning) return;
    isGameRunning = false;
    audioManager.playDeath();

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

    // Hide drift combo
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
    virtualJoystick.classList.add('hidden');
    renderSkinGallery();
    overlayDesc.innerText = reasonText;
    startBtn.innerHTML = '<span class="play-icon">▶</span> SÜRE BAŞLAT';
    overlay.classList.remove('hidden');
}

function requestLandscapeAndFullscreen() {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen().catch(() => {});
}

function startGame() {
    audioManager.init();
    requestLandscapeAndFullscreen();
    const playerName = playerNameInput.value.trim() || 'DriftPilotu';
    localCar.reset();
    gameStartTime = Date.now();
    socket.emit('join', { name: playerName, skinId: progressionManager.selectedSkinId });
    isGameRunning = true;
    overlay.classList.add('hidden');
    gameoverModalOverlay.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);

// ============== RENDER LOOP ==============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const now = Date.now();

    if (isGameRunning) {
        // 1. Raycast for mouse target
        raycaster.setFromCamera(mouse, camera);
        // Compute keyboard steering & nitro boost
        let keySteerInput = 0;
        if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) keySteerInput -= 1;
        if (keysPressed['KeyD'] || keysPressed['ArrowRight']) keySteerInput += 1;

        const isBoosting = !!(keysPressed['Space'] || keysPressed['ShiftLeft'] || keysPressed['ShiftRight'] || keysPressed['KeyW'] || keysPressed['ArrowUp']);

        // 2. Update local car physics
        localCar.update(delta, targetPoint, isBoosting, keySteerInput);
        const headPos = localCar.getHeadPosition();
        const driftScore = localCar.getScore();

        // 3. Update score display
        scoreElement.innerText = driftScore;
        if (driftScore > progressionManager.highScore) {
            progressionManager.saveHighScore(driftScore);
            highScoreElement.innerText = driftScore;
        }

        // 4. Drift combo display
        if (driftComboEl) {
            if (localCar.isDrifting) {
                driftComboEl.classList.remove('hidden');
                const comboText = localCar.driftCombo > 1 ? ` x${localCar.driftCombo}` : '';
                driftComboEl.innerHTML = `<span class="combo-score">+${Math.floor(localCar.currentDriftScore)}</span><span class="combo-label">DRİFT!${comboText}</span>`;
            } else {
                driftComboEl.classList.add('hidden');
            }
        }

        // 5. Drift angle indicator
        if (driftAngleEl) {
            driftAngleEl.innerText = `${Math.floor(localCar.slipAngle)}°`;
            driftAngleEl.style.color = localCar.slipAngle > 30 ? '#ef4444' : localCar.slipAngle > 10 ? '#f59e0b' : '#6b7280';
        }

        // 6. Wall collision (client-side)
        const wallThreshold = 240;
        if (Math.abs(headPos.x) >= wallThreshold || Math.abs(headPos.z) >= wallThreshold) {
            triggerGameOver('💥 Duvara çarptın!');
            return;
        }

        // 7. Car vs car collision
        for (const otherId in otherCars) {
            const rc = otherCars[otherId];
            if (!rc) continue;
            const dx = headPos.x - rc.group.position.x;
            const dz = headPos.z - rc.group.position.z;
            if (dx * dx + dz * dz < 10.0) {
                triggerGameOver(`💥 ${rc.name} ile çarpıştın!`);
                return;
            }
        }

        // 8. Remote car animation
        for (const id in otherCars) otherCars[id].animate(delta);

        // 9. Network emit (20 ticks/sec)
        if (now - lastNetworkEmitTime > 50) {
            lastNetworkEmitTime = now;
            socket.volatile.emit('playerInput', {
                x: Math.round(headPos.x * 10) / 10,
                z: Math.round(headPos.z * 10) / 10,
                angle: Math.round(localCar.currentAngle * 10) / 10,
                driftScore: driftScore,
                skinId: progressionManager.selectedSkinId
            });
        }
    } else {
        // Menu idle animation
        const time = now * 0.003;
        targetPoint.set(Math.cos(time) * 30, 0, Math.sin(time) * 30);
        localCar.update(delta, targetPoint);
    }

    // Camera follow
    currentZoom += (targetZoom - currentZoom) * 0.1;
    const hp = localCar.getHeadPosition();
    const camX = hp.x - Math.sin(localCar.heading) * 8 * currentZoom;
    const camZ = hp.z - Math.cos(localCar.heading) * 8 * currentZoom;
    const camY = 15 * currentZoom;

    camera.position.x += (camX - camera.position.x) * 0.08;
    camera.position.y += (camY - camera.position.y) * 0.08;
    camera.position.z += (camZ - camera.position.z) * 0.08;
    camera.lookAt(hp.x, 0, hp.z);

    nameTagManager.updatePositions();
    renderer.render(scene, camera);
}

animate();
