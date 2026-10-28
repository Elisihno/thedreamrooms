import * as THREE from '../three.js';
import { instanceModel } from '../assets/models.js';
import { LEVEL_Y } from './layout.js';

// Party dressing: white-clothed long tables, folding chairs, place settings, cake, balloon bunches,
// confetti and bunting. Everything repeated is instanced, so a whole room costs a handful of draw calls.
const PARTY = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xff7eb6, 0xff8c1a, 0x1abc9c];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function instanced(parent, geo, mat, items, { cast = true, receive = true, optional = null } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z);
    o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    o.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (it.color !== undefined) m.setColorAt(i, c.set(it.color));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = cast; m.receiveShadow = receive;
  m.computeBoundingSphere();
  if (optional) { m.userData.optional = true; optional.push(m); }
  parent.add(m);
  return m;
}
export { instanced };

function bannerTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#d8d2c4'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 6); x.quadraticCurveTo(512, 40, 1024, 6); x.stroke();
  const n = text.length, w = 1024 / n;
  for (let i = 0; i < n; i++) {
    const cx = i * w + w / 2, sag = 6 + 34 * Math.sin(Math.PI * (i + 0.5) / n);
    x.fillStyle = '#' + PARTY[i % PARTY.length].toString(16).padStart(6, '0');
    x.beginPath(); x.moveTo(cx - w * 0.42, sag); x.lineTo(cx + w * 0.42, sag); x.lineTo(cx, sag + 84); x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center';
    x.fillText(text[i], cx, sag + 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Paper party plate (built in code): dished lathe with a printed rim, tinted per instance.
function plateGeometry() {
  const pts = [[0, 0], [0.075, 0.0], [0.098, 0.006], [0.118, 0.02], [0.122, 0.024], [0.119, 0.026], [0.098, 0.011], [0.0, 0.004]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 28);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.244 + 0.5, p.getZ(i) / 0.244 + 0.5);
  g.computeVertexNormals();
  return g;
}
function plateTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f6f3ea'; x.fillRect(0, 0, 256, 256);
  const cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'];
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; x.fillStyle = cols[i % 5]; x.beginPath(); x.arc(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100, 8, 0, 7); x.fill(); }
  x.strokeStyle = '#d9c9a0'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 78, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let plateGeo, plateMat;

const TABLE = { halfW: 0.75, top: 0.95 };

// tables: [{x, z, len (model stretch, default 1.5 = 3.3 m), cake}]; bounds: room rect; avoid: rects kept clear.
export function partySet(w, level, { tables, bounds, avoid = [], ceilingBalloons = 20, bunting = false, seed = 7, confetti = 600, tableScale = 1 }) {
  const parent = w.group(level), y0 = LEVEL_Y[level], r = rng(seed);
  const top = TABLE.top * tableScale;   // table-top height; underside is 0.1 m lower
  const hit = (x, z, m = 0.9) => avoid.some(a => x > a[0] - m && x < a[2] + m && z > a[1] - m && z < a[3] + m);
  const chairs = [], cups = [], hats = [], plates = [], tableP = [];
  const TINT = [0xffffff, 0xffe3ef, 0xe3f0ff, 0xfff6c9];
  for (const t of tables) {
    const sz = t.len ?? 1.5, half = 1.1 * sz;
    tableP.push({ x: t.x, y: y0, z: t.z, ry: Math.PI / 2, sz, sy: tableScale });
    w.collision.add(t.x - half, t.z - TABLE.halfW, t.x + half, t.z + TABLE.halfW, y0 + top - 0.1, y0 + top);
    const n = Math.max(2, Math.floor(half * 2 / 0.85));
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const cx = t.x + (i - (n - 1) / 2) * 0.85, cz = t.z + s * 1.0;
      chairs.push({ x: cx, y: y0, z: cz, ry: s < 0 ? -Math.PI / 2 : Math.PI / 2 });
      w.collision.add(cx - 0.27, cz - 0.31, cx + 0.27, cz + 0.31, y0, y0 + 0.9);
      plates.push({ x: cx, y: y0 + top + 0.002, z: t.z + s * 0.45, color: TINT[Math.floor(r() * 4)] });
      cups.push({ x: cx + 0.24, y: y0 + top, z: t.z + s * 0.38, ry: r() * 6.28 });
      if ((i % 2 === 0) === (s < 0)) hats.push({ x: cx - 0.3, y: y0 + top, z: t.z + s * 0.5, ry: r() * 6.28 });
    }
  }
  instanceModel(parent, 'table', tableP);
  instanceModel(parent, 'chair', chairs);
  instanceModel(parent, 'cup', cups, { receive: false, optional: w.optional });
  const hatGeo = new THREE.ConeGeometry(0.065, 0.18, 10); hatGeo.translate(0, 0.09, 0);
  instanced(parent, hatGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), hats.map(h => ({ ...h, color: PARTY[Math.floor(r() * PARTY.length)] })), { receive: false, optional: w.optional });
  if (!plateGeo) { plateGeo = plateGeometry(); plateMat = new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.6, side: THREE.DoubleSide }); }
  const pi = new THREE.InstancedMesh(plateGeo, plateMat, plates.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  plates.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, r() * 6.28, 0); o.updateMatrix(); pi.setMatrixAt(i, o.matrix); pi.setColorAt(i, col.set(p.color)); });
  pi.castShadow = true; pi.receiveShadow = true; pi.computeBoundingSphere(); pi.userData.optional = true; w.optional.push(pi); parent.add(pi);

  for (const t of tables) if (t.cake) instanceModel(parent, 'cake', [{ x: t.x, y: y0 + top, z: t.z, s: 1.4 }]);

  // balloon bunches tied to the floor (stationary), ceiling balloons
  const { x0, x1, z0, z1 } = bounds;
  const bunches = [];
  for (const t of tables) for (const sx of [-1, 1]) { const x = t.x + sx * (1.1 * (t.len ?? 1.5) + 0.9), z = t.z; if (x > x0 + 0.8 && x < x1 - 0.8 && !hit(x, z)) bunches.push({ x, y: y0, z, ry: r() * 6.28 }); }
  for (const [bx, bz] of [[x0 + 0.8, z0 + 0.8], [x0 + 0.8, z1 - 0.8], [x1 - 0.8, z0 + 0.8], [x1 - 0.8, z1 - 0.8]]) if (!hit(bx, bz, 1.2)) bunches.push({ x: bx, y: y0, z: bz, ry: r() * 6.28, s: 1.1 });
  instanceModel(parent, 'balloons', bunches);
  const bal = [];
  for (let i = 0; i < ceilingBalloons; i++) bal.push({ x: x0 + 0.5 + r() * (x1 - x0 - 1), y: y0 + 2.6 + r() * 0.2, z: z0 + 0.5 + r() * (z1 - z0 - 1), sy: 1.18, color: PARTY[Math.floor(r() * PARTY.length)] });
  if (bal.length) instanced(parent, new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.05 }), bal, { optional: w.optional });

  // confetti
  const conf = [];
  for (let i = 0; i < confetti; i++) {
    const t = tables.length ? tables[Math.floor(r() * tables.length)] : null, onTable = t && i < confetti * 0.2;
    conf.push(onTable
      ? { x: t.x + (r() - 0.5) * 2.4 * (t.len ?? 1.5) / 1.5, y: y0 + top + 0.008, z: t.z + (r() - 0.5) * 1.3, ry: r() * 6.28, color: PARTY[Math.floor(r() * PARTY.length)] }
      : { x: x0 + 0.3 + r() * (x1 - x0 - 0.6), y: y0 + 0.008, z: z0 + 0.3 + r() * (z1 - z0 - 0.6), ry: r() * 6.28, color: PARTY[Math.floor(r() * PARTY.length)] });
  }
  const cg = new THREE.PlaneGeometry(0.05, 0.03); cg.rotateX(-Math.PI / 2);
  instanced(parent, cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide }), conf, { cast: false, optional: w.optional });

  if (bunting) {
    const bm = new THREE.MeshBasicMaterial({ map: bannerTexture('HAPPYBIRTHDAY'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const north = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.875), bm);
    north.position.set((x0 + x1) / 2, y0 + 2.4, z0 + 0.14); parent.add(north);
    const west = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.875), bm);
    west.position.set(x0 + 0.14, y0 + 2.4, (z0 + z1) / 2); west.rotation.y = Math.PI / 2; parent.add(west);
  }
}
