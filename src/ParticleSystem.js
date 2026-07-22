import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];

        this.geo = new THREE.DodecahedronGeometry(0.2, 0);
        this.boostGeo = new THREE.SphereGeometry(0.3, 8, 8);
    }

    createEatBurst(pos, color = 0x00ffcc) {
        const count = 18;
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1
        });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.geo, mat);
            mesh.position.set(pos.x, pos.y || 0.8, pos.z);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                Math.random() * 6 + 2,
                (Math.random() - 0.5) * 12
            );

            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.4 + Math.random() * 0.2,
                maxLife: 0.6,
                type: 'eat'
            });
        }
    }

    createBoostParticle(pos, angle) {
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });

        const mesh = new THREE.Mesh(this.boostGeo, mat);
        const offsetX = -Math.sin(angle) * 1.5 + (Math.random() - 0.5) * 0.6;
        const offsetZ = -Math.cos(angle) * 1.5 + (Math.random() - 0.5) * 0.6;

        mesh.position.set(pos.x + offsetX, 0.6, pos.z + offsetZ);
        this.scene.add(mesh);

        this.particles.push({
            mesh: mesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2),
            life: 0.25,
            maxLife: 0.25,
            type: 'boost'
        });
    }

    createDeathExplosion(pos) {
        const count = 40;
        const colors = [0xff0055, 0x00ffcc, 0xffff00];

        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 1
            });
            const mesh = new THREE.Mesh(this.geo, mat);
            mesh.position.set(pos.x, 1.0, pos.z);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                Math.random() * 12 + 2,
                (Math.random() - 0.5) * 20
            );

            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.8,
                maxLife: 0.8,
                type: 'death'
            });
        }
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            p.mesh.position.x += p.velocity.x * delta;
            p.mesh.position.y += p.velocity.y * delta;
            p.mesh.position.z += p.velocity.z * delta;

            if (p.type === 'eat' || p.type === 'death') {
                p.velocity.y -= 9.8 * delta;
            }

            p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
        }
    }
}
