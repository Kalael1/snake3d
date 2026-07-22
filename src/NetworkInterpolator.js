/**
 * Professional IO Game Network Snapshot Interpolator (Hermite / Lerp with 50ms Render Delay Buffer)
 * Eliminates network jitter, ping spikes, and stuttering for remote entities.
 */
export class NetworkInterpolator {
    constructor(renderDelayMs = 50) {
        this.renderDelayMs = renderDelayMs;
        this.buffers = {}; // { socketId: [ { time, x, z, angle, body } ] }
    }

    pushSnapshot(id, data) {
        if (!this.buffers[id]) {
            this.buffers[id] = [];
        }

        const now = Date.now();
        const snapshot = {
            time: now,
            x: data.x,
            z: data.z,
            angle: data.angle || 0,
            body: data.body || []
        };

        const buffer = this.buffers[id];
        buffer.push(snapshot);

        // Keep buffer size small (last 10 snapshots max)
        if (buffer.length > 10) {
            buffer.shift();
        }
    }

    getInterpolatedState(id) {
        const buffer = this.buffers[id];
        if (!buffer || buffer.length === 0) return null;

        const renderTime = Date.now() - this.renderDelayMs;

        // If buffer has only 1 snapshot, return it
        if (buffer.length === 1) {
            return buffer[0];
        }

        // Find surrounding snapshots [snap0, snap1] for renderTime
        for (let i = buffer.length - 1; i >= 0; i--) {
            if (buffer[i].time <= renderTime) {
                const snap0 = buffer[i];
                const snap1 = buffer[i + 1] || snap0;

                if (snap0 === snap1) {
                    return snap0;
                }

                const total = snap1.time - snap0.time;
                const portion = renderTime - snap0.time;
                const ratio = Math.max(0, Math.min(1, total > 0 ? portion / total : 1));

                // Lerp Head Position & Angle
                const interX = snap0.x + (snap1.x - snap0.x) * ratio;
                const interZ = snap0.z + (snap1.z - snap0.z) * ratio;

                // Angle interpolation
                let diff = snap1.angle - snap0.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                const interAngle = snap0.angle + diff * ratio;

                // Interpolate body segments
                const interBody = [];
                const b0 = snap0.body || [];
                const b1 = snap1.body || [];
                const maxBodyLen = Math.max(b0.length, b1.length);

                for (let j = 0; j < maxBodyLen; j++) {
                    const seg0 = b0[j] || b1[j] || { x: interX, z: interZ, angle: interAngle };
                    const seg1 = b1[j] || b0[j] || { x: interX, z: interZ, angle: interAngle };

                    interBody.push({
                        x: seg0.x + (seg1.x - seg0.x) * ratio,
                        z: seg0.z + (seg1.z - seg0.z) * ratio,
                        angle: seg0.angle + (seg1.angle - seg0.angle) * ratio
                    });
                }

                return {
                    x: interX,
                    z: interZ,
                    angle: interAngle,
                    body: interBody
                };
            }
        }

        // Fallback to latest snapshot
        return buffer[buffer.length - 1];
    }

    removeEntity(id) {
        delete this.buffers[id];
    }

    clearAll() {
        this.buffers = {};
    }
}
