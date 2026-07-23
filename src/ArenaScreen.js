import * as THREE from 'three';

/**
 * ArenaScreen — the shared "jukebox".
 *
 * Uses a flat 2D DOM projection but applies a simple perspective skew (rotateY)
 * so it looks like it's glued to the building surface instead of always facing the camera.
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
        
        this._monitorForward = new THREE.Vector3();
        this._cameraForward = new THREE.Vector3();
    }

    /** Tell the screen where the in-world monitor is (from CityMap). */
    setMonitor(monitor) {
        this.monitor = monitor;
        if (this.wrapEl) this.wrapEl.classList.add('on-monitor');
        
        if (monitor && monitor.mesh) {
            // Assume the monitor mesh's forward is +Z in its local space
            this._monitorForward.set(0, 0, 1);
            this._monitorForward.applyQuaternion(monitor.mesh.getWorldQuaternion(new THREE.Quaternion()));
        }
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

    /** Position the iframe over the in-world monitor with pseudo-3D skew. */
    update(camera) {
        const wrap = this.wrapEl;
        if (!wrap || !this.videoId) return;

        // No monitor located → behave as a fixed corner jumbotron.
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
        let pxWidth = Math.abs(edgeX - sx) * 2;

        const onScreen = !behind && sx > -pxWidth && sx < w + pxWidth && sy > -400 && sy < h + 400 && pxWidth > 40;

        if (onScreen) {
            // Fake perspective based on screen position!
            // When the monitor is on the left side of the screen, it tilts to the right.
            // When on the right, it tilts to the left.
            // This breaks the illusion that it's "looking at you" and makes it feel
            // glued to the background, WITHOUT risking the monitor disappearing.
            const dx = (sx - (w / 2)) / (w / 2); // -1.0 to 1.0
            const angleY = dx * 0.6; // Max ~35 degrees skew

            // Increase width slightly when skewed to maintain visual size
            pxWidth /= Math.cos(angleY * 0.8);

            wrap.classList.add('tracking');
            wrap.style.width = pxWidth + 'px';
            wrap.style.left = '0px';
            wrap.style.top = '0px';
            wrap.style.transform =
                `translate(-50%, -50%) translate(${Math.round(sx)}px, ${Math.round(sy)}px) perspective(800px) rotateY(${angleY}rad)`;
        } else {
            wrap.classList.add('tracking');
            wrap.style.transform = 'translate(-9999px, -9999px)';
        }
    }
}
