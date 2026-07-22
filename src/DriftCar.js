import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getSkinById } from './SkinRegistry.js';
import { RibbonTrail } from './RibbonTrail.js';

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
        this.baseSpeed = 32;      // Cruising speed when engine is ON
        this.currentSpeed = 32;   // Dynamic speed
        
        // PURE, SMOOTH & ULTRA-RESPONSIVE CONTROLS
        this.steerSpeed = 6.0;        // Smooth mouse steering responsiveness
        this.keySteerVelocity = 0.0;  // Damped keyboard steering velocity for buttery smooth turning
        this.gripFactor = 3.6;        // Balanced grip for natural drift sliding

        // Q & E TWO-WHEEL STUNT DRIVING MECHANIC
        this.isTwoWheelLeft = false;  // Q Key
        this.isTwoWheelRight = false; // E Key
        this.isTwoWheeling = false;
        this.wasTwoWheeling = false;

        // Damped Spring Roll Physics
        this.currentRoll = 0;
        this.rollVelocity = 0;
        this.currentPitch = 0;
        this.pitchVelocity = 0;

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

        // CONTINUOUS CONNECTED 3D RIBBON TRAIL MESHES
        this.leftTireTrail = new RibbonTrail(this.scene, { width: 0.35, color: 0x050505, opacity: 0.85, maxPoints: 350 });
        this.rightTireTrail = new RibbonTrail(this.scene, { width: 0.35, color: 0x050505, opacity: 0.85, maxPoints: 350 });
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

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                if (child.material) {
                    child.material = child.material.clone();
                    if (child.material.color) {
                        child.material.color.multiplyScalar(1.75); // Brighten car paint!
                    }
                    if (child.material.roughness !== undefined) child.material.roughness = 0.25;
                    if (child.material.metalness !== undefined) child.material.metalness = 0.45;
                }
            }
        });

        const rotY = this.activeSkin.rotationY !== undefined ? this.activeSkin.rotationY : -Math.PI / 2;
        model.rotation.y = rotY;

        this.loadedMesh = model;
        this.group.add(this.loadedMesh);
    }

    applySkin(skinId) {
        this.skinId = skinId;
        this.activeSkin = getSkinById(skinId);
        this.loadCarModel(this.activeSkin.modelUrl);
    }

    update(delta, targetPoint, controlState = { left: false, right: false, steerDir: 0, isEngineOn: true }) {
        this.isTwoWheelLeft = controlState.left;
        this.isTwoWheelRight = controlState.right;
        this.isTwoWheeling = this.isTwoWheelLeft || this.isTwoWheelRight;
        const isEngineOn = controlState.isEngineOn !== false;
        const steerDir = controlState.steerDir || 0;

        // SANITIZE NaN SAFETY
        if (isNaN(this.heading)) this.heading = 0;
        if (isNaN(this.velocityAngle)) this.velocityAngle = 0;
        if (isNaN(this.position.x)) this.position.x = 0;
        if (isNaN(this.position.z)) this.position.z = 0;

        // POP & BOUNCE IMPULSE TRIGGER WHEN PRESSING OR RELEASING Q / E!
        if (this.isTwoWheeling && !this.wasTwoWheeling) {
            this.rollVelocity += this.isTwoWheelLeft ? 3.5 : -3.5;
            this.pitchVelocity -= 0.8;
        } else if (!this.isTwoWheeling && this.wasTwoWheeling) {
            this.rollVelocity += this.currentRoll * 2.0;
            this.pitchVelocity += 1.2;
        }
        this.wasTwoWheeling = this.isTwoWheeling;

        // 1. ENGINE POWER & SPEED CONTROL (Space Key Engine Toggle)
        const targetSpeed = isEngineOn ? this.baseSpeed : 0.0;
        this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1.0, 4.0 * delta);

        // 2. KEYBOARD & MOUSE STEERING (With Strict NaN Guards)
        const targetSteerVel = steerDir * 2.2;
        this.keySteerVelocity += (targetSteerVel - this.keySteerVelocity) * Math.min(1.0, 7.5 * delta);

        if (Math.abs(this.keySteerVelocity) > 0.05) {
            this.heading += this.keySteerVelocity * delta;
        } else if (targetPoint && targetPoint.x !== undefined && targetPoint.z !== undefined && !isNaN(targetPoint.x) && !isNaN(targetPoint.z) && this.currentSpeed > 0.5) {
            const dx = targetPoint.x - this.position.x;
            const dz = targetPoint.z - this.position.z;
            
            // Only steer towards mouse target if distance > 1.5 units (prevents jitter at origin)
            if (dx * dx + dz * dz > 2.2) {
                const targetAngle = Math.atan2(dx, dz);
                if (!isNaN(targetAngle)) {
                    let steerDiff = targetAngle - this.heading;
                    while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;
                    while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;
                    this.heading += steerDiff * Math.min(1.0, this.steerSpeed * delta);
                }
            }
        }

        // Final NaN sanity check on heading
        if (isNaN(this.heading)) this.heading = 0;

        // 3. Velocity direction with realistic drift lag
        let velDiff = this.heading - this.velocityAngle;
        while (velDiff < -Math.PI) velDiff += Math.PI * 2;
        while (velDiff > Math.PI) velDiff -= Math.PI * 2;
        this.velocityAngle += velDiff * this.gripFactor * delta;
        if (isNaN(this.velocityAngle)) this.velocityAngle = this.heading;

        // 4. Slip angle (drift magnitude)
        this.slipAngle = Math.abs(velDiff) * (180 / Math.PI);
        if (isNaN(this.slipAngle)) this.slipAngle = 0;
        this.currentAngle = this.heading;

        // 5. Position update
        this.position.x += Math.sin(this.velocityAngle) * this.currentSpeed * delta;
        this.position.z += Math.cos(this.velocityAngle) * this.currentSpeed * delta;

        if (isNaN(this.position.x)) this.position.x = 0;
        if (isNaN(this.position.z)) this.position.z = 0;

        // 6. Tire Marks (Only when moving & drifting!)
        if (this.currentSpeed > 2.0 && (this.isDrifting || this.slipAngle > 8 || this.isTwoWheeling)) {
            const cosH = Math.cos(this.heading);
            const sinH = Math.sin(this.heading);

            if (!this.isTwoWheelRight) {
                const rlX = this.position.x + (-1.1 * cosH) + (-1.3 * sinH);
                const rlZ = this.position.z + (1.1 * sinH) + (-1.3 * cosH);
                this.leftTireTrail.addPoint(rlX, rlZ, this.heading);
            }

            if (!this.isTwoWheelLeft) {
                const rrX = this.position.x + (1.1 * cosH) + (-1.3 * sinH);
                const rrZ = this.position.z + (-1.1 * sinH) + (-1.3 * cosH);
                this.rightTireTrail.addPoint(rrX, rrZ, this.heading);
            }
        }

        // 7. Drift & Two-Wheel Stunt Score Update
        if (this.currentSpeed > 5.0) {
            this.updateDriftScore(delta);
        }

        // 8. Group position & heading rotation
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.y = this.heading;

        // 9. DAMPED SPRING TILT PHYSICS
        let targetRoll = Math.max(-0.35, Math.min(0.35, velDiff * 0.45));
        let targetPitch = Math.min(0.12, Math.abs(velDiff) * 0.15);

        if (this.isTwoWheelLeft) {
            targetRoll = 0.78;
            targetPitch = 0.08;
        } else if (this.isTwoWheelRight) {
            targetRoll = -0.78;
            targetPitch = 0.08;
        }

        const rollForce = (targetRoll - this.currentRoll) * 35.0;
        this.rollVelocity += rollForce * delta;
        this.rollVelocity *= Math.pow(0.0001, delta);
        this.currentRoll += this.rollVelocity * delta;

        const pitchForce = (targetPitch - this.currentPitch) * 40.0;
        this.pitchVelocity += pitchForce * delta;
        this.pitchVelocity *= Math.pow(0.0001, delta);
        this.currentPitch += this.pitchVelocity * delta;

        if (isNaN(this.currentRoll)) this.currentRoll = 0;
        if (isNaN(this.currentPitch)) this.currentPitch = 0;

        this.group.rotation.z = -this.currentRoll;
        this.group.rotation.x = this.currentPitch;
    }

    updateDriftScore(delta) {
        const DRIFT_THRESHOLD = 10;
        const MEGA_THRESHOLD = 25;

        if (this.isTwoWheeling) {
            this.totalDriftScore += Math.floor(50 * delta);
        }

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

            if (this.isTwoWheeling) angleMult *= 2;

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
        this.position.set(0, 0, 0); // Always spawn safely in center avenue!
        this.heading = 0;
        this.velocityAngle = 0;
        this.slipAngle = 0;
        this.isDrifting = false;
        this.isTwoWheelLeft = false;
        this.isTwoWheelRight = false;
        this.isTwoWheeling = false;
        this.wasTwoWheeling = false;
        this.currentSpeed = this.baseSpeed;
        this.keySteerVelocity = 0.0;
        this.currentDriftScore = 0;
        this.totalDriftScore = 0;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.currentRoll = 0;
        this.rollVelocity = 0;
        this.currentPitch = 0;
        this.pitchVelocity = 0;
        if (this.leftTireTrail) this.leftTireTrail.clear();
        if (this.rightTireTrail) this.rightTireTrail.clear();
        this.group.visible = true; // Ensure 3D car model is visible!
        this.group.position.set(0, 0, 0);
        this.group.rotation.set(0, 0, 0);
    }
}
