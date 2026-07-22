import * as THREE from 'three';
import { getSkinById } from './SkinRegistry.js';

export class Snake {
    constructor(scene) {
        this.scene = scene;
        this.segments = [];
        this.skinId = 'classic';
        this.activeSkin = getSkinById(this.skinId);

        // Smooth & Responsive Speed Parameters
        this.speed = 20;
        this.boostSpeed = 34;
        this.turnSpeed = 6.0; // Smooth natural turn speed

        this.currentAngle = 0;

        // Dimensions
        this.headRadius = 1.2;
        this.segmentRadius = 0.95;
        this.segmentSpacing = 1.2;

        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });

        this.init();
    }

    init() {
        this.headGroup = new THREE.Group();
        const skin = this.activeSkin;

        this.headMat = new THREE.MeshStandardMaterial({
            color: skin.headColor,
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        const headGeo = new THREE.SphereGeometry(this.headRadius, 16, 16);
        this.headMesh = new THREE.Mesh(headGeo, this.headMat);
        this.headGroup.add(this.headMesh);

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

        this.hornsGroup = new THREE.Group();
        this.crownGroup = new THREE.Group();
        this.headGroup.add(this.hornsGroup, this.crownGroup);

        this.updateAttachments();

        this.headGroup.position.set(0, this.headRadius, 0);
        this.scene.add(this.headGroup);
        this.segments.push(this.headGroup);

        for (let i = 1; i <= 8; i++) {
            this.addSegment(0, -i * this.segmentSpacing);
        }
    }

    applySkin(skinId) {
        this.skinId = skinId;
        this.activeSkin = getSkinById(skinId);
        const skin = this.activeSkin;

        if (this.headMat) {
            this.headMat.color.setHex(skin.headColor);
            this.headMat.roughness = skin.roughness;
            this.headMat.metalness = skin.metalness;
            this.headMat.transparent = skin.transparent;
            this.headMat.opacity = skin.opacity;
            this.headMat.needsUpdate = true;
        }

        for (let i = 1; i < this.segments.length; i++) {
            const seg = this.segments[i];
            if (seg.material) {
                seg.material.color.setHex(skin.bodyColor);
                seg.material.roughness = skin.roughness;
                seg.material.metalness = skin.metalness;
                seg.material.transparent = skin.transparent;
                seg.material.opacity = skin.opacity;
                seg.material.needsUpdate = true;
            }
        }

        this.updateAttachments();
    }

    updateAttachments() {
        while(this.hornsGroup.children.length > 0){
            const obj = this.hornsGroup.children[0];
            this.hornsGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
        }
        while(this.crownGroup.children.length > 0){
            const obj = this.crownGroup.children[0];
            this.crownGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
        }

        const skin = this.activeSkin;

        if (skin.hasHorns) {
            const hornGeo = new THREE.ConeGeometry(0.2, 0.9, 8);
            const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0055 });

            const leftHorn = new THREE.Mesh(hornGeo, hornMat);
            leftHorn.position.set(-0.6, 1.2, -0.3);
            leftHorn.rotation.set(-0.3, 0, -0.3);

            const rightHorn = new THREE.Mesh(hornGeo, hornMat);
            rightHorn.position.set(0.6, 1.2, -0.3);
            rightHorn.rotation.set(-0.3, 0, 0.3);

            this.hornsGroup.add(leftHorn, rightHorn);
        }

        if (skin.hasCrown) {
            const crownGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.4, 6);
            const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.set(0, 1.35, 0);
            this.crownGroup.add(crown);
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

    updateGrowth(score) {
        const targetSegments = 8 + Math.floor(score / 35);
        while (this.segments.length < targetSegments) {
            const lastSeg = this.segments[this.segments.length - 1];
            this.addSegment(lastSeg.position.x, lastSeg.position.z);
        }
    }

    // Smooth & Natural World Target Point Mouse Follow Controls
    update(delta, targetPoint, isBoosting) {
        const head = this.segments[0];

        const dx = targetPoint.x - head.position.x;
        const dz = targetPoint.z - head.position.z;
        const targetAngle = Math.atan2(dx, dz);

        let diff = targetAngle - this.currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        this.currentAngle += diff * Math.min(1.0, this.turnSpeed * delta);
        head.rotation.y = this.currentAngle;

        const currentSpeed = isBoosting ? this.boostSpeed : this.speed;
        const moveDist = currentSpeed * delta;

        head.position.x += Math.sin(this.currentAngle) * moveDist;
        head.position.z += Math.cos(this.currentAngle) * moveDist;

        // Smooth follow head logic
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

    getHeadPosition() {
        return this.segments[0].position;
    }

    reset() {
        while (this.segments.length > 1) {
            const seg = this.segments.pop();
            this.scene.remove(seg);
            if (seg.geometry) seg.geometry.dispose();
        }
        this.segments[0].position.set(0, this.headRadius, 0);
        this.currentAngle = 0;

        for (let i = 1; i <= 8; i++) {
            this.addSegment(0, -i * this.segmentSpacing);
        }
    }
}
