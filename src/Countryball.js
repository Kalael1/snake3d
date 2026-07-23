import { getCountryballSkin, getHat, getGlasses } from './CountryballRegistry.js';

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
        
        this.hatId = 'none';
        this.glassesId = 'none';
        this.hat = getHat('none');
        this.glasses = getGlasses('none');

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

    setCosmetics(hatId, glassesId) {
        this.hatId = hatId;
        this.glassesId = glassesId;
        this.hat = getHat(hatId);
        this.glasses = getGlasses(glassesId);
    }

    say(text, duration = 4.0) {
        this.speechText = text;
        this.speechTimer = duration;
    }

    dash(targetPos = null) {
        if (this.dashCooldown > 0) return false;
        
        let angle;
        if (targetPos) {
            const dx = targetPos.x - this.x;
            const dy = targetPos.y - this.y;
            angle = Math.atan2(dy, dx);
        } else {
            const speed = Math.hypot(this.vx, this.vy);
            angle = speed > 0.1 ? Math.atan2(this.vy, this.vx) : -Math.PI / 2;
        }

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
            if (this.x - r < bounds.minX) { this.x = bounds.minX + r; this.vx = Math.abs(this.vx) * 0.75; this.onBounce('x'); }
            else if (this.x + r > bounds.maxX) { this.x = bounds.maxX - r; this.vx = -Math.abs(this.vx) * 0.75; this.onBounce('x'); }
            if (this.y - r < bounds.minY) { this.y = bounds.minY + r; this.vy = Math.abs(this.vy) * 0.75; this.onBounce('y'); }
            else if (this.y + r > bounds.maxY) { this.y = bounds.maxY - r; this.vy = -Math.abs(this.vy) * 0.75; this.onBounce('y'); }
        }

        if (!isFinite(this.squishX)) this.squishX = 1.0;
        if (!isFinite(this.squishY)) this.squishY = 1.0;
        this.squishX += (1.0 - this.squishX) * 0.18;
        this.squishY += (1.0 - this.squishY) * 0.18;
    }

    onBounce(axis = 'xy') {
        if (axis === 'x') {
            this.squishX = 0.75; // Squash horizontally (hit left/right wall)
            this.squishY = 1.30; // Stretch vertically
        } else if (axis === 'y') {
            this.squishX = 1.30; // Stretch horizontally
            this.squishY = 0.75; // Squash vertically (hit top/bottom wall)
        } else {
            this.squishX = 0.85; // Generic bump contraction
            this.squishY = 0.85;
        }
        
        if (Math.hypot(this.vx, this.vy) > 3) { this.expression = 'angry'; this.expressionTimer = 0.5; }
    }

    draw(ctx, targetPos = null) {
        if (!isFinite(this.x) || !isFinite(this.y)) return;

        const r = this.radius;
        const bounceSx = isFinite(this.squishX) ? this.squishX : 1.0;
        const bounceSy = isFinite(this.squishY) ? this.squishY : 1.0;
        
        // 🔹 Rhythmic Walk Cycle (Bobbing) 🔹
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 0.5) {
            this.walkTimer = (this.walkTimer || 0) + speed * 0.05;
        } else if (this.walkTimer) {
            this.walkTimer += (0 - this.walkTimer) * 0.2; // Return to standing gracefully
            if (Math.abs(this.walkTimer) < 0.01) this.walkTimer = 0;
        }

        let walkSx = 1.0, walkSy = 1.0;
        if (this.walkTimer) {
            // Math.abs(Math.sin) creates a bouncing rhythm (0 to 1)
            const bob = Math.abs(Math.sin(this.walkTimer));
            const squashIntensity = Math.min(speed * 0.015, 0.18); // Max 18% squash
            
            // "üstden basılsın" - Squash from top, stretch from sides rhythmically
            walkSx = 1.0 + bob * squashIntensity;
            walkSy = 1.0 - bob * squashIntensity;
        }

        ctx.save();                         // save-1: outer transform
        ctx.translate(this.x, this.y);
        ctx.scale(bounceSx * walkSx, bounceSy * walkSy);

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

        // ── cosmetics ──
        if (this.glasses.draw) this.glasses.draw(ctx, r);
        if (this.hat.draw) this.hat.draw(ctx, r);

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
        const lookRadius = er * 0.55; // Max distance pupil can travel from eye center
        
        let lxL = 0, lyL = 0; // Left eye look offset
        let lxR = 0, lyR = 0; // Right eye look offset
        
        if (targetPos) {
            // 🔹 Left Eye Math
            const dxL = targetPos.x - (this.x - ex);
            const dyL = targetPos.y - (this.y + ey);
            const distL = Math.hypot(dxL, dyL);
            const intensityL = Math.min(distL / (r * 1.5), 1.0); // Max pupil stretch when mouse is 1.5 radii away
            
            if (distL > 0) {
                lxL = (dxL / distL) * lookRadius * intensityL;
                lyL = (dyL / distL) * lookRadius * intensityL;
            }

            // 🔹 Right Eye Math
            const dxR = targetPos.x - (this.x + ex);
            const dyR = targetPos.y - (this.y + ey);
            const distR = Math.hypot(dxR, dyR);
            const intensityR = Math.min(distR / (r * 1.5), 1.0);
            
            if (distR > 0) {
                lxR = (dxR / distR) * lookRadius * intensityR;
                lyR = (dyR / distR) * lookRadius * intensityR;
            }
        } else {
            // Default look based on velocity
            const speed = Math.hypot(this.vx, this.vy);
            const intensity = Math.min(speed / 5, 1.0);
            if (speed > 0) {
                lxL = lxR = (this.vx / speed) * lookRadius * intensity;
                lyL = lyR = (this.vy / speed) * lookRadius * intensity;
            }
        }

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;

        // Left eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-ex + lxL*0.3, ey + lyL*0.3, er, er * 1.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // pupil
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(-ex + lxL, ey + lyL, er * 0.45, 0, Math.PI * 2); ctx.fill();

        // Right eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex + lxR*0.3, ey + lyR*0.3, er, er * 1.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // pupil
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + lxR, ey + lyR, er * 0.45, 0, Math.PI * 2); ctx.fill();

        // Angry brow
        if (this.expression === 'angry') {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 3;
            const bx = (lxL + lxR) * 0.5 * 0.5;
            const by = (lyL + lyR) * 0.5 * 0.5;
            ctx.beginPath(); ctx.moveTo(-ex - er*1.1 + bx, ey - er*1.15 + by); ctx.lineTo(-ex + er*1.1 + bx, ey - er*0.3 + by); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex + er*1.1 + bx, ey - er*1.15 + by); ctx.lineTo(ex - er*1.1 + bx, ey - er*0.3 + by); ctx.stroke();
        } 
        // Sad brow and tears
        else if (this.expression === 'sad') {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 3;
            const bx = (lxL + lxR) * 0.5 * 0.5;
            const by = (lyL + lyR) * 0.5 * 0.5;
            ctx.beginPath(); ctx.moveTo(-ex - er*1.1 + bx, ey - er*0.6 + by); ctx.lineTo(-ex + er*1.1 + bx, ey - er*1.15 + by); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex + er*1.1 + bx, ey - er*0.6 + by); ctx.lineTo(ex - er*1.1 + bx, ey - er*1.15 + by); ctx.stroke();
            // Tear drops
            ctx.fillStyle = '#0d6efd';
            ctx.beginPath(); ctx.arc(-ex + lxL, ey + lyL + er*0.8, er*0.25, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex + lxR, ey + lyR + er*0.8, er*0.25, 0, Math.PI*2); ctx.fill();
        }
        // Surprised (wide eyes, tiny pupils)
        else if (this.expression === 'surprised') {
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(-ex + lxL, ey + lyL, er*0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex + lxR, ey + lyR, er*0.2, 0, Math.PI*2); ctx.fill();
            // Mouth
            ctx.beginPath(); ctx.arc(0, ey + er*1.5, er*0.4, 0, Math.PI*2); ctx.fill();
        }
        // Happy (closed curves)
        else if (this.expression === 'happy') {
            // Overwrite eyes with happy curves
            ctx.fillStyle = this.skinId === 'japan' ? '#fff' : this.skin.colors ? this.skin.colors[0] : '#fff'; // approximate background to hide pupil
            ctx.beginPath(); ctx.ellipse(-ex + lxL*0.3, ey + lyL*0.3, er*1.1, er*1.2, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(ex + lxR*0.3, ey + lyR*0.3, er*1.1, er*1.2, 0, 0, Math.PI*2); ctx.fill();
            
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(-ex, ey, er*0.8, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
            ctx.beginPath(); ctx.arc(ex, ey, er*0.8, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
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
