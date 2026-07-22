import { SKINS } from './SkinRegistry.js';

export class ProgressionManager {
    constructor() {
        this.highScoreKey = 'snake3d_high_score';
        this.selectedSkinKey = 'snake3d_selected_skin';

        this.highScore = this.loadHighScore();
        this.selectedSkinId = this.loadSelectedSkin();
    }

    loadHighScore() {
        const val = localStorage.getItem(this.highScoreKey);
        return val ? parseInt(val, 10) || 0 : 0;
    }

    saveHighScore(score) {
        if (score > this.highScore) {
            this.highScore = score;
            localStorage.setItem(this.highScoreKey, score.toString());
            return true; // New High Score Record!
        }
        return false;
    }

    loadSelectedSkin() {
        const val = localStorage.getItem(this.selectedSkinKey);
        if (val && this.isSkinUnlocked(val)) {
            return val;
        }
        return 'classic';
    }

    setSelectedSkin(skinId) {
        if (this.isSkinUnlocked(skinId)) {
            this.selectedSkinId = skinId;
            localStorage.setItem(this.selectedSkinKey, skinId);
            return true;
        }
        return false;
    }

    isSkinUnlocked(skinId) {
        const skin = SKINS.find(s => s.id === skinId);
        if (!skin) return false;
        return this.highScore >= skin.reqScore;
    }

    getNextUnlock() {
        const lockedSkins = SKINS.filter(s => this.highScore < s.reqScore);
        if (lockedSkins.length === 0) return null; // All unlocked!
        return lockedSkins[0];
    }
}
