import * as THREE from '../../vendor/three.module.min.js';

// House plan (metres). North is z = 0, west is x = 0.
//   L living (0..7, 0..5)   K kitchen (7..12, 0..5)
//   B bedroom (0..6, 5..9)  S storage (6..12, 5..9)
export const W = 12, D = 9, H = 2.8, T = 0.2;

export function roomAt(x, z) {
  if (z < 5) return x < 7 ? 'L' : 'K';
  return x < 6 ? 'B' : 'S';
}
export const ROOM_CENTER = { L: [3.5, 2.5], K: [9.5, 2.5], B: [3, 7], S: [9, 7] };
const DOORS = [
  { a: 'L', b: 'K', p: [7, 2.5] },
  { a: 'L', b: 'B', p: [3, 5] },
  { a: 'K', b: 'S', p: [9, 5] },
  { a: 'B', b: 'S', p: [6, 7] },
];

// Door points to walk through to get from a to b, then the target itself.
export function findPath(from, to) {
  const ra = roomAt(from.x, from.z), rb = roomAt(to.x, to.z);
  if (ra === rb) return [{ x: to.x, z: to.z }];
  const prev = { [ra]: null };
  const queue = [ra];
  while (queue.length) {
    const r = queue.shift();
    if (r === rb) break;
    for (const d of DOORS) {
      const n = d.a === r ? d.b : d.b === r ? d.a : null;
      if (n && !(n in prev)) { prev[n] = { r, d }; queue.push(n); }
    }
  }
  const pts = [];
  for (let r = rb; prev[r]; r = prev[r].r) pts.unshift({ x: prev[r].d.p[0], z: prev[r].d.p[1] });
  pts.push({ x: to.x, z: to.z });
  return pts;
}

// ---- collision helpers ----------------------------------------------------
export function resolveCircle(pos, r, rects) {
  for (let it = 0; it < 2; it++) {
    for (const k of rects) {
      if (k.off) continue;
      const cx = Math.max(k.x0, Math.min(pos.x, k.x1));
      const cz = Math.max(k.z0, Math.min(pos.z, k.z1));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), p = (r - d) / d;
        pos.x += dx * p; pos.z += dz * p;
      } else {
        const l = pos.x - k.x0, rr = k.x1 - pos.x, t = pos.z - k.z0, b = k.z1 - pos.z;
        const m = Math.min(l, rr, t, b);
        if (m === l) pos.x = k.x0 - r; else if (m === rr) pos.x = k.x1 + r;
        else if (m === t) pos.z = k.z0 - r; else pos.z = k.z1 + r;
      }
    }
  }
}

export function lineClear(ax, az, bx, bz, rects) {
  const dx = bx - ax, dz = bz - az;
  for (const k of rects) {
    if (k.off || !k.los) continue;
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[ax, dx, k.x0, k.x1], [az, dz, k.z0, k.z1]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return false;
  }
  return true;
}

// ---- textures -------------------------------------------------------------
const loader = new THREE.TextureLoader();
const texCache = {};
function tex(name) {
  if (!texCache[name]) {
    const t = loader.load(`assets/textures/${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache[name] = t;
  }
  return texCache[name];
}
const matCache = {};
function mat(name, tint = 0xffffff, side = THREE.FrontSide) {
  const key = name + tint + side;
  if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial({ map: tex(name), color: tint, side });
  return matCache[key];
}
const plain = (color) => new THREE.MeshLambertMaterial({ color });

const WALL = { L: 'wall_3', K: 'wall_0', B: 'wall_8', S: 'blood', ext: 'wall_7' };
const FLOOR = { L: 'floor_8', K: 'floor_6', B: 'floor_2', S: 'floor_5' };

// ---- builder --------------------------------------------------------------
export function buildWorld() {
  const group = new THREE.Group();
  const rects = [];          // collision rects: {x0,x1,z0,z1,los,off}
  const entries = [];
  const piles = [];
  const hides = [];
  const dark = plain(0x1a1511);

  function setUV(geo, w, h, tile) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  }

  // one face of a wall piece
  function panel(axis, c, a0, a1, y0, y1, side, name) {
    const len = a1 - a0, h = y1 - y0;
    const geo = new THREE.PlaneGeometry(len, h);
    setUV(geo, len, h, 2.2);
    const m = new THREE.Mesh(geo, name === 'blood' ? mat('blood') : mat(name));
    const mid = (a0 + a1) / 2, off = T / 2 + 0.004;
    if (axis === 'x') { m.position.set(mid, (y0 + y1) / 2, c + side * off); m.rotation.y = side > 0 ? 0 : Math.PI; }
    else { m.position.set(c + side * off, (y0 + y1) / 2, mid); m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
    group.add(m);
  }

  function sideName(axis, c, mid, side) {
    const px = axis === 'x' ? mid : c + side * 0.6;
    const pz = axis === 'x' ? c + side * 0.6 : mid;
    if (px < 0 || px > W || pz < 0 || pz > D) return WALL.ext;
    return WALL[roomAt(px, pz)];
  }

  function solid(axis, c, a0, a1, y0, y1, collide) {
    if (a1 - a0 < 0.01) return;
    const len = a1 - a0, mid = (a0 + a1) / 2;
    const core = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len : T, y1 - y0, axis === 'x' ? T : len), dark);
    core.position.set(axis === 'x' ? mid : c, (y0 + y1) / 2, axis === 'x' ? c : mid);
    group.add(core);
    panel(axis, c, a0, a1, y0, y1, 1, sideName(axis, c, mid, 1));
    panel(axis, c, a0, a1, y0, y1, -1, sideName(axis, c, mid, -1));
    if (collide) {
      rects.push(axis === 'x'
        ? { x0: a0, x1: a1, z0: c - T / 2, z1: c + T / 2, los: true }
        : { x0: c - T / 2, x1: c + T / 2, z0: a0, z1: a1, los: true });
    }
  }

  function wall(axis, c, from, to, openings) {
    let cur = from;
    for (const o of [...openings].sort((p, q) => p.c - q.c)) {
      const lo = o.c - o.w / 2, hi = o.c + o.w / 2;
      solid(axis, c, cur, lo, 0, H, true);
      if (o.y0 > 0) solid(axis, c, lo, hi, 0, o.y0, false);
      solid(axis, c, lo, hi, o.y1, H, false);
      cur = hi;
    }
    solid(axis, c, cur, to, 0, H, true);
  }

  // ---- entry points (the doors and windows she can break) ----
  const plankMat = (() => {
    const t = tex('floor_2').clone();
    t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 0.4); t.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ map: t, color: 0xcdbba0 });
  })();

  function addEntry(def) {
    const { id, name, kind, axis, c, a, out, w } = def;
    const y0 = kind === 'door' ? 0 : 0.8, y1 = kind === 'door' ? 2.1 : 2.3;
    const max = kind === 'door' ? 4 : 3;
    const cx = axis === 'x' ? a : c, cz = axis === 'x' ? c : a;
    const nx = axis === 'x' ? 0 : out, nz = axis === 'x' ? out : 0;
    const e = {
      id, name, kind, axis, c, a, out, w, y0, y1, max, planks: 0, open: false, paneBroken: false, heat: 0,
      cx, cz, nx, nz,
      inside: { x: cx - nx * 0.9, z: cz - nz * 0.9 },
      mid: new THREE.Vector3(cx - nx * 0.5, (y0 + y1) / 2, cz - nz * 0.5),
      collider: axis === 'x'
        ? { x0: a - w / 2, x1: a + w / 2, z0: c - T / 2, z1: c + T / 2, los: true, off: false }
        : { x0: c - T / 2, x1: c + T / 2, z0: a - w / 2, z1: a + w / 2, los: true, off: false },
      slots: [], doorPivot: null, pane: null, doorAngle: 0,
    };
    rects.push(e.collider);

    // the door leaf / the window pane
    if (kind === 'door') {
      const pivot = new THREE.Group();
      const geo = new THREE.PlaneGeometry(w, 2.1);
      const m = new THREE.Mesh(geo, mat('door', 0xffffff, THREE.DoubleSide));
      m.position.x = w / 2;
      pivot.add(m);
      pivot.position.set(axis === 'x' ? a - w / 2 : c, 1.05, axis === 'x' ? c : a - w / 2);
      pivot.rotation.y = axis === 'x' ? 0 : -Math.PI / 2;
      pivot.userData.base = pivot.rotation.y;
      group.add(pivot);
      e.doorPivot = pivot;
    } else {
      const geo = new THREE.PlaneGeometry(w, y1 - y0);
      const m = new THREE.Mesh(geo, mat(def.pane, 0xffffff, THREE.DoubleSide));
      m.position.set(cx, (y0 + y1) / 2, cz);
      if (axis === 'z') m.rotation.y = Math.PI / 2;
      group.add(m);
      e.pane = m;
    }

    // plank slots on the inside face
    for (let i = 0; i < max; i++) {
      const len = w + 0.45;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.19, 0.06), plankMat);
      const y = y0 + (y1 - y0) * (i + 0.5) / max;
      m.position.set(cx - nx * (T / 2 + 0.05), y, cz - nz * (T / 2 + 0.05));
      m.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
      m.rotation.z = (Math.random() - 0.5) * 0.12;
      m.visible = false;
      group.add(m);
      e.slots.push(m);
    }

    e.refresh = () => {
      e.slots.forEach((m, i) => { m.visible = i < e.planks; });
      e.collider.off = e.open;
      if (e.pane) e.pane.visible = !e.paneBroken;
    };
    e.openUp = () => {
      e.open = true;
      e.paneBroken = true;
      e.refresh();
    };
    entries.push(e);
    return e;
  }

  const WIN = (i) => `window_${i}`;
  addEntry({ id: 'front', name: 'Front door', kind: 'door', axis: 'x', c: D, a: 9, out: 1, w: 1.2 });
  addEntry({ id: 'back', name: 'Back door', kind: 'door', axis: 'x', c: 0, a: 9.5, out: -1, w: 1.2 });
  addEntry({ id: 'livN', name: 'Living room window', kind: 'window', axis: 'x', c: 0, a: 3.5, out: -1, w: 1, pane: WIN(0) });
  addEntry({ id: 'livW', name: 'Living room side window', kind: 'window', axis: 'z', c: 0, a: 2.5, out: -1, w: 1, pane: WIN(1) });
  addEntry({ id: 'bedW', name: 'Bedroom window', kind: 'window', axis: 'z', c: 0, a: 7, out: -1, w: 1, pane: WIN(6) });
  addEntry({ id: 'bedS', name: 'Bedroom south window', kind: 'window', axis: 'x', c: D, a: 3, out: 1, w: 1, pane: WIN(3) });
  addEntry({ id: 'kitE', name: 'Kitchen window', kind: 'window', axis: 'z', c: W, a: 2.5, out: 1, w: 1, pane: WIN(4) });
  addEntry({ id: 'stoE', name: 'Storage window', kind: 'window', axis: 'z', c: W, a: 7, out: 1, w: 1, pane: WIN(9) });

  const byAxis = (axis, c) => entries.filter(e => e.axis === axis && e.c === c).map(e => ({ c: e.a, w: e.w, y0: e.y0, y1: e.y1 }));
  wall('x', 0, 0, W, byAxis('x', 0));
  wall('x', D, 0, W, byAxis('x', D));
  wall('z', 0, 0, D, byAxis('z', 0));
  wall('z', W, 0, D, byAxis('z', W));
  const doorway = (c) => ({ c, w: 1.1, y0: 0, y1: 2.1 });
  wall('x', 5, 0, W, [doorway(3), doorway(9)]);
  wall('z', 7, 0, 5, [doorway(2.5)]);
  wall('z', 6, 5, D, [doorway(7)]);

  // ---- floors, ceiling, ground ----
  function floorQuad(x0, z0, x1, z1, name, y, up) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    setUV(geo, x1 - x0, z1 - z0, 2.2);
    const m = new THREE.Mesh(geo, mat(name, up ? 0x8a8a8a : 0xffffff));
    m.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    group.add(m);
  }
  floorQuad(0, 0, 7, 5, FLOOR.L, 0);
  floorQuad(7, 0, 12, 5, FLOOR.K, 0);
  floorQuad(0, 5, 6, 9, FLOOR.B, 0);
  floorQuad(6, 5, 12, 9, FLOOR.S, 0);
  floorQuad(0, 0, W, D, 'wall_4', H, true);
  {
    const geo = new THREE.PlaneGeometry(90, 90);
    setUV(geo, 90, 90, 3);
    const g = new THREE.Mesh(geo, mat('floor_0', 0x4a4a44));
    g.rotation.x = -Math.PI / 2; g.position.set(W / 2, -0.02, D / 2);
    group.add(g);
  }
  // a ring of dead trees to give the fog something to hide
  const trunk = plain(0x0d0b09);
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2 + Math.random() * 0.2, r = 11 + Math.random() * 10;
    const h = 4 + Math.random() * 4;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, h, 6), trunk);
    t.position.set(W / 2 + Math.cos(ang) * r * 1.2, h / 2, D / 2 + Math.sin(ang) * r);
    group.add(t);
  }

  // ---- furniture ----
  function box(x, z, w, d, h, color, o = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || plain(color));
    m.position.set(x, (o.y || 0) + h / 2, z);
    group.add(m);
    if (o.collide !== false) rects.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, los: h > 1.2 });
    return m;
  }
  const wood = mat('floor_2', 0x8a7a66);
  // living room
  box(5.6, 3.9, 2.0, 0.9, 0.8, 0x3b2a2a);                     // couch
  box(5.6, 4.3, 2.0, 0.2, 0.6, 0x3b2a2a, { y: 0.8 });        // couch back
  box(3.4, 3.1, 1.1, 0.6, 0.45, 0, { mat: wood });            // table
  box(6.5, 0.7, 0.9, 0.4, 1.8, 0, { mat: wood });             // bookshelf
  // kitchen
  box(10.3, 3.4, 1.5, 1.0, 0.75, 0, { mat: wood });           // table
  box(8.0, 0.45, 1.6, 0.6, 0.9, 0x6a6a64);                    // counter
  box(11.5, 0.5, 0.8, 0.7, 1.8, 0xb9b5a8);                    // fridge
  // bedroom
  box(0.75, 8.1, 1.3, 1.9, 0.5, 0x4a3b3b);                    // bed
  box(0.75, 8.85, 1.2, 0.3, 0.15, 0xbdb6a6, { y: 0.5, collide: false });
  // storage
  box(7.0, 8.2, 1.1, 1.1, 1.0, 0, { mat: wood });
  box(11.3, 6.1, 1.2, 0.9, 0.8, 0, { mat: wood });
  box(6.45, 5.8, 0.5, 1.4, 1.9, 0, { mat: wood });            // tall shelf on the dividing wall

  // hiding places
  function hide(id, x, z, w, d, h, color, frontX, frontZ, label) {
    const m = box(x, z, w, d, h, color);
    hides.push({ id, label, x, z, front: { x: frontX, z: frontZ }, mesh: m, pos: new THREE.Vector3(x, h * 0.6, z), occupied: false });
  }
  hide('wardrobe', 5.2, 8.6, 1.1, 0.7, 2.1, 0x2a1d17, 5.2, 7.8, 'the wardrobe');
  hide('bed', 0.75, 7.2, 1.3, 0.6, 0.35, 0x2c2420, 1.9, 7.2, 'under the bed');
  hide('pantry', 11.4, 4.5, 0.9, 0.9, 2.0, 0x30251d, 10.5, 4.5, 'the pantry');
  hide('closet', 1.0, 4.4, 1.1, 0.9, 2.0, 0x2a1d17, 1.0, 3.5, 'the closet');
  hides.find(h => h.id === 'bed').pos.y = 0.5;

  // plank piles
  function pile(id, x, z, supplyMax) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.17), plankMat);
      p.position.set((Math.random() - 0.5) * 0.1, 0.05 + i * 0.075, (i % 3 - 1) * 0.18);
      p.rotation.y = (Math.random() - 0.5) * 0.3;
      g.add(p);
    }
    g.position.set(x, 0, z);
    group.add(g);
    rects.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.35, z1: z + 0.35, los: false });
    piles.push({ id, group: g, count: 0, pos: new THREE.Vector3(x, 0.45, z), supplyMax });
  }
  pile('storage', 10.3, 8.5, 0);
  pile('bedroom', 4.5, 5.7, 0);
  pile('kitchen', 11.5, 1.6, 0);
  pile('living', 1.1, 0.9, 0);

  function setPileCount(p, n) {
    p.count = n;
    p.group.children.forEach((c, i) => { c.visible = i < Math.min(6, Math.ceil(n / 2)) && n > 0; });
  }
  entries.forEach(e => e.refresh());

  return { group, rects, entries, piles, hides, setPileCount };
}
