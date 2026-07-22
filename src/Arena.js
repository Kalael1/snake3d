import * as THREE from 'three';

export class Arena {
    constructor(scene, size) {
        this.size = size;
        
        // Clean White Ground
        const floorGeo = new THREE.PlaneGeometry(size, size);
        const solidMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.1
        });

        const ground = new THREE.Mesh(floorGeo, solidMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Elegant Slate Grid lines over white ground
        const gridHelper = new THREE.GridHelper(size, 250, 0x475569, 0xc0c6d4);
        gridHelper.position.y = 0.05;
        if (gridHelper.material) {
            gridHelper.material.opacity = 0.5;
            gridHelper.material.transparent = true;
        }
        scene.add(gridHelper);

        // Sleek Gray Boundary Walls
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x64748b, // Modern Slate Gray
            emissive: 0x334155,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.5
        });
        
        const wallGeo = new THREE.BoxGeometry(size, 6, 2);
        
        const wallN = new THREE.Mesh(wallGeo, wallMat);
        wallN.position.set(0, 3, -size/2);
        scene.add(wallN);

        const wallS = new THREE.Mesh(wallGeo, wallMat);
        wallS.position.set(0, 3, size/2);
        scene.add(wallS);

        const wallE = new THREE.Mesh(wallGeo, wallMat);
        wallE.rotation.y = Math.PI / 2;
        wallE.position.set(size/2, 3, 0);
        scene.add(wallE);

        const wallW = new THREE.Mesh(wallGeo, wallMat);
        wallW.rotation.y = Math.PI / 2;
        wallW.position.set(-size/2, 3, 0);
        scene.add(wallW);

        // Corner Pillars in Slate Gray
        const pillarGeo = new THREE.CylinderGeometry(2.5, 2.5, 12, 16);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.2,
            metalness: 0.8
        });

        const corners = [
            [-size/2, -size/2],
            [size/2, -size/2],
            [-size/2, size/2],
            [size/2, size/2]
        ];

        corners.forEach(([x, z]) => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(x, 6, z);
            scene.add(pillar);

            const light = new THREE.PointLight(0x64748b, 2, 60);
            light.position.set(x, 8, z);
            scene.add(light);
        });
    }
}
