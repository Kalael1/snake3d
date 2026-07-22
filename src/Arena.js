import * as THREE from 'three';

export class Arena {
    constructor(scene, size = 500) {
        this.scene = scene;
        this.size = size;
        this.wallHeight = 8;
        this.cones = [];
        this.barriers = []; // Solid neon crash barriers with bounding boxes
        this.init();
    }

    init() {
        const halfSize = this.size / 2;

        // Dark Tron Cyber Grid Floor
        const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x050811 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        // Glowing Tron Grid Lines across floor
        const gridHelper = new THREE.GridHelper(this.size, 50, 0x00f3ff, 0x0f2d4a);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // ================= TRON HIGHWAY LANES =================
        this.createTronRoads();

        // Center Glowing Tron Drift Ring
        const circleOuterGeo = new THREE.RingGeometry(16, 22, 64);
        const circleOuterMat = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });
        const circleOuter = new THREE.Mesh(circleOuterGeo, circleOuterMat);
        circleOuter.rotation.x = -Math.PI / 2;
        circleOuter.position.y = 0.04;
        this.scene.add(circleOuter);

        const circleInnerGeo = new THREE.CircleGeometry(16, 64);
        const circleInnerMat = new THREE.MeshBasicMaterial({
            color: 0x080e1a,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        const circleInner = new THREE.Mesh(circleInnerGeo, circleInnerMat);
        circleInner.rotation.x = -Math.PI / 2;
        circleInner.position.y = 0.035;
        this.scene.add(circleInner);

        // ================= TRON CYBERPUNK BUILDINGS =================
        this.createTronBuildings();

        // ================= SOLID NEON CRASH BARRIERS =================
        this.createCrashBarriers();

        // Outer Tron Perimeter Wall (Glowing Magenta / Cyan Wall)
        const wallMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.95 });
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

        // Corner Glowing Tron Pillars
        const pillarGeo = new THREE.CylinderGeometry(3, 3, this.wallHeight + 10, 12);
        const pillarMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const corners = [
            [-halfSize, (this.wallHeight + 10) / 2, -halfSize],
            [halfSize, (this.wallHeight + 10) / 2, -halfSize],
            [-halfSize, (this.wallHeight + 10) / 2, halfSize],
            [halfSize, (this.wallHeight + 10) / 2, halfSize]
        ];
        corners.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(...pos);
            this.scene.add(pillar);
        });

        // ================= TRAFFIC CONES (KUKALAR) =================
        this.createTrafficCones();
    }

    createTronRoads() {
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x0a101d });
        const cyanLineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const magentaLineMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

        const roadPositions = [-120, 0, 120];

        roadPositions.forEach(offset => {
            // Dark Highway Base
            const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(28, this.size), roadMat);
            vRoad.rotation.x = -Math.PI / 2;
            vRoad.position.set(offset, 0.015, 0);
            this.scene.add(vRoad);

            const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(this.size, 28), roadMat);
            hRoad.rotation.x = -Math.PI / 2;
            hRoad.position.set(0, 0.015, offset);
            this.scene.add(hRoad);

            // Glowing Tron Highway Stripes
            if (offset === 0) {
                const segLen = (this.size / 2) - 25;
                const segCenterPos = 25 + (segLen / 2);

                [-segCenterPos, segCenterPos].forEach(zPos => {
                    const y1 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, segLen), cyanLineMat);
                    y1.rotation.x = -Math.PI / 2;
                    y1.position.set(-0.4, 0.022, zPos);
                    this.scene.add(y1);

                    const y2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, segLen), cyanLineMat);
                    y2.rotation.x = -Math.PI / 2;
                    y2.position.set(0.4, 0.022, zPos);
                    this.scene.add(y2);
                });

                [-segCenterPos, segCenterPos].forEach(xPos => {
                    const x1 = new THREE.Mesh(new THREE.PlaneGeometry(segLen, 0.4), cyanLineMat);
                    x1.rotation.x = -Math.PI / 2;
                    x1.position.set(xPos, 0.022, -0.4);
                    this.scene.add(x1);

                    const x2 = new THREE.Mesh(new THREE.PlaneGeometry(segLen, 0.4), cyanLineMat);
                    x2.rotation.x = -Math.PI / 2;
                    x2.position.set(xPos, 0.022, 0.4);
                    this.scene.add(x2);
                });
            } else {
                const v1 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, this.size), magentaLineMat);
                v1.rotation.x = -Math.PI / 2;
                v1.position.set(offset, 0.022, 0);
                this.scene.add(v1);

                const h1 = new THREE.Mesh(new THREE.PlaneGeometry(this.size, 0.4), magentaLineMat);
                h1.rotation.x = -Math.PI / 2;
                h1.position.set(0, 0.022, offset);
                this.scene.add(h1);
            }
        });
    }

    createTronBuildings() {
        const buildingMat = new THREE.MeshLambertMaterial({ color: 0x060c18 });
        const neonTrimColors = [0x00f3ff, 0xff0055, 0x00ff88, 0xffaa00];

        const buildingLocations = [];

        // Outer Perimeter Tron Skyscrapers
        for (let i = -210; i <= 210; i += 60) {
            buildingLocations.push({ x: i, z: -225, w: 45, d: 45, h: 35 + Math.random() * 35 });
            buildingLocations.push({ x: i, z: 225, w: 45, d: 45, h: 35 + Math.random() * 35 });
            buildingLocations.push({ x: -225, z: i, w: 45, d: 45, h: 35 + Math.random() * 35 });
            buildingLocations.push({ x: 225, z: i, w: 45, d: 45, h: 35 + Math.random() * 35 });
        }

        // Inner City Block Monoliths
        const innerBlocks = [-170, -60, 60, 170];
        innerBlocks.forEach(bx => {
            innerBlocks.forEach(bz => {
                if (Math.abs(bx) === 60 && Math.abs(bz) === 60) return;
                buildingLocations.push({ x: bx, z: bz, w: 38, d: 38, h: 25 + Math.random() * 25 });
            });
        });

        buildingLocations.forEach((b, idx) => {
            const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
            const bMesh = new THREE.Mesh(bGeo, buildingMat);
            bMesh.position.set(b.x, b.h / 2, b.z);
            this.scene.add(bMesh);

            // Glowing Wireframe Edges (Tron Aesthetic!)
            const wireGeo = new THREE.WireframeGeometry(bGeo);
            const wireMat = new THREE.LineBasicMaterial({ color: neonTrimColors[idx % neonTrimColors.length], linewidth: 2 });
            const wireLine = new THREE.LineSegments(wireGeo, wireMat);
            wireLine.position.set(b.x, b.h / 2, b.z);
            this.scene.add(wireLine);

            // Glowing Roof Beacon Trim
            const trimMat = new THREE.MeshBasicMaterial({ color: neonTrimColors[idx % neonTrimColors.length] });
            const trimGeo = new THREE.BoxGeometry(b.w + 0.8, 1.0, b.d + 0.8);
            const trimMesh = new THREE.Mesh(trimGeo, trimMat);
            trimMesh.position.set(b.x, b.h + 0.5, b.z);
            this.scene.add(trimMesh);
        });
    }

    createCrashBarriers() {
        const barrierMatConcrete = new THREE.MeshLambertMaterial({ color: 0x1a202c });
        const barrierMatNeon = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const hazardMatYellow = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

        // Barrier Placements (Dangerous chicanes, intersection blocks, and street barriers!)
        const barrierConfigs = [
            // Center Roundabout Entrance Barriers (High risk drift chicanes!)
            { x: -35, z: 0, w: 1.5, h: 2.8, d: 10 },
            { x: 35, z: 0, w: 1.5, h: 2.8, d: 10 },
            { x: 0, z: -35, w: 10, h: 2.8, d: 1.5 },
            { x: 0, z: 35, w: 10, h: 2.8, d: 1.5 },

            // Highway Mid-Street Barriers
            { x: -120, z: -60, w: 1.5, h: 2.8, d: 14 },
            { x: -120, z: 60, w: 1.5, h: 2.8, d: 14 },
            { x: 120, z: -60, w: 1.5, h: 2.8, d: 14 },
            { x: 120, z: 60, w: 1.5, h: 2.8, d: 14 },
            { x: -60, z: -120, w: 14, h: 2.8, d: 1.5 },
            { x: 60, z: -120, w: 14, h: 2.8, d: 1.5 },
            { x: -60, z: 120, w: 14, h: 2.8, d: 1.5 },
            { x: 60, z: 120, w: 14, h: 2.8, d: 1.5 },

            // Corner Chicane Obstructive Barriers
            { x: -100, z: -100, w: 8, h: 2.8, d: 8 },
            { x: 100, z: -100, w: 8, h: 2.8, d: 8 },
            { x: -100, z: 100, w: 8, h: 2.8, d: 8 },
            { x: 100, z: 100, w: 8, h: 2.8, d: 8 }
        ];

        barrierConfigs.forEach(b => {
            const group = new THREE.Group();

            // Heavy Concrete Base
            const baseGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
            const baseMesh = new THREE.Mesh(baseGeo, barrierMatConcrete);
            baseMesh.position.y = b.h / 2;
            group.add(baseMesh);

            // Glowing Neon Edge Strip
            const neonGeo = new THREE.BoxGeometry(b.w + 0.2, 0.4, b.d + 0.2);
            const neonMesh = new THREE.Mesh(neonGeo, barrierMatNeon);
            neonMesh.position.y = b.h + 0.2;
            group.add(neonMesh);

            // Flashing Yellow Warning Beacons
            const beaconGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 8);
            const beaconMesh1 = new THREE.Mesh(beaconGeo, hazardMatYellow);
            beaconMesh1.position.set(-b.w / 3, b.h + 0.6, 0);
            group.add(beaconMesh1);

            const beaconMesh2 = new THREE.Mesh(beaconGeo, hazardMatYellow);
            beaconMesh2.position.set(b.w / 3, b.h + 0.6, 0);
            group.add(beaconMesh2);

            group.position.set(b.x, 0, b.z);
            this.scene.add(group);

            // Save barrier collision bounding box
            this.barriers.push({
                x: b.x,
                z: b.z,
                minX: b.x - (b.w / 2) - 1.2,
                maxX: b.x + (b.w / 2) + 1.2,
                minZ: b.z - (b.d / 2) - 1.2,
                maxZ: b.z + (b.d / 2) + 1.2
            });
        });
    }

    createTrafficCones() {
        const coneMatOrange = new THREE.MeshLambertMaterial({ color: 0xff5500 });
        const coneMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        const positions = [];

        // Roundabout circle ring cones
        const ringRadius = 23;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            positions.push({ x: Math.cos(angle) * ringRadius, z: Math.sin(angle) * ringRadius });
        }

        // Slalom cone courses
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

    checkBarrierCollision(carX, carZ) {
        for (let i = 0; i < this.barriers.length; i++) {
            const b = this.barriers[i];
            if (carX >= b.minX && carX <= b.maxX && carZ >= b.minZ && carZ <= b.maxZ) {
                return b;
            }
        }
        return null;
    }
}
