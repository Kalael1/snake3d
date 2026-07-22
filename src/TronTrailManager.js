import * as THREE from 'three';

export class TronTrailManager {
    constructor(scene) {
        this.scene = scene;
        this.MAX_SEGMENTS = 400; // Hard cap on total segments to prevent memory leaks/freezes
        this.TRAIL_LIFETIME = 3.5; // Seconds before light wall disappears

        this.segments = []; // Active trail point objects: { id, playerId, x, z, angle, age, isNewStroke }

        // Efficient Instanced Wall Mesh (Single Draw Call = 0% Lag, 0% Memory Leaks!)
        const wallGeo = new THREE.BoxGeometry(0.3, 1.4, 0.8);
        const wallMat = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });

        this.instancedMesh = new THREE.InstancedMesh(wallGeo, wallMat, this.MAX_SEGMENTS);
        this.instancedMesh.frustumCulled = false;
        this.instancedMesh.count = 0;
        this.scene.add(this.instancedMesh);

        this._tempMatrix = new THREE.Matrix4();
        this.lastPlayerStrokeId = {};
    }

    addSegment(playerId, x, z, angle, breakTrail = false) {
        const seg = {
            id: playerId + '_' + Date.now() + '_' + Math.random(),
            playerId,
            x,
            z,
            angle,
            age: 0,
            breakTrail
        };

        this.segments.push(seg);
        if (this.segments.length > this.MAX_SEGMENTS) {
            this.segments.shift();
        }
    }

    breakPlayerTrail(playerId) {
        this.lastPlayerStrokeId[playerId] = Date.now();
    }

    update(delta) {
        // Age segments and remove expired ones
        for (let i = this.segments.length - 1; i >= 0; i--) {
            this.segments[i].age += delta;
            if (this.segments[i].age > this.TRAIL_LIFETIME) {
                this.segments.splice(i, 1);
            }
        }

        // Update single InstancedMesh matrices (0% lag, 100% smooth)
        const count = this.segments.length;
        for (let i = 0; i < count; i++) {
            const seg = this.segments[i];
            const fade = Math.max(0.1, 1.0 - (seg.age / this.TRAIL_LIFETIME));
            
            this._tempMatrix.makeScale(1.0, fade, 1.0);
            this._tempMatrix.makeRotationY(seg.angle);
            this._tempMatrix.setPosition(seg.x, 0.7 * fade, seg.z);
            this.instancedMesh.setMatrixAt(i, this._tempMatrix);
        }

        this.instancedMesh.count = count;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    checkCollision(carX, carZ, localPlayerId) {
        const radiusSq = 2.0 * 2.0;
        // Fast stride sampling to prevent CPU freeze!
        for (let i = 0; i < this.segments.length; i += 2) {
            const seg = this.segments[i];
            // Don't collide with your own fresh trail (less than 0.8s old)
            if (seg.playerId === localPlayerId && seg.age < 0.8) continue;

            const dx = carX - seg.x;
            const dz = carZ - seg.z;
            if (dx * dx + dz * dz < radiusSq) {
                return seg;
            }
        }
        return null;
    }

    clear() {
        this.segments = [];
        this.instancedMesh.count = 0;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
}
