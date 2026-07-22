import * as THREE from 'three';
import { io } from 'socket.io-client';
import { Arena } from './src/Arena.js';
import { Snake } from './src/Snake.js';
import { OtherSnake } from './src/OtherSnake.js';

// Setup Socket.io Client
const socket = io();

// Setup basic scene with bright light background
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe2e8f0);
scene.fog = new THREE.FogExp2(0xe2e8f0, 0.003);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.8);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(120, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 1000;
dirLight.shadow.camera.left = -400;
dirLight.shadow.camera.right = 400;
dirLight.shadow.camera.top = 400;
dirLight.shadow.camera.bottom = -400;
scene.add(dirLight);

// Game Entities
const arenaSize = 500;
const arena = new Arena(scene, arenaSize);
const localSnake = new Snake(scene);
const otherSnakes = {}; // { socketId: OtherSnake instance }
const foodMeshes = {}; // { foodId: THREE.Mesh }

let isGameRunning = false;
let isBoosting = false;
let localSocketId = null;

// Camera Zoom
let targetZoom = 1.0;
let currentZoom = 1.0;

window.addEventListener('wheel', (event) => {
    targetZoom += event.deltaY * 0.0015;
    targetZoom = Math.max(0.35, Math.min(3.0, targetZoom));
}, { passive: true });

// DOM Elements
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const finalScoreBox = document.getElementById('final-score-box');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayDesc = document.getElementById('overlay-desc');
const playerNameInput = document.getElementById('player-name');
const lbList = document.getElementById('lb-list');

// Food rendering materials
const foodColors = [0xff0055, 0x00ffcc, 0xffff00, 0xaa00ff, 0xff8800, 0x00ffaa];
const foodGeo = new THREE.DodecahedronGeometry(0.8, 0);
const foodMaterials = foodColors.map(color => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 1.0,
    roughness: 0.1,
    metalness: 0.9
}));

// Mouse tracking & Raycasting
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const targetPoint = new THREE.Vector3(0, 0, 10);

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Boost & ESC Controls
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && isGameRunning) isBoosting = true;
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) isBoosting = false;
});
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isGameRunning) {
        isBoosting = true;
    } else if (e.code === 'Escape' && isGameRunning) {
        openMenu('Oyun Duraklatıldı');
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') isBoosting = false;
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// SOCKET EVENTS
socket.on('init', (data) => {
    localSocketId = data.id;
    syncFoods(data.foods || []);
});

socket.on('foodEaten', (data) => {
    localSnake.grow();
    if (data && typeof data.score === 'number') {
        scoreElement.innerText = data.score;
    }
});

socket.on('gameState', (state) => {
    if (!state) return;

    // 1. Sync Foods
    if (state.foods) {
        syncFoods(state.foods);
    }

    // 2. Sync Other Players
    const serverPlayers = state.players || {};
    const serverIds = Object.keys(serverPlayers);

    // Update Local Player Score
    if (localSocketId && serverPlayers[localSocketId]) {
        scoreElement.innerText = serverPlayers[localSocketId].score || 0;
    }

    // Render Other Snakes
    serverIds.forEach(id => {
        if (id === localSocketId) return;
        const playerData = serverPlayers[id];

        if (!otherSnakes[id]) {
            otherSnakes[id] = new OtherSnake(scene, playerData);
        } else {
            otherSnakes[id].update(playerData);
        }
    });

    // Remove disconnected players
    Object.keys(otherSnakes).forEach(id => {
        if (!serverPlayers[id]) {
            otherSnakes[id].destroy();
            delete otherSnakes[id];
        }
    });

    // 3. Update Leaderboard
    updateLeaderboard(serverPlayers);
});

socket.on('gameOver', (data) => {
    isGameRunning = false;
    isBoosting = false;
    finalScoreElement.innerText = scoreElement.innerText;
    finalScoreBox.classList.remove('hidden');
    overlayDesc.innerText = data.reason || 'Oyun bitti!';
    startBtn.innerText = 'TEKRAR OYNA';
    overlay.classList.remove('hidden');
});

function syncFoods(foodList) {
    const currentFoodIds = new Set(foodList.map(f => f.id));

    // Remove missing foods
    Object.keys(foodMeshes).forEach(id => {
        if (!currentFoodIds.has(id)) {
            scene.remove(foodMeshes[id]);
            if (foodMeshes[id].geometry) foodMeshes[id].geometry.dispose();
            delete foodMeshes[id];
        }
    });

    // Add new foods
    foodList.forEach(f => {
        if (!foodMeshes[f.id]) {
            const mat = foodMaterials[Math.floor(Math.random() * foodMaterials.length)];
            const mesh = new THREE.Mesh(foodGeo, mat);
            mesh.position.set(f.x, 0.8, f.z);
            mesh.castShadow = true;
            mesh.userData.rotSpeed = (Math.random() - 0.5) * 3;
            scene.add(mesh);
            foodMeshes[f.id] = mesh;
        }
    });
}

function updateLeaderboard(serverPlayers) {
    const sorted = Object.values(serverPlayers)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

    lbList.innerHTML = sorted.map((p, idx) => `
        <li>
            <span>${idx + 1}. ${p.name || 'Oyuncu'}</span>
            <span style="color:#00ffcc">${p.score || 0}</span>
        </li>
    `).join('') || '<li>1. Bekleniyor...</li>';
}

function openMenu(reasonText) {
    isGameRunning = false;
    isBoosting = false;
    finalScoreElement.innerText = scoreElement.innerText;
    finalScoreBox.classList.remove('hidden');
    overlayDesc.innerText = reasonText;
    startBtn.innerText = 'ARENAYA DÖN / YENİDEN BAŞLA';
    overlay.classList.remove('hidden');
}

function startGame() {
    const playerName = playerNameInput.value.trim() || 'YılanOyuncusu';
    localSnake.reset();
    socket.emit('join', playerName);
    isGameRunning = true;
    overlay.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    // Animate foods
    const time = Date.now() * 0.004;
    Object.values(foodMeshes).forEach(food => {
        food.rotation.y += (food.userData.rotSpeed || 1) * delta;
        food.position.y = 0.8 + Math.sin(time + food.position.x) * 0.2;
    });

    if (isGameRunning) {
        // 1. Target Point via Raycast
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(groundPlane, targetPoint);

        // 2. Local Snake Physics Update
        localSnake.update(delta, targetPoint, isBoosting);

        // 3. Prepare Body Segment Positions to Send to Server
        const headPos = localSnake.getHeadPosition();
        const bodyPositions = localSnake.segments.slice(1).map(seg => ({
            x: seg.position.x,
            z: seg.position.z,
            angle: seg.rotation.y
        }));

        // 4. Emit Head & Body Position to Server for Collision & Score Sync
        socket.emit('playerInput', {
            x: headPos.x,
            z: headPos.z,
            angle: localSnake.currentAngle,
            isBoosting: isBoosting,
            body: bodyPositions
        });
    } else {
        const time = Date.now() * 0.0003;
        targetPoint.set(Math.cos(time) * 20, 0, Math.sin(time) * 20);
        localSnake.update(delta, targetPoint, false);
    }

    // 5. Dynamic Camera Follow & Smooth Zoom
    currentZoom += (targetZoom - currentZoom) * 0.1;

    const headPos = localSnake.getHeadPosition();
    const camTargetX = headPos.x;
    const camTargetZ = headPos.z + (20 * currentZoom);
    const camTargetY = headPos.y + (26 * currentZoom);

    camera.position.x += (camTargetX - camera.position.x) * 0.1;
    camera.position.y += (camTargetY - camera.position.y) * 0.1;
    camera.position.z += (camTargetZ - camera.position.z) * 0.1;
    camera.lookAt(headPos.x, headPos.y, headPos.z - 2);

    renderer.render(scene, camera);
}

animate();
