export class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        
        // Continuous Boost Synth State
        this.boostOsc = null;
        this.boostGain = null;
        this.boostFilter = null;
        this.isBoostPlaying = false;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Professional Soft Crystal Pickup Sound
    playEat() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Smooth sine wave with warm low-pass filtering
        const baseFreq = 580 + Math.random() * 200;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, this.ctx.currentTime + 0.09);

        // Soft low-pass filter removes high harshness
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.09);
    }

    // Professional Sci-Fi Aerodynamic Boost Hum (Smooth & Soothing)
    startBoost() {
        if (this.isMuted || this.isBoostPlaying) return;
        this.init();
        if (!this.ctx) return;

        try {
            this.isBoostPlaying = true;

            // Warm sine/sub-bass mix (No harsh buzz)
            this.boostOsc = this.ctx.createOscillator();
            this.boostOsc.type = 'sine';
            this.boostOsc.frequency.setValueAtTime(130, this.ctx.currentTime);
            this.boostOsc.frequency.exponentialRampToValueAtTime(190, this.ctx.currentTime + 0.3);

            // Biquad Lowpass Filter for deep warm whoosh sound
            this.boostFilter = this.ctx.createBiquadFilter();
            this.boostFilter.type = 'lowpass';
            this.boostFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

            // Gain node with smooth attack
            this.boostGain = this.ctx.createGain();
            this.boostGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
            this.boostGain.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.1);

            this.boostOsc.connect(this.boostFilter);
            this.boostFilter.connect(this.boostGain);
            this.boostGain.connect(this.ctx.destination);

            this.boostOsc.start();
        } catch (e) {
            this.isBoostPlaying = false;
        }
    }

    stopBoost() {
        if (!this.isBoostPlaying || !this.boostGain) return;

        try {
            const now = this.ctx.currentTime;
            this.boostGain.gain.cancelScheduledValues(now);
            this.boostGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);

            setTimeout(() => {
                if (this.boostOsc) {
                    try { this.boostOsc.stop(); } catch (e) {}
                    try { this.boostOsc.disconnect(); } catch (e) {}
                    this.boostOsc = null;
                }
                this.isBoostPlaying = false;
            }, 130);
        } catch (e) {
            this.isBoostPlaying = false;
        }
    }

    playDeath() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;

        this.stopBoost();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.35);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBoost();
        }
        return this.isMuted;
    }
}
