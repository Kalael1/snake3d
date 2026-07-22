import * as THREE from 'three';
import { getSkinById } from './SkinRegistry.js';

export class Snake {
    constructor(scene) {
        this.scene = scene;
        this.segments = [];
        this.history = [];
        
        this.baseSpeed = 18;
        this.speed = this.baseSpeed;
        this.turnSpeed = 8;
        
        this.headRadius = 1.2;
        this.segmentRadius = 0.95;
        this.segmentSpacing = 1.3;

        this.currentAngle = 0;
        this.massPerSegment = 35;
        this.activeSkin = getSkinById('classic');

        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });

        this.init();
    }

    init() {
        this.headGroup = new THREE.Group();

        const headGeo = new THREE.SphereGeometry(this.headRadius, 32, 32);
        this.headMesh = new THREE.Mesh(headGeo, this.createHeadMaterial(this.activeSkin));
        this.headMesh.castShadow = true;
        this.headGroup.add(this.headMesh);

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

        // Optional 3D Horns & Crown attachments
        this.attachmentsGroup = new THREE.Group();
        this.headGroup.add(this.attachmentsGroup);
        this.updateAttachments(this.activeSkin);

        this.headGroup.position.set(0, this.headRadius, 0);
        this.scene.add(this.headGroup);
        this.segments.push(this.headGroup);

        this.direction = new THREE.Vector3(0, 0, 1);
        this.currentAngle = 0;

        for (let i = 0; i < 300; i++) {
            this.history.push({
                position: new THREE.Vector3(0, this.headRadius, -i * 0.05),
                angle: 0
            });
        }

        for (let i = 0; i < 8; i++) {
            this.grow();
        }
    }

    createHeadMaterial(skin) {
        return new THREE.MeshStandardMaterial({
            color: skin.headColor,
            emissive: skin.headColor,
            emissiveIntensity: skin.emissiveIntensity,
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });
    }

    createBodyMaterial(skin, index) {
        const segMat = new THREE.MeshStandardMaterial({
            color: skin.bodyColor,
            emissive: skin.bodyColor,
            emissiveIntensity: skin.emissiveIntensity * 0.7,
            roughness: skin.roughness,
            metalness: skin.metalness,
            transparent: skin.transparent,
            opacity: skin.opacity
        });

        // Add subtle color gradient per segment
        const hueShift = (index * 0.02) % 0.15;
        const color = new THREE.Color(skin.bodyColor);
        color.offsetHSL(hueShift, 0, 0);
        segMat.color = color;

        return segMat;
    }

    updateAttachments(skin) {
        // Clear previous attachments
        while (this.attachmentsGroup.children.length > 0) {
            const child = this.attachmentsGroup.children.pop();
            if (child.geometry) child.geometry.dispose();
            this.scene.remove(child);
        }

        // Add Dragon Horns
        if (skin.hasHorns) {
            const hornGeo = new THREE.ConeGeometry(0.2, 0.9, 16);
            const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.6 });

            const leftHorn = new THREE.Mesh(hornGeo, hornMat);
            leftHorn.position.set(-0.6, 1.2, -0.3);
            leftHorn.rotation.set(-0.3, 0, -0.3);

            const rightHorn = new THREE.Mesh(hornGeo, hornMat);
            rightHorn.position.set(0.6, 1.2, -0.3);
            rightHorn.rotation.set(-0.3, 0, 0.3);

            this.attachmentsGroup.add(leftHorn, rightHorn);
        }

        // Add Crown for Gold / Diamond
        if (skin.hasCrown) {
            const crownGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.4, 6);
            const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.set(0, 1.35, 0);
            this.attachmentsGroup.add(crown);
        }
    }

    applySkin(skinId) {
        this.activeSkin = getSkinById(skinId);
        if (this.headMesh) {
            this.headMesh.material = this.createHeadMaterial(this.activeSkin);
        }
        this.updateAttachments(this.activeSkin);

        // Update body segment materials
        for (let i = 1; i < this.segments.length; i++) {
            this.segments[i].material = this.createBodyMaterial(this.activeSkin, i);
        }
    }

    grow() {
        const geo = new THREE.SphereGeometry(this.segmentRadius, 24, 24);
        const segMat = this.createBodyMaterial(this.activeSkin, this.segments.length);

        const segment = new THREE.Mesh(geo, segMat);
        segment.castShadow = true;
        
        const lastSegment = this.segments[this.segments.length - 1];
        segment.position.copy(lastSegment.position);
        
        this.scene.add(segment);
        this.segments.push(segment);
    }

    updateGrowth(score) {
        const targetSegments = 8 + Math.floor(score / this.massPerSegment);
        while (this.segments.length < targetSegments) {
            this.grow();
        }
    }

    update(delta, targetPoint, isBoosting = false) {
        if (!targetPoint) return;

        this.speed = isBoosting ? this.baseSpeed * 1.8 : this.baseSpeed;
        const head = this.segments[0];

        const diffX = targetPoint.x - head.position.x;
        const diffZ = targetPoint.z - head.position.z;
        const distanceToTarget = Math.sqrt(diffX * diffX + diffZ * diffZ);

        if (distanceToTarget > 1.5) {
            const targetAngle = Math.atan2(diffX, diffZ);
            
            let angleDiff = targetAngle - this.currentAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            this.currentAngle += angleDiff * Math.min(1, this.turnSpeed * delta);
        }

        this.direction.set(Math.sin(this.currentAngle), 0, Math.cos(this.currentAngle)).normalize();
        head.rotation.y = this.currentAngle;

        const moveDistance = this.speed * delta;
        head.position.x += this.direction.x * moveDistance;
        head.position.z += this.direction.z * moveDistance;
        head.position.y = this.headRadius;

        this.history.unshift({
            position: head.position.clone(),
            angle: this.currentAngle
        });

        if (this.history.length > 4000) {
            this.history.pop();
        }

        let currentHistIdx = 0;
        let accumulatedDist = 0;

        for (let i = 1; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const desiredDist = i * this.segmentSpacing;

            while (currentHistIdx < this.history.length - 1) {
                const p1 = this.history[currentHistIdx].position;
                const p2 = this.history[currentHistIdx + 1].position;
                const segLen = p1.distanceTo(p2);

                if (accumulatedDist + segLen >= desiredDist) {
                    const t = segLen > 0 ? (desiredDist - accumulatedDist) / segLen : 0;
                    
                    segment.position.lerpVectors(p1, p2, t);
                    segment.position.y = this.segmentRadius;

                    const angle1 = this.history[currentHistIdx].angle;
                    let angle2 = this.history[currentHistIdx + 1].angle;
                    
                    let diff = angle2 - angle1;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    segment.rotation.y = angle1 + diff * t;

                    break;
                }

                accumulatedDist += segLen;
                currentHistIdx++;
            }
        }
    }

    getHeadPosition() {
        return this.segments[0].position;
    }

    reset() {
        const head = this.segments[0];
        head.position.set(0, this.headRadius, 0);
        this.currentAngle = 0;
        this.direction.set(0, 0, 1);
        
        this.history = [];
        for (let i = 0; i < 300; i++) {
            this.history.push({
                position: new THREE.Vector3(0, this.headRadius, -i * 0.05),
                angle: 0
            });
        }

        while (this.segments.length > 9) {
            const seg = this.segments.pop();
            this.scene.remove(seg);
        }
    }
}
