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
        this.targetSpeed = 30;    // Target forward speed
        this.currentSpeed = 30;   // Current active speed (drops to 0 on spinout!)

        // Rate-Limited Steering Physics
        this.maxTurnRate = 2.8;   // Max ~160 degrees/sec turn limit
        this.gripFactor = 3.6;    // Grip level (lower = more drift slide)

        // Spinout & Stall Mechanics
        this.isSpinningOut = false;
        this.spinoutTimer = 0;
        this.extremeTurnTime = 0;
        this.spinDir = 1;

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

        // Build procedural fallback & load GLB
        this.buildFallbackModel();
        this.loadCarModel(this.activeSkin.modelUrl);

        // Tire marks system
        this.MAX_MARKS = 600;
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
        if (this.loadedMesh) {
            this.group.remove(this.loadedMesh);
        }
        if (this.fallbackGroup) {
            this.group.remove(this.fallbackGroup);
        }

        const rotY = this.activeSkin.rotationY !== undefined ? this.activeSkin.rotationY : -Math.PI / 2;
        model.rotation.y = rotY;

        this.loadedMesh = model;
        this.group.add(this.loadedMesh);
    }

    initTireMarks() {
        const markGeo = new THREE.PlaneGeometry(0.4, 0.8);
        markGeo.rotateX(-Math.PI / 2);
        const markMat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.6,
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
        this._markMatrix.setPosition(x, 0.02, z);
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

    triggerSpinout(spinDirection = 1) {
        this.isSpinningOut = true;
        this.spinoutTimer = 0.95; // 0.95 seconds donut spin stall in place
        this.currentSpeed = 0;    // Speed drops to 0 immediately!
        this.spinDir = spinDirection;

        // Cancel/reset current unbanked drift score combo
        this.currentDriftScore = 0;
        this.isDrifting = false;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.extremeTurnTime = 0;
    }

    update(delta, targetPoint) {
        // A) IF CAR IS CURRENTLY SPINNING OUT / STALLED IN PLACE
        if (this.isSpinningOut) {
            this.spinoutTimer -= delta;

            // Car spins in place (donut spin)
            this.heading += this.spinDir * 7.5 * delta;
            this.velocityAngle = this.heading;
            this.currentSpeed = 0; // Speed is 0 during spinout stall

            // Burnout tire marks in place
            this.markTimer += delta;
            if (this.markTimer > 0.04) {
                this.markTimer = 0;
                this.addTireMark(this.position.x, this.position.z, this.heading);
            }

            // End spinout after timer expires and begin re-accelerating!
            if (this.spinoutTimer <= 0) {
                this.isSpinningOut = false;
            }
        } else {
            // B) NORMAL DRIVING & MOUSE STEERING
            if (targetPoint) {
                const dx = targetPoint.x - this.position.x;
                const dz = targetPoint.z - this.position.z;
                const targetAngle = Math.atan2(dx, dz);

                let steerDiff = targetAngle - this.heading;
                while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;
                while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;

                // Check if player is turning continuously in a circle (extreme turn)
                if (Math.abs(steerDiff) > 1.4) {
                    this.extremeTurnTime += delta;
                    // TRIGGER SPINOUT STALL IF TURNING CONTINUOUSLY IN A CIRCLE FOR > 0.6 SECONDS!
                    if (this.extremeTurnTime > 0.6) {
                        this.triggerSpinout(steerDiff > 0 ? 1 : -1);
                        return;
                    }
                } else {
                    this.extremeTurnTime = Math.max(0, this.extremeTurnTime - delta * 2);
                }

                // Clamped turn step
                const turnStep = Math.max(-this.maxTurnRate * delta, Math.min(this.maxTurnRate * delta, steerDiff * 4.0 * delta));
                this.heading += turnStep;
            }

            // Velocity direction with realistic drift lag
            let velDiff = this.heading - this.velocityAngle;
            while (velDiff < -Math.PI) velDiff += Math.PI * 2;
            while (velDiff > Math.PI) velDiff -= Math.PI * 2;
            this.velocityAngle += velDiff * this.gripFactor * delta;

            // Slip angle (drift magnitude)
            this.slipAngle = Math.abs(velDiff) * (180 / Math.PI);

            // TRIGGER SPINOUT STALL IF SLIP ANGLE EXCEEDS EXTREME DRIFT LIMIT (55 DEGREES)!
            if (this.slipAngle > 55) {
                this.triggerSpinout(velDiff > 0 ? 1 : -1);
                return;
            }

            // Smooth re-acceleration back to target speed (30 km/h) after spinout
            this.currentSpeed += (this.targetSpeed - this.currentSpeed) * Math.min(1.0, 3.5 * delta);

            // Position update
            this.position.x += Math.sin(this.velocityAngle) * this.currentSpeed * delta;
            this.position.z += Math.cos(this.velocityAngle) * this.currentSpeed * delta;

            // Drift score update
            this.updateDriftScore(delta);
        }

        this.currentAngle = this.heading;

        // Group position & heading rotation
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.y = this.heading;

        // REALISTIC HANDLING & SUSPENSION TILT MECHANIC (Roll & Pitch)
        let velDiff = this.heading - this.velocityAngle;
        while (velDiff < -Math.PI) velDiff += Math.PI * 2;
        while (velDiff > Math.PI) velDiff -= Math.PI * 2;

        const targetRoll = this.isSpinningOut ? (this.spinDir * 0.4) : Math.max(-0.35, Math.min(0.35, velDiff * 0.45));
        const targetPitch = this.isSpinningOut ? 0.2 : Math.min(0.12, Math.abs(velDiff) * 0.15);

        this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1.0, 12.0 * delta);
        this.currentPitch += (targetPitch - this.currentPitch) * Math.min(1.0, 10.0 * delta);

        this.group.rotation.z = -this.currentRoll;
        this.group.rotation.x = this.currentPitch;
    }

    updateDriftScore(delta) {
        const DRIFT_THRESHOLD = 10;
        const MEGA_THRESHOLD = 30;

        if (this.slipAngle > DRIFT_THRESHOLD) {
            if (!this.isDrifting) {
                this.isDrifting = true;
                this.currentDriftScore = 0;
                this.driftCombo = 1;
                this.driftTimer = 0;
            }

            this.driftTimer += delta;

            if (this.driftTimer > 1.5) this.driftCombo = 2;
            if (this.driftTimer > 3.5) this.driftCombo = 3;
            if (this.driftTimer > 6.0) this.driftCombo = 5;

            let angleMult = 1;
            if (this.slipAngle > MEGA_THRESHOLD) angleMult = 3;
            else if (this.slipAngle > 20) angleMult = 2;

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
        this.isSpinningOut = false;
        this.spinoutTimer = 0;
        this.extremeTurnTime = 0;
        this.currentDriftScore = 0;
        this.totalDriftScore = 0;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.currentRoll = 0;
        this.currentPitch = 0;
        this.currentSpeed = this.targetSpeed;
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.set(0, this.heading, 0);
    }
}
