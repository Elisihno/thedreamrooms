// The waking-up intro at the start of a run: eyelids open, the blur clears, and you sit up.
export const WAKE = 5.2; // seconds

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// Smoothly interpolate between [time, value] keyframes.
function keys(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return frames[frames.length - 1][1];
}

// lid: 1 = eyes shut, 0 = wide open (a slow blink or two on the way).  blur in px.
// eye: camera height (lying down -> standing).  pitch: looking up at the ceiling -> straight ahead.
export function wakeState(t) {
  const p = Math.min(1, t / WAKE);
  return {
    lid: keys([[0, 1], [0.7, 1], [1.4, 0.6], [1.9, 0.96], [2.5, 0.96], [3.2, 0.28], [3.6, 0.42], [4.3, 0], [WAKE, 0]], t),
    blur: keys([[0, 20], [2.2, 15], [3.4, 9], [4.7, 0], [WAKE, 0]], t),
    eye: keys([[0, 0.3], [1.8, 0.34], [3.6, 0.95], [WAKE, 1.6]], t),
    pitch: keys([[0, 1.05], [2.6, 0.9], [WAKE, 0]], t),
    roll: Math.sin(t * 1.7) * 0.07 * (1 - p),
  };
}
