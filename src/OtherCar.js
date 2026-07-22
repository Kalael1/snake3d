import * as THREE from 'three';
import { getSkinById } from './SkinRegistry.js';

export class OtherCar {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;
        this.name = initialData.name || 'Oyuncu';
        this.skinId = initialData.skinId || 'red_classic';
        this.activeSkin = getSkinById(this.skinId);

        // Smooth target values
        this.targetX = initialData.x || 0;
        this.targetZ = initialData.z || 0;
        this.targetAngle = initialData.angle || 0;
        this.driftScore = 0;

        // 3D Model
        this.group = new THREE.Group();
        this.buildModel();
        this.group.position.set(this.targetX, 0, this.targetZ);
        this.scene.add(this.group);
    }

    buildModel() {
        const skin = this.activeSkin;

        // Body
        const bodyGeo = new THREE.BoxGeometry(2.4, 0.7, 4.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: skin.bodyColor });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.55;
        this.group.add(bodyMesh);

        // Roof
        const roofGeo = new THREE.BoxGeometry(2.0, 0.55, 2.0);
        const roofMat = new THREE.MeshLambertMaterial({ color: skin.roofColor });
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.set(0, 1.15, -0.2);
        this.group.add(roofMesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8);
        const wheelMat = new THREE.MeshLambertMaterial({ color: skin.wheelColor || 0x222222 });
        [[-1.25, 0.35, 1.4], [1.25, 0.35, 1.4], [-1.25, 0.35, -1.4], [1.25, 0.35, -1.4]].forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            this.group.add(wheel);
        });

        // Headlights
        const lightGeo = new THREE.SphereGeometry(0.15, 6, 6);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        [[-0.8, 0.55, 2.15], [0.8, 0.55, 2.15]].forEach(pos => {
            this.group.add(new THREE.Mesh(lightGeo, headMat).translateX(pos[0]).translateY(pos[1]).translateZ(pos[2]));
        });

        // Tail lights
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        [[-0.8, 0.55, -2.15], [0.8, 0.55, -2.15]].forEach(pos => {
            const m = new THREE.Mesh(lightGeo, tailMat);
            m.position.set(...pos);
            this.group.add(m);
        });
    }

    updateFromServer(state) {
        if (!state) return;
        this.targetX = state.x;
        this.targetZ = state.z;
        this.targetAngle = state.angle || 0;
        this.driftScore = state.driftScore || 0;
    }

    animate(delta) {
        // Smooth lerp to server target
        this.group.position.x += (this.targetX - this.group.position.x) * 0.2;
        this.group.position.z += (this.targetZ - this.group.position.z) * 0.2;
        this.group.rotation.y = this.targetAngle;
    }

    destroy() {
        this.scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
