import * as THREE from 'three';
import { io } from 'socket.io-client';

import { Arena } from './src/Arena.js';
import { Snake } from './src/Snake.js';
import { OtherSnake } from './src/OtherSnake.js';
import { AudioManager } from './src/AudioManager.js';
import { SKINS } from './src/SkinRegistry.js';
import { ProgressionManager } from './src/ProgressionManager.js';
import { NameTagManager } from './src/NameTagManager.js';

// ============== SOCKET CONNECTION ==============
const SOCKET_URL = window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')
    ? 'https://boutique-mainly-being-succeed.trycloudflare.com'
    : window.location.origin;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

// ============== MANAGERS ==============
const progressionManager = new ProgressionManager();
const audioManager = new AudioManager();

// ============== THREE.JS SCENE (Minimal, Fast) ==============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x475569);
// NO fog — fog causes per-object GPU overhead

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 800);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1.0); // Force 1x — biggest single perf win on mobile/retina
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.NoToneMapping; // Skip tone mapping
document.getElementById('app').appendChild(renderer.domElement);

const nameTagManager = new NameTagManager(camera, document.getElementById('nametag-container'));

// Simple lighting — no shadows
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.2);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(120, 200, 100);
scene.add(dirLight);

// ============== GAME ENTITIES ==============
const arenaSize = 500;
const arena = new Arena(scene, arenaSize);
const localSnake = new Snake(scene);
localSnake.applySkin(progressionManager.selectedSkinId);

const otherSnakes = {};

// ============== FOOD SYSTEM (InstancedMesh — 1 draw call!) ==============
const MAX_FOOD_INSTANCES = 200;
const foodGeo = new THREE.CircleGeometry(0.7, 8);
const foodMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const foodInstancedMesh = new THREE.InstancedMesh(foodGeo, foodMat, MAX_FOOD_INSTANCES);
foodInstancedMesh.rotation.x = -Math.PI / 2;
foodInstancedMesh.position.y = 0.2;
scene.add(foodInstancedMesh);

// Food data stored in arrays (zero GC)
const foodIds = new Array(MAX_FOOD_INSTANCES).fill(null);
const foodX = new Float32Array(MAX_FOOD_INSTANCES);
const foodZ = new Float32Array(MAX_FOOD_INSTANCES);
const foodValues = new Uint8Array(MAX_FOOD_INSTANCES);
let foodCount = 0;

const foodColorPalette = [
    new THREE.Color(0xff0055), new THREE.Color(0x00ffcc), new THREE.Color(0xffff00),
    new THREE.Color(0xaa00ff), new THREE.Color(0xff8800), new THREE.Color(0x00ffaa)
];
const _tempMatrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();

const localEatenFoods = new Set();

function rebuildFoodInstances() {
    for (let i = 0; i < foodCount; i++) {
        _tempMatrix.makeTranslation(foodX[i], foodZ[i], 0); // Note: CircleGeo is rotated, so Y→Z mapping
        foodInstancedMesh.setMatrixAt(i, _tempMatrix);
        foodInstancedMesh.setColorAt(i, foodColorPalette[i % foodColorPalette.length]);
    }
    foodInstancedMesh.count = foodCount;
    foodInstancedMesh.instanceMatrix.needsUpdate = true;
    if (foodInstancedMesh.instanceColor) foodInstancedMesh.instanceColor.needsUpdate = true;
}

function addFoodData(f) {
    if (foodCount >= MAX_FOOD_INSTANCES || localEatenFoods.has(f.id)) return;
    // Check duplicate
    for (let i = 0; i < foodCount; i++) {
        if (foodIds[i] === f.id) return;
    }
    const idx = foodCount;
    foodIds[idx] = f.id;
    foodX[idx] = f.x;
    foodZ[idx] = f.z;
    foodValues[idx] = f.value || 2;
    foodCount++;
}

function removeFoodData(foodId) {
    for (let i = 0; i < foodCount; i++) {
        if (foodIds[i] === foodId) {
            // Swap with last element
            const last = foodCount - 1;
            foodIds[i] = foodIds[last];
            foodX[i] = foodX[last];
            foodZ[i] = foodZ[last];
            foodValues[i] = foodValues[last];
            foodIds[last] = null;
            foodCount--;
            return;
        }
    }
}

function syncFoods(foodList) {
    foodCount = 0;
    for (let i = 0; i < foodList.length && i < MAX_FOOD_INSTANCES; i++) {
        const f = foodList[i];
        foodIds[i] = f.id;
        foodX[i] = f.x;
        foodZ[i] = f.z;
        foodValues[i] = f.value || 2;
        foodCount++;
    }
    rebuildFoodInstances();
}

// ============== GAME STATE ==============
let isGameRunning = false;
let isBoosting = false;
let localSocketId = null;
let currentScore = 0;
let gameStartTime = 0;
let currentPlayersList = [];
let lastNetworkEmitTime = 0;
let lastFoodRebuildTime = 0;

let targetZoom = 1.0;
let currentZoom = 1.0;

window.addEventListener('wheel', (e) => {
    targetZoom += e.deltaY * 0.0015;
    targetZoom = Math.max(0.35, Math.min(3.0, targetZoom));
}, { passive: true });

// ============== DOM ELEMENTS ==============
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
        skinProgressText.innerText = `👑 TÜM KOSTÜMLER AÇILDI! (${highScore} Rekor)`;
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
                localSnake.applySkin(skin.id);
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
    const cleanText = text.trim();
    if (!cleanText) return;
    socket.emit('chatMessage', { text: cleanText, isEmoji: isEmoji });
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
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        targetZoom += (initialPinchDist - currentDist) * 0.005;
        targetZoom = Math.max(0.35, Math.min(3.0, targetZoom));
        initialPinchDist = currentDist;
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        virtualJoystick.classList.add('hidden');
        joystickKnob.style.transform = 'translate(-50%, -50%)';
        initialPinchDist = null;
    }
}, { passive: true });

// Boost controls
function setBoostState(state) {
    if (isBoosting !== state) {
        isBoosting = state;
        if (isBoosting) audioManager.startBoost(); else audioManager.stopBoost();
    }
}

mobileBoostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setBoostState(true); });
mobileBoostBtn.addEventListener('touchend', (e) => { e.preventDefault(); setBoostState(false); });
mobileBoostBtn.addEventListener('mousedown', (e) => { e.preventDefault(); setBoostState(true); });
mobileBoostBtn.addEventListener('mouseup', (e) => { e.preventDefault(); setBoostState(false); });

window.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('#mobile-boost-btn,#mobile-chat-modal')) return;
    if (e.button === 0 && isGameRunning) setBoostState(true);
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) setBoostState(false); });
window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    if (e.code === 'Space' && isGameRunning) setBoostState(true);
    else if (e.code === 'Escape' && isGameRunning) { setBoostState(false); openMenu('Oyun Duraklatıldı'); }
});
window.addEventListener('keyup', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    if (e.code === 'Space') setBoostState(false);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============== SOCKET EVENTS ==============
socket.on('init', (data) => {
    localSocketId = data.id;
    syncFoods(data.foods || []);
});

socket.on('foodRemoved', (data) => {
    if (data && data.foodId) {
        localEatenFoods.add(data.foodId);
        removeFoodData(data.foodId);
    }
    if (data && data.newFood) addFoodData(data.newFood);
    // Defer instance rebuild to next frame (batch updates)
    lastFoodRebuildTime = 0;
});

socket.on('gameState', (state) => {
    if (!state) return;
    const serverPlayers = state.players || {};
    currentPlayersList = Object.values(serverPlayers);

    if (localSocketId && serverPlayers[localSocketId]) {
        const pData = serverPlayers[localSocketId];
        const serverScore = pData.score || 0;
        if (serverScore > currentScore) {
            currentScore = serverScore;
            scoreElement.innerText = currentScore;
            localSnake.updateGrowth(currentScore);
            if (currentScore > progressionManager.highScore) {
                progressionManager.saveHighScore(currentScore);
                highScoreElement.innerText = currentScore;
            }
        }
        nameTagManager.createOrUpdateTag(localSocketId, pData.name, localSnake.activeSkin.icon, () => localSnake.getHeadPosition(), true);
    }

    for (const id in serverPlayers) {
        if (id === localSocketId) continue;
        const pd = serverPlayers[id];

        if (!otherSnakes[id]) {
            otherSnakes[id] = new OtherSnake(scene, pd);
        }

        // Direct smooth update — no intermediate buffer
        otherSnakes[id].updateFromServer(pd);

        const skinIcon = otherSnakes[id].activeSkin ? otherSnakes[id].activeSkin.icon : '🐍';
        nameTagManager.createOrUpdateTag(id, pd.name, skinIcon, () => otherSnakes[id].segments[0] ? otherSnakes[id].segments[0].position : null, false);
    }

    for (const id in otherSnakes) {
        if (!serverPlayers[id]) {
            otherSnakes[id].destroy();
            delete otherSnakes[id];
            nameTagManager.removeTag(id);
        }
    }

    updateLeaderboard(serverPlayers);
});

socket.on('gameOver', (data) => { triggerGameOver(data ? data.reason : 'Oyun Bitti!'); });

function triggerGameOver(reasonText) {
    if (!isGameRunning) return;
    isGameRunning = false;
    setBoostState(false);
    virtualJoystick.classList.add('hidden');
    audioManager.playDeath();
    progressionManager.saveHighScore(currentScore);
    highScoreElement.innerText = progressionManager.highScore;

    const secondsSurvived = Math.floor((Date.now() - gameStartTime) / 1000);
    const mins = String(Math.floor(secondsSurvived / 60)).padStart(2, '0');
    const secs = String(secondsSurvived % 60).padStart(2, '0');

    const sorted = currentPlayersList.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    const rankIndex = sorted.findIndex(p => p.id === localSocketId);

    gameoverReasonText.innerText = reasonText || 'Oyun Bitti!';
    statRank.innerText = rankIndex !== -1 ? `#${rankIndex + 1}` : '#1';
    statScore.innerText = currentScore;
    statTime.innerText = `${mins}:${secs}`;
    statHighscore.innerText = progressionManager.highScore;
    gameoverModalOverlay.classList.remove('hidden');
}

restartGameBtn.addEventListener('click', () => { gameoverModalOverlay.classList.add('hidden'); startGame(); });
openSkinsBtn.addEventListener('click', () => { gameoverModalOverlay.classList.add('hidden'); openMenu('Kostüm Garazı'); });

function updateLeaderboard(serverPlayers) {
    const sorted = Object.values(serverPlayers).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
    lbList.innerHTML = sorted.map((p, idx) => `<li><span>${idx + 1}. ${p.name || 'Oyuncu'}</span><span style="color:#06b6d4">${p.score || 0}</span></li>`).join('') || '<li>Bekleniyor...</li>';
}

function openMenu(reasonText) {
    isGameRunning = false;
    setBoostState(false);
    virtualJoystick.classList.add('hidden');
    renderSkinGallery();
    overlayDesc.innerText = reasonText;
    startBtn.innerHTML = '<span class="play-icon">▶</span> OYUNA BAŞLA';
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
    const playerName = playerNameInput.value.trim() || 'YılanOyuncusu';
    currentScore = 0;
    scoreElement.innerText = '0';
    localEatenFoods.clear();
    localSnake.reset();
    gameStartTime = Date.now();
    socket.emit('join', { name: playerName, skinId: progressionManager.selectedSkinId });
    isGameRunning = true;
    overlay.classList.add('hidden');
    gameoverModalOverlay.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);

// ============== MAIN RENDER LOOP (Ultra-Optimized) ==============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const now = Date.now();

    if (isGameRunning) {
        // 1. Raycast
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(groundPlane, targetPoint);

        // 2. Local snake
        localSnake.update(delta, targetPoint, isBoosting);
        const headPos = localSnake.getHeadPosition();

        // 3. Wall collision
        const wallThreshold = 240;
        if (Math.abs(headPos.x) >= wallThreshold || Math.abs(headPos.z) >= wallThreshold) {
            triggerGameOver('💥 Harita duvarına çarptın!');
            socket.emit('playerInput', { x: headPos.x, z: headPos.z, dead: true });
            return;
        }

        // 4. Snake vs snake collision
        for (const otherId in otherSnakes) {
            const rs = otherSnakes[otherId];
            if (!rs || !rs.segments) continue;
            for (let i = 1; i < rs.segments.length; i++) {
                const sp = rs.segments[i].position;
                const dx = headPos.x - sp.x;
                const dz = headPos.z - sp.z;
                if (dx * dx + dz * dz < 4.0) {
                    triggerGameOver(`💥 ${rs.name} oyuncusuna çarptın!`);
                    socket.emit('playerInput', { x: headPos.x, z: headPos.z, dead: true });
                    return;
                }
            }
        }

        // 5. Smooth body follow for remote snakes
        for (const id in otherSnakes) {
            otherSnakes[id].animateBody(delta);
        }

        // 6. Food eating check (array-based, zero GC)
        for (let i = 0; i < foodCount; i++) {
            if (localEatenFoods.has(foodIds[i])) continue;
            const dx = headPos.x - foodX[i];
            const dz = headPos.z - foodZ[i];
            if (dx * dx + dz * dz < 8.0) {
                const fId = foodIds[i];
                const fVal = foodValues[i];
                localEatenFoods.add(fId);
                removeFoodData(fId);
                audioManager.playEat();
                currentScore += fVal;
                scoreElement.innerText = currentScore;
                localSnake.updateGrowth(currentScore);
                if (currentScore > progressionManager.highScore) {
                    progressionManager.saveHighScore(currentScore);
                    highScoreElement.innerText = currentScore;
                }
                socket.emit('eatFood', { foodId: fId });
                lastFoodRebuildTime = 0;
                break;
            }
        }

        // 7. Network emit (20 ticks/sec)
        if (now - lastNetworkEmitTime > 50) {
            lastNetworkEmitTime = now;
            socket.volatile.emit('playerInput', {
                x: Math.round(headPos.x * 10) / 10,
                z: Math.round(headPos.z * 10) / 10,
                angle: Math.round(localSnake.currentAngle * 10) / 10,
                isBoosting: isBoosting,
                skinId: progressionManager.selectedSkinId
            });
        }
    } else {
        const time = now * 0.004;
        targetPoint.set(Math.cos(time) * 20, 0, Math.sin(time) * 20);
        localSnake.update(delta, targetPoint, false);
    }

    // 8. Rebuild food instances (batched, max once per 100ms)
    if (now - lastFoodRebuildTime > 100) {
        lastFoodRebuildTime = now;
        rebuildFoodInstances();
    }

    // 9. Camera
    currentZoom += (targetZoom - currentZoom) * 0.1;
    const hp = localSnake.getHeadPosition();
    camera.position.x += (hp.x - camera.position.x) * 0.15;
    camera.position.y += (hp.y + 26 * currentZoom - camera.position.y) * 0.15;
    camera.position.z += (hp.z + 20 * currentZoom - camera.position.z) * 0.15;
    camera.lookAt(hp.x, hp.y, hp.z - 2);

    // 10. Name tags
    nameTagManager.updatePositions();

    renderer.render(scene, camera);
}

animate();
