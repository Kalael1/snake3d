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

            // Add directly to the scene to avoid inheriting weird GLTF scales from parent meshes!
            this.scene.add(this.cssObject);

            // Extract exact world coordinates
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scl = new THREE.Vector3();
            monitor.mesh.matrixWorld.decompose(pos, quat, scl);

            this.cssObject.position.copy(pos);
            this.cssObject.quaternion.copy(quat);

            // Create a semi-transparent red debug plane so we can see where the screen is supposed to be!
            const debugGeo = new THREE.PlaneGeometry(monitor.width, monitor.width * (720/1280));
            const debugMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const debugMesh = new THREE.Mesh(debugGeo, debugMat);
            debugMesh.position.copy(pos);
            debugMesh.quaternion.copy(quat);
            this.scene.add(debugMesh);

            // Adjust the local position slightly outward to prevent z-fighting
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
            this.cssObject.position.add(forward.multiplyScalar(0.5));
            debugMesh.position.add(forward.multiplyScalar(0.4));
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
