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

        // Movement stats
        this.accel = 0.8;
        this.friction = 0.94;
        this.maxSpeed = 9;

        // Visual squish & stretch on impact
        this.squishX = 1.0;
        this.squishY = 1.0;

        // Eye expressions: 'normal', 'angry', 'happy', 'blink'
        this.expression = 'normal';
        this.expressionTimer = 0;

        // Speech bubble
        this.speechText = '';
        this.speechTimer = 0;

        // Dash/Boost ability
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
        const currentSpeed = Math.hypot(this.vx, this.vy);
        const angle = currentSpeed > 0.1 ? Math.atan2(this.vy, this.vx) : -Math.PI / 2;
        const dashForce = 18;
        this.vx = Math.cos(angle) * dashForce;
        this.vy = Math.sin(angle) * dashForce;
        this.dashCooldown = 1.2;
        this.isDashing = true;
        this.squishX = 1.4;
        this.squishY = 0.7;
        this.expression = 'angry';
        this.expressionTimer = 0.8;
        return true;
    }

    update(delta, inputState, bounds) {
        // Cooldowns
        if (this.dashCooldown > 0) this.dashCooldown -= delta;
        if (this.speechTimer > 0) {
            this.speechTimer -= delta;
            if (this.speechTimer <= 0) this.speechText = '';
        }
        if (this.expressionTimer > 0) {
            this.expressionTimer -= delta;
            if (this.expressionTimer <= 0) this.expression = 'normal';
        }

        // Keyboard WASD Movement
        let moveX = 0;
        let moveY = 0;

        if (inputState.left) moveX -= 1;
        if (inputState.right) moveX += 1;
        if (inputState.up) moveY -= 1;
        if (inputState.down) moveY += 1;

        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
        }

        // Apply acceleration
        this.vx += moveX * this.accel;
        this.vy += moveY * this.accel;

        // Mouse target movement if no WASD pressed
        if (moveX === 0 && moveY === 0 && inputState.mouseTarget && inputState.isMouseDown) {
            const dx = inputState.mouseTarget.x - this.x;
            const dy = inputState.mouseTarget.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
                this.vx += (dx / dist) * this.accel;
                this.vy += (dy / dist) * this.accel;
            }
        }

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Cap speed (unless dashing)
        const speed = Math.hypot(this.vx, this.vy);
        const limit = this.isDashing ? 20 : this.maxSpeed;
        if (speed > limit) {
            this.vx = (this.vx / speed) * limit;
            this.vy = (this.vy / speed) * limit;
        }
        if (speed < 12) this.isDashing = false;

        // Position update
        this.x += this.vx;
        this.y += this.vy;

        // Border Collisions with Elastic Bounce
        const r = this.radius;
        if (bounds) {
            if (this.x - r < bounds.minX) {
                this.x = bounds.minX + r;
                this.vx = -this.vx * 0.8;
                this.onBounce();
            } else if (this.x + r > bounds.maxX) {
                this.x = bounds.maxX - r;
                this.vx = -this.vx * 0.8;
                this.onBounce();
            }

            if (this.y - r < bounds.minY) {
                this.y = bounds.minY + r;
                this.vy = -this.vy * 0.8;
                this.onBounce();
            } else if (this.y + r > bounds.maxY) {
                this.y = bounds.maxY - r;
                this.vy = -this.vy * 0.8;
                this.onBounce();
            }
        }

        // Smooth squish recovery back to 1.0
        this.squishX += (1.0 - this.squishX) * 0.15;
        this.squishY += (1.0 - this.squishY) * 0.15;
    }

    onBounce() {
        this.squishX = 1.3;
        this.squishY = 0.75;
        if (Math.hypot(this.vx, this.vy) > 4) {
            this.expression = 'angry';
            this.expressionTimer = 0.6;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.squishX, this.squishY);

        // Shadow under the Countryball
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, this.radius * 0.85, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 1. Draw Flag Pattern
        if (this.skin.type === 'custom' && this.skin.drawFlag) {
            this.skin.drawFlag(ctx, this.radius);
        } else if (this.skin.type === 'striped_horizontal' && this.skin.colors) {
            this.drawHorizontalStripes(ctx, this.skin.colors);
        } else if (this.skin.type === 'striped_vertical' && this.skin.colors) {
            this.drawVerticalStripes(ctx, this.skin.colors);
        } else {
            // Default circle
            ctx.fillStyle = '#E30A17';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Outer Countryball outline (thick black outline like Polandball style!)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Draw Classic Countryball Cartoon Eyes!
        this.drawEyes(ctx);

        ctx.restore();

        // 3. Draw Name Tag & Speech Bubble above ball
        this.drawUI(ctx);
    }

    drawHorizontalStripes(ctx, colors) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();

        const count = colors.length;
        const stripeH = (this.radius * 2) / count;
        for (let i = 0; i < count; i++) {
            ctx.fillStyle = colors[i];
            ctx.fillRect(-this.radius, -this.radius + i * stripeH, this.radius * 2, stripeH + 0.5);
        }
        ctx.restore();
    }

    drawVerticalStripes(ctx, colors) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();

        const count = colors.length;
        const stripeW = (this.radius * 2) / count;
        for (let i = 0; i < count; i++) {
            ctx.fillStyle = colors[i];
            ctx.fillRect(-this.radius + i * stripeW, -this.radius, stripeW + 0.5, this.radius * 2);
        }
        ctx.restore();
    }

    drawEyes(ctx) {
        // Eyes position
        const eyeOffsetX = this.radius * 0.32;
        const eyeOffsetY = -this.radius * 0.12;
        const eyeR = this.radius * 0.24;

        // Determine look direction slightly towards movement
        const lookDx = Math.max(-4, Math.min(4, this.vx * 0.4));
        const lookDy = Math.max(-4, Math.min(4, this.vy * 0.4));

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;

        // Left Eye
        ctx.beginPath();
        ctx.ellipse(-eyeOffsetX + lookDx, eyeOffsetY + lookDy, eyeR, eyeR * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right Eye
        ctx.beginPath();
        ctx.ellipse(eyeOffsetX + lookDx, eyeOffsetY + lookDy, eyeR, eyeR * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Expressions (Angry / Happy eyelids)
        if (this.expression === 'angry') {
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(-eyeOffsetX - eyeR * 1.2 + lookDx, eyeOffsetY - eyeR * 1.1 + lookDy);
            ctx.lineTo(-eyeOffsetX + eyeR * 1.2 + lookDx, eyeOffsetY + eyeR * 0.4 + lookDy);
            ctx.lineTo(-eyeOffsetX - eyeR * 1.2 + lookDx, eyeOffsetY + eyeR * 0.4 + lookDy);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(eyeOffsetX + eyeR * 1.2 + lookDx, eyeOffsetY - eyeR * 1.1 + lookDy);
            ctx.lineTo(eyeOffsetX - eyeR * 1.2 + lookDx, eyeOffsetY + eyeR * 0.4 + lookDy);
            ctx.lineTo(eyeOffsetX + eyeR * 1.2 + lookDx, eyeOffsetY + eyeR * 0.4 + lookDy);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawUI(ctx) {
        ctx.save();

        // 1. Name Tag
        ctx.font = 'bold 13px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const nameY = this.y + this.radius + 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const nameWidth = ctx.measureText(this.name).width + 12;
        ctx.fillRect(this.x - nameWidth / 2, nameY, nameWidth, 18);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(this.name, this.x, nameY + 2);

        // 2. Speech Bubble (if active)
        if (this.speechText) {
            ctx.font = '14px Inter, Arial, sans-serif';
            const padding = 10;
            const textWidth = ctx.measureText(this.speechText).width;
            const bubbleW = textWidth + padding * 2;
            const bubbleH = 28;
            const bubbleX = this.x - bubbleW / 2;
            const bubbleY = this.y - this.radius - bubbleH - 14;

            // Draw bubble background
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 8);
            ctx.fill();
            ctx.stroke();

            // Pointer triangle pointing to countryball
            ctx.beginPath();
            ctx.moveTo(this.x - 6, bubbleY + bubbleH);
            ctx.lineTo(this.x, bubbleY + bubbleH + 6);
            ctx.lineTo(this.x + 6, bubbleY + bubbleH);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.speechText, this.x, bubbleY + bubbleH / 2);
        }

        ctx.restore();
    }
}
