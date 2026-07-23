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
        
        // PURE, SMOOTH & ULTRA-RESPONSIVE HYBRID CONTROLS
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

        // Feel & anti-exploit helpers
        this.gripSmooth = 6.0;   // Smoothed grip → buttery grip/slide transitions (no "raw" snap)
        this.driftSign = 0;      // This frame's slide direction (+1 / -1 / 0)
        this.driftDir = 0;       // Direction of the currently scored drift
        this.sameDirTimer = 0;   // Seconds spent sliding the SAME way (drives the donut fade)

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
        this.isHandbrake = controlState.isHandbrake || false;
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

        // 1. ENGINE POWER & SPEED CONTROL (Handbrake / Space / WASD)
        let targetSpeed = 0.0;
        if (controlState.selectedControlScheme === 'keyboard') {
            if (controlState.forward) {
                targetSpeed = this.baseSpeed;
            } else if (controlState.backward) {
                targetSpeed = -this.baseSpeed * 0.4; // Reverse speed is slower
            }
        } else {
            // Mouse control uses engine toggle
            targetSpeed = isEngineOn ? this.baseSpeed : 0.0;
        }

        if (this.isHandbrake) {
            // Handbrake only scrubs forward speed, doesn't speed up if standing still
            if (targetSpeed > 0) targetSpeed = this.baseSpeed * 0.6;
        }

        // CORNERING SCRUB — hard steering and big slides bleed speed. This makes the
        // car "load up" in a turn (nicer feel) AND makes spin-in-place donuts
        // self-limiting: the harder you keep spinning, the more speed you lose.
        const steerLoad = Math.min(1, Math.abs(this.keySteerVelocity) / 3.4);
        const slipLoad = Math.min(1, this.slipAngle / 50); // previous frame's slip magnitude
        const scrub = Math.min(0.6, 0.26 * steerLoad + 0.34 * slipLoad);
        targetSpeed *= (1 - scrub);

        const accelFactor = this.isHandbrake ? 7.0 : 3.2;
        this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1.0, accelFactor * delta);

        const speedRatio = Math.max(0, Math.min(1, this.currentSpeed / this.baseSpeed));

        // 2. RESPONSIVE ARCADE STEERING (smooth + speed-sensitive)
        const targetSteerVel = steerDir * 3.4;
        this.keySteerVelocity += (targetSteerVel - this.keySteerVelocity) * Math.min(1.0, 9.0 * delta); // softer ramp = less twitch
        // Steering authority scales with speed: agile at pace, gentle when crawling
        // (a near-stopped car can no longer whip around to farm angle).
        const steerAuthority = 0.4 + 0.6 * speedRatio;

        if (steerDir !== 0 || Math.abs(this.keySteerVelocity) > 0.05) {
            // A/D Keyboard or Mobile Touch steering
            this.heading += this.keySteerVelocity * delta * steerAuthority;
        } else if (targetPoint && targetPoint.x !== undefined && targetPoint.z !== undefined && !isNaN(targetPoint.x) && !isNaN(targetPoint.z) && this.currentSpeed > 0.5) {
            // Mouse target steering when keyboard A/D is not pressed
            this.keySteerVelocity = 0; // Clear velocity to prevent interference
            const dx = targetPoint.x - this.position.x;
            const dz = targetPoint.z - this.position.z;
            if (dx * dx + dz * dz > 2.0) {
                const targetAngle = Math.atan2(dx, dz);
                if (!isNaN(targetAngle)) {
                    let steerDiff = targetAngle - this.heading;
                    while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;
                    while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;
                    this.heading += steerDiff * Math.min(1.0, this.steerSpeed * delta) * steerAuthority;
                }
            }
        }

        // Final NaN sanity check on heading
        if (isNaN(this.heading)) this.heading = 0;

        // DRIFT PHYSICS: velocity angle chases heading through a SMOOTHED grip value,
        // so grip↔slide transitions ease in/out instead of snapping (kills the "raw" feel).
        let angleDiff = this.heading - this.velocityAngle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        this.driftSign = angleDiff > 0.0001 ? 1 : (angleDiff < -0.0001 ? -1 : 0);

        let targetGrip = this.isTwoWheeling ? 10.0 : 6.0; // Tighter grip normally
        if (this.isHandbrake) targetGrip = 1.6;           // Long, smooth slides on handbrake
        this.gripSmooth += (targetGrip - this.gripSmooth) * Math.min(1.0, 8.0 * delta);

        this.velocityAngle += angleDiff * Math.min(1.0, this.gripSmooth * delta);
        if (isNaN(this.velocityAngle)) this.velocityAngle = this.heading;

        // 4. Slip angle (drift magnitude)
        this.slipAngle = Math.abs(angleDiff) * (180 / Math.PI);
        if (isNaN(this.slipAngle)) this.slipAngle = 0;
        this.currentAngle = this.heading;

        // 5. Position update
        this.position.x += Math.sin(this.velocityAngle) * this.currentSpeed * delta;
        this.position.z += Math.cos(this.velocityAngle) * this.currentSpeed * delta;

        if (isNaN(this.position.x)) this.position.x = 0;
        if (isNaN(this.position.z)) this.position.z = 0;

        // 6. Tire Marks (Only when moving & drifting!)
        const isSkidding = this.isDrifting || this.slipAngle > 8 || this.isTwoWheeling || this.isHandbrake;
        if (this.currentSpeed > 2.0 && isSkidding) {
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
        let targetRoll = Math.max(-0.35, Math.min(0.35, angleDiff * 0.45));
        let targetPitch = Math.min(0.12, Math.abs(angleDiff) * 0.15);

        if (this.isTwoWheelLeft) {
            targetRoll = -0.78; // Roll Left (Negative Z)
            targetPitch = 0.08;
        } else if (this.isTwoWheelRight) {
            targetRoll = 0.78; // Roll Right (Positive Z)
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
        const speedRatio = Math.max(0, Math.min(1, this.currentSpeed / this.baseSpeed));

        // Two-wheel stunt points scale with speed → no free points while barely moving
        if (this.isTwoWheeling) {
            this.totalDriftScore += Math.floor(50 * delta * speedRatio);
        }

        if (this.slipAngle > DRIFT_THRESHOLD) {
            if (!this.isDrifting) {
                this.isDrifting = true;
                this.currentDriftScore = 0;
                this.driftCombo = 1;
                this.driftTimer = 0;
                this.driftDir = this.driftSign;
                this.sameDirTimer = 0;
            }

            // TRANSITION BONUS: flicking the slide to the opposite side refreshes the
            // donut fade and bumps the combo → rewards skilful S-drifts / countersteer.
            if (this.driftSign !== 0 && this.driftSign !== this.driftDir) {
                this.driftDir = this.driftSign;
                this.sameDirTimer = 0;
                this.driftCombo = Math.min(6, this.driftCombo + 1);
            }

            this.driftTimer += delta;
            this.sameDirTimer += delta;

            if (this.driftTimer > 1.2) this.driftCombo = Math.max(this.driftCombo, 2);
            if (this.driftTimer > 2.8) this.driftCombo = Math.max(this.driftCombo, 3);
            if (this.driftTimer > 5.0) this.driftCombo = Math.max(this.driftCombo, 5);

            let angleMult = 1;
            if (this.slipAngle > MEGA_THRESHOLD) angleMult = 3;
            else if (this.slipAngle > 16) angleMult = 2;
            if (this.isTwoWheeling) angleMult *= 2;

            // DONUT FADE — a steady same-direction slide earns full points only briefly,
            // then decays toward a floor. Combined with speedRatio and cornering scrub,
            // this stops endless spin-in-place score farming while a real, fast, transitioning
            // drift keeps scoring big.
            const fade = this.sameDirTimer < 2.0
                ? 1.0
                : Math.max(0.06, 1.0 - (this.sameDirTimer - 2.0) * 0.6);

            this.currentDriftScore += this.slipAngle * delta * angleMult * this.driftCombo * speedRatio * fade;
        } else {
            if (this.isDrifting) {
                this.totalDriftScore += Math.floor(this.currentDriftScore);
                this.isDrifting = false;
                this.currentDriftScore = 0;
                this.driftCombo = 1;
                this.driftTimer = 0;
                this.driftDir = 0;
                this.sameDirTimer = 0;
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
        this.position.set(0, 0, 0); // Safe center spawn!
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
        this.gripSmooth = 6.0;
        this.driftSign = 0;
        this.driftDir = 0;
        this.sameDirTimer = 0;
        this.currentRoll = 0;
        this.rollVelocity = 0;
        this.currentPitch = 0;
        this.pitchVelocity = 0;
        if (this.leftTireTrail) this.leftTireTrail.clear();
        if (this.rightTireTrail) this.rightTireTrail.clear();
        this.group.visible = true; // Guaranteed visible 3D car!
        this.group.position.set(0, 0, 0);
        this.group.rotation.set(0, 0, 0);
    }
}
