import type { SoundType } from "../types";

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private initialized = false;
  private lastPlayedAt: Partial<Record<SoundType, number>> = {};
  private readonly cooldownMs: Partial<Record<SoundType, number>> = {
    coinDrop: 80,
    coinSpawn: 45,
    coinCollect: 55,
    centerHit: 180,
    mechanismRoll: 900,
    mechanismStop: 200,
    upgrade: 180,
    error: 120,
    giftPack: 180,
    offline: 250,
    click: 80
  };

  init(): void {
    if (this.initialized) return;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      this.ctx = new AudioContextCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.68;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      // Web Audio not supported
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  play(type: SoundType): void {
    if (!this.enabled || !this.ctx) return;
    if (!this.canPlay(type)) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    switch (type) {
      case "coinDrop":
        this.coinDrop();
        break;
      case "coinSpawn":
        this.coinSpawn();
        break;
      case "coinCollect":
        this.coinCollect();
        break;
      case "centerHit":
        this.centerHit();
        break;
      case "mechanismRoll":
        this.mechanismRoll();
        break;
      case "mechanismStop":
        this.mechanismStop();
        break;
      case "upgrade":
        this.upgrade();
        break;
      case "error":
        this.error();
        break;
      case "giftPack":
        this.giftPack();
        break;
      case "offline":
        this.offline();
        break;
      case "click":
        this.click();
        break;
    }
  }

  private canPlay(type: SoundType): boolean {
    const now = Date.now();
    const cooldown = this.cooldownMs[type] ?? 0;
    const previous = this.lastPlayedAt[type] ?? 0;
    if (now - previous < cooldown) return false;
    this.lastPlayedAt[type] = now;
    return true;
  }

  private now(): number {
    return this.ctx!.currentTime;
  }

  private output(): AudioNode {
    return this.masterGain ?? this.ctx!.destination;
  }

  private coinDrop(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private coinSpawn(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private coinCollect(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.setValueAtTime(880, t + 0.04);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private centerHit(): void {
    const t = this.now();
    [523, 659, 784].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0.12, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.2);
      osc.connect(gain).connect(this.output());
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.2);
    });
  }

  private mechanismRoll(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(400, t + 1.0);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 1.1);
  }

  private mechanismStop(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private upgrade(): void {
    const t = this.now();
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0.1, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.18);
      osc.connect(gain).connect(this.output());
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.18);
    });
  }

  private error(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private giftPack(): void {
    const t = this.now();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      gain.gain.setValueAtTime(0.1, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.15);
      osc.connect(gain).connect(this.output());
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.15);
    });
  }

  private offline(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(554, t + 0.15);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private click(): void {
    const t = this.now();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(this.output());
    osc.start(t);
    osc.stop(t + 0.04);
  }
}

export const audioSystem = new AudioSystem();
