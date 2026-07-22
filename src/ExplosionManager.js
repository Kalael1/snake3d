import * as THREE from 'three';

export class ExplosionManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.isExploding = false;
        this.explosionGroup = new THREE.Group();
        this.scene.add(this.explosionGroup);

        // Pre-create particle geometries and materials for instant zero-lag explosion!
        this.particleGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        this.colors = [0xff5500, 0xf59e0b, 0xef4444, 0xff0055, 0x00f3ff, 0xffffff];
        this.materials = this.colors.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1.0 }));
    }

    triggerExplosion(x, y, z, onComplete) {
        this.clear();
        this.isExploding = true;

        const count = 90;
        for (let i = 0; i < count; i++) {
            const mat = this.materials[i % this.materials.length].clone();
            const mesh = new THREE.Mesh(this.particleGeo, mat);
            mesh.position.set(x, y + 0.8, z);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 12 + Math.random() * 28;

            const vx = Math.sin(phi) * Math.cos(theta) * speed;
            const vy = Math.abs(Math.cos(phi)) * speed * 0.8 + 4.0;
            const vz = Math.sin(phi) * Math.sin(theta) * speed;

            const rotVx = (Math.random() - 0.5) * 15;
            const rotVy = (Math.random() - 0.5) * 15;
            const rotVz = (Math.random() - 0.5) * 15;

            mesh.scale.setScalar(0.8 + Math.random() * 1.4);
            this.explosionGroup.add(mesh);

            this.particles.push({
                mesh,
                vx,
                vy,
                vz,
                rotVx,
                rotVy,
                rotVz,
                life: 1.0, // 1.0 down to 0.0 over 1.2 seconds
                maxLife: 1.2
            });
        }

        // Schedule Game Over modal popup AFTER 1.2 second explosion animation!
        if (onComplete) {
            setTimeout(() => {
                this.isExploding = false;
                onComplete();
            }, 1200);
        }
    }

    update(delta) {
        if (!this.particles.length) return;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta / p.maxLife;

            if (p.life <= 0) {
                this.explosionGroup.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            p.mesh.position.x += p.vx * delta;
            p.mesh.position.y += p.vy * delta;
            p.mesh.position.z += p.vz * delta;

            p.vy -= 22.0 * delta; // Gravity pull downwards

            p.mesh.rotation.x += p.rotVx * delta;
            p.mesh.rotation.y += p.rotVy * delta;
            p.mesh.rotation.z += p.rotVz * delta;

            const scale = Math.max(0.01, p.life * 1.5);
            p.mesh.scale.setScalar(scale);

            if (p.mesh.material) {
                p.mesh.material.opacity = p.life;
            }
        }
    }

    clear() {
        this.particles.forEach(p => this.explosionGroup.remove(p.mesh));
        this.particles = [];
        this.isExploding = false;
    }
}
