import * as THREE from 'three';

export class NameTagManager {
    constructor(camera, containerElement) {
        this.camera = camera;
        this.container = containerElement;
        this.tags = {}; // { socketId: { element, bubbleElement, bubbleTimeout } }
    }

    createOrUpdateTag(id, name, skinIcon, headPos, isLocal = false) {
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
                headPos: headPos.clone(),
                bubbleTimer: null
            };
        } else {
            this.tags[id].headPos.copy(headPos);
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
        const tempV = new THREE.Vector3();

        Object.keys(this.tags).forEach(id => {
            const item = this.tags[id];
            if (!item) return;

            // Project 3D head position (+ height offset) to 2D screen space
            tempV.copy(item.headPos);
            tempV.y += 2.8; // Position above snake head
            tempV.project(this.camera);

            // Check if behind camera
            if (tempV.z > 1) {
                item.tagEl.style.display = 'none';
                item.bubbleEl.style.display = 'none';
                return;
            }

            const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;

            item.tagEl.style.display = 'block';
            item.tagEl.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;

            item.bubbleEl.style.display = 'block';
            item.bubbleEl.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 32}px)`;
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
