import * as THREE from 'three';

export class NameTagManager {
    constructor(camera, containerElement) {
        this.camera = camera;
        this.container = containerElement;
        this.tags = {}; // { socketId: { tagEl, bubbleEl, getPosFn, bubbleTimer } }
        this.tempV = new THREE.Vector3();
    }

    createOrUpdateTag(id, name, skinIcon, getPosFn, isLocal = false) {
        if (!this.tags[id]) {
            const tagDiv = document.createElement('div');
            tagDiv.className = `nametag-pill ${isLocal ? 'local-tag' : ''}`;
            tagDiv.innerHTML = `
                <span class="tag-icon">${skinIcon || '🐍'}</span>
                <span class="tag-name">${name || 'Oyuncu'}</span>
            `;
            this.container.appendChild(tagDiv);

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'speech-bubble hidden';
            this.container.appendChild(bubbleDiv);

            this.tags[id] = {
                tagEl: tagDiv,
                bubbleEl: bubbleDiv,
                getPosFn: getPosFn,
                bubbleTimer: null
            };
        } else {
            this.tags[id].getPosFn = getPosFn;
        }
    }

    showBubble(id, content, isEmoji = false) {
        const item = this.tags[id];
        if (!item) return;

        item.bubbleEl.innerHTML = isEmoji ? `<span class="bubble-emoji">${content}</span>` : content;
        item.bubbleEl.classList.remove('hidden');
        item.bubbleEl.classList.add('pop-in');

        if (item.bubbleTimer) clearTimeout(item.bubbleTimer);
        item.bubbleTimer = setTimeout(() => {
            item.bubbleEl.classList.add('hidden');
            item.bubbleEl.classList.remove('pop-in');
        }, 3200);
    }

    updatePositions() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        Object.keys(this.tags).forEach(id => {
            const item = this.tags[id];
            if (!item || !item.getPosFn) return;

            // Direct live 60 FPS 3D head position
            const liveHeadPos = item.getPosFn();
            if (!liveHeadPos) return;

            // Project 3D head position (+ height offset) to 2D screen space
            this.tempV.copy(liveHeadPos);
            this.tempV.y += 2.7;
            this.tempV.project(this.camera);

            // Hide if behind camera frustum
            if (this.tempV.z > 1) {
                item.tagEl.style.display = 'none';
                item.bubbleEl.style.display = 'none';
                return;
            }

            const targetX = (this.tempV.x * 0.5 + 0.5) * width;
            const targetY = (-(this.tempV.y * 0.5) + 0.5) * height;

            const roundedX = Math.round(targetX);
            const roundedY = Math.round(targetY);

            item.tagEl.style.display = 'flex';
            item.tagEl.style.transform = `translate3d(${roundedX}px, ${roundedY}px, 0) translate(-50%, -100%)`;

            item.bubbleEl.style.display = 'block';
            item.bubbleEl.style.transform = `translate3d(${roundedX}px, ${roundedY - 28}px, 0) translate(-50%, -100%)`;
        });
    }

    removeTag(id) {
        const item = this.tags[id];
        if (item) {
            if (item.bubbleTimer) clearTimeout(item.bubbleTimer);
            if (item.tagEl.parentNode) item.tagEl.parentNode.removeChild(item.tagEl);
            if (item.bubbleEl.parentNode) item.bubbleEl.parentNode.removeChild(item.bubbleEl);
            delete this.tags[id];
        }
    }

    clearAll() {
        Object.keys(this.tags).forEach(id => this.removeTag(id));
    }
}
