import * as THREE from 'three';

/**
 * ArenaScreen — the shared "jukebox".
 *
 * A YouTube player can't be painted onto a WebGL texture (browser CORS/DRM), so
 * the video lives in an HTML <iframe>. The AUDIO plays everywhere regardless of
 * where the iframe sits, and the VIDEO is projected onto the city model's
 * "YoutubeMonitor" surface: each frame we project that mesh's world position to
 * screen space and lay the iframe over it. When the monitor is off-screen or
 * behind the camera we park the iframe off-view (still playing) so music keeps going.
 */
export class ArenaScreen {
    constructor(scene, { iframeEl, wrapEl, labelEl } = {}) {
        this.scene = scene;
        this.iframeEl = iframeEl;
        this.wrapEl = wrapEl;
        this.labelEl = labelEl;
        this.videoId = null;
        this.monitor = null;      // { pos: Vector3, width, height }
        this._v = new THREE.Vector3();
        this._right = new THREE.Vector3();
    }

    /** Tell the screen where the in-world monitor is (from CityMap). */
    setMonitor(monitor) {
        this.monitor = monitor;
        if (this.wrapEl) this.wrapEl.classList.add('on-monitor');
    }

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
    }

    /** Position the iframe over the in-world monitor (or park it off-screen). */
    update(camera) {
        const wrap = this.wrapEl;
        if (!wrap || !this.videoId) return;

        // No monitor located → behave as a fixed corner jumbotron (CSS default).
        if (!this.monitor) return;

        const w = window.innerWidth, h = window.innerHeight;

        // Project the monitor centre to screen space
        this._v.copy(this.monitor.pos).project(camera);
        const behind = this._v.z > 1;
        const sx = (this._v.x * 0.5 + 0.5) * w;
        const sy = (-this._v.y * 0.5 + 0.5) * h;

        // Project a point one monitor half-width to the camera's right to get on-screen scale
        camera.getWorldDirection(this._right);
        this._right.cross(camera.up).normalize().multiplyScalar(this.monitor.width * 0.5);
        this._right.add(this.monitor.pos).project(camera);
        const edgeX = (this._right.x * 0.5 + 0.5) * w;
        const pxWidth = Math.abs(edgeX - sx) * 2;

        const onScreen = !behind && sx > -pxWidth && sx < w + pxWidth && sy > -400 && sy < h + 400 && pxWidth > 60;

        if (onScreen) {
            wrap.classList.add('tracking');
            wrap.style.width = pxWidth + 'px';
            wrap.style.left = '0px';
            wrap.style.top = '0px';
            wrap.style.transform =
                `translate(-50%, -50%) translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
        } else {
            // Park off-view but keep the iframe alive so audio continues
            wrap.classList.add('tracking');
            wrap.style.transform = 'translate(-9999px, -9999px)';
        }
    }
}
