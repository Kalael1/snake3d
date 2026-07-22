import * as THREE from 'three';

export class OtherSnake {
    constructor(scene, data) {
        this.scene = scene;
        this.id = data.id;
        this.name = data.name || 'Oyuncu';
        this.segments = [];
        this.headRadius = 1.2;
        this.segmentRadius = 0.95;

        // Color based on hue
        this.headMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(data.colorHue || 0.5, 0.9, 0.5),
            emissive: new THREE.Color().setHSL(data.colorHue || 0.5, 0.9, 0.3),
            roughness: 0.2,
            metalness: 0.5
        });

        this.bodyMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(data.colorHue || 0.5, 0.8, 0.4),
            roughness: 0.3,
            metalness: 0.4
        });

        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });

        this.init(data);
    }

    init(data) {
        // Head Group
        const headGroup = new THREE.Group();

        const headGeo = new THREE.SphereGeometry(this.headRadius, 24, 24);
        const headMesh = new THREE.Mesh(headGeo, this.headMat);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const pupilGeo = new THREE.SphereGeometry(0.18, 16, 16);

        const leftEye = new THREE.Mesh(eyeGeo, this.eyeMat);
        leftEye.position.set(-0.5, 0.6, 0.8);
        const leftPupil = new THREE.Mesh(pupilGeo, this.pupilMat);
        leftPupil.position.set(-0.5, 0.6, 1.05);
        headGroup.add(leftEye, leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, this.eyeMat);
        rightEye.position.set(0.5, 0.6, 0.8);
        const rightPupil = new THREE.Mesh(pupilGeo, this.pupilMat);
        rightPupil.position.set(0.5, 0.6, 1.05);
        headGroup.add(rightEye, rightPupil);

        headGroup.position.set(data.x, this.headRadius, data.z);
        headGroup.rotation.y = data.angle || 0;
        this.scene.add(headGroup);
        this.segments.push(headGroup);

        // Body segments
        if (data.body && data.body.length > 0) {
            data.body.forEach(segData => {
                this.addSegment(segData.x, segData.z, segData.angle);
            });
        }
    }

    addSegment(x, z, angle) {
        const geo = new THREE.SphereGeometry(this.segmentRadius, 20, 20);
        const mesh = new THREE.Mesh(geo, this.bodyMat);
        mesh.position.set(x, this.segmentRadius, z);
        mesh.rotation.y = angle || 0;
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.segments.push(mesh);
    }

    update(serverData) {
        if (!serverData) return;

        // Smooth Lerp Head
        const head = this.segments[0];
        head.position.x += (serverData.x - head.position.x) * 0.4;
        head.position.z += (serverData.z - head.position.z) * 0.4;
        head.rotation.y = serverData.angle;

        // Match body segment count
        const serverBody = serverData.body || [];
        while (this.segments.length - 1 < serverBody.length) {
            const lastSeg = serverBody[this.segments.length - 1] || { x: serverData.x, z: serverData.z, angle: serverData.angle };
            this.addSegment(lastSeg.x, lastSeg.z, lastSeg.angle);
        }

        // Update body segment positions
        for (let i = 0; i < serverBody.length; i++) {
            const segMesh = this.segments[i + 1];
            const segData = serverBody[i];
            if (segMesh && segData) {
                segMesh.position.x += (segData.x - segMesh.position.x) * 0.4;
                segMesh.position.z += (segData.z - segMesh.position.z) * 0.4;
                segMesh.rotation.y = segData.angle;
            }
        }
    }

    destroy() {
        this.segments.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
        });
        this.segments = [];
    }
}
