export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.emotes = [];
    }

    addSparkles(x, y, color = '#FFD700', count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 4.5;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                color,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    addDashTrail(x, y, radius, color = '#00f3ff') {
        this.particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: radius * (0.4 + Math.random() * 0.4),
            color,
            alpha: 0.6,
            decay: 0.04
        });
    }

    addEmote(x, y, emoji) {
        this.emotes.push({
            x,
            y,
            emoji,
            vy: -1.5,
            alpha: 1.0,
            scale: 0.2,
            targetScale: 1.2,
            life: 1.8
        });
    }

    update(delta) {
        // Particles update
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            p.radius *= 0.96;
            if (p.alpha <= 0 || p.radius <= 0.5) {
                this.particles.splice(i, 1);
            }
        }

        // Emotes update
        for (let i = this.emotes.length - 1; i >= 0; i--) {
            const e = this.emotes[i];
            e.y += e.vy;
            e.life -= delta;
            if (e.scale < e.targetScale) e.scale += (e.targetScale - e.scale) * 0.2;
            if (e.life < 0.5) e.alpha = Math.max(0, e.life / 0.5);
            if (e.life <= 0) {
                this.emotes.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Draw particles
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Draw floating emotes
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const e of this.emotes) {
            ctx.globalAlpha = Math.max(0, e.alpha);
            ctx.font = `${Math.floor(28 * e.scale)}px sans-serif`;
            ctx.fillText(e.emoji, e.x, e.y);
        }
        ctx.restore();
    }
}
