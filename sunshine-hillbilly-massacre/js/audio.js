// All the sound is made here, from oscillators and noise: no audio files. The browser only allows
// audio after a tap or key press, so the context is made on the first one (init).

export function createAudio(getSettings) {
  let ctx = null, master = null, saw = null, amb = null;
  const api = {};

  api.init = () => {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; return; }
    master = ctx.createGain();
    master.connect(ctx.destination);
    api.applyVolume();
    if (!getSettings().sound) ctx.suspend?.();
    startChainsaw();
    startAmbience();
  };
  api.ready = () => !!ctx;
  api.applyVolume = () => { if (master) master.gain.value = getSettings().volume / 100; };
  api.setEnabled = on => { if (ctx) (on ? ctx.resume() : ctx.suspend()).catch?.(() => {}); };

  const noiseBuf = (len, decay) => {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (decay ? Math.exp(-i / (ctx.sampleRate * decay)) : 1);
    return buf;
  };
  const noise = (len, decay) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(len, decay); return s; };
  const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(3, 0); s.loop = true; return s; };
  const env = (g, now, t0, peak, a, dur) => {
    g.gain.setValueAtTime(0.0001, now + t0);
    g.gain.linearRampToValueAtTime(peak, now + t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
  };
  // a plain tone with an envelope; f2 slides the pitch
  const tone = (type, f, t0, dur, vol, f2, lp) => {
    const now = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t0 + dur);
    env(g, now, t0, vol, Math.min(0.08, dur / 3), dur);
    let node = o;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(g).connect(master);
    o.start(now + t0); o.stop(now + t0 + dur + 0.05);
  };
  const burst = (len, decay, ftype, freq, vol, t0 = 0, q = 1) => {
    const now = ctx.currentTime, s = noise(len, decay), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = ftype; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    s.connect(f).connect(g).connect(master); s.start(now + t0);
  };

  // ---- the chainsaw: a two-stroke engine that runs the whole time he is in the house ------------
  function startChainsaw() {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), am = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
    const n = loopNoise(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = 1800;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 14; lg.gain.value = 0.45; lfo.connect(lg).connect(am.gain);
    am.gain.value = 0.55;
    const out = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    out.gain.value = 0;
    o.connect(lp); o2.connect(lp); lp.connect(am); n.connect(bp).connect(ng).connect(am);
    am.connect(out);
    if (pan) { out.connect(pan).connect(master); } else out.connect(master);
    o.start(); o2.start(); n.start(); lfo.start();
    saw = { o, o2, lp, bp, ng, lfo, lg, out, pan, am, wob: 0 };
  }
  // vol 0..1 (distance), pan -1..1, rpm 0..1 (0 = stalled), muffle 0..1 (walls and floors in the way)
  api.chainsaw = ({ vol, pan, rpm, muffle }) => {
    if (!saw) return;
    const now = ctx.currentTime, r = Math.max(0, rpm);
    saw.wob += 0.35 * (Math.random() - 0.5);
    saw.wob *= 0.9;
    const f = 36 + r * 150 + saw.wob * (1 - r) * 8;                       // the engine note
    saw.o.frequency.setTargetAtTime(f, now, 0.05); saw.o2.frequency.setTargetAtTime(f * 0.5, now, 0.05);
    saw.lfo.frequency.setTargetAtTime(9 + r * 24, now, 0.1);              // putt-putt at idle, a snarl flat out
    saw.lg.gain.setTargetAtTime(0.55 - r * 0.3, now, 0.1);
    saw.bp.frequency.setTargetAtTime(1300 + r * 2600, now, 0.1);
    saw.ng.gain.setTargetAtTime(0.1 + r * 0.7, now, 0.1);
    saw.lp.frequency.setTargetAtTime(500 + (1 - muffle) * (1400 + r * 2400), now, 0.1);
    saw.out.gain.setTargetAtTime(rpm <= 0.01 ? 0 : Math.min(1, vol) * (0.28 + r * 0.5), now, 0.08);
    if (saw.pan) saw.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1);
  };

  // ---- the farm outside: cicadas and a hot wind ---------------------------------------------------------
  function startAmbience() {
    const n = loopNoise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), trem = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 9;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 71; lg.gain.value = 0.5; trem.gain.value = 0.5;
    lfo.connect(lg).connect(trem.gain);
    const swell = ctx.createOscillator(), sg = ctx.createGain(); swell.frequency.value = 0.13; sg.gain.value = 0.25; swell.connect(sg).connect(g.gain);
    g.gain.value = 0.35;
    n.connect(bp).connect(trem).connect(g);
    const wind = loopNoise(), wl = ctx.createBiquadFilter(), wg = ctx.createGain(), wlfo = ctx.createOscillator(), wlg = ctx.createGain();
    wl.type = 'lowpass'; wl.frequency.value = 380; wg.gain.value = 0.2; wlfo.frequency.value = 0.07; wlg.gain.value = 0.12;
    wlfo.connect(wlg).connect(wg.gain); wind.connect(wl).connect(wg);
    const out = ctx.createGain(); out.gain.value = 0.0;
    g.connect(out); wg.connect(out); out.connect(master);
    n.start(); lfo.start(); swell.start(); wind.start(); wlfo.start();
    amb = { out };
  }
  // bright: 0 in the cellar, 1 with the sun on the windows
  api.ambience = (bright, on = true) => { if (amb) amb.out.gain.setTargetAtTime(on ? 0.05 + bright * 0.1 : 0, ctx.currentTime, 0.5); };

  // ---- a slow, out-of-tune banjo, plucked more and more often as the fear rises -------------------
  const SCALE = [146.8, 164.8, 174.6, 196, 220, 233.1, 261.6, 293.7];
  api.pluck = (vol = 1, idx) => {
    if (!ctx) return;
    const f = SCALE[idx ?? Math.floor(Math.random() * SCALE.length)] * (1 + (Math.random() - 0.5) * 0.02);
    tone('triangle', f, 0, 1.1, 0.14 * vol, f * 0.985, 2400);
    tone('square', f * 2, 0, 0.25, 0.04 * vol, f * 1.99, 3200);
    burst(0.03, 0.006, 'highpass', 3000, 0.12 * vol);
  };
  let pluckT = 3;
  api.music = (dt, fear, on) => {
    if (!ctx || !on) return;
    pluckT -= dt;
    if (pluckT <= 0) {
      api.pluck(0.7 + fear / 160);
      if (Math.random() < 0.4) setTimeout(() => api.pluck(0.5 + fear / 200), 260 + Math.random() * 200);
      pluckT = 5.5 - fear * 0.04 + Math.random() * 4;
    }
  };

  api.chime = () => { if (ctx) tone('triangle', 660, 0, 0.35, 0.25, 990); };
  api.thud = () => {
    if (!ctx) return;
    const now = ctx.currentTime, th = ctx.createOscillator(), g = ctx.createGain();
    th.frequency.setValueAtTime(90, now); th.frequency.exponentialRampToValueAtTime(35, now + 0.3);
    g.gain.setValueAtTime(0.9, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    th.connect(g).connect(master); th.start(now); th.stop(now + 0.5);
    burst(0.5, 0.08, 'lowpass', 400, 0.9);
  };

  // world sounds
  api.sfx = name => {
    if (!ctx) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'unlock': burst(0.15, 0.015, 'highpass', 2500, 0.7); break;
      case 'glass':
        burst(0.5, 0.09, 'highpass', 2200, 0.9);
        for (let i = 0; i < 12; i++) tone('sine', 2500 + Math.random() * 3000, 0.08 + i * 0.07 + Math.random() * 0.05, 0.08, 0.06);
        break;
      case 'jar':   // a heavy smash, a wet slap, then glittering
        burst(0.4, 0.07, 'highpass', 1500, 0.9); burst(0.3, 0.05, 'lowpass', 700, 0.8);
        for (let i = 0; i < 8; i++) tone('sine', 2000 + Math.random() * 3500, 0.06 + i * 0.06, 0.07, 0.06);
        tone('sine', 110, 0, 0.16, 0.4, 55);
        break;
      case 'click': burst(0.04, 0.006, 'highpass', 1500, 0.6); break;
      case 'doorOpen': tone('sawtooth', 110, 0, 0.5, 0.1, 190, 600); break;
      case 'doorClose': tone('sine', 95, 0.35, 0.2, 0.5, 42); break;
      case 'creak': tone('sawtooth', 90, 0, 1.1, 0.12, 150, 500); break;
      case 'alert': {   // something far away, low and long
        tone('sawtooth', 52, 0, 3.2, 0.26, 34, 160); break;
      }
      case 'pour': for (let i = 0; i < 4; i++) tone('sine', 300 + i * 40, i * 0.18, 0.15, 0.18, 140); break;
      case 'engine': {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 420;
        o.frequency.setValueAtTime(34, now); o.frequency.linearRampToValueAtTime(40, now + 0.9);
        o.frequency.linearRampToValueAtTime(95, now + 1.3); o.frequency.exponentialRampToValueAtTime(55, now + 2.4);
        g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.18, now + 0.2);
        g.gain.setValueAtTime(0.18, now + 0.9); g.gain.linearRampToValueAtTime(0.32, now + 1.3); g.gain.linearRampToValueAtTime(0.2, now + 3.0); g.gain.linearRampToValueAtTime(0.0001, now + 4);
        o.connect(lp).connect(g).connect(master); o.start(now); o.stop(now + 4);
        break;
      }
      case 'drop': tone('sine', 120, 0, 0.16, 0.45, 50); break;
      case 'chop': burst(0.18, 0.03, 'lowpass', 1800, 0.8); tone('sine', 140, 0, 0.14, 0.5, 60); break;
      case 'shot': burst(0.9, 0.2, 'lowpass', 3000, 1); tone('sine', 95, 0, 0.5, 0.9, 30); break;
      case 'dry': burst(0.06, 0.008, 'highpass', 1800, 0.5); break;
      case 'load': burst(0.07, 0.01, 'bandpass', 2200, 0.6, 0, 1.2); burst(0.07, 0.01, 'bandpass', 2200, 0.6, 0.16, 1.2); break;
      case 'wrong': tone('square', 110, 0, 0.35, 0.12); break;
      case 'cut': burst(0.12, 0.012, 'lowpass', 6000, 0.7); burst(0.4, 0.09, 'bandpass', 1800, 0.7, 0.05, 0.8); break;
      default: break;
    }
  };
  api.use = (kind, open) => {
    if (!ctx) return;
    const len = kind === 'drawer' ? 0.28 : 0.4, now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-(i / ctx.sampleRate) * (open ? 9 : 14)) * (kind === 'drawer' ? 1 : 0.8);
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(kind === 'drawer' ? 700 : 420, now); bp.frequency.linearRampToValueAtTime(open ? 260 : 600, now + len);
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(master); src.start(now);
  };

  // him
  api.entity = (name, vol = 1) => {
    if (!ctx || vol <= 0) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'step': tone('sine', 78, 0, 0.22, 0.6 * vol, 34); burst(0.06, 0.01, 'lowpass', 500, 0.3 * vol); break;
      case 'beat': tone('sine', 62, 0, 0.16, 0.9 * vol, 38); setTimeout(() => api.entity('beat2', vol * 0.7), 190); break;
      case 'beat2': tone('sine', 56, 0, 0.16, 0.8 * vol, 36); break;
      case 'growl': tone('sawtooth', 70, 0, 1.4, 0.34 * vol, 38, 240); tone('sawtooth', 76, 0, 1.4, 0.24 * vol, 42, 240); break;
      case 'sting': tone('square', 880, 0, 0.9, 0.12 * vol, 860, 2400); tone('square', 932, 0, 0.9, 0.12 * vol, 900, 2400); tone('sawtooth', 120, 0, 0.9, 0.3 * vol, 60, 400); break;
      case 'hurt': tone('sawtooth', 380, 0, 0.8, 0.3 * vol, 60, 900); burst(0.5, 0.12, 'lowpass', 600, 0.4 * vol); break;
      case 'pull': for (let i = 0; i < 3; i++) { tone('sawtooth', 50 + i * 20, i * 0.45, 0.4, 0.22 * vol, 90 + i * 40, 500); burst(0.25, 0.08, 'bandpass', 1200, 0.3 * vol, i * 0.45); } break;
      case 'crack': burst(0.5, 0.09, 'lowpass', 1800, vol); tone('sine', 110, 0, 0.4, 0.8 * vol, 40); break;
      case 'wind': {
        const s = noise(1.8, 0), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(300, now); bp.frequency.exponentialRampToValueAtTime(2200, now + 1.8);
        g.gain.value = 0.55 * vol; s.connect(bp).connect(g).connect(master); s.start(now);
        break;
      }
      case 'swing': {   // the chain screams through the air
        const s = noise(0.4, 0), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(500, now); bp.frequency.exponentialRampToValueAtTime(3200, now + 0.4);
        g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.9 * vol, now + 0.15); g.gain.linearRampToValueAtTime(0.0001, now + 0.4);
        s.connect(bp).connect(g).connect(master); s.start(now);
        tone('sawtooth', 160, 0, 0.4, 0.3 * vol, 320, 1800);
        break;
      }
      case 'hit': tone('sine', 120, 0, 0.35, vol, 30); burst(0.25, 0.04, 'lowpass', 1400, 0.9 * vol); burst(0.3, 0.05, 'bandpass', 2400, 0.5 * vol); break;
      case 'catch': tone('sawtooth', 200, 0, 1.2, 0.6 * vol, 40, 800); tone('square', 1400, 0, 0.5, 0.25 * vol, 300); break;
      default: break;
    }
  };

  // waking up: a heartbeat and a ringing in the ears
  api.wake = () => {
    if (!ctx) return;
    const now = ctx.currentTime, ring = ctx.createOscillator(), rg = ctx.createGain();
    ring.frequency.value = 2900;
    rg.gain.setValueAtTime(0.0001, now); rg.gain.linearRampToValueAtTime(0.03, now + 0.6); rg.gain.exponentialRampToValueAtTime(0.0001, now + 6.5);
    ring.connect(rg).connect(master); ring.start(now); ring.stop(now + 6.6);
    let at = 0.5, gap = 1.0;
    while (at < 8.0) {
      for (const [d, amp] of [[0, 0.5], [0.22, 0.34]]) tone('sine', 70, at + d, 0.2, amp, 38);
      at += gap; gap = Math.max(0.62, gap - 0.04);
    }
  };

  // sounds for the three endings
  api.finale = kind => {
    if (!ctx) return;
    if (kind === 'front') {         // a warm chord swelling in, and birds
      [220, 277.2, 329.6, 440].forEach((f, i) => tone('sine', f, 0.2 + i * 0.25, 4.2, 0.07));
      for (let i = 0; i < 9; i++) { const t0 = 1.0 + i * 0.32 + Math.random() * 0.2, f = 3000 + Math.random() * 1600; tone('sine', f, t0, 0.09, 0.05, f * (1.3 + Math.random() * 0.4)); tone('sine', f * 1.2, t0 + 0.11, 0.08, 0.04, f * 0.9); }
    } else if (kind === 'hatch') {  // the hot wind of the open field, and cicadas
      api.entity('wind', 0.6);
      for (let i = 0; i < 28; i++) tone('sine', 4300, 1.6 + i * 0.12, 0.05, 0.022);
    } else {                        // the horn, a moment after the engine catches
      tone('square', 392, 2.5, 0.45, 0.12); tone('square', 494, 2.5, 0.45, 0.12);
    }
  };
  return api;
}
