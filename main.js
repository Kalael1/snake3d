import * as THREE from 'three';
import { io } from 'socket.io-client';

import { Arena } from './src/Arena.js';
import { Snake } from './src/Snake.js';
import { OtherSnake } from './src/OtherSnake.js';
import { AudioManager } from './src/AudioManager.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { SKINS } from './src/SkinRegistry.js';
import { ProgressionManager } from './src/ProgressionManager.js';
import { NameTagManager } from './src/NameTagManager.js';
import { NetworkInterpolator } from './src/NetworkInterpolator.js';

// Setup Socket.io Client
const socket = io();

// Managers
const progressionManager = new ProgressionManager();
const audioManager = new AudioManager();
const networkInterpolator = new NetworkInterpolator(50);

// Setup basic scene with Slate Gray theme
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x475569);
scene.fog = new THREE.FogExp2(0x475569, 0.002);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

// NameTag & Floating Bubble Manager
const nameTagManager = new NameTagManager(camera, document.getElementById('nametag-container'));

// Balanced Soft Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(120, 200, 100);
dirLight.castShadow = false;
scene.add(dirLight);

const particleSystem = new ParticleSystem(scene);

// Game Entities
const arenaSize = 500;
const arena = new Arena(scene, arenaSize);
const localSnake = new Snake(scene);
localSnake.applySkin(progressionManager.selectedSkinId);

const otherSnakes = {};
const foodMeshes = {};
const localEatenFoods = new Set();

let isGameRunning = false;
let isBoosting = false;
let localSocketId = null;
let currentScore = 0;

// Camera Zoom
let targetZoom = 1.0;
let currentZoom = 1.0;

window.addEventListener('wheel', (event) => {
    targetZoom += event.deltaY * 0.0015;
    targetZoom = Math.max(0.35, Math.min(3.0, targetZoom));
}, { passive: true });

// DOM Elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const finalScoreBox = document.getElementById('final-score-box');
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

// Mobile Chat Drawer Elements
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

// FULLSCREEN TOGGLE
function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        requestLandscapeAndFullscreen();
        fullscreenBtn.innerText = '🗗';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen().catch(() => {});
        }
        fullscreenBtn.innerText = '⛶';
    }
}
fullscreenBtn.addEventListener('click', toggleFullscreen);

// Render Gamified Skin Gallery Grid
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
        if (isSelected) {
            badgeHtml = `<span class="skin-badge active">SEÇİLİ</span>`;
        } else if (isUnlocked) {
            badgeHtml = `<span class="skin-badge unlocked">AÇIK</span>`;
        } else {
            badgeHtml = `<span class="skin-badge locked-badge">🔒 ${skin.reqScore} Pn</span>`;
        }

        card.innerHTML = `
            <span class="skin-icon">${skin.icon}</span>
            <span class="skin-title">${skin.name}</span>
            ${badgeHtml}
        `;

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

// CHAT & EMOJI REACTION LOGIC
function sendChatMessage(text, isEmoji = false) {
    const cleanText = text.trim();
    if (!cleanText) return;
    socket.emit('chatMessage', { text: cleanText, isEmoji: isEmoji });
}

sendChatBtn.addEventListener('click', () => {
    sendChatMessage(chatInput.value, false);
    chatInput.value = '';
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage(chatInput.value, false);
        chatInput.value = '';
        chatInput.blur();
    }
});

// Mobile Chat Drawer Open / Close Logic
chatInput.addEventListener('focus', () => {
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
        chatInput.blur();
        mobileChatModal.classList.remove('hidden');
        setTimeout(() => mobileChatInput.focus(), 100);
    }
});

closeMobileChatBtn.addEventListener('click', () => {
    mobileChatModal.classList.add('hidden');
});

mobileSendChatBtn.addEventListener('click', () => {
    sendChatMessage(mobileChatInput.value, false);
    mobileChatInput.value = '';
    mobileChatModal.classList.add('hidden');
});

mobileChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage(mobileChatInput.value, false);
        mobileChatInput.value = '';
        mobileChatInput.blur();
        mobileChatModal.classList.add('hidden');
    }
});

// Quick Emoji Reactions
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (emoji) {
            sendChatMessage(emoji, true);
        }
    });
});

socket.on('chatReceived', (data) => {
    if (!data) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `<span class="sender">${data.name}:</span> ${data.text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const mMsgDiv = document.createElement('div');
    mMsgDiv.className = 'chat-msg';
    mMsgDiv.innerHTML = `<span class="sender">${data.name}:</span> ${data.text}`;
    mobileChatMessages.appendChild(mMsgDiv);
    mobileChatMessages.scrollTop = mobileChatMessages.scrollHeight;

    nameTagManager.showBubble(data.id, data.text, data.isEmoji);
});

// MOUSE & TOUCH CONTROLS
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const targetPoint = new THREE.Vector3(0, 0, 10);

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// MOBILE TOUCH & PINCH-TO-ZOOM CONTROLS
let touchStartOrigin = { x: 0, y: 0 };
let initialPinchDist = null;

window.addEventListener('touchstart', (e) => {
    if (!isGameRunning) return;

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (e.target.closest('#chat-container') || e.target.closest('#mobile-boost-btn') || e.target.closest('#sound-btn') || e.target.closest('#fullscreen-btn') || e.target.closest('#mobile-chat-modal')) return;

        touchStartOrigin = { x: touch.clientX, y: touch.clientY };
        virtualJoystick.style.left = `${touch.clientX}px`;
        virtualJoystick.style.top = `${touch.clientY}px`;
        virtualJoystick.classList.remove('hidden');

        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isGameRunning) return;

    if (e.touches.length === 1) {
        const touch = e.touches[0];

        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

        const dx = touch.clientX - touchStartOrigin.x;
        const dy = touch.clientY - touchStartOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 45;
        const angle = Math.atan2(dy, dx);

        const knobX = Math.cos(angle) * Math.min(dist, maxDist);
        const knobY = Math.sin(angle) * Math.min(dist, maxDist);

        joystickKnob.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    } else if (e.touches.length === 2 && initialPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.sqrt(dx * dx + dy * dy);

        const delta = (initialPinchDist - currentDist) * 0.005;
        targetZoom += delta;
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

// Dedicated Mobile Boost Button Triggers
mobileBoostBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    setBoostState(true);
});
mobileBoostBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    setBoostState(false);
});
mobileBoostBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    setBoostState(true);
});
mobileBoostBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    setBoostState(false);
});

// Boost State Control
function setBoostState(state) {
    if (isBoosting !== state) {
        isBoosting = state;
        if (isBoosting) {
            audioManager.startBoost();
        } else {
            audioManager.stopBoost();
        }
    }
}

window.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('#mobile-boost-btn') || e.target.closest('#mobile-chat-modal')) return;
    if (e.button === 0 && isGameRunning) setBoostState(true);
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) setBoostState(false);
});
window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;

    if (e.code === 'Space' && isGameRunning) {
        setBoostState(true);
    } else if (e.code === 'Escape' && isGameRunning) {
        setBoostState(false);
        openMenu('Oyun Duraklatıldı');
    }
});
window.addEventListener('keyup', (e) => {
    if (document.activeElement === chatInput || document.activeElement === mobileChatInput) return;
    if (e.code === 'Space') setBoostState(false);
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ALL COLLECTIBLES ARE NOW 2D FLAT CIRCLE DISCS FOR MAXIMUM OPTIMIZED PERFORMANCE!
const foodColors = [0xff0055, 0x00ffcc, 0xffff00, 0xaa00ff, 0xff8800, 0x00ffaa];
const smallFoodGeo2D = new THREE.CircleGeometry(0.7, 16);
const bigFoodGeo2D = new THREE.CircleGeometry(1.4, 16);

const foodMaterials = foodColors.map(color => new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide
}));

// SOCKET EVENTS
socket.on('init', (data) => {
    localSocketId = data.id;
    syncFoods(data.foods || []);
});

socket.on('foodRemoved', (data) => {
    if (data && data.foodId) {
        localEatenFoods.add(data.foodId);
        removeFoodMesh(data.foodId);
    }
    if (data && data.newFood) {
        addFoodMesh(data.newFood);
    }
});

socket.on('gameState', (state) => {
    if (!state) return;

    const serverPlayers = state.players || {};
    const serverIds = Object.keys(serverPlayers);

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

        nameTagManager.createOrUpdateTag(
            localSocketId,
            pData.name,
            localSnake.activeSkin.icon,
            () => localSnake.getHeadPosition(),
            true
        );
    }

    serverIds.forEach(id => {
        if (id === localSocketId) return;
        const playerData = serverPlayers[id];

        if (!otherSnakes[id]) {
            otherSnakes[id] = new OtherSnake(scene, playerData);
        }

        networkInterpolator.pushSnapshot(id, playerData);

        const remoteSnake = otherSnakes[id];
        const skinIcon = remoteSnake.activeSkin ? remoteSnake.activeSkin.icon : '🐍';

        nameTagManager.createOrUpdateTag(
            id,
            playerData.name,
            skinIcon,
            () => remoteSnake.segments[0] ? remoteSnake.segments[0].position : null,
            false
        );
    });

    Object.keys(otherSnakes).forEach(id => {
        if (!serverPlayers[id]) {
            otherSnakes[id].destroy();
            delete otherSnakes[id];
            nameTagManager.removeTag(id);
            networkInterpolator.removeEntity(id);
        }
    });

    updateLeaderboard(serverPlayers);
});

socket.on('gameOver', (data) => {
    isGameRunning = false;
    setBoostState(false);
    virtualJoystick.classList.add('hidden');

    audioManager.playDeath();
    particleSystem.createDeathExplosion(localSnake.getHeadPosition());

    progressionManager.saveHighScore(currentScore);
    highScoreElement.innerText = progressionManager.highScore;
    renderSkinGallery();

    finalScoreElement.innerText = currentScore;
    finalScoreBox.classList.remove('hidden');
    overlayDesc.innerText = data.reason || 'Oyun bitti!';
    startBtn.innerHTML = '<span class="play-icon">▶</span> TEKRAR OYNA';
    overlay.classList.remove('hidden');
});

function removeFoodMesh(foodId) {
    if (foodMeshes[foodId]) {
        scene.remove(foodMeshes[foodId]);
        if (foodMeshes[foodId].geometry) foodMeshes[foodId].geometry.dispose();
        delete foodMeshes[foodId];
    }
}

function addFoodMesh(f) {
    if (!foodMeshes[f.id] && !localEatenFoods.has(f.id)) {
        const mat = foodMaterials[Math.floor(Math.random() * foodMaterials.length)];
        const geo = f.isBig ? bigFoodGeo2D : smallFoodGeo2D;
        const mesh = new THREE.Mesh(geo, mat);
        
        // Flat 2D disc lying on ground plane
        mesh.position.set(f.x, 0.2, f.z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.userData.foodValue = f.value || 2;

        scene.add(mesh);
        foodMeshes[f.id] = mesh;
    }
}

function syncFoods(foodList) {
    const currentFoodIds = new Set(foodList.map(f => f.id));

    Object.keys(foodMeshes).forEach(id => {
        if (!currentFoodIds.has(id)) {
            removeFoodMesh(id);
        }
    });

    foodList.forEach(f => {
        addFoodMesh(f);
    });
}

function updateLeaderboard(serverPlayers) {
    const sorted = Object.values(serverPlayers)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

    lbList.innerHTML = sorted.map((p, idx) => `
        <li>
            <span>${idx + 1}. ${p.name || 'Oyuncu'}</span>
            <span style="color:#06b6d4">${p.score || 0}</span>
        </li>
    `).join('') || '<li>1. Bekleniyor...</li>';
}

function openMenu(reasonText) {
    isGameRunning = false;
    setBoostState(false);
    virtualJoystick.classList.add('hidden');
    renderSkinGallery();
    finalScoreElement.innerText = currentScore;
    finalScoreBox.classList.remove('hidden');
    overlayDesc.innerText = reasonText;
    startBtn.innerHTML = '<span class="play-icon">▶</span> ARENAYA DÖN';
    overlay.classList.remove('hidden');
}

function requestLandscapeAndFullscreen() {
    try {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }
    } catch (e) {}

    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen().catch(() => {});
    }
}

function startGame() {
    audioManager.init();
    requestLandscapeAndFullscreen();

    const playerName = playerNameInput.value.trim() || 'YılanOyuncusu';
    currentScore = 0;
    scoreElement.innerText = '0';
    localEatenFoods.clear();
    localSnake.reset();

    socket.emit('join', {
        name: playerName,
        skinId: progressionManager.selectedSkinId
    });

    isGameRunning = true;
    overlay.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    // Update 3D Particles
    particleSystem.update(delta);

    if (isGameRunning) {
        // 1. Target Point via Raycast
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(groundPlane, targetPoint);

        // 2. Local Snake Physics Update (Client Prediction)
        localSnake.update(delta, targetPoint, isBoosting);

        if (isBoosting) {
            particleSystem.createBoostParticle(localSnake.getHeadPosition(), localSnake.currentAngle);
        }

        // 3. Update Remote Snakes via Network Interpolator Queue (Butter Smooth 60 FPS!)
        Object.keys(otherSnakes).forEach(id => {
            const interpolatedState = networkInterpolator.getInterpolatedState(id);
            if (interpolatedState) {
                otherSnakes[id].updateInterpolated(interpolatedState);
            }
        });

        // 4. Head Collision Eating Check
        const headPos = localSnake.getHeadPosition();
        const foodKeys = Object.keys(foodMeshes);
        
        for (let i = 0; i < foodKeys.length; i++) {
            const foodId = foodKeys[i];
            const foodMesh = foodMeshes[foodId];

            if (foodMesh && !localEatenFoods.has(foodId)) {
                const dx = headPos.x - foodMesh.position.x;
                const dz = headPos.z - foodMesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 2.8) {
                    localEatenFoods.add(foodId);

                    audioManager.playEat();
                    particleSystem.createEatBurst(foodMesh.position);

                    removeFoodMesh(foodId);

                    const gainedVal = foodMesh.userData.foodValue || 2;
                    currentScore += gainedVal;
                    scoreElement.innerText = currentScore;
                    localSnake.updateGrowth(currentScore);

                    if (currentScore > progressionManager.highScore) {
                        progressionManager.saveHighScore(currentScore);
                        highScoreElement.innerText = currentScore;
                    }

                    socket.emit('eatFood', { foodId: foodId });
                    break;
                }
            }
        }

        // 5. Emit Head & Body Position to Server (Volatile UDP-like emit)
        const bodyPositions = localSnake.segments.slice(1).map(seg => ({
            x: seg.position.x,
            z: seg.position.z,
            angle: seg.rotation.y
        }));

        socket.volatile.emit('playerInput', {
            x: headPos.x,
            z: headPos.z,
            angle: localSnake.currentAngle,
            isBoosting: isBoosting,
            skinId: progressionManager.selectedSkinId,
            body: bodyPositions
        });
    } else {
        const time = Date.now() * 0.004;
        targetPoint.set(Math.cos(time) * 20, 0, Math.sin(time) * 20);
        localSnake.update(delta, targetPoint, false);
    }

    // 6. Dynamic Camera Follow & Smooth Zoom
    currentZoom += (targetZoom - currentZoom) * 0.1;

    const headPos = localSnake.getHeadPosition();
    const camTargetX = headPos.x;
    const camTargetZ = headPos.z + (20 * currentZoom);
    const camTargetY = headPos.y + (26 * currentZoom);

    camera.position.x += (camTargetX - camera.position.x) * 0.1;
    camera.position.y += (camTargetY - camera.position.y) * 0.1;
    camera.position.z += (camTargetZ - camera.position.z) * 0.1;
    camera.lookAt(headPos.x, headPos.y, headPos.z - 2);

    // 7. Update Overhead 3D projected Player Name Tags & Speech/Emoji Bubbles
    nameTagManager.updatePositions();

    renderer.render(scene, camera);
}

animate();
