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

        // Simple flat floor — single draw call
        const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        // Lightweight grid — 50 divisions instead of 250
        const gridHelper = new THREE.GridHelper(this.size, 50, 0x334155, 0x475569);
        gridHelper.position.y = 0.05;
        this.scene.add(gridHelper);

        // Boundary Walls — Lambert material (no PBR overhead)
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x334155 });

        const wallGeos = [
            new THREE.BoxGeometry(this.size + this.wallThickness * 2, this.wallHeight, this.wallThickness),
            new THREE.BoxGeometry(this.size + this.wallThickness * 2, this.wallHeight, this.wallThickness),
            new THREE.BoxGeometry(this.wallThickness, this.wallHeight, this.size),
            new THREE.BoxGeometry(this.wallThickness, this.wallHeight, this.size)
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
            this.scene.add(wall);
        }

        // Corner Pillars — Basic material
        const pillarGeo = new THREE.BoxGeometry(3, this.wallHeight + 4, 3);
        const pillarMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

        const corners = [
            [-halfSize, (this.wallHeight + 4) / 2, -halfSize],
            [halfSize, (this.wallHeight + 4) / 2, -halfSize],
            [-halfSize, (this.wallHeight + 4) / 2, halfSize],
            [halfSize, (this.wallHeight + 4) / 2, halfSize]
        ];

        corners.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(...pos);
            this.scene.add(pillar);
        });
    }
}
