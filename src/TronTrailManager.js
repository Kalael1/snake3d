import * as THREE from 'three';

export class TronTrailManager {
    constructor(scene) {
        this.scene = scene;
        this.playerTrails = {}; // Map of playerId -> RibbonMesh
        this.allSegments = [];   // Collision data: { playerId, x, z, age }
        this.TRAIL_LIFETIME = 3.8;
    }

    addSegment(playerId, x, z, angle) {
        this.allSegments.push({
            playerId,
            x,
            z,
            angle,
            age: 0
        });

        if (this.allSegments.length > 1200) {
            this.allSegments.shift();
        }

        if (!this.playerTrails[playerId]) {
            this.playerTrails[playerId] = this.createRibbonMesh();
        }
        this.playerTrails[playerId].addPoint(x, z, angle);
    }

    createRibbonMesh() {
        const maxPoints = 500;
        const height = 1.4;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxPoints * 4 * 3);
        const colors = new Float32Array(maxPoints * 4 * 4); // RGBA per vertex for smooth FADE-OUT!
        const indices = new Uint16Array(maxPoints * 6);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        const material = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        this.scene.add(mesh);

        const pts = [];
        const lifetime = this.TRAIL_LIFETIME;

        return {
            mesh,
            geometry,
            positions,
            colors,
            indices,
            pts,
            addPoint(x, z, angle) {
                pts.push({ x, z, angle, age: 0 });
                if (pts.length > maxPoints) pts.shift();
            },
            update(delta) {
                // Age points and fade opacity smoothly!
                for (let i = pts.length - 1; i >= 0; i--) {
                    pts[i].age += delta;
                    if (pts[i].age > lifetime) {
                        pts.splice(i, 1);
                    }
                }

                const count = pts.length;
                if (count < 2) {
                    geometry.setDrawRange(0, 0);
                    return;
                }

                let idx = 0;
                let colIdx = 0;
                let triIdx = 0;

                for (let i = 0; i < count - 1; i++) {
                    const p1 = pts[i];
                    const p2 = pts[i + 1];

                    const vIdx = i * 4;

                    // Smooth Fade Out Alpha: 1.0 -> 0.0 over lifetime!
                    const alpha1 = Math.max(0, 1.0 - (p1.age / lifetime));
                    const alpha2 = Math.max(0, 1.0 - (p2.age / lifetime));

                    // Positions
                    positions[idx] = p1.x;
                    positions[idx + 1] = 0.1;
                    positions[idx + 2] = p1.z;

                    positions[idx + 3] = p1.x;
                    positions[idx + 4] = height * alpha1; // Wall height also shrinks smoothly as it fades out!
                    positions[idx + 5] = p1.z;

                    positions[idx + 6] = p2.x;
                    positions[idx + 7] = 0.1;
                    positions[idx + 8] = p2.z;

                    positions[idx + 9] = p2.x;
                    positions[idx + 10] = height * alpha2;
                    positions[idx + 11] = p2.z;

                    idx += 12;

                    // Quad indices
                    indices[triIdx] = vIdx;
                    indices[triIdx + 1] = vIdx + 1;
                    indices[triIdx + 2] = vIdx + 2;

                    indices[triIdx + 3] = vIdx + 1;
                    indices[triIdx + 4] = vIdx + 3;
                    indices[triIdx + 5] = vIdx + 2;

                    triIdx += 6;
                }

                geometry.attributes.position.needsUpdate = true;
                geometry.index.needsUpdate = true;
                geometry.setDrawRange(0, triIdx);
            },
            destroy() {
                scene.remove(mesh);
                geometry.dispose();
                material.dispose();
            }
        };
    }

    update(delta) {
        // Age collision points
        for (let i = this.allSegments.length - 1; i >= 0; i--) {
            this.allSegments[i].age += delta;
            if (this.allSegments[i].age > this.TRAIL_LIFETIME) {
                this.allSegments.splice(i, 1);
            }
        }

        // Update active player trail ribbon meshes with smooth fade out
        for (const pid in this.playerTrails) {
            this.playerTrails[pid].update(delta);
        }
    }

    checkCollision(carX, carZ, localPlayerId) {
        const radiusSq = 2.2 * 2.2;
        for (let i = 0; i < this.allSegments.length; i++) {
            const seg = this.allSegments[i];
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
        this.allSegments = [];
        for (const pid in this.playerTrails) {
            this.playerTrails[pid].destroy();
        }
        this.playerTrails = {};
    }
}
