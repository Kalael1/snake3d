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

        // Smooth target for lerping
        this.targetX = initialData.x || 0;
        this.targetZ = initialData.z || 0;
        this.targetAngle = initialData.angle || 0;
        this.targetScore = 0;

        this.eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        this.pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        this.init(initialData);
    }

    init(data) {
        this.headGroup = new THREE.Group();
        const skin = this.activeSkin;

        const headMat = new THREE.MeshLambertMaterial({
            color: skin.headColor,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        const headGeo = new THREE.SphereGeometry(this.headRadius, 12, 12);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        this.headGroup.add(headMesh);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.35, 6, 6);
        const pupilGeo = new THREE.SphereGeometry(0.18, 6, 6);

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

        // Horns / Crown
        if (skin.hasHorns) {
            const hornGeo = new THREE.ConeGeometry(0.2, 0.9, 6);
            const hornMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
            const lh = new THREE.Mesh(hornGeo, hornMat);
            lh.position.set(-0.6, 1.2, -0.3);
            lh.rotation.set(-0.3, 0, -0.3);
            const rh = new THREE.Mesh(hornGeo, hornMat);
            rh.position.set(0.6, 1.2, -0.3);
            rh.rotation.set(-0.3, 0, 0.3);
            this.headGroup.add(lh, rh);
        }
        if (skin.hasCrown) {
            const crownGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.4, 6);
            const crownMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.set(0, 1.35, 0);
            this.headGroup.add(crown);
        }

        this.headGroup.position.set(data.x || 0, this.headRadius, data.z || 0);
        this.scene.add(this.headGroup);
        this.segments.push(this.headGroup);

        for (let i = 1; i <= 8; i++) {
            this.addSegment(data.x || 0, (data.z || 0) - i * this.segmentSpacing);
        }
    }

    addSegment(x, z) {
        const skin = this.activeSkin;
        const geo = new THREE.SphereGeometry(this.segmentRadius, 8, 8);
        const segMat = new THREE.MeshLambertMaterial({
            color: skin.bodyColor,
            transparent: skin.transparent,
            opacity: skin.opacity
        });
        const segment = new THREE.Mesh(geo, segMat);
        segment.position.set(x, this.segmentRadius, z);
        this.scene.add(segment);
        this.segments.push(segment);
    }

    // Called when server snapshot arrives (15 ticks/sec)
    updateFromServer(state) {
        if (!state) return;
        this.targetX = state.x;
        this.targetZ = state.z;
        this.targetAngle = state.angle || 0;
        this.targetScore = state.score || 0;

        // Grow body
        const targetSegments = 8 + Math.floor(this.targetScore / 35);
        while (this.segments.length < targetSegments) {
            const lastSeg = this.segments[this.segments.length - 1];
            this.addSegment(lastSeg.position.x, lastSeg.position.z);
        }
    }

    // Called every frame (60 FPS) — smooth lerp head toward server target
    animateBody(delta) {
        const head = this.segments[0];

        // Smooth lerp head toward target (0.2 factor = smooth over ~5 frames)
        head.position.x += (this.targetX - head.position.x) * 0.2;
        head.position.z += (this.targetZ - head.position.z) * 0.2;
        head.rotation.y = this.targetAngle;

        // Body follow physics
        for (let i = 1; i < this.segments.length; i++) {
            const prev = this.segments[i - 1];
            const curr = this.segments[i];

            const dx = prev.position.x - curr.position.x;
            const dz = prev.position.z - curr.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > this.segmentSpacing) {
                const angle = Math.atan2(dx, dz);
                curr.position.x = prev.position.x - Math.sin(angle) * this.segmentSpacing;
                curr.position.z = prev.position.z - Math.cos(angle) * this.segmentSpacing;
                curr.rotation.y = angle;
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
