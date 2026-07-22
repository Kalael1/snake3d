import * as THREE from 'three';
import { getSkinById } from './SkinRegistry.js';

export class OtherSnake {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;
        this.name = initialData.name || 'Oyuncu';
        this.skinId = initialData.skinId || 'classic';
        this.activeSkin = getSkinById(this.skinId);
        
        this.segments = [];
        this.targetPositions = [];

        this.headRadius = 1.2;
        this.segmentRadius = 0.95;

        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });

        this.init(initialData);
    }

    init(data) {
        this.headGroup = new THREE.Group();

        const skin = this.activeSkin;

        const headMat = new THREE.MeshStandardMaterial({
            color: skin.headColor,
            emissive: skin.headColor,
            emissiveIntensity: skin.emissiveIntensity,
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        const headGeo = new THREE.SphereGeometry(this.headRadius, 32, 32);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.castShadow = true;
        this.headGroup.add(headMesh);

        // Add Eyes
        const eyeGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const pupilGeo = new THREE.SphereGeometry(0.18, 16, 16);

        const leftEye = new THREE.Mesh(eyeGeo, this.eyeMat);
        leftEye.position.set(-0.5, 0.6, 0.8);
        const leftPupil = new THREE.Mesh(pupilGeo, this.pupilMat);
        leftPupil.position.set(-0.5, 0.6, 1.05);
        this.headGroup.add(leftEye, leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, this.eyeMat);
        rightEye.position.set(0.5, 0.6, 0.8);
        const rightPupil = new THREE.Mesh(pupilGeo, this.pupilMat);
        rightPupil.position.set(0.5, 0.6, 1.05);
        this.headGroup.add(rightEye, rightPupil);

        // Optional 3D Horns / Crown
        if (skin.hasHorns) {
            const hornGeo = new THREE.ConeGeometry(0.2, 0.9, 16);
            const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.6 });

            const leftHorn = new THREE.Mesh(hornGeo, hornMat);
            leftHorn.position.set(-0.6, 1.2, -0.3);
            leftHorn.rotation.set(-0.3, 0, -0.3);

            const rightHorn = new THREE.Mesh(hornGeo, hornMat);
            rightHorn.position.set(0.6, 1.2, -0.3);
            rightHorn.rotation.set(-0.3, 0, 0.3);

            this.headGroup.add(leftHorn, rightHorn);
        }

        if (skin.hasCrown) {
            const crownGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.4, 6);
            const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.set(0, 1.35, 0);
            this.headGroup.add(crown);
        }

        this.headGroup.position.set(data.x || 0, this.headRadius, data.z || 0);
        this.scene.add(this.headGroup);
        this.segments.push(this.headGroup);

        // Body segments
        const bodyList = data.body || [];
        bodyList.forEach((segData, idx) => {
            this.addSegment(segData.x, segData.z, idx);
        });
    }

    addSegment(x, z, index) {
        const skin = this.activeSkin;
        const geo = new THREE.SphereGeometry(this.segmentRadius, 24, 24);

        const segMat = new THREE.MeshStandardMaterial({
            color: skin.bodyColor,
            emissive: skin.bodyColor,
            emissiveIntensity: skin.emissiveIntensity * 0.7,
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        const segment = new THREE.Mesh(geo, segMat);
        segment.position.set(x, this.segmentRadius, z);
        segment.castShadow = true;

        this.scene.add(segment);
        this.segments.push(segment);
    }

    update(data) {
        if (!data) return;

        // Check if skin changed
        if (data.skinId && data.skinId !== this.skinId) {
            this.skinId = data.skinId;
            this.activeSkin = getSkinById(this.skinId);
        }

        // Target position lerp for smooth network movement
        const head = this.segments[0];
        head.position.x += (data.x - head.position.x) * 0.3;
        head.position.z += (data.z - head.position.z) * 0.3;
        head.rotation.y = data.angle || 0;

        const bodyData = data.body || [];

        // Adjust body segment count
        while (this.segments.length - 1 < bodyData.length) {
            const lastSeg = this.segments[this.segments.length - 1];
            this.addSegment(lastSeg.position.x, lastSeg.position.z, this.segments.length);
        }

        // Sync positions smoothly
        for (let i = 0; i < bodyData.length; i++) {
            const seg = this.segments[i + 1];
            const target = bodyData[i];
            if (seg && target) {
                seg.position.x += (target.x - seg.position.x) * 0.3;
                seg.position.z += (target.z - seg.position.z) * 0.3;
                seg.rotation.y = target.angle || 0;
            }
        }
    }

    destroy() {
        this.segments.forEach(seg => {
            this.scene.remove(seg);
            if (seg.geometry) seg.geometry.dispose();
        });
        this.segments = [];
    }
}
