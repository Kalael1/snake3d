import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getSkinById } from './SkinRegistry.js';

const gltfLoader = new GLTFLoader();
const modelCache = {};

export class DriftCar {
    constructor(scene) {
        this.scene = scene;
        this.skinId = 'sport';
        this.activeSkin = getSkinById(this.skinId);

        // Physics parameters & handling
        this.position = new THREE.Vector3(0, 0, 0);
        this.heading = 0;         // Heading angle (radians)
        this.velocityAngle = 0;   // Velocity direction angle (radians)
        this.speed = 32;          // Constant cruising speed
        
        // PURE, SMOOTH & ULTRA-RESPONSIVE MOUSE DRIFT CONTROLS
        this.steerSpeed = 6.0;    // Smooth mouse steering responsiveness
        this.gripFactor = 3.6;    // Balanced grip for natural drift sliding

        // Suspension & Handling Lean Physics
        this.currentRoll = 0;     // Side-to-side body roll (Z-axis)
        this.currentPitch = 0;    // Front-to-back nose dip (X-axis)

        // Drift tracking
        this.slipAngle = 0;
        this.isDrifting = false;
        this.currentDriftScore = 0;
        this.totalDriftScore = 0;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.currentAngle = 0;

        // 3D Scene Group
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.loadedMesh = null;
        this.fallbackMesh = null;

        this.buildFallbackModel();
        this.loadCarModel(this.activeSkin.modelUrl);

        // Tire marks system (InstancedMesh - Smooth Circle Overlay, No Blocky Gaps!)
        this.MAX_MARKS = 1600;
        this.markIndex = 0;
        this.markTimer = 0;
        this.initTireMarks();
    }

    buildFallbackModel() {
        this.fallbackGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(2.4, 0.7, 4.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.55;
        this.fallbackGroup.add(bodyMesh);

        const roofGeo = new THREE.BoxGeometry(2.0, 0.55, 2.0);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.set(0, 1.15, -0.2);
        this.fallbackGroup.add(roofMesh);

        this.group.add(this.fallbackGroup);
    }

    loadCarModel(url) {
        if (!url) return;

        if (modelCache[url]) {
            this.setLoadedModel(modelCache[url].clone());
            return;
        }

        gltfLoader.load(url, (gltf) => {
            const model = gltf.scene;
            modelCache[url] = model;

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetScale = 4.2 / maxDim;

            model.scale.set(targetScale, targetScale, targetScale);
            const newBox = new THREE.Box3().setFromObject(model);
            model.position.y = -newBox.min.y;

            this.setLoadedModel(model.clone());
        }, undefined, (err) => {
            console.warn('Failed to load GLB model:', url, err);
        });
    }

    setLoadedModel(model) {
        if (this.loadedMesh) this.group.remove(this.loadedMesh);
        if (this.fallbackGroup) this.group.remove(this.fallbackGroup);

        const rotY = this.activeSkin.rotationY !== undefined ? this.activeSkin.rotationY : -Math.PI / 2;
        model.rotation.y = rotY;

        this.loadedMesh = model;
        this.group.add(this.loadedMesh);
    }

    initTireMarks() {
        // Smooth circular discs for seamless unbroken rubber tracks without blocky square edges!
        const markGeo = new THREE.CircleGeometry(0.42, 12);
        markGeo.rotateX(-Math.PI / 2);

        const markMat = new THREE.MeshBasicMaterial({
            color: 0x080808,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });

        this.tireMarksMesh = new THREE.InstancedMesh(markGeo, markMat, this.MAX_MARKS);
        this.tireMarksMesh.frustumCulled = false;
        this.tireMarksMesh.count = 0;
        this.scene.add(this.tireMarksMesh);

        this._markMatrix = new THREE.Matrix4();
    }

    addTireMark(x, z, angle) {
        this._markMatrix.makeRotationY(angle);
        this._markMatrix.setPosition(x, 0.08, z);
        this.tireMarksMesh.setMatrixAt(this.markIndex % this.MAX_MARKS, this._markMatrix);
        this.markIndex++;
        this.tireMarksMesh.count = Math.min(this.markIndex, this.MAX_MARKS);
        this.tireMarksMesh.instanceMatrix.needsUpdate = true;
    }

    applySkin(skinId) {
        this.skinId = skinId;
        this.activeSkin = getSkinById(skinId);
        this.loadCarModel(this.activeSkin.modelUrl);
    }

    update(delta, targetPoint) {
        // 1. PURE SMOOTH MOUSE STEERING
        if (targetPoint) {
            const dx = targetPoint.x - this.position.x;
            const dz = targetPoint.z - this.position.z;
            const targetAngle = Math.atan2(dx, dz);

            let steerDiff = targetAngle - this.heading;
            while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;
            while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;

            this.heading += steerDiff * Math.min(1.0, this.steerSpeed * delta);
        }

        // 2. Velocity direction with realistic drift lag
        let velDiff = this.heading - this.velocityAngle;
        while (velDiff < -Math.PI) velDiff += Math.PI * 2;
        while (velDiff > Math.PI) velDiff -= Math.PI * 2;
        this.velocityAngle += velDiff * this.gripFactor * delta;

        // 3. Slip angle (drift magnitude)
        this.slipAngle = Math.abs(velDiff) * (180 / Math.PI);
        this.currentAngle = this.heading;

        // 4. Position update
        this.position.x += Math.sin(this.velocityAngle) * this.speed * delta;
        this.position.z += Math.cos(this.velocityAngle) * this.speed * delta;

        // 5. High-density 60 FPS sampling for 100% continuous unbroken tire marks!
        this.markTimer += delta;
        if ((this.isDrifting || this.slipAngle > 8) && this.markTimer > 0.012) {
            this.markTimer = 0;
            const cosH = Math.cos(this.heading);
            const sinH = Math.sin(this.heading);

            const rlX = this.position.x + (-1.1 * cosH) + (-1.3 * sinH);
            const rlZ = this.position.z + (1.1 * sinH) + (-1.3 * cosH);
            this.addTireMark(rlX, rlZ, this.heading);

            const rrX = this.position.x + (1.1 * cosH) + (-1.3 * sinH);
            const rrZ = this.position.z + (-1.1 * sinH) + (-1.3 * cosH);
            this.addTireMark(rrX, rrZ, this.heading);
        }

        // 6. Drift score update
        this.updateDriftScore(delta);

        // 7. Group position & heading rotation
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.y = this.heading;

        // 8. REALISTIC HANDLING & SUSPENSION TILT MECHANIC (Roll & Pitch)
        const targetRoll = Math.max(-0.35, Math.min(0.35, velDiff * 0.45));
        const targetPitch = Math.min(0.12, Math.abs(velDiff) * 0.15);

        this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1.0, 12.0 * delta);
        this.currentPitch += (targetPitch - this.currentPitch) * Math.min(1.0, 10.0 * delta);

        this.group.rotation.z = -this.currentRoll;
        this.group.rotation.x = this.currentPitch;
    }

    updateDriftScore(delta) {
        const DRIFT_THRESHOLD = 10;
        const MEGA_THRESHOLD = 25;

        if (this.slipAngle > DRIFT_THRESHOLD) {
            if (!this.isDrifting) {
                this.isDrifting = true;
                this.currentDriftScore = 0;
                this.driftCombo = 1;
                this.driftTimer = 0;
            }

            this.driftTimer += delta;

            if (this.driftTimer > 1.2) this.driftCombo = 2;
            if (this.driftTimer > 2.8) this.driftCombo = 3;
            if (this.driftTimer > 5.0) this.driftCombo = 5;

            let angleMult = 1;
            if (this.slipAngle > MEGA_THRESHOLD) angleMult = 3;
            else if (this.slipAngle > 16) angleMult = 2;

            this.currentDriftScore += this.slipAngle * delta * angleMult * this.driftCombo;
        } else {
            if (this.isDrifting) {
                this.totalDriftScore += Math.floor(this.currentDriftScore);
                this.isDrifting = false;
                this.currentDriftScore = 0;
                this.driftCombo = 1;
                this.driftTimer = 0;
            }
        }
    }

    getScore() {
        return this.totalDriftScore + Math.floor(this.currentDriftScore);
    }

    getHeadPosition() {
        return this.group.position;
    }

    reset() {
        const halfSize = 220;
        this.position.set(
            (Math.random() - 0.5) * halfSize,
            0,
            (Math.random() - 0.5) * halfSize
        );
        this.heading = Math.random() * Math.PI * 2;
        this.velocityAngle = this.heading;
        this.slipAngle = 0;
        this.isDrifting = false;
        this.currentDriftScore = 0;
        this.totalDriftScore = 0;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.currentRoll = 0;
        this.currentPitch = 0;
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.set(0, this.heading, 0);
    }
}
