"use client";

/**
 * Web Audio SFX synthesizer (no BGM).
 * iOS / Messenger in-app browsers keep AudioContext suspended until a real
 * user-gesture unlock (silent HTMLAudio + resume + silent buffer). Firework
 * SFX must also be triggered on the tap itself — not only after an async
 * fetch — or mobile WebViews stay silent.
 */

class MoonlightSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private gestureBound = false;
  private silentEl: HTMLAudioElement | null = null;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
  }

  /** Install once: unlock on first user gesture (covers iOS/Android autoplay). */
  public bindGestureUnlock(): void {
    if (this.gestureBound || typeof window === "undefined") return;
    this.gestureBound = true;
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "touchstart",
      "touchend",
      "mousedown",
      "keydown",
      "click",
    ];
    const onGesture = () => {
      this.unlock();
    };
    for (const ev of events) {
      window.addEventListener(ev, onGesture, {
        capture: true,
        passive: true,
      });
    }
  }

  /** Tiny silent WAV — unlocks the iOS/Messenger media session like HTMLAudio BGM used to. */
  private unlockHtmlAudio(): void {
    if (typeof window === "undefined") return;
    try {
      if (!this.silentEl) {
        // Minimal valid WAV (silence)
        this.silentEl = new Audio(
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
        );
        this.silentEl.setAttribute("playsinline", "true");
        this.silentEl.preload = "auto";
        this.silentEl.volume = 0.01;
      }
      this.silentEl.currentTime = 0;
      void this.silentEl.play().catch(() => {
        // Ignore — Web Audio path may still work
      });
    } catch {
      // Ignore
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  private kickSilentBuffer(ctx: AudioContext): void {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Ignore
    }
  }

  /**
   * Call from any user-gesture handler. Safe to call repeatedly.
   * Unlocks HTMLAudio session + AudioContext for firework/lantern SFX.
   */
  public unlock(): void {
    if (typeof window === "undefined") return;
    this.bindGestureUnlock();
    this.unlockHtmlAudio();

    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    this.kickSilentBuffer(ctx);
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        this.kickSilentBuffer(ctx);
      }).catch(() => {});
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    const ctx = this.ensureAudioContext();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      // Same as early main: kick resume; caller may still schedule on this ctx.
      void ctx.resume().catch(() => {});
      this.kickSilentBuffer(ctx);
    }
    return ctx;
  }

  public playCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [784, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playLanternChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.07 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.07 + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.95);
    });
  }

  public playHeartPop(combo = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = combo
      ? [523.25, 659.25, 783.99, 987.77, 1174.66]
      : [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = combo ? "triangle" : "sine";
      const start = now + idx * (combo ? 0.065 : 0.055);
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(combo ? 0.12 : 0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0008,
        start + (combo ? 1.0 : 0.45),
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + (combo ? 1.05 : 0.5));
    });
  }

  public playFusionChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const chargeOsc = ctx.createOscillator();
    const chargeGain = ctx.createGain();
    chargeOsc.type = "sine";
    chargeOsc.frequency.setValueAtTime(220, now);
    chargeOsc.frequency.exponentialRampToValueAtTime(880, now + 1.22);
    chargeGain.gain.setValueAtTime(0.001, now);
    chargeGain.gain.exponentialRampToValueAtTime(0.09, now + 1.15);
    chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 1.28);
    chargeOsc.connect(chargeGain);
    chargeGain.connect(ctx.destination);
    chargeOsc.start(now);
    chargeOsc.stop(now + 1.3);

    const impactAt = now + 1.24;
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = "triangle";
    boom.frequency.setValueAtTime(210, impactAt);
    boom.frequency.exponentialRampToValueAtTime(42, impactAt + 0.35);
    boomGain.gain.setValueAtTime(0.001, impactAt);
    boomGain.gain.linearRampToValueAtTime(0.24, impactAt + 0.015);
    boomGain.gain.exponentialRampToValueAtTime(0.001, impactAt + 0.42);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(impactAt);
    boom.stop(impactAt + 0.45);

    const sr = ctx.sampleRate;
    const whooshBuf = ctx.createBuffer(1, Math.floor(sr * 0.45), sr);
    const wd = whooshBuf.getChannelData(0);
    for (let i = 0; i < wd.length; i++) {
      wd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.14));
    }
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = whooshBuf;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(2400, impactAt);
    whooshFilter.frequency.exponentialRampToValueAtTime(700, impactAt + 0.4);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.18, impactAt);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, impactAt + 0.44);
    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshSrc.start(impactAt);
    whooshSrc.stop(impactAt + 0.45);

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      const start = impactAt + 0.04 + idx * 0.095;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.55);
    });
  }

  public playFireworkBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;

    const whooshLen = Math.floor(sr * 0.36);
    const whooshBuf = ctx.createBuffer(1, whooshLen, sr);
    const wd = whooshBuf.getChannelData(0);
    for (let i = 0; i < whooshLen; i++) {
      const env = Math.sin((i / whooshLen) * Math.PI);
      wd[i] = (Math.random() * 2 - 1) * env * 0.45;
    }
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = whooshBuf;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(650, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(2200, now + 0.34);
    whooshFilter.Q.value = 1.6;
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.12, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshSrc.start(now);
    whooshSrc.stop(now + 0.36);

    const boomAt = now + 0.34;
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = "sine";
    boomOsc.frequency.setValueAtTime(145, boomAt);
    boomOsc.frequency.exponentialRampToValueAtTime(42, boomAt + 0.42);
    boomGain.gain.setValueAtTime(0.001, boomAt);
    boomGain.gain.linearRampToValueAtTime(0.28, boomAt + 0.015);
    boomGain.gain.exponentialRampToValueAtTime(0.001, boomAt + 0.48);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(boomAt);
    boomOsc.stop(boomAt + 0.5);

    const sparkleLen = Math.floor(sr * 0.72);
    const sparkleBuf = ctx.createBuffer(1, sparkleLen, sr);
    const sd = sparkleBuf.getChannelData(0);
    for (let i = 0; i < sparkleLen; i++) {
      const decay = Math.exp(-i / (sr * 0.24));
      const crackle = Math.random() > 0.86 ? 1 : 0.15;
      sd[i] = (Math.random() * 2 - 1) * decay * crackle;
    }
    const spSrc = ctx.createBufferSource();
    spSrc.buffer = sparkleBuf;
    const spFilter = ctx.createBiquadFilter();
    spFilter.type = "highpass";
    spFilter.frequency.value = 2400;
    const spGain = ctx.createGain();
    spGain.gain.setValueAtTime(0.18, boomAt + 0.02);
    spGain.gain.exponentialRampToValueAtTime(0.001, boomAt + 0.74);
    spSrc.connect(spFilter);
    spFilter.connect(spGain);
    spGain.connect(ctx.destination);
    spSrc.start(boomAt + 0.02);
    spSrc.stop(boomAt + 0.76);
  }

  public playReleaseBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [261.63, 392.0, 523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0006, start + 2.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 2.3);
    });
  }
}

export const soundEngine = new MoonlightSoundEngine();
