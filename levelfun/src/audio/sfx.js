// Small synthesized sound effects (WebAudio). These are placeholders until the real audio pass (Stage 7).
let ctx = null, master = null, volume = 0.6;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  } catch (_) { ctx = null; }
}
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function tone(freq, dur, { type = 'sine', gain = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { gain = 0.3, hp = 800, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

let breath = null;
function panned(pan) { if (!ctx) return master; if (!ctx.createStereoPanner) return master; const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p; }
function thud(gain, pan) {
  if (!ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(panned(pan)); o.start(t); o.stop(t + 0.2);
}

export const sfx = {
  // Smiley: heavy footsteps (quieter with distance, panned left/right), slow breathing, and a few stings
  smileyStep(dist, pan) { const v = Math.max(0, 1 - dist / 26); if (v > 0.02) thud(0.55 * v * v + 0.04 * v, pan); },
  setBreath(vol, chasing) {
    if (!ctx) return;
    if (!breath) {
      const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start();
      breath = { g, f };
    }
    const t = ctx.currentTime, rate = chasing ? 1.5 : 0.55, w = 0.55 + 0.45 * Math.sin(t * rate * 6.283);
    breath.g.gain.setTargetAtTime(vol * vol * 0.32 * w, t, 0.06);
    breath.f.frequency.setTargetAtTime(chasing ? 700 : 480, t, 0.2);
  },
  smileyNotice() { tone(70, 0.9, { type: 'sawtooth', gain: 0.3, slide: -20 }); tone(740, 0.5, { type: 'square', gain: 0.08, slide: -300 }); },
  heavyDoor() { noise(0.5, { gain: 0.5, hp: 150 }); tone(70, 0.8, { type: 'sawtooth', gain: 0.35, slide: -30 }); tone(130, 1.1, { type: 'sawtooth', gain: 0.12, slide: 110, delay: 0.1 }); tone(60, 0.5, { type: 'sine', gain: 0.5, delay: 0.9, slide: -20 }); },
  // something big tips over: a hollow bang for a bin, a metallic crash for a lamp, a rattle for a chair
  clatter(kind) {
    if (kind === 'bin') { noise(0.35, { gain: 0.55, hp: 250 }); tone(150, 0.25, { type: 'square', gain: 0.3, slide: -90 }); noise(0.2, { gain: 0.3, hp: 900, delay: 0.22 }); tone(210, 0.15, { type: 'square', gain: 0.18, slide: -120, delay: 0.24 }); }
    else if (kind === 'lamp') { noise(0.5, { gain: 0.6, hp: 400 }); tone(900, 0.3, { type: 'triangle', gain: 0.25, slide: -500 }); tone(1500, 0.4, { type: 'sine', gain: 0.14, slide: -900, delay: 0.05 }); noise(0.25, { gain: 0.3, hp: 2500, delay: 0.3 }); }
    else { noise(0.3, { gain: 0.5, hp: 500 }); tone(320, 0.15, { type: 'square', gain: 0.25, slide: -200 }); noise(0.18, { gain: 0.3, hp: 1500, delay: 0.2 }); }
  },
  doorCreak() { tone(180, 0.7, { type: 'sawtooth', gain: 0.08, slide: 120 }); noise(0.6, { gain: 0.05, hp: 1200 }); },
  stunned() { sfx.zap(); tone(60, 1.2, { type: 'sawtooth', gain: 0.3, slide: -30 }); },
  stick() { noise(0.5, { gain: 0.35, hp: 200 }); tone(240, 0.35, { type: 'sine', gain: 0.25, slide: -170 }); tone(160, 0.3, { type: 'sine', gain: 0.2, slide: -100, delay: 0.15 }); },
  struggle() { noise(0.18, { gain: 0.25, hp: 300 }); },
  thump() { noise(0.2, { gain: 0.6, hp: 120 }); tone(70, 0.3, { type: 'sine', gain: 0.5, slide: -40 }); },
  scream() { tone(1100, 0.9, { type: 'sawtooth', gain: 0.35, slide: 500 }); tone(1650, 0.9, { type: 'square', gain: 0.18, slide: 300 }); noise(0.9, { gain: 0.45, hp: 900 }); tone(55, 1, { type: 'sawtooth', gain: 0.4 }); },

  pop() { noise(0.12, { gain: 0.55, hp: 600 }); tone(180, 0.08, { type: 'square', gain: 0.2, slide: -120 }); },
  bang() { noise(0.35, { gain: 0.7, hp: 300 }); tone(90, 0.25, { type: 'sawtooth', gain: 0.35, slide: -60 }); },
  // A pea whistle: a pure ~2.8 kHz tone with a fast warble (the pea rattling), breathy noise, and a short rise at the start.
  whistle() {
    if (!ctx) return;
    const t = ctx.currentTime, dur = 0.55, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(2500, t); o.frequency.linearRampToValueAtTime(2850, t + 0.06); o.frequency.setValueAtTime(2850, t + dur - 0.1); o.frequency.linearRampToValueAtTime(2700, t + dur);
    lfo.frequency.value = 42; lg.gain.value = 170; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.38, t + 0.03); g.gain.setValueAtTime(0.38, t + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(5650, t); o2.frequency.linearRampToValueAtTime(5400, t + dur);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur); o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t + dur + 0.02);
    noise(dur, { gain: 0.07, hp: 3200 });
  },
  squeak() { tone(900, 0.12, { type: 'triangle', gain: 0.25, slide: 500 }); tone(1300, 0.08, { type: 'triangle', gain: 0.2, delay: 0.1 }); },
  tick() { tone(1400, 0.03, { type: 'square', gain: 0.18 }); },
  click() { tone(500, 0.04, { type: 'square', gain: 0.15 }); },
  install() { tone(330, 0.1, { type: 'square', gain: 0.18 }); tone(495, 0.14, { type: 'square', gain: 0.18, delay: 0.09 }); },
  ding() { tone(880, 0.5, { gain: 0.3 }); tone(1320, 0.6, { gain: 0.2, delay: 0.08 }); },
  buzz() { tone(110, 0.3, { type: 'sawtooth', gain: 0.25 }); },
  zap() { noise(0.25, { gain: 0.5, hp: 1500 }); tone(1800, 0.25, { type: 'sawtooth', gain: 0.25, slide: -1400 }); },
  alarm() { for (let i = 0; i < 6; i++) { tone(760, 0.2, { type: 'square', gain: 0.22, delay: i * 0.45 }); tone(560, 0.2, { type: 'square', gain: 0.22, delay: i * 0.45 + 0.22 }); } },
  rumble() { noise(1.6, { gain: 0.25, hp: 60 }); tone(55, 1.6, { type: 'sawtooth', gain: 0.2 }); },
  record() { tone(1000, 0.1, { gain: 0.2 }); tone(1000, 0.1, { gain: 0.2, delay: 0.18 }); },
  // twinkling tune for the music box (about 15 s when repeated by the caller)
  musicBar(step) {
    const notes = [523, 659, 784, 659, 523, 392, 440, 523, 587, 494, 392, 494];
    for (let i = 0; i < 4; i++) tone(notes[(step * 4 + i) % notes.length], 0.45, { type: 'triangle', gain: 0.22, delay: i * 0.5 });
  },
};
