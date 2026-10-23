import * as THREE from '../vendor/three.module.min.js';

// Every surface in the farmhouse is painted on a canvas when the game loads, so the whole game
// is just code: no image files to download. Each painter gets a seeded random so a texture
// looks the same on every load.

const S = 256;
const rngOf = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const canvas = (w = S, h = S) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function toTexture(cv, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  // mirrored tiling hides the seams, since the painted tiles are not seamless
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// grime that every old surface gets: speckle, water stains running down from the top, and dark corners
function age(g, rnd, { stains = 5, speckle = 900, damp = 0.25, w = S, h = S } = {}) {
  for (let i = 0; i < speckle; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.03 + rnd() * 0.07})` : `rgba(255,245,220,${0.03 + rnd() * 0.06})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < stains; i++) {
    const x = rnd() * w, len = h * (0.25 + rnd() * 0.7), sw = 6 + rnd() * 26;
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, `rgba(70,45,20,${damp * (0.5 + rnd() * 0.6)})`);
    grad.addColorStop(1, 'rgba(70,45,20,0)');
    g.fillStyle = grad;
    g.fillRect(x - sw / 2, 0, sw, len);
  }
}

function wallpaper(seed, base, ink, kind) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  if (kind === 'flowers') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + (y % 2 ? 32 : 0) + 16, cy = y * 64 + 32;
      g.fillStyle = ink;
      for (let p = 0; p < 6; p++) { const a = p * Math.PI / 3; g.beginPath(); g.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, 3.5, a, 0, 7); g.fill(); }
      g.fillStyle = '#d9b64a'; g.beginPath(); g.arc(cx, cy, 3.2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(80,110,60,.55)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, cy + 10); g.quadraticCurveTo(cx + 8, cy + 28, cx + 2, cy + 40); g.stroke();
    }
  } else {   // stripes
    for (let x = 0; x < S; x += 32) { g.fillStyle = ink; g.fillRect(x, 0, 11, S); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 11, 0, 2, S); }
  }
  age(g, rnd, { stains: 7, damp: 0.34 });
  return toTexture(cv);
}

function boards(seed, colors, { vertical = false, count = 6, gap = 'rgba(20,12,6,.75)', grain = 0.18, wear = 0.4 } = {}) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  const step = S / count;
  for (let i = 0; i < count; i++) {
    g.save();
    if (vertical) g.transform(0, 1, 1, 0, 0, 0);   // draw as horizontal boards, then flip into columns
    const y0 = i * step, c = colors[Math.floor(rnd() * colors.length)];
    g.fillStyle = c; g.fillRect(0, y0, S, step);
    for (let k = 0; k < 26; k++) {   // grain
      const y = y0 + rnd() * step, x0 = rnd() * S, len = 40 + rnd() * 160;
      g.strokeStyle = rnd() < 0.55 ? `rgba(40,22,8,${grain * (0.4 + rnd())})` : `rgba(255,235,190,${grain * 0.6 * rnd()})`;
      g.lineWidth = 0.6 + rnd();
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + (rnd() - 0.5) * 3); g.stroke();
    }
    if (rnd() < 0.5) {   // a knot
      const kx = rnd() * S, ky = y0 + step / 2, r = 3 + rnd() * 4;
      const kg = g.createRadialGradient(kx, ky, 0.5, kx, ky, r * 2);
      kg.addColorStop(0, 'rgba(40,20,6,.85)'); kg.addColorStop(1, 'rgba(40,20,6,0)');
      g.fillStyle = kg; g.beginPath(); g.ellipse(kx, ky, r * 2.2, r, 0, 0, 7); g.fill();
    }
    g.fillStyle = gap; g.fillRect(0, y0, S, 1.6);   // seam
    g.fillStyle = 'rgba(0,0,0,.35)';   // nails
    for (const nx of [14, S - 14]) { g.beginPath(); g.arc(nx, y0 + step / 2, 1.4, 0, 7); g.fill(); }
    g.restore();
  }
  age(g, rnd, { stains: 4, damp: wear, speckle: 1200 });
  return toTexture(cv);
}

function linoleum(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? '#d8d0b4' : '#6e8068';
    g.fillRect(x * 32, y * 32, 32, 32);
  }
  for (let i = 0; i < 40; i++) {   // scuffs
    g.strokeStyle = `rgba(60,40,20,${0.08 + rnd() * 0.16})`; g.lineWidth = 1 + rnd() * 2;
    const x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40); g.stroke();
  }
  age(g, rnd, { stains: 2, damp: 0.3, speckle: 1600 });
  return toTexture(cv);
}

function concrete(seed, tone = 120) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  g.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { const v = tone - 30 + rnd() * 60; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.strokeStyle = 'rgba(25,22,18,.7)'; g.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {   // cracks
    let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 9; s++) { x += (rnd() - 0.5) * 36; y += 8 + rnd() * 22; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 6; i++) {   // damp patches and dark mould
    const x = rnd() * S, y = rnd() * S, r = 16 + rnd() * 34;
    const dg = g.createRadialGradient(x, y, 2, x, y, r);
    dg.addColorStop(0, rnd() < 0.5 ? 'rgba(40,50,30,.4)' : 'rgba(20,18,14,.35)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = dg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return toTexture(cv);
}

// the old stained plaster, with something dragged across it
function bloodWall(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  g.fillStyle = '#c9bfa6'; g.fillRect(0, 0, S, S);
  age(g, rnd, { stains: 9, damp: 0.4, speckle: 1500 });
  g.lineCap = 'round';
  for (let k = 0; k < 4; k++) {   // long smears
    const x = 30 + rnd() * 190; g.strokeStyle = `rgba(${95 + rnd() * 30},8,8,${0.55 + rnd() * 0.3})`; g.lineWidth = 6 + rnd() * 12;
    g.beginPath(); g.moveTo(x, 0 + rnd() * 40); g.quadraticCurveTo(x + (rnd() - 0.5) * 60, 130, x + (rnd() - 0.5) * 30, 150 + rnd() * 100); g.stroke();
  }
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(110,6,6,${0.4 + rnd() * 0.4})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 4, 0, 7); g.fill(); }
  return toTexture(cv);
}

function barn(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  const reds = ['#7a2f22', '#6d281d', '#843426', '#74301f'];
  for (let i = 0; i < 8; i++) {
    g.fillStyle = reds[Math.floor(rnd() * reds.length)]; g.fillRect(i * 32, 0, 32, S);
    for (let k = 0; k < 24; k++) { g.strokeStyle = `rgba(20,6,2,${0.1 + rnd() * 0.2})`; g.lineWidth = 0.8; const x = i * 32 + rnd() * 30, y = rnd() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y + 20 + rnd() * 100); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(i * 32, 0, 1.6, S);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(230,200,160,${0.04 + rnd() * 0.1})`; g.fillRect(rnd() * S, rnd() * S, 2, 6 + rnd() * 20); }   // sun-bleached flecks
  age(g, rnd, { stains: 3, damp: 0.3 });
  return toTexture(cv);
}

// weathered white clapboard for the outside of the house
function clapboard(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const y = i * 32, grad = g.createLinearGradient(0, y, 0, y + 32);
    grad.addColorStop(0, '#d9d2bf'); grad.addColorStop(0.85, '#c9c1ab'); grad.addColorStop(1, '#8a826c');
    g.fillStyle = grad; g.fillRect(0, y, S, 32);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 30, S, 2);
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(110,95,70,${0.06 + rnd() * 0.12})`; g.fillRect(rnd() * S, rnd() * S, 4 + rnd() * 30, 1 + rnd() * 2); }   // peeled paint
  age(g, rnd, { stains: 6, damp: 0.3, speckle: 1000 });
  return toTexture(cv);
}

function rug(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  g.fillStyle = '#7a2c24'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#d6b45a'; g.lineWidth = 6; g.strokeRect(14, 14, S - 28, S - 28);
  g.strokeStyle = '#2a3a58'; g.lineWidth = 10; g.strokeRect(34, 34, S - 68, S - 68);
  g.fillStyle = '#d6b45a';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.save(); g.translate(64 + i * 42, 64 + j * 42); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`; g.fillRect(rnd() * S, rnd() * S, 1, 2); }
  age(g, rnd, { stains: 2, damp: 0.3 });
  return toTexture(cv);
}

function hay(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  g.fillStyle = '#9d8650'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 8 + rnd() * 26;
    g.strokeStyle = rnd() < 0.5 ? `rgba(230,200,110,${0.3 + rnd() * 0.4})` : `rgba(90,66,26,${0.2 + rnd() * 0.3})`;
    g.lineWidth = 0.8 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return toTexture(cv);
}

function dirt(seed) {
  const rnd = rngOf(seed), cv = canvas(), g = cv.getContext('2d');
  g.fillStyle = '#b79a68'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 6000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(90,66,36,${rnd() * 0.25})` : `rgba(240,215,160,${rnd() * 0.22})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1 + rnd() * 3); }
  for (let i = 0; i < 90; i++) {   // dry grass tufts
    const x = rnd() * S, y = rnd() * S;
    g.strokeStyle = `rgba(${150 + rnd() * 50},${130 + rnd() * 40},60,${0.5 + rnd() * 0.4})`; g.lineWidth = 1;
    for (let b = 0; b < 4; b++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 10, y - 5 - rnd() * 9); g.stroke(); }
  }
  return toTexture(cv, { repeat: true });
}

// A window: glass you can see through (the sun-bleached farm lies outside), a sash frame, and curtains
function windowTex(seed, curtain) {
  const rnd = rngOf(seed), W = 128, H = 218, cv = canvas(W, H), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,248,215,.13)'; g.fillRect(0, 0, W, H);                              // dusty glass
  const gl = g.createLinearGradient(0, 0, W, H); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(0.6, 'rgba(255,255,255,.12)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(120,100,70,${0.04 + rnd() * 0.08})`; g.beginPath(); g.arc(rnd() * W, rnd() * H, 2 + rnd() * 9, 0, 7); g.fill(); }   // smudges
  g.fillStyle = '#e9e1cd'; g.strokeStyle = 'rgba(60,45,25,.6)'; g.lineWidth = 1.2;           // frame and mullions
  for (const r of [[0, 0, W, 9], [0, H - 12, W, 12], [0, 0, 9, H], [W - 9, 0, 9, H], [0, H * 0.46, W, 7], [W / 2 - 3.5, 0, 7, H]]) { g.fillRect(...r); g.strokeRect(...r); }
  if (curtain) {   // gingham curtains tied back at the sides
    for (const side of [0, 1]) {
      const x0 = side ? W - 34 : 0;
      g.save(); g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 34, 0);
      g.lineTo(x0 + (side ? 18 : 16), H * 0.55); g.lineTo(x0 + (side ? 30 : 4), H); g.lineTo(x0, H); g.closePath(); g.clip();
      g.fillStyle = curtain; g.fillRect(x0, 0, 34, H);
      g.fillStyle = 'rgba(255,255,255,.4)';
      for (let y = 0; y < H; y += 12) g.fillRect(x0, y, 34, 6);
      for (let x = 0; x < 34; x += 12) g.fillRect(x0 + x, 0, 6, H);
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the cellar's only light: a small, dirty pane, and the sun hitting it is blinding
function glareTex() {
  const cv = canvas(128, 218), g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 109, 4, 64, 109, 120);
  grd.addColorStop(0, '#fffbe6'); grd.addColorStop(1, '#f1d98e');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 218);
  g.fillStyle = '#3a2c1a'; for (const r of [[0, 0, 128, 10], [0, 208, 128, 10], [0, 0, 10, 218], [118, 0, 10, 218], [60, 0, 8, 218]]) g.fillRect(...r);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function doorTex(seed) {
  const rnd = rngOf(seed), cv = canvas(128, 256), g = cv.getContext('2d');
  g.fillStyle = '#6a4a2c'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(30,16,6,${0.1 + rnd() * 0.2})`; g.lineWidth = 1; const x = rnd() * 128; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 4, 256); g.stroke(); }
  g.strokeStyle = 'rgba(20,10,4,.8)'; g.lineWidth = 4;
  g.strokeRect(14, 14, 100, 96); g.strokeRect(14, 130, 100, 112);
  g.fillStyle = 'rgba(255,230,180,.08)'; g.fillRect(14, 14, 100, 96); g.fillRect(14, 130, 100, 112);
  g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(104, 128, 6, 0, 7); g.fill();   // knob
  age(g, rnd, { stains: 3, damp: 0.3, w: 128, h: 256 });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function burlap(seed) {
  const rnd = rngOf(seed), cv = canvas(128, 128), g = cv.getContext('2d');
  g.fillStyle = '#b89a66'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 3) { g.strokeStyle = `rgba(90,62,28,${0.25 + rnd() * 0.25})`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + rnd()); g.lineTo(128, y + rnd()); g.stroke(); }
  for (let x = 0; x < 128; x += 3) { g.strokeStyle = `rgba(90,62,28,${0.2 + rnd() * 0.25})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + rnd(), 0); g.lineTo(x + rnd(), 128); g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(80,10,6,${0.15 + rnd() * 0.3})`; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a soft fade used by the sunbeams: strongest at the window and in the middle of the beam, fading to nothing along
// both edges and toward the floor, so a beam has no hard edge to show up against the ceiling and walls
function beamTex() {
  const W = 64, H = 128, cv = canvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const side = Math.pow(Math.sin(Math.PI * (x + 0.5) / W), 1.6), along = Math.pow(1 - y / H, 1.3) * Math.min(1, y / 6 + 0.35);
    const k = (y * W + x) * 4;
    img.data[k] = 255; img.data[k + 1] = 238; img.data[k + 2] = 178; img.data[k + 3] = Math.round(255 * side * along);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the patch of sun on the floor: the window's shape, with the shadow of its frame cut out of it
function patchTex() {
  const cv = canvas(64, 112), g = cv.getContext('2d');
  g.fillStyle = 'rgb(255,236,170)'; g.fillRect(2, 2, 60, 108);
  const edge = g.createLinearGradient(0, 0, 0, 112);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.7, 'rgba(0,0,0,.15)'); edge.addColorStop(1, 'rgba(0,0,0,.8)');
  g.fillStyle = edge; g.fillRect(0, 0, 64, 112);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 4); g.fillRect(0, 108, 64, 4); g.fillRect(0, 0, 4, 112); g.fillRect(60, 0, 4, 112);   // the frame
  g.fillRect(29, 0, 6, 112); g.fillRect(0, 52, 64, 5);                                                        // the mullions
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sunTex() {
  const cv = canvas(256, 256), g = cv.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,245,1)'); grd.addColorStop(0.12, 'rgba(255,252,225,1)'); grd.addColorStop(0.2, 'rgba(255,238,170,.55)'); grd.addColorStop(1, 'rgba(255,220,130,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mote() {
  const cv = canvas(32, 32), g = cv.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,248,215,1)'); grd.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wood(seed, tintless = true) {
  return boards(seed, ['#b8905e', '#a98150', '#c29a68', '#9d7646'], { count: 5, grain: 0.22, wear: 0.25 });
}

// ---- the postcard that carries the front door code ---------------------------------------------------
export function postcardCanvas(code) {
  const cv = canvas(320, 220), g = cv.getContext('2d');
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 320, 220);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(6, 6, 308, 208);
  g.strokeStyle = 'rgba(60,40,20,.5)'; g.beginPath(); g.moveTo(166, 20); g.lineTo(166, 200); g.stroke();   // the split down the middle
  // the picture side: a sun over a barn
  const sky = g.createLinearGradient(0, 14, 0, 110); sky.addColorStop(0, '#6fb3e8'); sky.addColorStop(1, '#f6e7b0');
  g.fillStyle = sky; g.fillRect(16, 16, 140, 100);
  g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(120, 46, 17, 0, 7); g.fill();
  g.fillStyle = '#c8a45a'; g.fillRect(16, 100, 140, 16);
  g.fillStyle = '#9a2f20'; g.fillRect(40, 70, 46, 32); g.beginPath(); g.moveTo(36, 72); g.lineTo(63, 52); g.lineTo(90, 72); g.fill();
  g.font = 'italic 700 17px Georgia, serif'; g.fillStyle = '#9a2f20'; g.textAlign = 'center';
  g.fillText('Greetings from', 86, 140); g.font = 'italic 700 24px Georgia, serif'; g.fillStyle = '#d28a14'; g.fillText('SUNSHINE', 86, 168);
  g.font = 'italic 14px Georgia, serif'; g.fillStyle = '#5a3a20'; g.fillText('Texas', 86, 188);
  // the writing side
  g.save(); g.translate(240, 100); g.rotate(-0.04);
  g.fillStyle = '#2b2a3a'; g.font = 'italic 17px "Segoe Print", "Bradley Hand", cursive, Georgia';
  g.fillText('Grandpa says the', 0, -48); g.fillText('front door code is', 0, -26);
  g.font = 'bold 40px "Segoe Print", "Bradley Hand", cursive, Georgia'; g.fillStyle = '#7a0f0f';
  g.fillText(code.split('').join(' '), 0, 24);
  g.font = 'italic 14px "Segoe Print", "Bradley Hand", cursive, Georgia'; g.fillStyle = '#2b2a3a';
  g.fillText('Do NOT go in the cellar.', 0, 56);
  g.restore();
  g.fillStyle = 'rgba(120,80,30,.25)'; g.fillRect(262, 18, 40, 46);   // stamp
  g.fillStyle = 'rgba(110,10,10,.45)'; g.beginPath(); g.arc(80, 180, 12, 0, 7); g.arc(94, 188, 5, 0, 7); g.fill();   // a thumbprint in something red
  return cv;
}

// The wallpapers and plaster are photographs, cut from one contact sheet into assets/textures/wall_01..10.jpg.
// They are tall and narrow, so they repeat about 1.3 m across and once up a 3 m wall.
const photoLoader = new THREE.TextureLoader();
function photo(n, rx = 3 / 1.29, ry = 1) {
  const t = photoLoader.load(`assets/textures/wall_${String(n).padStart(2, '0')}.jpg`);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;   // mirrored, so the seams between repeats do not show
  t.anisotropy = 4;
  t.repeat.set(rx, ry);
  return t;
}

// Every floor in the house is Dread's brown plank floor (floor_02). It is the same size as there (a tile covers
// 2.5 x 4.2 m), so the boards run along the length of the room.
function plankFloor() {
  const t = photoLoader.load('assets/textures/floor_wood.jpg');
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(3 / 2.5, 3 / 4.2);
  return t;
}

export function makeTextures() {
  const planks = plankFloor();
  const t = {
    wall: [
      photo(10),                                               // 0 old beige floral wallpaper
      photo(2),                                                // 1 white painted boards, peeling
      photo(3),                                                // 2 brown floral wallpaper
      photo(1),                                                // 3 cracked, stained plaster
      barn(15),                                                // 4 red barn boards
      photo(4),                                                // 5 damp, dark cellar plaster
      photo(6),                                                // 6 plaster with something dragged across it
      photo(8),                                                // 7 plaster crumbling off the brick
      photo(7),                                                // 8 dark green boards
      photo(9),                                                // 9 dark wood boards
    ],
    floor: [planks, planks, planks, planks, planks, planks, planks],   // the same boards in every room, so the room looks (a little) different only by its walls
    ceiling: boards(31, ['#d9cfb4', '#cfc4a6'], { count: 3, grain: 0.08, wear: 0.08 }),   // barely stained: hard-edged stains on a ceiling shimmer as you move
    outside: clapboard(41),
    wood: wood(51),
    dirt: dirt(61),
    door: doorTex(71),
    windowOpen: [windowTex(81, '#cf5a4a'), windowTex(82, '#e7d27a'), windowTex(83, null), windowTex(84, '#6a8cc0')],
    windowGlare: glareTex(),
    burlap: burlap(91),
    beam: beamTex(),
    patch: patchTex(),
    sun: sunTex(),
    mote: mote(),
  };
  t.ceiling.repeat?.set?.(1, 1);
  return t;
}
