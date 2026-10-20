import * as THREE from '../vendor/three.module.min.js';
import { appleSkinCanvas } from './apple.js';
import { spiralCanvas } from './vase.js';

// Inventory icons, drawn on small canvases and returned as data URLs.

function make(draw, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  return cv.toDataURL('image/png');
}

function apple(g) {
  // the lopsided apple outline, filled with the painted skin
  g.save();
  g.beginPath();
  g.moveTo(62, 40);
  g.bezierCurveTo(36, 22, 8, 46, 18, 84);
  g.bezierCurveTo(26, 116, 54, 120, 64, 108);
  g.bezierCurveTo(78, 122, 104, 112, 110, 82);
  g.bezierCurveTo(118, 48, 92, 24, 62, 40);
  g.closePath();
  g.clip();
  g.drawImage(appleSkinCanvas().color, 0, 0, 256, 256, 0, 6, 128, 128);
  const shade = g.createRadialGradient(46, 62, 6, 64, 78, 62);
  shade.addColorStop(0, 'rgba(255,255,255,.12)'); shade.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = shade; g.fillRect(0, 0, 128, 128);
  g.restore();
  g.strokeStyle = '#3e2a1a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(62, 40); g.quadraticCurveTo(66, 22, 80, 14); g.stroke();
  g.fillStyle = '#5b4a22'; g.beginPath(); g.ellipse(86, 26, 14, 5, -0.5, 0, 7); g.fill();
}

function knife(g) {
  g.translate(64, 64); g.rotate(-Math.PI / 4);
  const blade = g.createLinearGradient(0, -14, 0, 14);
  blade.addColorStop(0, '#f2f4f6'); blade.addColorStop(0.5, '#aab0b6'); blade.addColorStop(1, '#6d7379');
  g.fillStyle = blade;
  g.beginPath(); g.moveTo(-6, -12); g.lineTo(52, -12); g.quadraticCurveTo(66, -2, 56, 4); g.quadraticCurveTo(20, 14, -6, 12); g.closePath(); g.fill();
  g.fillStyle = '#7b8086'; g.fillRect(-10, -13, 6, 26);
  g.fillStyle = '#3a2416';
  g.beginPath(); g.roundRect(-58, -11, 50, 22, 6); g.fill();
  g.fillStyle = '#c9b377';
  for (const x of [-48, -30, -16]) { g.beginPath(); g.arc(x, 0, 2.6, 0, 7); g.fill(); }
}

function shotgun(g) {
  g.translate(64, 64); g.rotate(-0.35);
  g.fillStyle = '#2d3237'; g.fillRect(-10, -9, 78, 7);       // barrel
  g.fillStyle = '#4b5258'; g.fillRect(-4, -1, 58, 5);        // magazine tube
  g.fillStyle = '#6a4325'; g.fillRect(14, 0, 24, 8);         // pump
  g.fillStyle = '#1c2023'; g.fillRect(-30, -11, 26, 14);     // receiver
  g.fillStyle = '#6a4325';                                   // stock
  g.beginPath(); g.moveTo(-30, -9); g.lineTo(-72, -3); g.lineTo(-76, 18); g.lineTo(-56, 14); g.lineTo(-30, 4); g.closePath(); g.fill();
  g.strokeStyle = '#1c2023'; g.lineWidth = 2; g.beginPath(); g.arc(-18, 8, 6, 0, Math.PI); g.stroke();
}

function shells(g) {
  const shell = (x, y) => {
    g.save(); g.translate(x, y); g.rotate(-0.25);
    g.fillStyle = '#c8321f'; g.fillRect(-9, -34, 18, 48);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-6, -34, 4, 48);
    g.fillStyle = '#b89a32'; g.fillRect(-9, 14, 18, 16);
    g.fillStyle = '#7e6a1e'; g.fillRect(-9, 14, 18, 3); g.beginPath(); g.arc(0, 24, 3, 0, 7); g.fill();
    g.restore();
  };
  shell(36, 64); shell(64, 62); shell(92, 66);
}

function battery(g) {
  g.fillStyle = '#2a3035'; g.fillRect(22, 48, 84, 52);
  g.fillStyle = '#3a5aa0'; g.fillRect(20, 40, 88, 14);
  g.fillStyle = '#b89a32'; g.fillRect(34, 28, 16, 14); g.fillRect(78, 28, 16, 14);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(22, 58, 84, 4);
  g.fillStyle = '#ddd'; g.font = 'bold 22px system-ui'; g.fillText('+', 30, 24); g.fillText('−', 82, 24);
}

function fuel(g) {
  g.fillStyle = '#c8321f'; g.fillRect(32, 40, 62, 66);
  g.fillStyle = '#8a1c10'; g.fillRect(32, 70, 62, 8);
  g.fillStyle = '#c8321f'; g.fillRect(50, 28, 30, 12);
  g.fillStyle = '#2a3035'; g.beginPath(); g.moveTo(40, 40); g.lineTo(34, 24); g.lineTo(46, 22); g.lineTo(50, 40); g.fill();
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(36, 44, 6, 56);
}

// ---- the crumpled paper ---------------------------------------------------------------------
// One height function drives both the 3D shape (crumpled, curled at the edges) and the texture
// (creases shaded in, so the picture reads as rough, worn paper). u runs left to right and v bottom
// to top over the sheet, both 0..1.
const FOLDS = (() => {
  let s = 21;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return Array.from({ length: 13 }, () => ({ x: r(), y: r(), a: r() * Math.PI, k: 0.5 + r() * 1.0, w: 0.018 + r() * 0.045, sign: r() < 0.5 ? -1 : 1 }));
})();
export function paperHeight(u, v) {
  let h = 0;
  for (const f of FOLDS) {   // creases: narrow ridges and valleys across the sheet
    const d = (u - f.x) * Math.cos(f.a) + (v - f.y) * Math.sin(f.a);
    h += f.sign * f.k * Math.exp(-(d * d) / (f.w * f.w));
  }
  h += 0.5 * Math.sin(u * 9 + v * 5) * Math.sin(v * 11 - u * 4) + 0.28 * Math.sin(u * 23 + 1) * Math.sin(v * 19 + 2);
  const e = Math.min(u, 1 - u, v, 1 - v);   // the edges curl
  h += 0.9 * Math.exp(-(e * e) / 0.004) * (0.5 + 0.5 * Math.sin(u * 6 + v * 3));
  return h;
}

export function crumpledPaperGeometry(w, hgt) {
  const geo = new THREE.PlaneGeometry(w, hgt, 22, 30);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, paperHeight(p.getX(i) / w + 0.5, p.getY(i) / hgt + 0.5) * 0.013);
  geo.computeVertexNormals();
  return geo;
}

// value noise for ragged, torn edges
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

// The paper with a smiley face and an arrow, drawn on a canvas (also used as its texture).
let paperCache = null;
export function paperCanvas(size = 256) {
  if (paperCache && paperCache.width === size) return paperCache;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = Math.round(size * 1.38);
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#e3dac2'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {            // yellowed, stained patches
    g.fillStyle = `rgba(${110 + (i % 4) * 12},${86 + (i % 3) * 10},${44},${0.03 + (i % 6) * 0.012})`;
    g.beginPath(); g.arc((i * 83) % W, (i * 137) % H, 6 + (i % 9) * 6, 0, 7); g.fill();
  }
  for (let i = 0; i < 3; i++) {             // a few dark stains with a ring
    const x = W * (0.2 + 0.3 * i), y = H * (0.15 + 0.32 * ((i * 2) % 3)), r = 14 + i * 9;
    const sg = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    sg.addColorStop(0, 'rgba(90,62,30,.35)'); sg.addColorStop(0.8, 'rgba(90,62,30,.18)'); sg.addColorStop(1, 'rgba(70,46,22,.0)');
    g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, r * 1.3, r, i, 0, 7); g.fill();
  }
  const cx = W / 2, cy = H * 0.34, r = W * 0.26;
  g.lineCap = 'round'; g.strokeStyle = '#1d1a14'; g.fillStyle = '#1d1a14';
  g.lineWidth = W * 0.036;
  g.beginPath(); g.arc(cx + 2, cy, r, 0.1, Math.PI * 2 + 0.05); g.stroke();                       // face, hand drawn
  g.beginPath(); g.arc(cx - r * 0.38, cy - r * 0.25, W * 0.026, 0, 7); g.fill();                    // eyes
  g.beginPath(); g.arc(cx + r * 0.38, cy - r * 0.22, W * 0.024, 0, 7); g.fill();
  g.beginPath(); g.arc(cx, cy + r * 0.05, r * 0.6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();   // smile
  g.lineWidth = W * 0.052;                                                                          // the arrow, pointing down
  g.beginPath(); g.moveTo(cx, H * 0.58); g.lineTo(cx + 3, H * 0.86); g.stroke();
  g.beginPath(); g.moveTo(cx - W * 0.16, H * 0.76); g.lineTo(cx + 2, H * 0.9); g.lineTo(cx + W * 0.16, H * 0.76); g.stroke();
  // worn, whitish scuffs along the creases
  g.strokeStyle = 'rgba(250,244,226,.5)'; g.lineWidth = 1.6;
  for (const f of FOLDS) {
    const px = f.x * W, py = (1 - f.y) * H, dx = -Math.sin(f.a), dy = Math.cos(f.a);
    g.beginPath(); g.moveTo(px - dx * W, py + dy * W * 0 - dy * W); g.lineTo(px + dx * W, py + dy * W); g.stroke();
  }
  // shade the creases, add grain, and rip the edges
  const img = g.getImageData(0, 0, W, H), d = img.data, eps = 0.004;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = px / (W - 1), v = 1 - py / (H - 1), k = (py * W + px) * 4;
    const dhu = paperHeight(u + eps, v) - paperHeight(u - eps, v), dhv = paperHeight(u, v + eps) - paperHeight(u, v - eps);
    const shade = Math.max(0.35, Math.min(1.35, 1 - (dhu * 0.55 - dhv * 0.55) * 2.4));       // light from the upper left
    const grain = 0.9 + 0.2 * hash(px, py) + 0.1 * (vnoise(px * 0.3, py * 0.3) - 0.5);
    const m = shade * grain;
    d[k] = Math.min(255, d[k] * m); d[k + 1] = Math.min(255, d[k + 1] * m); d[k + 2] = Math.min(255, d[k + 2] * m);
    const e = Math.min(u, 1 - u, v, 1 - v);       // torn, ragged edges and a ripped corner
    const rag = 0.006 + 0.03 * vnoise(u * 38, v * 52) + 0.015 * vnoise(u * 90, v * 120);
    let alpha = e > rag ? 255 : e > rag - 0.008 ? 120 : 0;
    if (u + v < 0.16 + 0.12 * vnoise(u * 20, v * 20)) alpha = 0;
    if ((1 - u) + (1 - v) < 0.1 + 0.1 * vnoise(u * 24 + 5, v * 24)) alpha = 0;
    d[k + 3] = alpha;
  }
  g.putImageData(img, 0, 0);
  paperCache = cv;
  return cv;
}

function flashlight(g) {
  g.translate(64, 64); g.rotate(-0.6);
  g.fillStyle = '#3a3f45'; g.fillRect(-48, -9, 64, 18);
  g.fillStyle = '#23272b'; for (const x of [-38, -28, -18]) g.fillRect(x, -9, 3, 18);
  g.fillStyle = '#8d949b'; g.beginPath(); g.moveTo(16, -9); g.lineTo(40, -17); g.lineTo(40, 17); g.lineTo(16, 9); g.closePath(); g.fill();
  g.fillStyle = '#fff0b0'; g.fillRect(40, -15, 5, 30);
  g.fillStyle = '#c8321f'; g.fillRect(-20, -13, 8, 4);
}

function vaseIcon(g) {
  // the bottle silhouette filled with the spiral texture, with a bright highlight down one side
  g.save();
  g.beginPath();
  g.moveTo(48, 6); g.lineTo(80, 6); g.bezierCurveTo(84, 22, 68, 32, 80, 46);
  g.bezierCurveTo(118, 64, 112, 112, 64, 122); g.bezierCurveTo(16, 112, 10, 64, 48, 46);
  g.bezierCurveTo(60, 32, 44, 22, 48, 6); g.closePath(); g.clip();
  g.drawImage(spiralCanvas(), 0, 0, 256, 512, 10, 4, 108, 122);   // half the texture: three bold stripes
  const sh = g.createLinearGradient(14, 0, 114, 0);
  sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(0.28, 'rgba(255,255,255,.3)'); sh.addColorStop(0.42, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.4)');
  g.fillStyle = sh; g.fillRect(0, 0, 128, 128);
  g.restore();
}

export const icons = {
  vase: make(vaseIcon),
  paper: make(g => { g.drawImage(paperCanvas(256), 0, 0, 256, 353, 24, 4, 80, 110); }),
  flashlight: make(flashlight),
  battery: make(battery),
  fuel: make(fuel),
  apple: make(apple),
  knife: make(knife),
  shotgun: make(shotgun),
  shells: make(shells),
};
