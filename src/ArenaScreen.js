import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/**
 * ArenaScreen — the shared "jukebox".
 *
 * Uses CSS3DRenderer to embed the YouTube iframe directly onto the 
 * "YoutubeMonitor" mesh in the 3D scene, providing a true 3D perspective.
 */
export class ArenaScreen {
    constructor(scene, { iframeEl, wrapEl, labelEl } = {}) {
        this.scene = scene;
        this.iframeEl = iframeEl;
        this.wrapEl = wrapEl;
        this.labelEl = labelEl;
        this.videoId = null;
        this.monitor = null;
        this.cssObject = null;
    }

    /** Tell the screen where the in-world monitor is (from CityMap). */
    setMonitor(monitor) {
        this.monitor = monitor;
        if (this.wrapEl) this.wrapEl.classList.add('on-monitor');

        if (monitor && monitor.mesh && this.wrapEl) {
            this.cssObject = new CSS3DObject(this.wrapEl);

            // We define a high-res base size for the iframe
            const baseWidth = 1280;
            const baseHeight = 720;
            this.wrapEl.style.width = baseWidth + 'px';
            this.wrapEl.style.height = baseHeight + 'px';
            
            // Allow pointer events just on the iframe wrap
            this.wrapEl.style.pointerEvents = 'auto';

            // Scale the CSS3DObject down to fit the monitor's 3D width
            const scale = monitor.width / baseWidth;
            this.cssObject.scale.set(scale, scale, scale);

            // Parent the CSS3DObject directly to the monitor mesh!
            // This means it inherits the exact world position and rotation of the monitor surface.
            monitor.mesh.add(this.cssObject);

            // Adjust the local position slightly to prevent z-fighting with the monitor mesh
            // Z is usually forward/backward depending on the mesh's local axes.
            // If the video faces the wrong way or is inside the mesh, we may need to adjust this.
            this.cssObject.position.set(0, 0, 0.2); 
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

    /** Update is no longer needed for 2D tracking! CSS3DRenderer handles it entirely. */
    update(camera) {
        // Nothing to do here!
    }
}
