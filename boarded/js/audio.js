// All sound is synthesised, so the game needs no audio files.
export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  let heartT = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ambient();
  }

  function out(pan) {
    if (!ctx.createStereoPanner) return master;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    p.connect(master);
    return p;
  }

  function ambient() {
    // low drone
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 46;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120;
    g.gain.value = 0.05;
    o.connect(lp); lp.connect(g); g.connect(master); o.start();
    // wind
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(wg.gain); lfo.start();
    n.connect(bp); bp.connect(wg); wg.connect(master); n.start();
  }

  function burst({ freq = 800, q = 1, type = 'bandpass', dur = 0.15, gain = 0.5, pan = 0, sweep = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out(pan));
    s.start(t, Math.random(), dur + 0.05);
  }

  function thump({ freq = 90, dur = 0.25, gain = 0.6, pan = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(25, freq * 0.4), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out(pan));
    o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    init,
    knock(pan, v = 1) { thump({ freq: 140, dur: 0.16, gain: 0.7 * v, pan }); burst({ freq: 700, dur: 0.07, gain: 0.35 * v, pan }); },
    pound(pan, v = 1) { thump({ freq: 70, dur: 0.3, gain: 0.95 * v, pan }); burst({ freq: 300, dur: 0.18, gain: 0.5 * v, pan }); },
    scratch(pan, v = 1) { burst({ freq: 2600, q: 3, dur: 0.5, gain: 0.22 * v, pan, sweep: 0.5 }); },
    hammer(pan = 0, v = 1) { thump({ freq: 180, dur: 0.1, gain: 0.5 * v, pan }); burst({ freq: 3200, q: 4, dur: 0.06, gain: 0.35 * v, pan }); },
    crack(pan, v = 1) { burst({ freq: 1500, q: 1.5, dur: 0.28, gain: 0.8 * v, pan, sweep: 0.3 }); thump({ freq: 110, dur: 0.2, gain: 0.5 * v, pan }); },
    smash(pan, v = 1) { burst({ freq: 2200, q: 0.8, dur: 0.7, gain: 0.9 * v, pan, sweep: 0.2 }); thump({ freq: 60, dur: 0.5, gain: 1 * v, pan }); },
    pickup() { burst({ freq: 900, q: 2, dur: 0.09, gain: 0.25 }); },
    step(pan, v = 1) { thump({ freq: 75, dur: 0.12, gain: 0.35 * v, pan }); burst({ freq: 500, dur: 0.08, gain: 0.12 * v, pan }); },
    creak(pan = 0, v = 1) { burst({ freq: 380, q: 9, dur: 0.9, gain: 0.18 * v, pan, sweep: 1.8 }); },
    scare() { burst({ freq: 3000, q: 0.6, dur: 1.2, gain: 0.9, sweep: 0.15 }); thump({ freq: 55, dur: 1, gain: 1 }); },
    win() { thump({ freq: 300, dur: 1.4, gain: 0.25 }); burst({ freq: 5000, q: 1, dur: 1, gain: 0.08, type: 'highpass' }); },
    heart(dt, rate) {
      // rate in beats/s; 0 = silent
      if (!ctx || rate <= 0) { heartT = 0; return; }
      heartT -= dt;
      if (heartT <= 0) {
        heartT = 1 / rate;
        thump({ freq: 60, dur: 0.14, gain: 0.55 });
        setTimeout(() => thump({ freq: 52, dur: 0.12, gain: 0.35 }), 140);
      }
    },
  };
}
