import * as THREE from 'three';
import { getSkinById } from './SkinRegistry.js';

export class DriftCar {
    constructor(scene) {
        this.scene = scene;
        this.skinId = 'red_classic';
        this.activeSkin = getSkinById(this.skinId);

        // Physics
        this.position = new THREE.Vector3(0, 0, 0);
        this.heading = 0;         // Direction car is FACING
        this.velocityAngle = 0;   // Direction car is MOVING
        this.speed = 28;          // Constant forward speed
        this.steerSpeed = 5.0;    // How fast heading follows mouse
        this.gripFactor = 4.5;    // How fast velocity follows heading (lower = more drift)

        // Drift state
        this.slipAngle = 0;       // Degrees
        this.isDrifting = false;
        this.currentDriftScore = 0;
        this.totalDriftScore = 0;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.currentAngle = 0;    // For network sync

        // 3D Model
        this.group = new THREE.Group();
        this.buildModel();
        this.scene.add(this.group);

        // Tire marks system
        this.MAX_MARKS = 600;
        this.markIndex = 0;
        this.markTimer = 0;
        this.initTireMarks();
    }

    buildModel() {
        const skin = this.activeSkin;

        // Car body
        const bodyGeo = new THREE.BoxGeometry(2.4, 0.7, 4.2);
        this.bodyMat = new THREE.MeshLambertMaterial({ color: skin.bodyColor });
        this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
        this.bodyMesh.position.y = 0.55;
        this.group.add(this.bodyMesh);

        // Roof/cabin
        const roofGeo = new THREE.BoxGeometry(2.0, 0.55, 2.0);
        this.roofMat = new THREE.MeshLambertMaterial({ color: skin.roofColor });
        this.roofMesh = new THREE.Mesh(roofGeo, this.roofMat);
        this.roofMesh.position.set(0, 1.15, -0.2);
        this.group.add(this.roofMesh);

        // Wheels (4x cylinder)
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8);
        const wheelMat = new THREE.MeshLambertMaterial({ color: skin.wheelColor || 0x222222 });

        this.wheels = [];
        const wheelPos = [
            [-1.25, 0.35, 1.4],   // FL
            [1.25, 0.35, 1.4],    // FR
            [-1.25, 0.35, -1.4],  // RL
            [1.25, 0.35, -1.4]    // RR
        ];

        wheelPos.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            this.group.add(wheel);
            this.wheels.push(wheel);
        });

        // Headlights (front)
        const lightGeo = new THREE.SphereGeometry(0.15, 6, 6);
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        [[-0.8, 0.55, 2.15], [0.8, 0.55, 2.15]].forEach(pos => {
            const light = new THREE.Mesh(lightGeo, headlightMat);
            light.position.set(...pos);
            this.group.add(light);
        });

        // Tail lights (rear)
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        [[-0.8, 0.55, -2.15], [0.8, 0.55, -2.15]].forEach(pos => {
            const light = new THREE.Mesh(lightGeo, tailMat);
            light.position.set(...pos);
            this.group.add(light);
        });
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
        this.bodyMat.color.setHex(this.activeSkin.bodyColor);
        this.roofMat.color.setHex(this.activeSkin.roofColor);
    }

    update(delta, targetPoint) {
        // 1. Calculate target steering angle from mouse
        const dx = targetPoint.x - this.position.x;
        const dz = targetPoint.z - this.position.z;
        const targetAngle = Math.atan2(dx, dz);

        // 2. Smooth steering — heading follows mouse
        let steerDiff = targetAngle - this.heading;
        while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;
        while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;
        this.heading += steerDiff * Math.min(1.0, this.steerSpeed * delta);

        // 3. Velocity follows heading WITH LAG — this creates drift!
        let velDiff = this.heading - this.velocityAngle;
        while (velDiff < -Math.PI) velDiff += Math.PI * 2;
        while (velDiff > Math.PI) velDiff -= Math.PI * 2;
        this.velocityAngle += velDiff * this.gripFactor * delta;

        // 4. Slip angle = drift amount (degrees)
        this.slipAngle = Math.abs(velDiff) * (180 / Math.PI);
        this.currentAngle = this.heading;

        // 5. Move car in velocity direction (never stops!)
        this.position.x += Math.sin(this.velocityAngle) * this.speed * delta;
        this.position.z += Math.cos(this.velocityAngle) * this.speed * delta;

        // 6. Drift scoring
        this.updateDriftScore(delta);

        // 7. Update 3D model position & rotation
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.y = this.heading;

        // 8. Visual tilt during drift
        const tiltAmount = Math.max(-0.18, Math.min(0.18, velDiff * 0.25));
        this.group.rotation.z = -tiltAmount;

        // 9. Tire marks during drift
        this.markTimer += delta;
        if (this.isDrifting && this.markTimer > 0.03) {
            this.markTimer = 0;
            // Rear left wheel world position
            const cosH = Math.cos(this.heading);
            const sinH = Math.sin(this.heading);

            const rlX = this.position.x + (-1.25 * cosH) + (-1.4 * sinH);
            const rlZ = this.position.z + (1.25 * sinH) + (-1.4 * cosH);
            this.addTireMark(rlX, rlZ, this.heading);

            const rrX = this.position.x + (1.25 * cosH) + (-1.4 * sinH);
            const rrZ = this.position.z + (-1.25 * sinH) + (-1.4 * cosH);
            this.addTireMark(rrX, rrZ, this.heading);
        }

        // 10. Spin wheels
        this.wheels.forEach(w => { w.rotation.x += this.speed * delta * 0.5; });
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

            // Combo escalation
            if (this.driftTimer > 1.5) this.driftCombo = 2;
            if (this.driftTimer > 3.5) this.driftCombo = 3;
            if (this.driftTimer > 6.0) this.driftCombo = 5;

            // Angle multiplier
            let angleMult = 1;
            if (this.slipAngle > MEGA_THRESHOLD) angleMult = 3;
            else if (this.slipAngle > 20) angleMult = 2;

            this.currentDriftScore += this.slipAngle * delta * angleMult * this.driftCombo;
        } else {
            if (this.isDrifting) {
                // Drift ended — bank the combo score
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
        this.group.position.set(this.position.x, 0, this.position.z);
        this.group.rotation.set(0, this.heading, 0);
    }
}
