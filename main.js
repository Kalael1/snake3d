import * as THREE from 'three';
import { io } from 'socket.io-client';

import { Arena } from './src/Arena.js';
import { DriftCar } from './src/DriftCar.js';
import { OtherCar } from './src/OtherCar.js';
import { AudioManager } from './src/AudioManager.js';
import { SKINS } from './src/SkinRegistry.js';
import { ProgressionManager } from './src/ProgressionManager.js';
import { NameTagManager } from './src/NameTagManager.js';
import { TronTrailManager } from './src/TronTrailManager.js';
import { ExplosionManager } from './src/ExplosionManager.js';

// ============== SOCKET ==============
const SOCKET_URL = window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')
    ? 'https://boutique-mainly-being-succeed.trycloudflare.com'
    : window.location.origin;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const progressionManager = new ProgressionManager();
const audioManager = new AudioManager();

// ============== SCENE & STABLE HIGH-PERFORMANCE LIGHTING ==============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
scene.fog = new THREE.FogExp2(0x1e293b, 0.0022);

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

// 1. Bright Ambient Hemisphere Light
const hemiLight = new THREE.HemisphereLight(0x00f3ff, 0x334155, 1.4);
scene.add(hemiLight);

// 2. Primary Cyber Moonlight
const dirLight = new THREE.DirectionalLight(0x7dd3fc, 2.6);
dirLight.position.set(100, 180, 80);
scene.add(dirLight);

// 3. Pink / Magenta Rim Accent Light
const rimLight = new THREE.DirectionalLight(0xff0077, 2.2);
rimLight.position.set(-120, 100, -100);
scene.add(rimLight);

// 4. Dynamic Car Underglow PointLight
const carUnderglowLight = new THREE.PointLight(0x00f3ff, 12.0, 22);
scene.add(carUnderglowLight);

// 5. Dedicated Car Key Spotlight (Follows car directly from above!)
const carKeySpotlight = new THREE.SpotLight(0xffffff, 16.0, 45, Math.PI / 3, 0.4);
scene.add(carKeySpotlight);

// ============== GAME ENTITIES ==============
const arena = new Arena(scene, 500);
const localCar = new DriftCar(scene);
localCar.applySkin(progressionManager.selectedSkinId);

const tronTrailManager = new TronTrailManager(scene);
const explosionManager = new ExplosionManager(scene);
const otherCars = {};

let isGameRunning = false;
let isEmittingTrail = false;
let lastTrailEmitTime = 0;
let localSocketId = null;
let currentPlayersList = [];
let gameStartTime = 0;
let lastNetworkEmitTime = 0;

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
        isEngineOn = !isEngineOn;
        isEmittingTrail = isEngineOn;
        if (!isEngineOn) tronTrailManager.breakPlayerTrail(localSocketId);
    }
    if (e.code === 'Escape' && isGameRunning) openMenu('Oyun Duraklatıldı');
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
});

// ============== GAME OVER & EXPLOSION SYSTEM ==============
function triggerGameOver(reasonText) {
    if (!isGameRunning) return;
    isGameRunning = false;
    isEmittingTrail = false;
    audioManager.playCrash();

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
        isEngineOn = true;
        isEmittingTrail = false;

        localCar.reset();
        localCar.group.visible = true;
        explosionManager.clear();
        tronTrailManager.clear();
        gameStartTime = Date.now();

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

// ============== RENDER LOOP ==============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const now = Date.now();

    explosionManager.update(delta);

    if (isGameRunning) {
        // 1. Raycast for mouse target with NaN & null guards
        raycaster.setFromCamera(mouse, camera);
        const intersectHit = raycaster.ray.intersectPlane(groundPlane, targetPoint);
        if (!intersectHit || isNaN(targetPoint.x) || isNaN(targetPoint.z)) {
            targetPoint.set(0, 0, 0);
        }

        // 2. Control Steering & Engine State
        let steerDir = 0;
        if (keysPressed['KeyA'] || keysPressed['ArrowLeft'] || mobileSteerLeft) steerDir += 1; // Turn Left
        if (keysPressed['KeyD'] || keysPressed['ArrowRight'] || mobileSteerRight) steerDir -= 1; // Turn Right

        const controlState = {
            left: !!keysPressed['KeyQ'],
            right: !!keysPressed['KeyE'],
            steerDir,
            isEngineOn
        };

        // Hybrid steering: Both Mouse Target & Keyboard A/D steer seamlessly!
        localCar.update(delta, targetPoint, controlState);

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
        const hitSeg = tronTrailManager.checkCollision(headPos.x, headPos.z, localSocketId);
        if (hitSeg) {
            triggerGameOver("⚡ Tron Neon Işıklı Duvara Çarptın!");
            return;
        }

        const hitBarrier = arena.checkBarrierCollision(headPos.x, headPos.z);
        if (hitBarrier) {
            triggerGameOver("💥 Neon Güvenlik Bariyerine Yüksek Hızla Çarptın!");
            return;
        }

        const hitBuilding = arena.checkBuildingCollision(headPos.x, headPos.z);
        if (hitBuilding) {
            triggerGameOver("💥 Binaya Yüksek Hızla Çarptın!");
            return;
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
        const wallThreshold = 240;
        if (Math.abs(headPos.x) >= wallThreshold || Math.abs(headPos.z) >= wallThreshold) {
            triggerGameOver('💥 Duvara çarptın!');
            return;
        }

        // 10. Car vs car collision
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

            const camX = hp.x - Math.sin(localCar.heading) * tpsDist;
            const camZ = hp.z - Math.cos(localCar.heading) * tpsDist;
            const camY = tpsHeight;

            camera.position.x += (camX - camera.position.x) * 0.2;
            camera.position.y += (camY - camera.position.y) * 0.2;
            camera.position.z += (camZ - camera.position.z) * 0.2;
            camera.lookAt(hp.x + Math.sin(localCar.heading) * (8 * currentZoom), 2.0 * currentZoom, hp.z + Math.cos(localCar.heading) * (8 * currentZoom));
        } else {
            const camX = hp.x - Math.sin(localCar.heading) * 12 * currentZoom;
            const camZ = hp.z - Math.cos(localCar.heading) * 12 * currentZoom;
            const camY = 22 * currentZoom;

            camera.position.x += (camX - camera.position.x) * 0.15;
            camera.position.y += (camY - camera.position.y) * 0.15;
            camera.position.z += (camZ - camera.position.z) * 0.15;
            camera.lookAt(hp.x, 0, hp.z);
        }

        if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
            camera.position.set(hp.x, 22, hp.z - 12);
            camera.lookAt(hp.x, 0, hp.z);
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
    const mapScale = 140 / arena.size;

    // 1. Draw Road Avenues
    ctx.fillStyle = '#1e293b';
    const roadPositions = [-120, 0, 120];
    const roadWidth = 28 * mapScale;

    roadPositions.forEach(offset => {
        const rx = 70 + offset * mapScale - roadWidth / 2;
        ctx.fillRect(rx, 0, roadWidth, 140);

        const rz = 70 + offset * mapScale - roadWidth / 2;
        ctx.fillRect(0, rz, 140, roadWidth);
    });

    // 2. Draw Roundabout
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(70, 70, 19 * mapScale, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Draw Buildings
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1;

    arena.buildings.forEach(b => {
        const bx = 70 + ((b.minX + b.maxX) / 2) * mapScale;
        const bz = 70 + ((b.minZ + b.maxZ) / 2) * mapScale;
        const bw = (b.maxX - b.minX - 2.4) * mapScale;
        const bh = (b.maxZ - b.minZ - 2.4) * mapScale;

        ctx.fillRect(bx - bw / 2, bz - bh / 2, bw, bh);
        ctx.strokeRect(bx - bw / 2, bz - bh / 2, bw, bh);
    });

    // 4. Draw Border
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 2;
    ctx.strokeRect(70 - 250 * mapScale, 70 - 250 * mapScale, 500 * mapScale, 500 * mapScale);

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
