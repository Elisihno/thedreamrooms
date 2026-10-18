import * as THREE from '../vendor/three.module.min.js';

// ---- layout -------------------------------------------------------------
// One map per storey, bottom to top. Each letter is a room; every character is one
// CELL x CELL square. 'S' marks a stairwell that climbs to the storey above (see STAIRS).
// On the storey above, the stair's two cells plus the cell south of them belong to one
// room: that is where the stairs arrive.
const LEVELS = [
  {
    name: 'Basement', windows: 0,
    walls: [0, 1, 4, 6], floors: [1, 5, 6],
    map: [
      'AAAABBBBB',
      'ASAABBBBB',
      'ASAABBBBB',
      'CCCCDDDEE',
      'CCCCDDDEE',
      'CCCCDDDEE',
    ],
  },
  {
    name: 'Base Floor', windows: 0.7,
    walls: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], floors: [0, 2, 3, 4, 7, 8, 9],
    map: [
      'PPPQQQRRR',
      'PPPQQQRRR',
      'PPPQQQTTT',
      'PPPUSUTTT',
      'VVVUSUWWW',
      'VVVUUUWWW',
    ],
  },
  {
    name: 'Upper Floor', windows: 0.7,
    walls: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], floors: [0, 2, 3, 4, 7, 8, 9],
    map: [
      'PPPQQQRRR',
      'PPPQQQRSR',
      'PPPQQQRSR',
      'VVVUUUTTT',
      'VVVUUUTTT',
      'VVVUUUTTT',
    ],
  },
  {
    name: 'Attic', windows: 0.45,
    walls: [2, 5, 7, 9], floors: [0, 2, 3, 4, 7, 9],
    map: [
      'AAAAABBBB',
      'AAAAABBBB',
      'AAAAABBBB',
      'CCCCCBBBB',
      'CCCCCDDDD',
      'CCCCCDDDD',
    ],
  },
];
export const GROUND = 1; // index of the Base Floor

// stairs[k] climbs from LEVELS[k] to LEVELS[k+1], running south (+z)
const STAIR_CELLS = [
  { col: 1, row: 1 },
  { col: 4, row: 3 },
  { col: 7, row: 1 },
];

export const CELL = 3;
export const WALL_H = 3; // also the height of one storey
const THICK = 0.2, HT = THICK / 2;
const DOOR_W = 1.2, DOOR_H = 2.2;
const WIN_W = 1.1, WIN_H = 1.87, WIN_Y = 0.7; // window tiles are ~0.59 aspect
const TILE_W = 2.5, TILE_H = 4.2;             // world size one texture tile covers
const SPAN = 2;                                // stair length in cells

export const levelY = i => (i - GROUND) * WALL_H;
const COUNT = { wall: 10, floor: 10, window: 10 };

export const stairs = STAIR_CELLS.map((s, k) => ({
  from: k,
  x0: s.col * CELL, x1: (s.col + 1) * CELL,
  z0: s.row * CELL, z1: (s.row + SPAN) * CELL,
  rise: WALL_H,
  col: s.col, row: s.row,
}));

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
      // mirrored tiling hides the seams, since the source tiles are not seamless
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
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

// Collects world-space geometry per material and builds one mesh per material.
// worldUV: texture coordinates come from world position, so a texture runs on
// unbroken across wall pieces, corners and rooms.
function makeBatch() {
  const parts = new Map();
  const add = (geo, material, worldUV = true) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    let e = parts.get(material);
    if (!e) parts.set(material, (e = { p: [], n: [], u: [] }));
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    let uv = g.attributes.uv.array;
    if (worldUV) {
      uv = new Float32Array(pos.length / 3 * 2);
      for (let i = 0; i < pos.length / 3; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        const ax = Math.abs(nor[i * 3]), ay = Math.abs(nor[i * 3 + 1]), az = Math.abs(nor[i * 3 + 2]);
        let u, v;
        if (ay >= ax && ay >= az) { u = x / TILE_W; v = z / TILE_H; }
        else if (ax >= az) { u = z / TILE_W; v = y / TILE_H; }
        else { u = x / TILE_W; v = y / TILE_H; }
        uv[i * 2] = u; uv[i * 2 + 1] = v;
      }
    }
    e.p.push(pos); e.n.push(nor); e.u.push(uv);
  };
  const cat = (arrs) => {
    const out = new Float32Array(arrs.reduce((a, b) => a + b.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };
  return {
    add,
    // box faces may use different materials: mats = [+x,-x,+y,-y,+z,-z]
    box(sx, sy, sz, cx, cy, cz, mats) {
      const geo = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
      geo.translate(cx, cy, cz);
      for (let f = 0; f < 6; f++) {
        const s = f * 18, e = s + 18;
        const part = new THREE.BufferGeometry();
        part.setAttribute('position', new THREE.BufferAttribute(geo.attributes.position.array.slice(s, e), 3));
        part.setAttribute('normal', new THREE.BufferAttribute(geo.attributes.normal.array.slice(s, e), 3));
        part.setAttribute('uv', new THREE.BufferAttribute(geo.attributes.uv.array.slice(f * 12, f * 12 + 12), 2));
        add(part, mats[f]);
      }
    },
    flush(parent) {
      for (const [material, e] of parts) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(cat(e.p), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(cat(e.n), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(cat(e.u), 2));
        const m = new THREE.Mesh(g, material);
        m.frustumCulled = false;
        parent.add(m);
      }
      parts.clear();
    },
  };
}

function placed(geo, x, y, z, rx = 0, ry = 0) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)).setPosition(x, y, z));
  return geo;
}

// ---- generator ----------------------------------------------------------
export function buildHouse(renderer, seed = 1) {
  const rand = rng(seed);
  const tex = loadTextures(renderer);
  const group = new THREE.Group();
  const colliders = []; // {minX,maxX,minZ,maxZ,level}
  const rooms = [];     // {pos, base}: one per room, feeds the light pool
  const outside = mat(tex.wall[4], 0x555555);
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  LEVELS.forEach((cfg, level) => buildFloor(cfg, level));
  stairs.forEach(buildStairs);

  function buildFloor(cfg, level) {
    const MAP = cfg.map, Y = levelY(level);
    const batch = makeBatch();
    const rows = MAP.length, cols = MAP[0].length;
    const at = (c, r) => (r < 0 || c < 0 || r >= rows || c >= cols ? null : MAP[r][c]);
    const up = stairs[level];       // stairs leaving this storey
    const down = stairs[level - 1]; // stairs arriving from below
    const cellsOf = st => (st ? [0, 1].map(i => `${st.col},${st.row + i}`) : []);
    const ceilHole = new Set(cellsOf(up)), floorHole = new Set(cellsOf(down));

    // per-room look
    const ids = [...new Set(MAP.join(''))];
    const look = {};
    for (const id of ids) {
      look[id] = { wall: tex.wall[pick(cfg.walls)], floor: tex.floor[pick(cfg.floors)], sx: 0, sz: 0, n: 0 };
    }
    const wallMat = id => (id ? mat(look[id].wall) : outside);

    // which wall edges exist: 'h' = on top of cell (c,r), 'v' = on its left
    const key = (dir, c, r) => `${dir}${c},${r}`;
    const has = (dir, c, r) => (dir === 'h' ? at(c, r) !== at(c, r - 1) : at(c, r) !== at(c - 1, r));

    // doors: random spanning tree over room adjacency, plus a few loops
    const edgesByPair = new Map();
    const stairDoor = up ? key('h', up.col, up.row) : null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      for (const [dir, nc, nr] of [['h', c, r - 1], ['v', c - 1, r]]) {
        const a = at(c, r), b = at(nc, nr);
        if (!b || a === b) continue;
        // a stairwell opens only on its north end
        if ((a === 'S' || b === 'S') && key(dir, c, r) !== stairDoor) continue;
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
        doors.add(pick(list));
      } else if (rand() < 0.25 && !p.includes('S')) {
        doors.add(pick(list));
      }
    }

    // floors & ceilings (the stair openings have neither on the storeys they join)
    const ceilTex = tex.floor[3];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = at(c, r), lk = look[id], k = `${c},${r}`;
      const x = (c + 0.5) * CELL, z = (r + 0.5) * CELL;
      if (!floorHole.has(k)) batch.add(placed(new THREE.PlaneGeometry(CELL, CELL), x, Y, z, -Math.PI / 2), mat(lk.floor));
      if (!ceilHole.has(k)) batch.add(placed(new THREE.PlaneGeometry(CELL, CELL), x, Y + WALL_H, z, Math.PI / 2), mat(ceilTex, 0xaaaaaa));
      lk.sx += x; lk.sz += z; lk.n++;
    }

    // Each wall-junction square is owned by exactly one wall piece (west edge first,
    // then east, north, south), which reaches over it; the others stop at its border.
    // That leaves no overlapping coplanar faces, so nothing z-fights at corners.
    const owner = (vc, vr) => [['h', vc - 1, vr], ['h', vc, vr], ['v', vc, vr - 1], ['v', vc, vr]]
      .find(([d, c, r]) => has(d, c, r));
    const reach = (vc, vr, dir, c, r) => {
      const o = owner(vc, vr);
      return o && o[0] === dir && o[1] === c && o[2] === r ? HT : -HT;
    };

    const side = mat(tex.wall[4], 0x333333);
    // wall piece spanning a0..a1 along `axis` at fixed coordinate `f`
    function piece(axis, a0, a1, f, y0, y1, posMat, negMat, solid = true) {
      const len = a1 - a0, h = y1 - y0;
      if (len <= 0.001 || h <= 0.001) return;
      const mid = (a0 + a1) / 2;
      const sx = axis === 'x' ? len : THICK, sz = axis === 'x' ? THICK : len;
      const cx = axis === 'x' ? mid : f, cz = axis === 'x' ? f : mid;
      batch.box(sx, h, sz, cx, Y + y0 + h / 2, cz,
        axis === 'x' ? [side, side, side, side, posMat, negMat] : [posMat, negMat, side, side, side, side]);
      if (solid) colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, level });
    }

    // One wall edge. +face looks toward +z (h) / +x (v), -face the other way.
    function wallEdge(dir, c, r) {
      const neg = dir === 'h' ? at(c, r - 1) : at(c - 1, r);
      const pos = at(c, r);
      if (pos === neg) return;
      const axis = dir === 'h' ? 'x' : 'z';
      const f = dir === 'h' ? r * CELL : c * CELL; // wall centre line
      const start = (dir === 'h' ? c : r) * CELL, end = start + CELL;
      const v0 = dir === 'h' ? [c, r] : [c, r], v1 = dir === 'h' ? [c + 1, r] : [c, r + 1];
      const a0 = start - reach(v0[0], v0[1], dir, c, r);
      const a1 = end + reach(v1[0], v1[1], dir, c, r);
      const mid = start + CELL / 2;
      const posMat = wallMat(pos), negMat = wallMat(neg);
      const k = key(dir, c, r);
      const opening = w => {
        piece(axis, a0, mid - w / 2, f, 0, WALL_H, posMat, negMat);
        piece(axis, mid + w / 2, a1, f, 0, WALL_H, posMat, negMat);
      };
      if (doors.has(k)) {
        opening(DOOR_W);
        piece(axis, mid - DOOR_W / 2, mid + DOOR_W / 2, f, DOOR_H, WALL_H, posMat, negMat, false);
      } else if ((!pos || !neg) && rand() < cfg.windows) {
        opening(WIN_W);
        piece(axis, mid - WIN_W / 2, mid + WIN_W / 2, f, 0, WIN_Y, posMat, negMat, false);
        piece(axis, mid - WIN_W / 2, mid + WIN_W / 2, f, WIN_Y + WIN_H, WALL_H, posMat, negMat, false);
        const hw = WIN_W / 2;
        colliders.push(axis === 'x'
          ? { minX: mid - hw, maxX: mid + hw, minZ: f - HT, maxZ: f + HT, level }
          : { minX: f - HT, maxX: f + HT, minZ: mid - hw, maxZ: mid + hw, level });
        const glass = placed(new THREE.PlaneGeometry(WIN_W, WIN_H),
          axis === 'x' ? mid : f, Y + WIN_Y + WIN_H / 2, axis === 'x' ? f : mid, 0, axis === 'z' ? Math.PI / 2 : 0);
        const gm = mat(tex.window[Math.floor(rand() * COUNT.window)], 0xffffff, THREE.DoubleSide);
        batch.add(glass, gm, false);
      } else {
        piece(axis, a0, a1, f, 0, WALL_H, posMat, negMat);
      }
    }

    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      if (c < cols) wallEdge('h', c, r);
      if (r < rows) wallEdge('v', c, r);
    }

    // railings around the opening for the stairs arriving here, open on the south side
    if (down) {
      const rail = mat(tex.floor[2], 0x777777);
      const t = 0.08, w = down.x1 - down.x0, d = down.z1 - down.z0;
      const add = (x, z, sx, sz) => {
        batch.box(sx, 1, sz, x, Y + 0.5, z, Array(6).fill(rail));
        colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, level });
      };
      add(down.x0 + t / 2, down.z0 + d / 2, t, d);
      add(down.x1 - t / 2, down.z0 + d / 2, t, d);
      add(down.x0 + w / 2, down.z0 + t / 2, w, t);
    }

    batch.flush(group);
    for (const id of ids) {
      const lk = look[id];
      rooms.push({ pos: new THREE.Vector3(lk.sx / lk.n, Y + WALL_H - 0.4, lk.sz / lk.n), base: 0.6 + rand() * 0.5, level });
    }
  }

  function buildStairs(st) {
    const batch = makeBatch();
    const steps = 15, run = (st.z1 - st.z0) / steps, rise = st.rise / steps, w = st.x1 - st.x0;
    const m = mat(tex.floor[2], 0x999999), mats = Array(6).fill(m);
    const y0 = levelY(st.from);
    // each step is a slab one rise thick, so no faces overlap
    for (let i = 0; i < steps; i++) {
      batch.box(w, rise, run, st.x0 + w / 2, y0 + rise * (i + 0.5), st.z0 + run * (i + 0.5), mats);
    }
    batch.flush(group);
  }

  const first = LEVELS[0].map;
  const size = { w: first[0].length * CELL, d: first.length * CELL };
  return {
    group, colliders, rooms, size, stairs,
    levels: LEVELS.map(l => l.name),
    spawn: new THREE.Vector3(4.5 * CELL, levelY(GROUND), 1.5 * CELL),
  };
}
