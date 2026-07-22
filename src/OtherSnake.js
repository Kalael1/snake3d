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
        this.segmentSpacing = 1.25;

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

        const headGeo = new THREE.SphereGeometry(this.headRadius, 16, 16);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        this.headGroup.add(headMesh);

        // Eyes
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

        // Initial 8 body segments
        for (let i = 1; i <= 8; i++) {
            this.addSegment(data.x || 0, (data.z || 0) - i * this.segmentSpacing);
        }
    }

    addSegment(x, z) {
        const skin = this.activeSkin;
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

    // Direct Smooth Snapshot Interpolation (Zero Double-Lerp Lag!)
    updateInterpolated(state) {
        if (!state) return;

        const head = this.segments[0];

        // Direct position set from NetworkInterpolator (Eliminates double-lerp stutter!)
        head.position.set(state.x, this.headRadius, state.z);
        head.rotation.y = state.angle || 0;

        // Update body count based on score
        const targetSegments = 8 + Math.floor((state.score || 0) / 35);
        while (this.segments.length < targetSegments) {
            const lastSeg = this.segments[this.segments.length - 1];
            this.addSegment(lastSeg.position.x, lastSeg.position.z);
        }

        // Local physics-follow for body segments (0 Network Payload Overhead!)
        for (let i = 1; i < this.segments.length; i++) {
            const prevSeg = this.segments[i - 1];
            const currSeg = this.segments[i];

            const segDx = prevSeg.position.x - currSeg.position.x;
            const segDz = prevSeg.position.z - currSeg.position.z;
            const dist = Math.sqrt(segDx * segDx + segDz * segDz);

            if (dist > this.segmentSpacing) {
                const angle = Math.atan2(segDx, segDz);
                currSeg.position.x = prevSeg.position.x - Math.sin(angle) * this.segmentSpacing;
                currSeg.position.z = prevSeg.position.z - Math.cos(angle) * this.segmentSpacing;
                currSeg.rotation.y = angle;
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
