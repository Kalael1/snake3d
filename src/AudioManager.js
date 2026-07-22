// Web Audio API Synthesizer with Soft Pleasing Sounds
export class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.boostOsc = null;
        this.boostGain = null;
        this.boostFilter = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted && this.boostOsc) {
            this.stopBoost();
        }
        return this.isMuted;
    }

    playEat() {
        if (this.isMuted) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    // Soft, Pleasing Low-Frequency Boost Whoosh (No ear fatigue!)
    startBoost() {
        if (this.isMuted || this.boostOsc) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.boostOsc = this.ctx.createOscillator();
        this.boostGain = this.ctx.createGain();
        this.boostFilter = this.ctx.createBiquadFilter();

        // Low frequency soft sine wave with lowpass filter for gentle wind effect
        this.boostOsc.type = 'sine';
        this.boostOsc.frequency.setValueAtTime(120, this.ctx.currentTime);
        
        this.boostFilter.type = 'lowpass';
        this.boostFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

        this.boostGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
        this.boostGain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.15);

        this.boostOsc.connect(this.boostFilter);
        this.boostFilter.connect(this.boostGain);
        this.boostGain.connect(this.ctx.destination);

        this.boostOsc.start();
    }

    stopBoost() {
        if (this.boostOsc && this.boostGain) {
            try {
                this.boostGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                setTimeout(() => {
                    if (this.boostOsc) {
                        this.boostOsc.stop();
                        this.boostOsc.disconnect();
                        this.boostOsc = null;
                        this.boostGain = null;
                        this.boostFilter = null;
                    }
                }, 100);
            } catch (e) {
                this.boostOsc = null;
            }
        }
    }

    playDeath() {
        if (this.isMuted) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }
}
