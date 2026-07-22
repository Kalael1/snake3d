import * as THREE from 'three';

export class Arena {
    constructor(scene, size = 500) {
        this.scene = scene;
        this.size = size;
        this.wallHeight = 6;
        this.init();
    }

    init() {
        const halfSize = this.size / 2;

        // Dark asphalt floor
        const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        // Road lane markings (dashed white lines)
        const lineGeo = new THREE.PlaneGeometry(0.3, this.size);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x666666 });

        for (let i = -200; i <= 200; i += 50) {
            const vLine = new THREE.Mesh(lineGeo, lineMat);
            vLine.rotation.x = -Math.PI / 2;
            vLine.position.set(i, 0.01, 0);
            this.scene.add(vLine);

            const hLine = new THREE.Mesh(new THREE.PlaneGeometry(this.size, 0.3), lineMat);
            hLine.rotation.x = -Math.PI / 2;
            hLine.position.set(0, 0.01, i);
            this.scene.add(hLine);
        }

        // Center circle (drift roundabout)
        const circleGeo = new THREE.RingGeometry(18, 20, 32);
        const circleMat = new THREE.MeshBasicMaterial({ color: 0xffa500, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(circleGeo, circleMat);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = 0.02;
        this.scene.add(circle);

        // Center island (solid cylinder)
        const islandGeo = new THREE.CylinderGeometry(17, 17, 1.5, 24);
        const islandMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
        const island = new THREE.Mesh(islandGeo, islandMat);
        island.position.y = 0.75;
        this.scene.add(island);

        // Neon boundary walls
        const wallMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

        const wallConfigs = [
            { size: [this.size, this.wallHeight, 1.5], pos: [0, this.wallHeight / 2, -halfSize] },
            { size: [this.size, this.wallHeight, 1.5], pos: [0, this.wallHeight / 2, halfSize] },
            { size: [1.5, this.wallHeight, this.size], pos: [halfSize, this.wallHeight / 2, 0] },
            { size: [1.5, this.wallHeight, this.size], pos: [-halfSize, this.wallHeight / 2, 0] }
        ];

        wallConfigs.forEach(cfg => {
            const geo = new THREE.BoxGeometry(...cfg.size);
            const wall = new THREE.Mesh(geo, wallMat);
            wall.position.set(...cfg.pos);
            this.scene.add(wall);
        });

        // Corner neon pillars
        const pillarGeo = new THREE.CylinderGeometry(2, 2, this.wallHeight + 4, 8);
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
