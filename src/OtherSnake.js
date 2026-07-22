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
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        // Low-Poly 16x16 head sphere
        const headGeo = new THREE.SphereGeometry(this.headRadius, 16, 16);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        this.headGroup.add(headMesh);

        // Eyes (Low-poly 8x8)
        const eyeGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const pupilGeo = new THREE.SphereGeometry(0.18, 8, 8);

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
            const hornGeo = new THREE.ConeGeometry(0.2, 0.9, 8);
            const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0055 });

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
        // Low-Poly 12x12 body sphere
        const geo = new THREE.SphereGeometry(this.segmentRadius, 12, 12);

        const segMat = new THREE.MeshStandardMaterial({
            color: skin.bodyColor,
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        const segment = new THREE.Mesh(geo, segMat);
        segment.position.set(x, this.segmentRadius, z);

        this.scene.add(segment);
        this.segments.push(segment);
    }

    updateInterpolated(state) {
        if (!state) return;

        // Head Position & Angle
        const head = this.segments[0];
        head.position.x = state.x;
        head.position.z = state.z;
        head.rotation.y = state.angle || 0;

        const bodyData = state.body || [];

        // Adjust body segment count
        while (this.segments.length - 1 < bodyData.length) {
            const lastSeg = this.segments[this.segments.length - 1];
            this.addSegment(lastSeg.position.x, lastSeg.position.z, this.segments.length);
        }
        while (this.segments.length - 1 > bodyData.length && this.segments.length > 1) {
            const popped = this.segments.pop();
            this.scene.remove(popped);
            if (popped.geometry) popped.geometry.dispose();
        }

        // Apply 60 FPS interpolated positions directly to body segments
        for (let i = 0; i < bodyData.length; i++) {
            const seg = this.segments[i + 1];
            const target = bodyData[i];
            if (seg && target) {
                seg.position.x = target.x;
                seg.position.z = target.z;
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
