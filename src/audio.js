// Tiny procedural sound engine (no audio files needed).
export class Sound {
  constructor() {
    this.ctx = null;
    this.beatT = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      // low ambient drone
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 43;
      o2.type = 'sine'; o2.frequency.value = 44.3;
      g.gain.value = 0.05;
      o.connect(g); o2.connect(g); g.connect(this.master);
      o.start(); o2.start();
    } catch {
      this.ctx = null;
    }
  }

  _noise(dur) {
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _tone(type, f0, f1, dur, vol) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  _burst(dur, freq, vol, q = 1) {
    const t = this.ctx.currentTime;
    const s = this._noise(dur);
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t);
  }

  step(vol = 0.5) { if (this.ctx) this._burst(0.11, 260 + Math.random() * 120, vol); }
  door(vol = 0.5) { if (this.ctx) { this._tone('sawtooth', 120 + Math.random() * 40, 70, 0.5, vol * 0.18); this._burst(0.15, 500, vol * 0.5); } }
  locked(vol = 0.5) { if (this.ctx) this._burst(0.08, 900, vol); }
  pickup() { if (this.ctx) { this._tone('triangle', 660, 990, 0.18, 0.2); } }
  crash(vol = 0.8) { if (this.ctx) { this._burst(0.5, 4000, vol, 3); this._tone('square', 900, 200, 0.2, vol * 0.1); } }
  swing() { if (this.ctx) this._burst(0.2, 1200, 0.3); }
  hit() { if (this.ctx) { this._tone('sine', 90, 35, 0.4, 0.9); this._burst(0.2, 700, 0.6); } }
  stinger() { if (this.ctx) { this._tone('sawtooth', 220, 110, 0.9, 0.18); this._tone('square', 233, 117, 0.9, 0.1); } }
  win() { if (this.ctx) { this._tone('triangle', 440, 880, 0.8, 0.25); } }

  // called every frame while Granny is hunting the player
  heartbeat(dt, intensity) {
    if (!this.ctx || intensity <= 0) return;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 0.9 - intensity * 0.45;
      this._tone('sine', 70, 40, 0.18, 0.55 * intensity);
      setTimeout(() => this.ctx && this._tone('sine', 62, 38, 0.18, 0.35 * intensity), 160);
    }
  }
}
