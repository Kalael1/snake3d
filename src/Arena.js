import * as THREE from 'three';

export class Arena {
    constructor(scene, size = 500) {
        this.scene = scene;
        this.size = size;
        this.wallHeight = 8;
        this.wallThickness = 2;
        this.init();
    }

    init() {
        const halfSize = this.size / 2;

        // Soft Medium Slate Gray Floor (Clean, Matte, Non-glare)
        const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x64748b, // Slate Gray
            roughness: 0.9,
            metalness: 0.1
        });

        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Subtle Dark Slate Grid Lines
        const gridHelper = new THREE.GridHelper(this.size, 250, 0x0f172a, 0x475569);
        gridHelper.position.y = 0.05;
        this.scene.add(gridHelper);

        // Boundary Walls - Slate Gray
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.6,
            metalness: 0.4
        });

        const wallGeos = [
            new THREE.BoxGeometry(this.size + this.wallThickness * 2, this.wallHeight, this.wallThickness), // North
            new THREE.BoxGeometry(this.size + this.wallThickness * 2, this.wallHeight, this.wallThickness), // South
            new THREE.BoxGeometry(this.wallThickness, this.wallHeight, this.size), // East
            new THREE.BoxGeometry(this.wallThickness, this.wallHeight, this.size)  // West
        ];

        const wallPositions = [
            [0, this.wallHeight / 2, -halfSize - this.wallThickness / 2],
            [0, this.wallHeight / 2, halfSize + this.wallThickness / 2],
            [halfSize + this.wallThickness / 2, this.wallHeight / 2, 0],
            [-halfSize - this.wallThickness / 2, this.wallHeight / 2, 0]
        ];

        for (let i = 0; i < 4; i++) {
            const wall = new THREE.Mesh(wallGeos[i], wallMat);
            wall.position.set(...wallPositions[i]);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
        }

        // Corner Pillars
        const pillarGeo = new THREE.BoxGeometry(3, this.wallHeight + 4, 3);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00ffcc,
            emissiveIntensity: 0.5,
            roughness: 0.3
        });

        const corners = [
            [-halfSize, (this.wallHeight + 4) / 2, -halfSize],
            [halfSize, (this.wallHeight + 4) / 2, -halfSize],
            [-halfSize, (this.wallHeight + 4) / 2, halfSize],
            [halfSize, (this.wallHeight + 4) / 2, halfSize]
        ];

        corners.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(...pos);
            pillar.castShadow = true;
            this.scene.add(pillar);
        });
    }
}
