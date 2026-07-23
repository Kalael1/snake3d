import { getCountryballSkin } from './CountryballRegistry.js';

export class Countryball {
    constructor(x, y, name = 'Player', skinId = 'turkey') {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 36;
        this.name = name;
        this.skinId = skinId;
        this.skin = getCountryballSkin(skinId);

        this.accel = 0.5;
        this.friction = 0.92;
        this.maxSpeed = 8;

        this.squishX = 1.0;
        this.squishY = 1.0;

        this.expression = 'normal';
        this.expressionTimer = 0;

        this.speechText = '';
        this.speechTimer = 0;

        this.dashCooldown = 0;
        this.isDashing = false;
    }

    setSkin(skinId) {
        this.skinId = skinId;
        this.skin = getCountryballSkin(skinId);
    }

    say(text, duration = 4.0) {
        this.speechText = text;
        this.speechTimer = duration;
    }

    dash() {
        if (this.dashCooldown > 0) return false;
        const speed = Math.hypot(this.vx, this.vy);
        const angle = speed > 0.1 ? Math.atan2(this.vy, this.vx) : -Math.PI / 2;
        this.vx = Math.cos(angle) * 16;
        this.vy = Math.sin(angle) * 16;
        this.dashCooldown = 1.2;
        this.isDashing = true;
        this.squishX = 1.4;
        this.squishY = 0.7;
        this.expression = 'angry';
        this.expressionTimer = 0.8;
        return true;
    }

    update(delta, inputState, bounds) {
        if (this.dashCooldown > 0) this.dashCooldown -= delta;
        if (this.speechTimer > 0) { this.speechTimer -= delta; if (this.speechTimer <= 0) this.speechText = ''; }
        if (this.expressionTimer > 0) { this.expressionTimer -= delta; if (this.expressionTimer <= 0) this.expression = 'normal'; }

        let moveX = 0, moveY = 0;
        if (inputState.left) moveX -= 1;
        if (inputState.right) moveX += 1;
        if (inputState.up) moveY -= 1;
        if (inputState.down) moveY += 1;

        if (moveX !== 0 && moveY !== 0) { moveX *= 0.7071; moveY *= 0.7071; }

        this.vx += moveX * this.accel;
        this.vy += moveY * this.accel;

        if (moveX === 0 && moveY === 0 && inputState.mouseTarget && inputState.isMouseDown) {
            const dx = inputState.mouseTarget.x - this.x;
            const dy = inputState.mouseTarget.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) { this.vx += (dx / dist) * this.accel; this.vy += (dy / dist) * this.accel; }
        }

        this.vx *= this.friction;
        this.vy *= this.friction;

        const speed = Math.hypot(this.vx, this.vy);
        const limit = this.isDashing ? 16 : this.maxSpeed;
        if (speed > limit) { this.vx = (this.vx / speed) * limit; this.vy = (this.vy / speed) * limit; }
        if (speed < 12) this.isDashing = false;

        this.x += this.vx;
        this.y += this.vy;

        // Hard NaN/Infinity guards
        if (!isFinite(this.x)) this.x = bounds ? (bounds.maxX / 2) : 400;
        if (!isFinite(this.y)) this.y = bounds ? (bounds.maxY / 2) : 300;
        if (!isFinite(this.vx)) this.vx = 0;
        if (!isFinite(this.vy)) this.vy = 0;

        // Wall bounce using Math.abs so the ball always bounces inward
        const r = this.radius;
        if (bounds && bounds.maxX > 50 && bounds.maxY > 50) {
            if (this.x - r < bounds.minX) { this.x = bounds.minX + r; this.vx = Math.abs(this.vx) * 0.75; this.onBounce(); }
            else if (this.x + r > bounds.maxX) { this.x = bounds.maxX - r; this.vx = -Math.abs(this.vx) * 0.75; this.onBounce(); }
            if (this.y - r < bounds.minY) { this.y = bounds.minY + r; this.vy = Math.abs(this.vy) * 0.75; this.onBounce(); }
            else if (this.y + r > bounds.maxY) { this.y = bounds.maxY - r; this.vy = -Math.abs(this.vy) * 0.75; this.onBounce(); }
        }

        if (!isFinite(this.squishX)) this.squishX = 1.0;
        if (!isFinite(this.squishY)) this.squishY = 1.0;
        this.squishX += (1.0 - this.squishX) * 0.18;
        this.squishY += (1.0 - this.squishY) * 0.18;
    }

    onBounce() {
        this.squishX = 1.3;
        this.squishY = 0.75;
        if (Math.hypot(this.vx, this.vy) > 3) { this.expression = 'angry'; this.expressionTimer = 0.5; }
    }

    // ─── DRAW ───────────────────────────────────────────────────────────────
    draw(ctx, targetPos = null) {
        if (!isFinite(this.x) || !isFinite(this.y)) return;

        const r = this.radius;
        const sx = isFinite(this.squishX) ? this.squishX : 1.0;
        const sy = isFinite(this.squishY) ? this.squishY : 1.0;

        ctx.save();                         // save-1: outer transform
        ctx.translate(this.x, this.y);
        ctx.scale(sx, sy);

        // ── shadow ──
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.85, r * 0.88, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1.0;

        // ── flag body inside clip ──
        ctx.save();                         // save-2: clip guard
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        this._drawFlagBody(ctx, r);
        ctx.restore();                      // restore-2: clip released

        // ── outline (outside clip, no artifact) ──
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // ── eyes ──
        this._drawEyes(ctx, r, targetPos);

        ctx.restore();                      // restore-1: transform removed

        // ── UI: name + speech bubble (screen-space, no transform) ──
        this._drawUI(ctx, r);
    }

    _drawFlagBody(ctx, r) {
        const skin = this.skin;
        if (skin.type === 'custom' && typeof skin.drawFlag === 'function') {
            skin.drawFlag(ctx, r);
        } else if (skin.type === 'striped_horizontal' && skin.colors) {
            const n = skin.colors.length;
            const h = (r * 2) / n;
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = skin.colors[i];
                ctx.fillRect(-r, -r + i * h, r * 2, h + 1);
            }
        } else if (skin.type === 'striped_vertical' && skin.colors) {
            const n = skin.colors.length;
            const w = (r * 2) / n;
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = skin.colors[i];
                ctx.fillRect(-r + i * w, -r, w + 1, r * 2);
            }
        } else {
            ctx.fillStyle = '#E30A17';
            ctx.fillRect(-r, -r, r * 2, r * 2);
        }
    }

    _drawEyes(ctx, r, targetPos) {
        const ex = r * 0.30;
        const ey = -r * 0.10;
        const er = r * 0.23;
        
        let lx = 0, ly = 0;
        if (targetPos) {
            const dx = targetPos.x - this.x;
            const dy = targetPos.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                lx = (dx / dist) * 3.5;
                ly = (dy / dist) * 3.5;
            }
        } else {
            lx = Math.max(-3, Math.min(3, this.vx * 0.35));
            ly = Math.max(-3, Math.min(3, this.vy * 0.35));
        }

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;

        // Left eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-ex + lx, ey + ly, er, er * 1.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // pupil
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(-ex + lx * 1.3, ey + ly * 1.3, er * 0.45, 0, Math.PI * 2); ctx.fill();

        // Right eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex + lx, ey + ly, er, er * 1.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + lx * 1.3, ey + ly * 1.3, er * 0.45, 0, Math.PI * 2); ctx.fill();

        // Angry brow
        if (this.expression === 'angry') {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-ex - er * 1.1 + lx, ey - er * 1.15 + ly);
            ctx.lineTo(-ex + er * 1.1 + lx, ey - er * 0.3 + ly);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ex + er * 1.1 + lx, ey - er * 1.15 + ly);
            ctx.lineTo(ex - er * 1.1 + lx, ey - er * 0.3 + ly);
            ctx.stroke();
        }
    }

    _drawUI(ctx, r) {
        // name tag
        ctx.save();
        try {
            ctx.font = 'bold 13px Fredoka, Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const ny = this.y + r * (this.squishY || 1) + 5;
            const tw = ctx.measureText(this.name).width + 14;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            
            // Custom roundRect implementation for maximum browser compatibility
            const drawRoundRect = (x, y, w, h, rad) => {
                ctx.beginPath();
                ctx.moveTo(x + rad, y);
                ctx.lineTo(x + w - rad, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
                ctx.lineTo(x + w, y + h - rad);
                ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
                ctx.lineTo(x + rad, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
                ctx.lineTo(x, y + rad);
                ctx.quadraticCurveTo(x, y, x + rad, y);
                ctx.closePath();
            };

            drawRoundRect(this.x - tw / 2, ny, tw, 18, 5);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.fillText(this.name, this.x, ny + 2);

            // speech bubble
            if (this.speechText) {
                ctx.font = '13px Fredoka, Outfit, sans-serif';
                const bw = ctx.measureText(this.speechText).width + 22;
                const bh = 28;
                const bx = this.x - bw / 2;
                const by = this.y - r * (this.squishY || 1) - bh - 10;

                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2;
                
                drawRoundRect(bx, by, bw, bh, 8);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1e293b';
                ctx.beginPath();
                ctx.moveTo(this.x - 6, by + bh);
                ctx.lineTo(this.x, by + bh + 7);
                ctx.lineTo(this.x + 6, by + bh);
                ctx.closePath(); ctx.fill(); ctx.stroke();

                ctx.fillStyle = '#0f172a';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.speechText, this.x, by + bh / 2);
            }
        } finally {
            ctx.restore();
        }
    }
}
