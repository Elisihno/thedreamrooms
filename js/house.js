import * as THREE from '../vendor/three.module.min.js';

// ---- layout -------------------------------------------------------------
// One map per storey. Each letter is a room; every character is one CELL x CELL square.
// Ground floor: room S is the stairwell (cells col 4, rows 3-4), entered from the north.
// Upper floor: the same cells are the opening above the stairs, inside room U.
const FLOORS = [
  [
    'AAAABBBCC',
    'AAAABBBCC',
    'DDDDBBBEE',
    'DDDDSFFEE',
    'GGGGSFFHH',
    'GGGGFFFHH',
  ],
  [
    'PPPPQQQRR',
    'PPPPQQQRR',
    'SSSSQQQTT',
    'SSSSUUUTT',
    'VVVVUUUWW',
    'VVVVUUUWW',
  ],
];

export const CELL = 3;
export const WALL_H = 3; // also the height of one storey
const THICK = 0.2;
const DOOR_W = 1.2, DOOR_H = 2.2;
const WIN_W = 1.1, WIN_H = 1.87, WIN_Y = 0.7; // window tiles are ~0.59 aspect
const TILE_W = 2.5, TILE_H = 4.2;             // world size one texture tile covers

// stairs run south (+z) from the ground floor up to the upper floor
const STAIR = { col: 4, row: 3, cells: 2 };
export const stair = {
  x0: STAIR.col * CELL, x1: (STAIR.col + 1) * CELL,
  z0: STAIR.row * CELL, z1: (STAIR.row + STAIR.cells) * CELL,
  rise: WALL_H,
};
const holeCells = new Set();
for (let i = 0; i < STAIR.cells; i++) holeCells.add(`${STAIR.col},${STAIR.row + i}`);

const COUNT = { wall: 10, floor: 10, window: 10 };

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadTextures(renderer) {
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const out = {};
  for (const [kind, n] of Object.entries(COUNT)) {
    out[kind] = [];
    for (let i = 0; i < n; i++) {
      const name = `${kind}_${String(i).padStart(2, '0')}`;
      // single-file builds can embed textures as data URIs on globalThis.__DR_TEX
      const t = loader.load(globalThis.__DR_TEX?.[name] ?? `assets/textures/${name}.jpg`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      out[kind].push(t);
    }
  }
  return out;
}

const matCache = new Map();
function mat(tex, tint = 0xffffff, side = THREE.FrontSide) {
  const key = tex.uuid + tint + side;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ map: tex, color: tint, side }));
  return matCache.get(key);
}

// scale a BoxGeometry's UVs so textures keep a constant world size
function metricUVs(geo, sx, sy, sz) {
  const uv = geo.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / TILE_W, uv.getY(i) * dims[f][1] / TILE_H);
    }
  }
}

// ---- generator ----------------------------------------------------------
export function buildHouse(renderer, seed = 1) {
  const rand = rng(seed);
  const tex = loadTextures(renderer);
  const group = new THREE.Group();
  const colliders = []; // {minX,maxX,minZ,maxZ,level}
  const rooms = [];     // {pos, base}: one per room, feeds the light pool
  const outside = mat(tex.wall[4], 0x555555);

  FLOORS.forEach((MAP, level) => buildFloor(MAP, level));
  buildStairs();

  function buildFloor(MAP, level) {
    const g = new THREE.Group();
    g.position.y = level * WALL_H;
    group.add(g);
    const rows = MAP.length, cols = MAP[0].length;
    const at = (c, r) => (r < 0 || c < 0 || r >= rows || c >= cols ? null : MAP[r][c]);
    const upper = level > 0, lower = level < FLOORS.length - 1;

    // per-room look
    const ids = [...new Set(MAP.join(''))];
    const look = {};
    for (const id of ids) {
      look[id] = {
        wall: tex.wall[Math.floor(rand() * COUNT.wall)],
        floor: tex.floor[Math.floor(rand() * COUNT.floor)],
        sx: 0, sz: 0, n: 0,
      };
    }
    const wallMat = id => (id ? mat(look[id].wall) : outside);

    // doors: random spanning tree over room adjacency, plus a few loops.
    // Edge keys: 'h' = wall on top of cell (c,r), 'v' = wall on left of cell (c,r).
    const edgesByPair = new Map();
    const key = (dir, c, r) => `${dir}${c},${r}`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      for (const [dir, nc, nr] of [['h', c, r - 1], ['v', c - 1, r]]) {
        const a = at(c, r), b = at(nc, nr);
        if (!b || a === b) continue;
        // the ground-floor stairwell only opens on its north end
        if (lower && (a === 'S' || b === 'S') && key(dir, c, r) !== key('h', STAIR.col, STAIR.row)) continue;
        const pair = [a, b].sort().join('|');
        if (!edgesByPair.has(pair)) edgesByPair.set(pair, []);
        edgesByPair.get(pair).push(key(dir, c, r));
      }
    }
    const pairs = [...edgesByPair.keys()].sort(() => rand() - 0.5);
    const parent = Object.fromEntries(ids.map(i => [i, i]));
    const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const doors = new Set();
    for (const p of pairs) {
      const [a, b] = p.split('|');
      const list = edgesByPair.get(p);
      if (find(a) !== find(b)) {
        parent[find(a)] = find(b);
        doors.add(list[Math.floor(rand() * list.length)]);
      } else if (rand() < 0.25 && !(lower && p.includes('S'))) {
        doors.add(list[Math.floor(rand() * list.length)]);
      }
    }

    // floors & ceilings (the stair opening has neither on the storeys it joins)
    const ceilTex = tex.floor[3];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = at(c, r), lk = look[id];
      const x = (c + 0.5) * CELL, z = (r + 0.5) * CELL;
      const hole = holeCells.has(`${c},${r}`);
      const geo = new THREE.PlaneGeometry(CELL, CELL);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * CELL / TILE_W, uv.getY(i) * CELL / TILE_H);
      if (!(upper && hole)) {
        const floor = new THREE.Mesh(geo, mat(lk.floor));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, 0, z);
        g.add(floor);
      }
      if (!(lower && hole)) {
        const ceil = new THREE.Mesh(geo, mat(ceilTex, 0xaaaaaa));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(x, WALL_H, z);
        g.add(ceil);
      }
      lk.sx += x; lk.sz += z; lk.n++;
    }

    // wall piece along X (faces +/-z) or along Z (faces +/-x)
    function piece(axis, cx, cz, len, y0, y1, posMat, negMat, solid = true) {
      const h = y1 - y0;
      if (len <= 0.001 || h <= 0.001) return;
      const sx = axis === 'x' ? len : THICK, sz = axis === 'x' ? THICK : len;
      const geo = new THREE.BoxGeometry(sx, h, sz);
      metricUVs(geo, sx, h, sz);
      const side = mat(tex.wall[4], 0x333333);
      const mats = axis === 'x'
        ? [side, side, side, side, posMat, negMat]
        : [posMat, negMat, side, side, side, side];
      const m = new THREE.Mesh(geo, mats);
      m.position.set(cx, y0 + h / 2, cz);
      g.add(m);
      if (solid) colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, level });
    }

    // One wall edge. +face looks toward +z (h) / +x (v), -face the other way.
    function wallEdge(dir, c, r) {
      const neg = dir === 'h' ? at(c, r - 1) : at(c - 1, r);
      const pos = at(c, r);
      if (pos === neg) return;
      const axis = dir === 'h' ? 'x' : 'z';
      const cx = dir === 'h' ? (c + 0.5) * CELL : c * CELL;
      const cz = dir === 'h' ? r * CELL : (r + 0.5) * CELL;
      const posMat = wallMat(pos), negMat = wallMat(neg);
      const L = CELL + THICK; // overlap so corners close
      const along = o => (axis === 'x' ? [cx + o, cz] : [cx, cz + o]);
      const k = key(dir, c, r);
      const opening = (w) => {
        const side = (L - w) / 2, off = (w + side) / 2;
        let [x, z] = along(-off); piece(axis, x, z, side, 0, WALL_H, posMat, negMat);
        [x, z] = along(off); piece(axis, x, z, side, 0, WALL_H, posMat, negMat);
        return along(0);
      };
      if (doors.has(k)) {
        const [x, z] = opening(DOOR_W);
        piece(axis, x, z, DOOR_W, DOOR_H, WALL_H, posMat, negMat, false);
      } else if ((!pos || !neg) && rand() < 0.7) {
        const [x, z] = opening(WIN_W);
        piece(axis, x, z, WIN_W, 0, WIN_Y, posMat, negMat, false);
        piece(axis, x, z, WIN_W, WIN_Y + WIN_H, WALL_H, posMat, negMat, false);
        const hw = WIN_W / 2, t = THICK / 2;
        colliders.push(axis === 'x'
          ? { minX: x - hw, maxX: x + hw, minZ: z - t, maxZ: z + t, level }
          : { minX: x - t, maxX: x + t, minZ: z - hw, maxZ: z + hw, level });
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H),
          mat(tex.window[Math.floor(rand() * COUNT.window)], 0xffffff, THREE.DoubleSide));
        glass.position.set(x, WIN_Y + WIN_H / 2, z);
        if (axis === 'z') glass.rotation.y = Math.PI / 2;
        g.add(glass);
      } else {
        const [x, z] = along(0);
        piece(axis, x, z, L, 0, WALL_H, posMat, negMat);
      }
    }

    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      if (c < cols) wallEdge('h', c, r);
      if (r < rows) wallEdge('v', c, r);
    }

    // railings around the stair opening, open on the south side where the stairs arrive
    if (upper) {
      const rail = mat(tex.floor[2], 0x777777);
      const add = (x, z, sx, sz) => {
        const geo = new THREE.BoxGeometry(sx, 1, sz);
        metricUVs(geo, sx, 1, sz);
        const m = new THREE.Mesh(geo, rail);
        m.position.set(x, 0.5, z);
        g.add(m);
        colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, level });
      };
      const w = stair.x1 - stair.x0, d = stair.z1 - stair.z0, t = 0.08;
      add(stair.x0 + t / 2, stair.z0 + d / 2, t, d);
      add(stair.x1 - t / 2, stair.z0 + d / 2, t, d);
      add(stair.x0 + w / 2, stair.z0 + t / 2, w, t);
    }

    for (const id of ids) {
      const lk = look[id];
      rooms.push({ pos: new THREE.Vector3(lk.sx / lk.n, level * WALL_H + WALL_H - 0.4, lk.sz / lk.n), base: 0.6 + rand() * 0.5 });
    }
  }

  function buildStairs() {
    const steps = 15, run = (stair.z1 - stair.z0) / steps, rise = stair.rise / steps;
    const w = stair.x1 - stair.x0;
    const m = mat(tex.floor[2], 0x999999);
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise;
      const geo = new THREE.BoxGeometry(w, top, run);
      metricUVs(geo, w, top, run);
      const s = new THREE.Mesh(geo, m);
      s.position.set(stair.x0 + w / 2, top / 2, stair.z0 + run * (i + 0.5));
      group.add(s);
    }
  }

  const size = { w: FLOORS[0][0].length * CELL, d: FLOORS[0].length * CELL };
  return { group, colliders, rooms, size, stair, levels: FLOORS.length, spawn: new THREE.Vector3(1.5 * CELL, 0, 1.5 * CELL) };
}
