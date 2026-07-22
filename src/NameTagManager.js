import * as THREE from 'three';

export class NameTagManager {
    constructor(camera, containerElement) {
        this.camera = camera;
        this.container = containerElement;
        this.tags = {}; // { socketId: { tagEl, bubbleEl, headPos, curX, curY, bubbleTimer } }
        this.tempV = new THREE.Vector3();
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
                curX: null,
                curY: null,
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
        const width = window.innerWidth;
        const height = window.innerHeight;

        Object.keys(this.tags).forEach(id => {
            const item = this.tags[id];
            if (!item) return;

            // Project 3D head position (+ height offset) to 2D screen space
            this.tempV.copy(item.headPos);
            this.tempV.y += 2.6;
            this.tempV.project(this.camera);

            // Hide if behind camera frustum
            if (this.tempV.z > 1) {
                item.tagEl.style.display = 'none';
                item.bubbleEl.style.display = 'none';
                return;
            }

            const targetX = (this.tempV.x * 0.5 + 0.5) * width;
            const targetY = (-(this.tempV.y * 0.5) + 0.5) * height;

            // Smooth Lerp Interpolation & Sub-Pixel Rounding to eliminate jittering
            if (item.curX === null || item.curY === null) {
                item.curX = targetX;
                item.curY = targetY;
            } else {
                item.curX += (targetX - item.curX) * 0.5;
                item.curY += (targetY - item.curY) * 0.5;
            }

            const roundedX = Math.round(item.curX);
            const roundedY = Math.round(item.curY);

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
