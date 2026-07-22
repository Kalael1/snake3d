import * as THREE from 'three';

export class Arena {
    constructor(scene, size = 500) {
        this.scene = scene;
        this.size = size;
        this.wallHeight = 6;
        this.cones = [];
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

        // Center Drift Roundabout
        const circleOuterGeo = new THREE.RingGeometry(16, 20, 48);
        const circleOuterMat = new THREE.MeshBasicMaterial({ color: 0xffa500, side: THREE.DoubleSide });
        const circleOuter = new THREE.Mesh(circleOuterGeo, circleOuterMat);
        circleOuter.rotation.x = -Math.PI / 2;
        circleOuter.position.y = 0.02;
        this.scene.add(circleOuter);

        const circleInnerGeo = new THREE.CircleGeometry(16, 48);
        const circleInnerMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
        const circleInner = new THREE.Mesh(circleInnerGeo, circleInnerMat);
        circleInner.rotation.x = -Math.PI / 2;
        circleInner.position.y = 0.015;
        this.scene.add(circleInner);

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

        // ================= TRAFFIC CONES (KUKALAR) =================
        this.createTrafficCones();
    }

    createTrafficCones() {
        const coneMatOrange = new THREE.MeshLambertMaterial({ color: 0xff5500 });
        const coneMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        const positions = [];

        // 1. Roundabout circle ring cones (12 cones around the central drift ring)
        const ringRadius = 23;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            positions.push({ x: Math.cos(angle) * ringRadius, z: Math.sin(angle) * ringRadius });
        }

        // 2. Slalom cone courses (Straight slalom lines)
        for (let i = -160; i <= 160; i += 40) {
            if (Math.abs(i) > 40) {
                positions.push({ x: i, z: -80 });
                positions.push({ x: i, z: 80 });
                positions.push({ x: -80, z: i });
                positions.push({ x: 80, z: i });
            }
        }

        positions.forEach(pos => {
            const coneGroup = new THREE.Group();

            // Square Base
            const baseGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.075;
            coneGroup.add(baseMesh);

            // Orange Cone Body
            const coneGeo = new THREE.CylinderGeometry(0.08, 0.48, 1.4, 12);
            const coneMesh = new THREE.Mesh(coneGeo, coneMatOrange);
            coneMesh.position.y = 0.75;
            coneGroup.add(coneMesh);

            // White Reflective Stripe
            const stripeGeo = new THREE.CylinderGeometry(0.2, 0.34, 0.32, 12);
            const stripeMesh = new THREE.Mesh(stripeGeo, coneMatWhite);
            stripeMesh.position.y = 0.8;
            coneGroup.add(stripeMesh);

            coneGroup.position.set(pos.x, 0, pos.z);
            this.scene.add(coneGroup);

            this.cones.push({
                group: coneGroup,
                x: pos.x,
                z: pos.z,
                isKnockedOver: false,
                vx: 0,
                vz: 0,
                rotVx: 0
            });
        });
    }

    updateCones(delta, carPos) {
        this.cones.forEach(c => {
            // Check collision with car
            if (!c.isKnockedOver) {
                const dx = carPos.x - c.x;
                const dz = carPos.z - c.z;
                if (dx * dx + dz * dz < 2.8) { // Cone hit!
                    c.isKnockedOver = true;
                    c.vx = (c.x - carPos.x) * 8.0;
                    c.vz = (c.z - carPos.z) * 8.0;
                    c.rotVx = Math.random() * 10 - 5;
                }
            } else {
                // Animate knocked over cone sliding & tumbling
                if (Math.abs(c.vx) > 0.1 || Math.abs(c.vz) > 0.1) {
                    c.x += c.vx * delta;
                    c.z += c.vz * delta;
                    c.vx *= 0.92;
                    c.vz *= 0.92;
                    c.group.position.set(c.x, 0, c.z);
                    c.group.rotation.z = Math.PI / 2;
                    c.group.rotation.y += c.rotVx * delta;
                }
            }
        });
    }
}
