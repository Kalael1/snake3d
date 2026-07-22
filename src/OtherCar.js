import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getSkinById } from './SkinRegistry.js';

const gltfLoader = new GLTFLoader();
const modelCache = {};

export class OtherCar {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;
        this.name = initialData.name || 'Oyuncu';
        this.skinId = initialData.skinId || 'sport';
        this.activeSkin = getSkinById(this.skinId);

        this.targetX = initialData.x || 0;
        this.targetZ = initialData.z || 0;
        this.targetAngle = initialData.angle || 0;
        this.driftScore = 0;

        this.group = new THREE.Group();
        this.group.position.set(this.targetX, 0, this.targetZ);
        this.scene.add(this.group);

        this.buildFallbackModel();
        this.loadCarModel(this.activeSkin.modelUrl);
    }

    buildFallbackModel() {
        this.fallbackGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(2.4, 0.7, 4.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.55;
        this.fallbackGroup.add(bodyMesh);
        this.group.add(this.fallbackGroup);
    }

    loadCarModel(url) {
        if (!url) return;

        if (modelCache[url]) {
            this.setLoadedModel(modelCache[url].clone());
            return;
        }

        gltfLoader.load(url, (gltf) => {
            const model = gltf.scene;
            modelCache[url] = model;

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetScale = 4.2 / maxDim;

            model.scale.set(targetScale, targetScale, targetScale);
            const newBox = new THREE.Box3().setFromObject(model);
            model.position.y = -newBox.min.y;

            this.setLoadedModel(model.clone());
        }, undefined, (err) => {
            console.warn('Failed to load GLB model for OtherCar:', url, err);
        });
    }

    setLoadedModel(model) {
        if (this.loadedMesh) this.group.remove(this.loadedMesh);
        if (this.fallbackGroup) this.group.remove(this.fallbackGroup);

        // Rotate GLB model by 90° (Math.PI/2) so car front points straight forward along movement heading!
        const rotY = this.activeSkin.rotationY !== undefined ? this.activeSkin.rotationY : Math.PI / 2;
        model.rotation.y = rotY;

        this.loadedMesh = model;
        this.group.add(this.loadedMesh);
    }

    updateFromServer(state) {
        if (!state) return;
        this.targetX = state.x;
        this.targetZ = state.z;
        this.targetAngle = state.angle || 0;
        this.driftScore = state.driftScore || 0;

        if (state.skinId && state.skinId !== this.skinId) {
            this.skinId = state.skinId;
            this.activeSkin = getSkinById(this.skinId);
            this.loadCarModel(this.activeSkin.modelUrl);
        }
    }

    animate(delta) {
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
