/**
 * Efeitos sonoros sintetizados com Web Audio. O contexto só é criado após
 * um gesto do usuário (Espaço na tela de título).
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startWind();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    vol: number,
    freq: number,
    q = 1,
    type: BiquadFilterType = 'lowpass',
  ): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  private startWind(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 380;
    f.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = this.ctx.createGain();
    lg.gain.value = 160;
    lfo.connect(lg).connect(f.frequency);
    s.connect(f).connect(g).connect(this.master);
    s.start();
    lfo.start();
  }

  swing(): void {
    this.noise(0.12, 0.25, 2400, 0.8, 'highpass');
  }
  hit(): void {
    this.tone(180, 0.12, 'square', 0.18, 60);
    this.noise(0.1, 0.3, 1200);
  }
  hurt(): void {
    this.tone(220, 0.25, 'sawtooth', 0.2, 70);
  }
  dodge(): void {
    this.noise(0.18, 0.18, 700, 0.7, 'bandpass');
  }
  heal(): void {
    this.tone(440, 0.25, 'sine', 0.15, 660);
    this.tone(660, 0.35, 'sine', 0.1, 880);
  }
  ignite(): void {
    this.noise(0.8, 0.35, 900, 0.5);
    this.tone(110, 0.8, 'triangle', 0.15, 220);
  }
  fire(): void {
    this.noise(0.35, 0.25, 600, 0.6);
  }
  roar(): void {
    this.tone(90, 1.1, 'sawtooth', 0.25, 45);
    this.noise(1.0, 0.3, 300, 0.8);
  }
  boom(): void {
    this.tone(70, 0.5, 'sine', 0.35, 30);
    this.noise(0.5, 0.35, 400);
  }
  select(): void {
    this.tone(520, 0.08, 'square', 0.08);
  }
  victory(): void {
    [392, 494, 587, 784].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.6, 'triangle', 0.15), i * 160),
    );
  }
  death(): void {
    this.tone(196, 1.4, 'triangle', 0.2, 49);
  }
}

export const sfx = new Sfx();
