import * as THREE from 'three';

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
        this.massPerSegment = 35; // Authentic Snake.io: 35 points required per 1 segment growth

        // Head Material - Vibrant Neon Green/Cyan
        this.headMat = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00ffcc,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.5
        });

        // Body Material
        this.bodyMat = new THREE.MeshStandardMaterial({
            color: 0x0099ff,
            emissive: 0x0044aa,
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.4
        });

        // Eye Material
        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });

        this.init();
    }

    init() {
        const headGroup = new THREE.Group();

        const headGeo = new THREE.SphereGeometry(this.headRadius, 32, 32);
        const headMesh = new THREE.Mesh(headGeo, this.headMat);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        // Add Eyes
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

        headGroup.position.set(0, this.headRadius, 0);
        this.scene.add(headGroup);
        this.segments.push(headGroup);

        this.direction = new THREE.Vector3(0, 0, 1);
        this.currentAngle = 0;

        // Pre-fill history buffer
        for(let i=0; i<300; i++) {
            this.history.push({
                position: new THREE.Vector3(0, this.headRadius, -i * 0.05),
                angle: 0
            });
        }

        // Initial 8 body segments
        for (let i = 0; i < 8; i++) {
            this.grow();
        }
    }

    grow() {
        const geo = new THREE.SphereGeometry(this.segmentRadius, 24, 24);
        
        const segmentCount = this.segments.length;
        const colorHue = (0.55 + segmentCount * 0.015) % 1.0;
        const segMat = this.bodyMat.clone();
        segMat.color.setHSL(colorHue, 0.9, 0.5);
        segMat.emissive.setHSL(colorHue, 0.9, 0.3);

        const segment = new THREE.Mesh(geo, segMat);
        segment.castShadow = true;
        
        const lastSegment = this.segments[this.segments.length - 1];
        segment.position.copy(lastSegment.position);
        
        this.scene.add(segment);
        this.segments.push(segment);
    }

    // Authentic Snake.io Mass Growth Scaling
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

        // 1. Steering Logic
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

        // 2. Update direction vector and head rotation
        this.direction.set(Math.sin(this.currentAngle), 0, Math.cos(this.currentAngle)).normalize();
        head.rotation.y = this.currentAngle;

        // 3. Move Head
        const moveDistance = this.speed * delta;
        head.position.x += this.direction.x * moveDistance;
        head.position.z += this.direction.z * moveDistance;
        head.position.y = this.headRadius;

        // 4. Record High-Resolution History
        this.history.unshift({
            position: head.position.clone(),
            angle: this.currentAngle
        });

        if (this.history.length > 4000) {
            this.history.pop();
        }

        // 5. Update Body Segments with Smooth Lerp Interpolation
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
        for(let i=0; i<300; i++) {
            this.history.push({
                position: new THREE.Vector3(0, this.headRadius, -i * 0.05),
                angle: 0
            });
        }

        while(this.segments.length > 9) {
            const seg = this.segments.pop();
            this.scene.remove(seg);
        }
    }
}
