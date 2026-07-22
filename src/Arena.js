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
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x1e222a });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        // ================= 3D CITY ROADS & STREET MARKINGS =================
        this.createCityRoads();

        // Center Drift Roundabout (Fixed Z-Height + PolygonOffset so zero Z-fighting/flicker happens!)
        const circleOuterGeo = new THREE.RingGeometry(16, 21, 64);
        const circleOuterMat = new THREE.MeshBasicMaterial({ color: 0xffa500, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const circleOuter = new THREE.Mesh(circleOuterGeo, circleOuterMat);
        circleOuter.rotation.x = -Math.PI / 2;
        circleOuter.position.y = 0.04;
        this.scene.add(circleOuter);

        const circleInnerGeo = new THREE.CircleGeometry(16, 64);
        const circleInnerMat = new THREE.MeshBasicMaterial({ color: 0x111622, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        const circleInner = new THREE.Mesh(circleInnerGeo, circleInnerMat);
        circleInner.rotation.x = -Math.PI / 2;
        circleInner.position.y = 0.035;
        this.scene.add(circleInner);

        // ================= 3D CITY BUILDINGS & SKYSCRAPERS =================
        this.createCityBuildings();

        // Neon boundary walls
        const wallMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
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
        const pillarGeo = new THREE.CylinderGeometry(2.5, 2.5, this.wallHeight + 6, 8);
        const pillarMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const corners = [
            [-halfSize, (this.wallHeight + 6) / 2, -halfSize],
            [halfSize, (this.wallHeight + 6) / 2, -halfSize],
            [-halfSize, (this.wallHeight + 6) / 2, halfSize],
            [halfSize, (this.wallHeight + 6) / 2, halfSize]
        ];
        corners.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(...pos);
            this.scene.add(pillar);
        });

        // ================= TRAFFIC CONES (KUKALAR) =================
        this.createTrafficCones();
    }

    createCityRoads() {
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x282c34 });
        const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });

        const roadPositions = [-120, 0, 120];

        roadPositions.forEach(offset => {
            // Asphalt Road Base
            const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(28, this.size), roadMat);
            vRoad.rotation.x = -Math.PI / 2;
            vRoad.position.set(offset, 0.01, 0);
            this.scene.add(vRoad);

            const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(this.size, 28), roadMat);
            hRoad.rotation.x = -Math.PI / 2;
            hRoad.position.set(0, 0.01, offset);
            this.scene.add(hRoad);

            // Double Yellow Lines (Natively omitted inside central roundabout radius r=24!)
            if (offset === 0) {
                // Split central lines into 2 segments (North/South & East/West) to completely bypass the central drift ring!
                const segLen = (this.size / 2) - 24; // ~226 units
                const segCenterPos = 24 + (segLen / 2); // ~137 units

                // Vertical double lines (North & South segments)
                [-segCenterPos, segCenterPos].forEach(zPos => {
                    const y1 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, segLen), yellowLineMat);
                    y1.rotation.x = -Math.PI / 2;
                    y1.position.set(-0.3, 0.02, zPos);
                    this.scene.add(y1);

                    const y2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, segLen), yellowLineMat);
                    y2.rotation.x = -Math.PI / 2;
                    y2.position.set(0.3, 0.02, zPos);
                    this.scene.add(y2);
                });

                // Horizontal double lines (East & West segments)
                [-segCenterPos, segCenterPos].forEach(xPos => {
                    const x1 = new THREE.Mesh(new THREE.PlaneGeometry(segLen, 0.35), yellowLineMat);
                    x1.rotation.x = -Math.PI / 2;
                    x1.position.set(xPos, 0.02, -0.3);
                    this.scene.add(x1);

                    const x2 = new THREE.Mesh(new THREE.PlaneGeometry(segLen, 0.35), yellowLineMat);
                    x2.rotation.x = -Math.PI / 2;
                    x2.position.set(xPos, 0.02, 0.3);
                    this.scene.add(x2);
                });
            } else {
                // Continuous yellow lines for non-center avenues
                const vYellow1 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, this.size), yellowLineMat);
                vYellow1.rotation.x = -Math.PI / 2;
                vYellow1.position.set(offset - 0.3, 0.02, 0);
                this.scene.add(vYellow1);

                const vYellow2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, this.size), yellowLineMat);
                vYellow2.rotation.x = -Math.PI / 2;
                vYellow2.position.set(offset + 0.3, 0.02, 0);
                this.scene.add(vYellow2);

                const hYellow1 = new THREE.Mesh(new THREE.PlaneGeometry(this.size, 0.35), yellowLineMat);
                hYellow1.rotation.x = -Math.PI / 2;
                hYellow1.position.set(0, 0.02, offset - 0.3);
                this.scene.add(hYellow1);

                const hYellow2 = new THREE.Mesh(new THREE.PlaneGeometry(this.size, 0.35), yellowLineMat);
                hYellow2.rotation.x = -Math.PI / 2;
                hYellow2.position.set(0, 0.02, offset + 0.3);
                this.scene.add(hYellow2);
            }
        });

        // Zebra Crossings (Pedestrian Crosswalks) at outer intersections
        const zebraStripGeo = new THREE.PlaneGeometry(1.2, 8.0);

        roadPositions.forEach(x => {
            roadPositions.forEach(z => {
                if (x === 0 && z === 0) return; // Skip roundabout center

                for (let i = -10; i <= 10; i += 2.5) {
                    const zNorth = new THREE.Mesh(zebraStripGeo, whiteLineMat);
                    zNorth.rotation.x = -Math.PI / 2;
                    zNorth.position.set(x + i * 0.7, 0.022, z - 16);
                    this.scene.add(zNorth);

                    const zSouth = new THREE.Mesh(zebraStripGeo, whiteLineMat);
                    zSouth.rotation.x = -Math.PI / 2;
                    zSouth.position.set(x + i * 0.7, 0.022, z + 16);
                    this.scene.add(zSouth);
                }
            });
        });
    }

    createCityBuildings() {
        const buildingColors = [0x0f172a, 0x1e293b, 0x334155, 0x1e1b4b];
        const neonTrimColors = [0x00f3ff, 0xff0055, 0xf59e0b, 0x10b981];

        const windowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });

        const buildingLocations = [];

        // Outer Perimeter Sky-scraping Towers
        for (let i = -210; i <= 210; i += 60) {
            buildingLocations.push({ x: i, z: -225, w: 45, d: 45, h: 30 + Math.random() * 35 });
            buildingLocations.push({ x: i, z: 225, w: 45, d: 45, h: 30 + Math.random() * 35 });
            buildingLocations.push({ x: -225, z: i, w: 45, d: 45, h: 30 + Math.random() * 35 });
            buildingLocations.push({ x: 225, z: i, w: 45, d: 45, h: 30 + Math.random() * 35 });
        }

        // Inner City Block Buildings
        const innerBlocks = [-170, -60, 60, 170];
        innerBlocks.forEach(bx => {
            innerBlocks.forEach(bz => {
                if (Math.abs(bx) === 60 && Math.abs(bz) === 60) return;
                buildingLocations.push({ x: bx, z: bz, w: 38, d: 38, h: 20 + Math.random() * 25 });
            });
        });

        buildingLocations.forEach((b, idx) => {
            const bMat = new THREE.MeshLambertMaterial({ color: buildingColors[idx % buildingColors.length] });
            const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
            const bMesh = new THREE.Mesh(bGeo, bMat);
            bMesh.position.set(b.x, b.h / 2, b.z);
            this.scene.add(bMesh);

            const trimMat = new THREE.MeshBasicMaterial({ color: neonTrimColors[idx % neonTrimColors.length] });
            const trimGeo = new THREE.BoxGeometry(b.w + 0.8, 0.8, b.d + 0.8);
            const trimMesh = new THREE.Mesh(trimGeo, trimMat);
            trimMesh.position.set(b.x, b.h + 0.4, b.z);
            this.scene.add(trimMesh);

            const winRowGeo = new THREE.PlaneGeometry(b.w * 0.7, 0.8);
            for (let y = 4; y < b.h - 2; y += 4) {
                if (Math.random() > 0.25) {
                    const winFront = new THREE.Mesh(winRowGeo, windowMat);
                    winFront.position.set(b.x, y, b.z + b.d / 2 + 0.05);
                    this.scene.add(winFront);

                    const winBack = new THREE.Mesh(winRowGeo, windowMat);
                    winBack.rotation.y = Math.PI;
                    winBack.position.set(b.x, y, b.z - b.d / 2 - 0.05);
                    this.scene.add(winBack);
                }
            }
        });
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

        // 2. Slalom cone courses
        for (let i = -160; i <= 160; i += 40) {
            if (Math.abs(i) > 40) {
                positions.push({ x: i, z: -120 });
                positions.push({ x: i, z: 120 });
                positions.push({ x: -120, z: i });
                positions.push({ x: 120, z: i });
            }
        }

        positions.forEach(pos => {
            const coneGroup = new THREE.Group();

            const baseGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.075;
            coneGroup.add(baseMesh);

            const coneGeo = new THREE.CylinderGeometry(0.08, 0.48, 1.4, 12);
            const coneMesh = new THREE.Mesh(coneGeo, coneMatOrange);
            coneMesh.position.y = 0.75;
            coneGroup.add(coneMesh);

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
            if (!c.isKnockedOver) {
                const dx = carPos.x - c.x;
                const dz = carPos.z - c.z;
                if (dx * dx + dz * dz < 2.8) {
                    c.isKnockedOver = true;
                    c.vx = (c.x - carPos.x) * 8.0;
                    c.vz = (c.z - carPos.z) * 8.0;
                    c.rotVx = Math.random() * 10 - 5;
                }
            } else {
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
