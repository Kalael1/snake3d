import * as THREE from 'three';

export class FoodManager {
    constructor(scene, arenaSize) {
        this.scene = scene;
        this.arenaSize = arenaSize;
        this.foods = [];
        this.maxFoods = 500; // Increased food count for 5x larger arena!

        this.colors = [
            0xff0055, 0x00ffcc, 0xffff00, 0xaa00ff, 0xff8800, 0x00ffaa
        ];

        this.geometry = new THREE.DodecahedronGeometry(0.8, 0); 
        this.materials = this.colors.map(color => new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0,
            roughness: 0.1,
            metalness: 0.9
        }));

        this.initFoods();
    }

    initFoods() {
        for (let i = 0; i < this.maxFoods; i++) {
            this.spawnFood();
        }
    }

    spawnFood() {
        const material = this.materials[Math.floor(Math.random() * this.materials.length)];
        const mesh = new THREE.Mesh(this.geometry, material);
        
        const halfSize = (this.arenaSize / 2) - 6;
        mesh.position.x = (Math.random() - 0.5) * 2 * halfSize;
        mesh.position.z = (Math.random() - 0.5) * 2 * halfSize;
        mesh.position.y = 0.8;
        
        mesh.castShadow = true;
        
        mesh.userData.rotSpeedX = (Math.random() - 0.5) * 3;
        mesh.userData.rotSpeedY = (Math.random() - 0.5) * 3;
        mesh.userData.baseY = mesh.position.y;
        mesh.userData.bobOffset = Math.random() * Math.PI * 2;

        this.scene.add(mesh);
        this.foods.push(mesh);
    }

    update(delta) {
        const time = Date.now() * 0.004;
        for (const food of this.foods) {
            food.rotation.x += food.userData.rotSpeedX * delta;
            food.rotation.y += food.userData.rotSpeedY * delta;
            food.position.y = food.userData.baseY + Math.sin(time + food.userData.bobOffset) * 0.25;
        }
    }

    checkCollision(headPos, headRadius) {
        let ateCount = 0;
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const food = this.foods[i];
            const dist = headPos.distanceTo(food.position);
            
            if (dist < headRadius + 1.0) {
                this.scene.remove(food);
                this.foods.splice(i, 1);
                ateCount++;
                this.spawnFood();
            }
        }
        return ateCount;
    }
}
