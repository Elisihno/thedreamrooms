import * as THREE from '../../vendor/three.module.min.js';

// Four floors, each 12 x 9 m and 3 m tall: 0 cellar, 1 ground, 2 upstairs, 3 attic.
// North is z = 0, west is x = 0. A stair hall runs down the west side of every floor.
export const W = 12, D = 9, H = 3, T = 0.2;
export const FLOOR_NAMES = ['Cellar', 'Ground floor', 'Upstairs', 'Attic'];
export const floorY = (f) => (f - 1) * H;

const R = (id, x0, z0, x1, z1, wall, floor) => ({ id, x0, z0, x1, z1, wall, floor });
const door = (c) => ({ c, w: 1.1, y0: 0, y1: 2.1 });
const EXT = 'wall_7';

// each floor: rooms, interior walls ['x'|'z', c, from, to, doorway centres], ceiling texture
const LAYOUT = [
  { // cellar
    rooms: [R('H', 0, 0, 3.6, 9, 'wall_1', 'floor_1'), R('A', 3.6, 0, 8, 9, 'wall_4', 'floor_1'), R('B', 8, 0, 12, 9, 'blood', 'floor_5')],
    walls: [['z', 3.6, 0, 9, [7]], ['z', 8, 0, 9, [4.5]]],
  },
  { // ground
    rooms: [R('H', 0, 0, 3.6, 9, 'wall_3', 'floor_2'), R('L', 3.6, 0, 8, 5, 'wall_0', 'floor_8'), R('K', 8, 0, 12, 5, 'wall_6', 'floor_6'), R('S', 3.6, 5, 12, 9, 'wall_8', 'floor_2')],
    walls: [['z', 3.6, 0, 9, [2.5, 7.2]], ['z', 8, 0, 5, [2.5]], ['x', 5, 3.6, 12, [5.8, 10]]],
  },
  { // upstairs
    rooms: [R('H', 0, 0, 3.6, 9, 'wall_3', 'floor_2'), R('B', 3.6, 0, 8, 5, 'wall_8', 'floor_9'), R('A', 8, 0, 12, 5, 'wall_6', 'floor_6'), R('S', 3.6, 5, 12, 9, 'wall_0', 'floor_8')],
    walls: [['z', 3.6, 0, 9, [2.5, 7.2]], ['z', 8, 0, 5, [2.5]], ['x', 5, 3.6, 12, [5.8, 10]]],
  },
  { // attic
    rooms: [R('H', 0, 0, 3.6, 9, 'wall_2', 'floor_3'), R('A', 3.6, 0, 12, 9, 'blood', 'floor_3')],
    walls: [['z', 3.6, 0, 9, [4.5]]],
  },
];

// window texture per entry, floor, wall axis, wall coordinate c, position a along the wall, outward sign
const ENTRIES = [
  { f: 1, id: 'front', name: 'Front door', kind: 'door', axis: 'x', c: D, a: 7.5, out: 1, w: 1.2 },
  { f: 1, id: 'back', name: 'Back door', kind: 'door', axis: 'x', c: 0, a: 10, out: -1, w: 1.2 },
  { f: 1, id: 'livN', name: 'Living room window', kind: 'window', axis: 'x', c: 0, a: 5.8, out: -1, w: 1, pane: 'window_0' },
  { f: 1, id: 'kitE', name: 'Kitchen window', kind: 'window', axis: 'z', c: W, a: 2.5, out: 1, w: 1, pane: 'window_4' },
  { f: 1, id: 'stoE', name: 'Back room window', kind: 'window', axis: 'z', c: W, a: 7, out: 1, w: 1, pane: 'window_9' },
  { f: 1, id: 'halW', name: 'Hall window', kind: 'window', axis: 'z', c: 0, a: 1.5, out: -1, w: 1, pane: 'window_1' },
  { f: 2, id: 'bedN', name: 'Bedroom window', kind: 'window', axis: 'x', c: 0, a: 5.8, out: -1, w: 1, pane: 'window_6' },
  { f: 2, id: 'bathE', name: 'Bathroom window', kind: 'window', axis: 'z', c: W, a: 2.5, out: 1, w: 1, pane: 'window_3' },
  { f: 2, id: 'stuS', name: 'Study window', kind: 'window', axis: 'x', c: D, a: 7, out: 1, w: 1, pane: 'window_1' },
  { f: 3, id: 'attE', name: 'Attic window', kind: 'window', axis: 'z', c: W, a: 4.5, out: 1, w: 1, pane: 'window_6' },
];

// stairs: the flight rises north from the bottom mouth (floor f) to the top mouth (floor f+1)
const FLIGHTS = [
  { id: 'C0', f: 0, foot: { x0: 0.2, x1: 1.4, z0: 3, z1: 6 }, bottom: { x: 0.8, z: 6.7 }, top: { x: 0.8, z: 2.3 } },
  { id: 'C1', f: 1, foot: { x0: 2.0, x1: 3.2, z0: 3, z1: 6 }, bottom: { x: 2.6, z: 6.7 }, top: { x: 2.6, z: 2.3 } },
  { id: 'C2', f: 2, foot: { x0: 0.2, x1: 1.4, z0: 3, z1: 6 }, bottom: { x: 0.8, z: 6.7 }, top: { x: 0.8, z: 2.3 } },
];

export function roomAt(f, x, z) {
  x = Math.max(0, Math.min(W - 0.001, x)); z = Math.max(0, Math.min(D - 0.001, z));
  for (const r of LAYOUT[f].rooms) if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return r.id;
  return 'H';
}
export function roomCenter(f, id) {
  const r = LAYOUT[f].rooms.find(q => q.id === id) || LAYOUT[f].rooms[0];
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}
export const roomIds = (f) => LAYOUT[f].rooms.map(r => r.id);

// ---- room graph (doors within a floor, stairs between floors) -------------
const graph = {};
const key = (f, id) => `${f}:${id}`;
function link(a, b, edge) { (graph[a] = graph[a] || []).push({ to: b, ...edge }); }
LAYOUT.forEach((fl, f) => {
  fl.walls.forEach(([axis, c, , , doors]) => doors.forEach(d => {
    const p = axis === 'z' ? { x: c, z: d } : { x: d, z: c };
    const s = axis === 'z' ? [{ x: c - 0.6, z: d }, { x: c + 0.6, z: d }] : [{ x: d, z: c - 0.6 }, { x: d, z: c + 0.6 }];
    const a = key(f, roomAt(f, s[0].x, s[0].z)), b = key(f, roomAt(f, s[1].x, s[1].z));
    link(a, b, { p, f }); link(b, a, { p, f });
  }));
});
FLIGHTS.forEach(fl => {
  link(key(fl.f, 'H'), key(fl.f + 1, 'H'), { p: fl.bottom, f: fl.f, stair: { flight: fl, dir: 'up' } });
  link(key(fl.f + 1, 'H'), key(fl.f, 'H'), { p: fl.top, f: fl.f + 1, stair: { flight: fl, dir: 'down' } });
});

// Waypoints to walk from a to b ({f,x,z}). A waypoint with .stair means "climb here".
export function findPath(a, b) {
  const start = key(a.f, roomAt(a.f, a.x, a.z)), goal = key(b.f, roomAt(b.f, b.x, b.z));
  const prev = { [start]: null };
  const queue = [start];
  while (queue.length) {
    const n = queue.shift();
    if (n === goal) break;
    for (const e of graph[n] || []) if (!(e.to in prev)) { prev[e.to] = { n, e }; queue.push(e.to); }
  }
  const pts = [];
  for (let n = goal; prev[n]; n = prev[n].n) {
    const e = prev[n].e;
    pts.unshift({ x: e.p.x, z: e.p.z, floor: e.f, stair: e.stair });
  }
  pts.push({ x: b.x, z: b.z, floor: b.f });
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

export const plankMat = (() => {
  const t = tex('floor_2').clone();
  t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 0.4); t.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: t, color: 0xcdbba0 });
})();

function setUV(geo, w, h, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
}
function subtract(r, h) {
  const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1), iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
  if (ix0 >= ix1 || iz0 >= iz1) return [r];
  return [
    { x0: r.x0, x1: ix0, z0: r.z0, z1: r.z1 }, { x0: ix1, x1: r.x1, z0: r.z0, z1: r.z1 },
    { x0: ix0, x1: ix1, z0: r.z0, z1: iz0 }, { x0: ix0, x1: ix1, z0: iz1, z1: r.z1 },
  ].filter(q => q.x1 - q.x0 > 0.01 && q.z1 - q.z0 > 0.01);
}

// ---- builder --------------------------------------------------------------
export function buildWorld() {
  const group = new THREE.Group();
  const dark = plain(0x1a1511);
  const wood = mat('floor_2', 0x8a7a66);
  const floors = [];
  const entries = [], piles = [], hides = [];
  const stairs = [];   // interactable stair mouths

  for (let f = 0; f < 4; f++) {
    const lay = LAYOUT[f];
    const g = new THREE.Group();
    g.position.y = floorY(f);
    group.add(g);
    const fl = { f, group: g, rects: [], entries: [], piles: [], hides: [], base: floorY(f) };
    floors.push(fl);
    const rects = fl.rects;
    const roomAtHere = (x, z) => lay.rooms.find(r => r.id === roomAt(f, x, z));

    // one face of a wall piece
    const panel = (axis, c, a0, a1, y0, y1, side, name) => {
      const len = a1 - a0, h = y1 - y0;
      const geo = new THREE.PlaneGeometry(len, h);
      setUV(geo, len, h, 2.2);
      const m = new THREE.Mesh(geo, mat(name));
      const mid = (a0 + a1) / 2, off = T / 2 + 0.004;
      if (axis === 'x') { m.position.set(mid, (y0 + y1) / 2, c + side * off); m.rotation.y = side > 0 ? 0 : Math.PI; }
      else { m.position.set(c + side * off, (y0 + y1) / 2, mid); m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
      g.add(m);
    };
    const sideName = (axis, c, mid, side) => {
      const px = axis === 'x' ? mid : c + side * 0.6;
      const pz = axis === 'x' ? c + side * 0.6 : mid;
      if (px < 0 || px > W || pz < 0 || pz > D) return EXT;
      return roomAtHere(px, pz).wall;
    };
    const solid = (axis, c, a0, a1, y0, y1, collide) => {
      if (a1 - a0 < 0.01) return;
      const len = a1 - a0, mid = (a0 + a1) / 2;
      const core = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len : T, y1 - y0, axis === 'x' ? T : len), dark);
      core.position.set(axis === 'x' ? mid : c, (y0 + y1) / 2, axis === 'x' ? c : mid);
      g.add(core);
      panel(axis, c, a0, a1, y0, y1, 1, sideName(axis, c, mid, 1));
      panel(axis, c, a0, a1, y0, y1, -1, sideName(axis, c, mid, -1));
      if (collide) {
        rects.push(axis === 'x'
          ? { x0: a0, x1: a1, z0: c - T / 2, z1: c + T / 2, los: true }
          : { x0: c - T / 2, x1: c + T / 2, z0: a0, z1: a1, los: true });
      }
    };
    const wall = (axis, c, from, to, openings) => {
      let cur = from;
      for (const o of [...openings].sort((p, q) => p.c - q.c)) {
        const lo = o.c - o.w / 2, hi = o.c + o.w / 2;
        solid(axis, c, cur, lo, 0, H, true);
        if (o.y0 > 0) solid(axis, c, lo, hi, 0, o.y0, false);
        solid(axis, c, lo, hi, o.y1, H, false);
        cur = hi;
      }
      solid(axis, c, cur, to, 0, H, true);
    };

    // ---- entry points on this floor ----
    for (const def of ENTRIES.filter(d => d.f === f)) {
      const { id, name, kind, axis, c, a, out, w } = def;
      const y0 = kind === 'door' ? 0 : 0.8, y1 = kind === 'door' ? 2.1 : 2.3;
      const max = kind === 'door' ? 4 : 3;
      const cx = axis === 'x' ? a : c, cz = axis === 'x' ? c : a;
      const nx = axis === 'x' ? 0 : out, nz = axis === 'x' ? out : 0;
      const e = {
        id, name, kind, axis, c, a, out, w, y0, y1, max, floor: f, base: fl.base,
        planks: 0, open: false, paneBroken: false, heat: 0, cx, cz, nx, nz,
        inside: { x: cx - nx * 0.9, z: cz - nz * 0.9 },
        mid: new THREE.Vector3(cx - nx * 0.5, fl.base + (y0 + y1) / 2, cz - nz * 0.5),
        collider: axis === 'x'
          ? { x0: a - w / 2, x1: a + w / 2, z0: c - T / 2, z1: c + T / 2, los: true, off: false }
          : { x0: c - T / 2, x1: c + T / 2, z0: a - w / 2, z1: a + w / 2, los: true, off: false },
        slots: [], doorPivot: null, pane: null, doorAngle: 0,
      };
      rects.push(e.collider);
      if (kind === 'door') {
        const pivot = new THREE.Group();
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.1), mat('door', 0xffffff, THREE.DoubleSide));
        m.position.x = w / 2;
        pivot.add(m);
        pivot.position.set(axis === 'x' ? a - w / 2 : c, 1.05, axis === 'x' ? c : a - w / 2);
        pivot.rotation.y = axis === 'x' ? 0 : -Math.PI / 2;
        pivot.userData.base = pivot.rotation.y;
        g.add(pivot);
        e.doorPivot = pivot;
      } else {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), mat(def.pane, 0xffffff, THREE.DoubleSide));
        m.position.set(cx, (y0 + y1) / 2, cz);
        if (axis === 'z') m.rotation.y = Math.PI / 2;
        g.add(m);
        e.pane = m;
      }
      for (let i = 0; i < max; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, 0.19, 0.06), plankMat);
        m.position.set(cx - nx * (T / 2 + 0.05), y0 + (y1 - y0) * (i + 0.5) / max, cz - nz * (T / 2 + 0.05));
        m.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
        m.rotation.z = (Math.random() - 0.5) * 0.12;
        m.visible = false;
        g.add(m);
        e.slots.push(m);
      }
      e.refresh = () => {
        e.slots.forEach((m, i) => { m.visible = i < e.planks; });
        e.collider.off = e.open;
        if (e.pane) e.pane.visible = !e.paneBroken;
      };
      e.openUp = () => { e.open = true; e.paneBroken = true; e.refresh(); };
      entries.push(e); fl.entries.push(e);
    }

    // ---- walls ----
    const onWall = (axis, c) => fl.entries.filter(e => e.axis === axis && e.c === c).map(e => ({ c: e.a, w: e.w, y0: e.y0, y1: e.y1 }));
    wall('x', 0, 0, W, onWall('x', 0));
    wall('x', D, 0, W, onWall('x', D));
    wall('z', 0, 0, D, onWall('z', 0));
    wall('z', W, 0, D, onWall('z', W));
    for (const [axis, c, from, to, doors] of lay.walls) wall(axis, c, from, to, doors.map(door));

    // ---- floors and ceilings (with stairwell holes) ----
    const floorHoles = FLIGHTS.filter(q => q.f === f - 1).map(q => q.foot);
    const ceilHoles = FLIGHTS.filter(q => q.f === f).map(q => q.foot);
    const quad = (r, name, y, up, tint) => {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const geo = new THREE.PlaneGeometry(w, d);
      setUV(geo, w, d, 2.2);
      const m = new THREE.Mesh(geo, mat(name, tint));
      m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
      m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
      g.add(m);
    };
    for (const room of lay.rooms) {
      let parts = [room];
      for (const h of floorHoles) parts = parts.flatMap(p => subtract(p, h));
      parts.forEach(p => quad(p, room.floor, 0, true, 0xffffff));
      parts = [room];
      for (const h of ceilHoles) parts = parts.flatMap(p => subtract(p, h));
      parts.forEach(p => quad(p, 'wall_4', H - 0.01, false, 0x6a6a6a));
    }
    // solid blocks around the stairwell: steps below, open hole above
    for (const q of FLIGHTS) {
      if (q.f === f || q.f === f - 1) rects.push({ x0: q.foot.x0, x1: q.foot.x1, z0: q.foot.z0, z1: q.foot.z1, los: false });
    }

    // ---- furniture helpers ----
    const box = (x, z, w, d, h, color, o = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || plain(color));
      m.position.set(x, (o.y || 0) + h / 2, z);
      g.add(m);
      if (o.collide !== false) rects.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, los: h > 1.2 });
      return m;
    };
    const hide = (id, x, z, w, d, h, color, fx, fz, label) => {
      const m = box(x, z, w, d, h, color);
      const hd = { id: `${f}${id}`, label, floor: f, x, z, front: { x: fx, z: fz }, mesh: m, pos: new THREE.Vector3(x, fl.base + Math.min(h * 0.6, 1.1), z), occupied: false };
      hides.push(hd); fl.hides.push(hd);
    };
    const pile = (id, x, z) => {
      const pg = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.17), plankMat);
        p.position.set((Math.random() - 0.5) * 0.1, 0.05 + i * 0.075, (i % 3 - 1) * 0.18);
        p.rotation.y = (Math.random() - 0.5) * 0.3;
        pg.add(p);
      }
      pg.position.set(x, 0, z);
      g.add(pg);
      rects.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.35, z1: z + 0.35, los: false });
      const p = { id: `${f}${id}`, floor: f, group: pg, count: 0, pos: new THREE.Vector3(x, fl.base + 0.45, z) };
      piles.push(p); fl.piles.push(p);
    };

    if (f === 0) { // cellar
      box(5.0, 0.8, 1.6, 0.5, 1.9, 0, { mat: wood });
      box(7.4, 8.3, 0.9, 0.9, 1.0, 0, { mat: wood });
      box(8.6, 0.8, 0.7, 0.7, 0.9, 0x3a2f28);
      box(11.4, 0.9, 0.8, 0.8, 0.9, 0x3a2f28);
      box(9.4, 3.3, 1.6, 0.6, 0.9, 0, { mat: wood });
      hide('bin', 6.2, 8.2, 1.2, 0.9, 1.5, 0x241a14, 6.2, 7.2, 'the coal bin');
      hide('barrels', 11.3, 4.6, 1.0, 1.0, 1.4, 0x2a2018, 10.3, 4.6, 'the barrels');
      pile('cellarA', 5.2, 4.2);
      pile('cellarB', 10.6, 8.2);
    } else if (f === 1) { // ground
      box(6.1, 3.9, 2.0, 0.9, 0.8, 0x3b2a2a);                     // couch
      box(6.1, 4.3, 2.0, 0.2, 0.6, 0x3b2a2a, { y: 0.8 });
      box(5.4, 2.3, 1.1, 0.6, 0.45, 0, { mat: wood });            // table
      box(7.5, 0.6, 0.8, 0.4, 1.8, 0, { mat: wood });             // bookshelf
      box(10.3, 3.2, 1.5, 1.0, 0.75, 0, { mat: wood });           // kitchen table
      box(9.0, 0.45, 1.6, 0.6, 0.9, 0x6a6a64);                    // counter
      box(11.6, 0.5, 0.8, 0.7, 1.8, 0xb9b5a8);                    // fridge
      box(7.2, 8.3, 1.1, 1.1, 1.0, 0, { mat: wood });             // crate
      box(11.3, 6.0, 1.2, 0.9, 0.8, 0, { mat: wood });
      hide('pantry', 11.4, 4.5, 0.9, 0.9, 2.0, 0x30251d, 10.5, 4.4, 'the pantry');
      hide('cabinet', 4.3, 8.5, 1.1, 0.7, 2.0, 0x2a1d17, 4.3, 7.7, 'the cabinet');
      hide('hallcloset', 3.2, 0.6, 0.8, 0.8, 2.0, 0x2a1d17, 2.4, 0.9, 'the coat closet');
      pile('groundA', 10.4, 8.5);
      pile('groundB', 11.4, 1.6);
      pile('groundC', 4.4, 0.9);
    } else if (f === 2) { // upstairs
      box(7.1, 1.2, 1.3, 1.9, 0.5, 0x4a3b3b);                     // bed
      box(7.1, 0.5, 1.2, 0.3, 0.15, 0xbdb6a6, { y: 0.5, collide: false });
      box(9.8, 0.9, 1.9, 0.9, 0.55, 0xc9c6bc);                    // bathtub
      box(11.4, 3.6, 0.7, 0.7, 0.85, 0xc9c6bc);                   // basin
      box(10.5, 8.5, 1.6, 0.8, 0.8, 0, { mat: wood });            // desk
      box(6.4, 8.6, 1.0, 0.5, 2.0, 0, { mat: wood });             // bookshelf
      hide('wardrobe', 4.2, 0.7, 1.1, 0.7, 2.1, 0x2a1d17, 4.2, 1.6, 'the wardrobe');
      hide('bed', 7.1, 2.5, 1.3, 0.6, 0.35, 0x2c2420, 7.1, 3.4, 'under the bed');
      hide('study', 11.4, 6.2, 0.9, 0.9, 2.0, 0x30251d, 10.5, 6.2, 'the study cabinet');
      pile('upA', 4.5, 4.3);
      pile('upB', 6.0, 7.2);
    } else { // attic
      box(5.2, 1.2, 1.4, 0.9, 0.9, 0, { mat: wood });
      box(9.0, 2.0, 1.0, 1.0, 0.8, 0, { mat: wood });
      box(7.0, 5.6, 1.8, 0.8, 0.6, 0x3a2f28);
      box(11.2, 7.6, 1.0, 1.4, 1.0, 0x3a2f28);
      hide('trunk', 4.4, 8.4, 1.3, 0.8, 1.0, 0x241a14, 4.4, 7.5, 'the old trunk');
      hide('chest', 11.4, 1.0, 1.0, 0.8, 1.2, 0x2a2018, 10.5, 1.0, 'the chest');
      pile('attic', 8.2, 6.8);
    }
  }

  // ---- staircases (steps visible from both floors) ----
  const stepMat = mat('floor_2', 0x6a5a48);
  for (const q of FLIGHTS) {
    const sg = new THREE.Group();
    const n = 12, run = (q.foot.z1 - q.foot.z0) / n, wd = q.foot.x1 - q.foot.x0;
    for (let i = 0; i < n; i++) {
      const h = (i + 1) * (H / n);
      const s = new THREE.Mesh(new THREE.BoxGeometry(wd, h, run), stepMat);
      s.position.set((q.foot.x0 + q.foot.x1) / 2, floorY(q.f) + h / 2, q.foot.z1 - (i + 0.5) * run);
      sg.add(s);
    }
    group.add(sg);
    q.group = sg;
    const mouth = (x, z, f, dir) => {
      const m = { flight: q, dir, floor: f, x, z, label: dir === 'up' ? (f === 0 ? 'Go up to the ground floor' : f === 1 ? 'Go upstairs' : 'Go up to the attic') : (f === 1 ? 'Go down to the cellar' : f === 2 ? 'Go downstairs' : 'Go down to the first floor'), pos: new THREE.Vector3(x, floorY(f) + 0.9, z + (dir === 'up' ? -0.9 : 0.9)) };
      stairs.push(m);
      return m;
    };
    q.upMouth = mouth(q.bottom.x, q.bottom.z, q.f, 'up');
    q.downMouth = mouth(q.top.x, q.top.z, q.f + 1, 'down');
  }

  // ---- ground, trees ----
  {
    const geo = new THREE.PlaneGeometry(90, 90);
    setUV(geo, 90, 90, 3);
    const gm = new THREE.Mesh(geo, mat('floor_0', 0x4a4a44));
    gm.rotation.x = -Math.PI / 2; gm.position.set(W / 2, -0.02, D / 2);
    group.add(gm);
    const trunk = plain(0x0d0b09);
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2 + Math.random() * 0.2, r = 11 + Math.random() * 10;
      const h = 6 + Math.random() * 6;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, h, 6), trunk);
      t.position.set(W / 2 + Math.cos(ang) * r * 1.2, h / 2, D / 2 + Math.sin(ang) * r);
      group.add(t);
    }
  }

  function setPileCount(p, n) {
    p.count = n;
    p.group.children.forEach((c, i) => { c.visible = i < Math.min(6, Math.ceil(n / 2)) && n > 0; });
  }
  // only draw the floors near the player
  function showFloors(pf) {
    floors.forEach(fl => { fl.group.visible = Math.abs(fl.f - pf) <= 1; });
    FLIGHTS.forEach(q => { q.group.visible = Math.abs(q.f + 0.5 - pf) <= 1.5; });
  }
  entries.forEach(e => e.refresh());
  showFloors(1);

  return { group, floors, entries, piles, hides, stairs, flights: FLIGHTS, setPileCount, showFloors };
}
