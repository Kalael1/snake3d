import * as THREE from 'three';

export class RibbonTrail {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.maxPoints = options.maxPoints || 250;
        this.width = options.width || 0.35;
        this.heightOffset = options.heightOffset || 0.08;
        this.color = options.color || 0x050505;
        this.opacity = options.opacity || 0.85;

        this.points = []; // Stores { x, z, heading }

        // Dynamic BufferGeometry for a single continuous 3D Ribbon Mesh
        this.geometry = new THREE.BufferGeometry();
        
        // 2 vertices per point (left and right edges)
        const vertexCount = this.maxPoints * 2;
        this.positions = new Float32Array(vertexCount * 3);
        this.indices = new Uint16Array((this.maxPoints - 1) * 6);

        // Build index buffer for continuous quads
        for (let i = 0; i < this.maxPoints - 1; i++) {
            const p = i * 2;
            const idx = i * 6;
            this.indices[idx] = p;
            this.indices[idx + 1] = p + 1;
            this.indices[idx + 2] = p + 2;
            this.indices[idx + 3] = p + 1;
            this.indices[idx + 4] = p + 3;
            this.indices[idx + 5] = p + 2;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

        this.material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: this.opacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
    }

    addPoint(x, z, heading) {
        this.points.push({ x, z, heading });
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
        this.updateMesh();
    }

    updateMesh() {
        const count = Math.min(this.points.length, this.maxPoints);
        if (count < 2) {
            this.geometry.setDrawRange(0, 0);
            return;
        }

        const halfW = this.width / 2;

        for (let i = 0; i < count; i++) {
            const pt = this.points[i];
            const cosH = Math.cos(pt.heading);
            const sinH = Math.sin(pt.heading);

            // Left vertex
            const lx = pt.x - cosH * halfW;
            const lz = pt.z + sinH * halfW;

            // Right vertex
            const rx = pt.x + cosH * halfW;
            const rz = pt.z - sinH * halfW;

            const idx = i * 6; // i * 2 * 3
            if (idx + 5 < this.positions.length) {
                this.positions[idx] = lx;
                this.positions[idx + 1] = this.heightOffset;
                this.positions[idx + 2] = lz;

                this.positions[idx + 3] = rx;
                this.positions[idx + 4] = this.heightOffset;
                this.positions[idx + 5] = rz;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.setDrawRange(0, (count - 1) * 6);
    }

    clear() {
        this.points = [];
        this.geometry.setDrawRange(0, 0);
    }
}
