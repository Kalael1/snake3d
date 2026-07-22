import * as THREE from 'three';

export class TronTrailManager {
    constructor(scene) {
        this.scene = scene;
        this.MAX_SEGMENTS = 800;
        this.TRAIL_LIFETIME = 4.0; // Seconds before light wall fades out

        this.segments = []; // Active trail point objects: { id, playerId, x, z, angle, age }

        // 3D Visual Mesh for Glowing Neon Light Walls (Vertical planes)
        const wallGeo = new THREE.PlaneGeometry(1.2, 2.0);
        wallGeo.rotateY(Math.PI / 2);
        
        const wallMat = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.instancedMesh = new THREE.InstancedMesh(wallGeo, wallMat, this.MAX_SEGMENTS);
        this.instancedMesh.frustumCulled = false;
        this.instancedMesh.count = 0;
        this.scene.add(this.instancedMesh);

        this._tempMatrix = new THREE.Matrix4();
    }

    addSegment(playerId, x, z, angle) {
        const seg = {
            id: playerId + '_' + Date.now() + '_' + Math.random(),
            playerId,
            x,
            z,
            angle,
            age: 0
        };
        this.segments.push(seg);
        if (this.segments.length > this.MAX_SEGMENTS) {
            this.segments.shift();
        }
    }

    update(delta) {
        const now = Date.now();
        
        // Age segments and remove expired ones
        for (let i = this.segments.length - 1; i >= 0; i--) {
            this.segments[i].age += delta;
            if (this.segments[i].age > this.TRAIL_LIFETIME) {
                this.segments.splice(i, 1);
            }
        }

        // Update InstancedMesh matrices
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const fade = Math.max(0.1, 1.0 - (seg.age / this.TRAIL_LIFETIME));
            
            this._tempMatrix.makeRotationY(seg.angle);
            this._tempMatrix.setPosition(seg.x, 1.0, seg.z);
            this.instancedMesh.setMatrixAt(i, this._tempMatrix);
        }

        this.instancedMesh.count = this.segments.length;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    checkCollision(carX, carZ, localPlayerId) {
        const radiusSq = 2.2 * 2.2;
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            // Don't collide with your own fresh trail (less than 0.8s old)
            if (seg.playerId === localPlayerId && seg.age < 0.8) continue;

            const dx = carX - seg.x;
            const dz = carZ - seg.z;
            if (dx * dx + dz * dz < radiusSq) {
                return seg; // Collision detected!
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
