import * as THREE from 'three';

/**
 * ArenaScreen — the shared "jumbotron" for the arena.
 *
 * NOTE: A YouTube player cannot be painted onto a WebGL texture (browser CORS/DRM),
 * so the actual video plays in an HTML <iframe> jumbotron overlay that every client
 * shows. This class also builds a big neon screen LANDMARK just beyond the north
 * wall so there is a real "big screen on the map", and lights it up while a video
 * is playing.
 */
export class ArenaScreen {
    constructor(scene, { iframeEl, wrapEl, labelEl } = {}) {
        this.scene = scene;
        this.iframeEl = iframeEl;
        this.wrapEl = wrapEl;
        this.labelEl = labelEl;
        this.videoId = null;
        this.build();
    }

    build() {
        const group = new THREE.Group();

        const frameW = 72;
        const frameH = 40;
        const centerY = 40; // floats high over the central avenue — cars drive underneath it

        // Dark screen panel (double-sided so it reads from both approaches)
        this.panelMat = new THREE.MeshBasicMaterial({ color: 0x05080f, side: THREE.DoubleSide });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(frameW - 4, frameH - 4), this.panelMat);
        panel.position.set(0, centerY, 0);
        group.add(panel);

        // Neon frame
        this.frameMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const bar = (w, h, x, y) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), this.frameMat);
            m.position.set(x, y, 0);
            group.add(m);
        };
        const t = 2.2;
        bar(frameW, t, 0, centerY + frameH / 2);
        bar(frameW, t, 0, centerY - frameH / 2);
        bar(t, frameH, -frameW / 2, centerY);
        bar(t, frameH, frameW / 2, centerY);

        // Slim overhead gantry beams so the screen reads as "mounted" over the road
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x0a2536 });
        [-frameW / 2, frameW / 2].forEach(px => {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 300), beamMat);
            beam.position.set(px, centerY + frameH / 2, 0);
            group.add(beam);
        });

        // "LIVE" bar under the screen (pulses while a video plays)
        this.liveMat = new THREE.MeshBasicMaterial({ color: 0xff2d95, transparent: true, opacity: 0.0 });
        const live = new THREE.Mesh(new THREE.BoxGeometry(frameW - 8, 2.6, 1.5), this.liveMat);
        live.position.set(0, centerY - frameH / 2 - 3, 0);
        group.add(live);

        // Suspended over the central north avenue (x = 0 road is clear), facing the arena
        group.position.set(0, 0, -140);
        this.group = group;
        this.scene.add(group);

        this.setActiveGlow(false);
    }

    setActiveGlow(active) {
        this.active = active;
        this.frameMat.color.setHex(active ? 0xff2d95 : 0x00b7cc);
        this.panelMat.color.setHex(active ? 0x0a1a34 : 0x05080f);
        this.liveMat.opacity = active ? 0.95 : 0.0;
    }

    /** Point the jumbotron overlay + landmark at a YouTube video. */
    setVideo(videoId, setByName) {
        if (!videoId) return;
        this.videoId = videoId;
        if (this.iframeEl) {
            this.iframeEl.src =
                `https://www.youtube-nocookie.com/embed/${videoId}` +
                `?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
        }
        if (this.wrapEl) this.wrapEl.classList.remove('hidden');
        if (this.labelEl) this.labelEl.innerText = `📺 ${setByName || 'Bir sürücü'} açtı`;
        this.setActiveGlow(true);
    }

    /** Subtle idle pulse so the landmark reads as "alive" while a video plays. */
    update(delta, elapsed) {
        if (this.active && this.liveMat) {
            this.liveMat.opacity = 0.6 + 0.35 * Math.sin(elapsed * 4.0);
        }
    }
}
