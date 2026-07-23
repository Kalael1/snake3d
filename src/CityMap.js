import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * CityMap — loads the artist-authored City.glb and exposes the same surface the
 * old procedural Arena did (size, buildings, collision checks, cone stubs) so the
 * rest of the game keeps working. It also recenters the model to the world origin
 * and locates the "YoutubeMonitor" mesh so the shared video can be pinned to it.
 *
 * Loading is async; callers gate gameplay on `ready`.
 */
export class CityMap {
    constructor(scene, url = '/Map/City.glb') {
        this.scene = scene;
        this.size = 560;          // sensible defaults until the model is measured
        this.halfX = 280;
        this.halfZ = 340;
        this.buildings = [];      // { minX, maxX, minZ, maxZ } world-space collision boxes
        this.barriers = [];       // unused for the city (kept for API compatibility)
        this.cones = [];          // unused
        this.loaded = false;
        this.monitor = null;      // { pos: Vector3, width, height }
        this.root = null;

        this.ready = new Promise((resolve, reject) => {
            new GLTFLoader().load(url, (gltf) => {
                try { this._onLoaded(gltf); resolve(this); }
                catch (e) { reject(e); }
            }, undefined, reject);
        });
    }

    _onLoaded(gltf) {
        const root = gltf.scene;
        root.updateWorldMatrix(true, true);

        // 1. Recenter the model so its XZ centre sits on the origin (ground stays ~y=0)
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        root.position.set(-center.x, 0, -center.z);
        root.updateWorldMatrix(true, true);

        this.size = Math.max(size.x, size.z);
        this.halfX = size.x / 2;
        this.halfZ = size.z / 2;
        this.root = root;
        this.scene.add(root);

        // 2. Derive collision boxes from building-like meshes + find the video monitor
        const SKIP_RE = /road|ground|grass|sidewalk|side_walk|floor|plane|walk|lane|line|curb|water|river|asphalt|terrain|park|grnd|zebra|cross/i;
        const tmpBox = new THREE.Box3();
        let monitorMesh = null;

        root.traverse((o) => {
            if (!o.isMesh) return;
            if (o.name === 'YoutubeMonitor') monitorMesh = o;

            if (SKIP_RE.test(o.name)) return;
            tmpBox.setFromObject(o);
            if (tmpBox.isEmpty()) return;
            const bs = tmpBox.getSize(new THREE.Vector3());
            const height = bs.y;
            const footprint = Math.min(bs.x, bs.z);
            // Skip anything floating above the road (signs, wires, the elevated monitor):
            // 2D collision can't tell height, so only ground-touching meshes are obstacles.
            if (tmpBox.min.y > 4) return;
            // Buildings / buses / big props: tall enough and with real footprint
            if (height > 6 && footprint > 3.5) {
                this.buildings.push({
                    minX: tmpBox.min.x - 1.1,
                    maxX: tmpBox.max.x + 1.1,
                    minZ: tmpBox.min.z - 1.1,
                    maxZ: tmpBox.max.z + 1.1
                });
            }
        });

        // 3. Locate the YouTube monitor for the shared screen overlay
        if (monitorMesh) {
            const wp = new THREE.Vector3();
            monitorMesh.getWorldPosition(wp);
            const mbox = new THREE.Box3().setFromObject(monitorMesh);
            const ms = mbox.getSize(new THREE.Vector3());
            this.monitor = {
                mesh: monitorMesh,
                pos: wp,
                width: Math.max(ms.x, ms.z),
                height: ms.y
            };
        }

        this.loaded = true;
    }

    findSpawn() {
        if (!this.checkBuildingCollision(0, 0)) return { x: 0, z: 0 };
        for (let r = 8; r <= 120; r += 8) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                const x = Math.cos(a) * r, z = Math.sin(a) * r;
                if (!this.checkBuildingCollision(x, z)) return { x, z };
            }
        }
        return { x: 0, z: 0 };
    }

    checkBuildingCollision(x, z) {
        for (let i = 0; i < this.buildings.length; i++) {
            const b = this.buildings[i];
            if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return b;
        }
        return null;
    }

    checkBarrierCollision() { return null; }
    updateCones() { /* no cones in the city map */ }
}
