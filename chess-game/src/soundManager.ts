class SoundManager {
  private ctx: AudioContext | null = null;
  private isEnabled = true;

  constructor() {
    // AudioContext will be initialized on the first user interaction to bypass browser policies
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleSound(enabled: boolean) {
    this.isEnabled = enabled;
    if (enabled) {
      this.initContext();
    }
  }

  public getSoundState(): boolean {
    return this.isEnabled;
  }

  public play(type: 'move' | 'capture' | 'check' | 'castle' | 'gameover') {
    if (!this.isEnabled) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      switch (type) {
        case 'move': {
          // Soft organic wood knock click
          const osc = this.ctx.createOscillator();
          const gainNode = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

          gainNode.gain.setValueAtTime(0.3, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

          osc.connect(gainNode);
          gainNode.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }

        case 'capture': {
          // Sharp snap wood friction strike
          const osc = this.ctx.createOscillator();
          const noise = this.ctx.createOscillator(); // Or simple filtered sweep
          const gainNode = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

          gainNode.gain.setValueAtTime(0.4, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

          osc.connect(gainNode);
          gainNode.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }

        case 'check': {
          // Dual warning bell chime
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gainNode = this.ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(660, now);
          osc1.frequency.setValueAtTime(660, now + 0.08);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, now);
          osc2.frequency.setValueAtTime(880, now + 0.08);

          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(this.ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.3);
          osc2.stop(now + 0.3);
          break;
        }

        case 'castle': {
          // Pleasant double-swoosh chime
          const osc = this.ctx.createOscillator();
          const gainNode = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

          gainNode.gain.setValueAtTime(0.18, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

          osc.connect(gainNode);
          gainNode.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.32);
          break;
        }

        case 'gameover': {
          // Warm harmonic grand finish arpeggio
          const freqs = [261.63, 329.63, 392.00, 523.25]; // C major chord notes
          freqs.forEach((freq, idx) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);

            gainNode.gain.setValueAtTime(0.12, now + idx * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.8);

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.8);
          });
          break;
        }
      }
    } catch (err) {
      console.warn('Audio play failure:', err);
    }
  }
}

export const soundManager = new SoundManager();
