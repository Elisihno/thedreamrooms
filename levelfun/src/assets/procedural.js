// Procedural placeholder textures (canvas). Used until real image files are listed in manifest.js.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function speckle(ctx, s, r, n, a) {
  for (let i = 0; i < n; i++) {
    const v = r() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${r() * a})`;
    ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
}
function grunge(ctx, s, r, n, a) {
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, rad = s * (0.03 + r() * 0.12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(30,20,10,${a * (0.3 + r() * 0.7)})`); g.addColorStop(1, 'rgba(30,20,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

const STYLES = {
  cloth(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(120,110,95,0.10)'; ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke(); }
    const cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'];
    for (let i = 0; i < 22; i++) { ctx.fillStyle = cols[i % 5]; ctx.globalAlpha = 0.35; ctx.fillRect(r() * s, r() * s, 6, 3); }
    ctx.globalAlpha = 1; grunge(ctx, s, r, 10, 0.12); speckle(ctx, s, r, s * 4, 0.12);
  },
  wallpaper(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    const w = s / 8;
    for (let i = 0; i < 8; i += 2) { ctx.fillStyle = p.alt; ctx.globalAlpha = 0.55; ctx.fillRect(i * w, 0, w, s); }
    ctx.globalAlpha = 1;
    const cols = ['#b0463c', '#3c6fb0', '#c9a23c', '#3c9a64'];
    for (let i = 0; i < 40; i++) { ctx.fillStyle = cols[i % 4]; ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(r() * s, r() * s, 3 + r() * 5, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1; grunge(ctx, s, r, 28, 0.22); speckle(ctx, s, r, s * 6, 0.2);
  },
  ceiling(ctx, s, r) {
    ctx.fillStyle = '#9a968a'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(40,36,30,0.7)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s / 2, 0); ctx.lineTo(i * s / 2, s); ctx.moveTo(0, i * s / 2); ctx.lineTo(s, i * s / 2); ctx.stroke(); }
    grunge(ctx, s, r, 22, 0.3); speckle(ctx, s, r, s * 10, 0.25);
  },
  carpet(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    const cols = ['#d94a3a', '#e8c23a', '#3aa86a', '#3a8ad9'];
    ctx.lineWidth = 3;
    for (let i = 0; i < 34; i++) { ctx.strokeStyle = cols[i % 4]; ctx.globalAlpha = 0.55; ctx.beginPath(); const x = r() * s, y = r() * s; ctx.moveTo(x, y); ctx.lineTo(x + 18 * (r() - 0.5), y + 18 * (r() - 0.5)); ctx.lineTo(x + 22 * (r() - 0.5), y + 22 * (r() - 0.5)); ctx.stroke(); }
    ctx.globalAlpha = 1; speckle(ctx, s, r, s * 40, 0.35); grunge(ctx, s, r, 18, 0.25);
  },
  padding(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, s - 4, s - 4);
    ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
    grunge(ctx, s, r, 20, 0.28); speckle(ctx, s, r, s * 8, 0.2);
  },
  concrete(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    grunge(ctx, s, r, 40, 0.25); speckle(ctx, s, r, s * 40, 0.3);
  },
  tile(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(50,45,38,0.6)'; ctx.lineWidth = 2;
    const n = 4, t = s / n;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, s); ctx.moveTo(0, i * t); ctx.lineTo(s, i * t); ctx.stroke(); }
    grunge(ctx, s, r, 30, 0.3); speckle(ctx, s, r, s * 12, 0.25);
  },
  metal(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(110,50,20,' + r() * 0.25 + ')'; ctx.beginPath(); ctx.arc(r() * s, r() * s, 4 + r() * 18, 0, 7); ctx.fill(); }
    grunge(ctx, s, r, 18, 0.25); speckle(ctx, s, r, s * 20, 0.3);
  },
  wood(ctx, s, r, p) {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { ctx.strokeStyle = `rgba(20,10,0,${0.05 + r() * 0.15})`; ctx.lineWidth = 1 + r() * 2; const y = r() * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(s * .3, y + (r() - .5) * 8, s * .7, y + (r() - .5) * 8, s, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke(); }
    grunge(ctx, s, r, 16, 0.25);
  },
};

export function proceduralCanvas(key, spec, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(hash(key));
  (STYLES[spec.style] || STYLES.concrete)(ctx, size, r, spec);
  return c;
}
