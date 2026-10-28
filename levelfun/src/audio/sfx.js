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

export const sfx = {
  pop() { noise(0.12, { gain: 0.55, hp: 600 }); tone(180, 0.08, { type: 'square', gain: 0.2, slide: -120 }); },
  bang() { noise(0.35, { gain: 0.7, hp: 300 }); tone(90, 0.25, { type: 'sawtooth', gain: 0.35, slide: -60 }); },
  whistle() { tone(2300, 0.35, { type: 'sine', gain: 0.35, slide: 200 }); tone(2380, 0.35, { type: 'sine', gain: 0.25, slide: 150, delay: 0.02 }); },
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
