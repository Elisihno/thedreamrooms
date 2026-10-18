import * as THREE from '../vendor/three.module.min.js';

// ---- layout -------------------------------------------------------------
// Each letter is a room; every character is one CELL x CELL square.
const MAP = [
  'AAAABBBCC',
  'AAAABBBCC',
  'DDDDBBBEE',
  'DDDDFFFEE',
  'GGGGFFFHH',
  'GGGGFFFHH',
];

export const CELL = 3;
export const WALL_H = 3;
const THICK = 0.2;
const DOOR_W = 1.2, DOOR_H = 2.2;
const WIN_W = 1.1, WIN_H = 1.87, WIN_Y = 0.7; // window tiles are ~0.59 aspect
const TILE_W = 2.5, TILE_H = 4.2;             // world size one texture tile covers

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
      const t = loader.load(`assets/textures/${kind}_${String(i).padStart(2, '0')}.jpg`);
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
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const rows = MAP.length, cols = MAP[0].length;
  const at = (c, r) => (r < 0 || c < 0 || r >= rows || c >= cols ? null : MAP[r][c]);

  // per-room look
  const ids = [...new Set(MAP.join(''))];
  const look = {};
  for (const id of ids) {
    look[id] = {
      wall: tex.wall[Math.floor(rand() * COUNT.wall)],
      floor: tex.floor[Math.floor(rand() * COUNT.floor)],
      center: new THREE.Vector3(),
      n: 0,
    };
  }
  const outside = mat(tex.wall[4], 0x555555);

  // doors: random spanning tree over room adjacency, plus a few loops
  const edgesByPair = new Map(); // "A|B" -> [{key}]
  const edgeKey = (dir, c, r) => `${dir}${c},${r}`; // h: wall on top of cell, v: wall on left of cell
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    for (const [dir, nc, nr] of [['h', c, r - 1], ['v', c - 1, r]]) {
      const a = at(c, r), b = at(nc, nr);
      if (!b || a === b) continue;
      const pair = [a, b].sort().join('|');
      if (!edgesByPair.has(pair)) edgesByPair.set(pair, []);
      edgesByPair.get(pair).push(edgeKey(dir, c, r));
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
    } else if (rand() < 0.25) {
      doors.add(list[Math.floor(rand() * list.length)]);
    }
  }

  // floors & ceilings
  const ceilTex = tex.floor[3];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = at(c, r), lk = look[id];
    const geo = new THREE.PlaneGeometry(CELL, CELL);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * CELL / TILE_W, uv.getY(i) * CELL / TILE_H);
    const x = (c + 0.5) * CELL, z = (r + 0.5) * CELL;
    const floor = new THREE.Mesh(geo, mat(lk.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0, z);
    const ceil = new THREE.Mesh(geo, mat(ceilTex, 0xaaaaaa));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(x, WALL_H, z);
    group.add(floor, ceil);
    lk.center.x += x; lk.center.z += z; lk.n++;
  }

  // wall piece: axis 'x' runs along X (faces +/-z); axis 'z' runs along Z (faces +/-x)
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
    group.add(m);
    if (solid) colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
  }

  function wallEdge(dir, c, r) {
    const here = at(c, r), there = dir === 'h' ? at(c, r - 1) : at(c - 1, r);
    if (here === there) return;
    const isOuter = !there;
    const axis = dir === 'h' ? 'x' : 'z';
    // wall centre line
    const cx = dir === 'h' ? (c + 0.5) * CELL : c * CELL;
    const cz = dir === 'h' ? r * CELL : (r + 0.5) * CELL;
    // +face looks toward +z (h) or +x (v), i.e. into the cell (c,r)
    const posMat = mat(look[here].wall);
    const negMat = isOuter ? outside : mat(look[there].wall);
    // extend so corners close
    const L = CELL + THICK;
    const key = edgeKey(dir, c, r);
    const along = (o) => (axis === 'x' ? [cx + o, cz] : [cx, cz + o]);
    if (doors.has(key)) {
      const side = (L - DOOR_W) / 2;
      const off = (DOOR_W + side) / 2;
      let [x, z] = along(-off); piece(axis, x, z, side, 0, WALL_H, posMat, negMat);
      [x, z] = along(off); piece(axis, x, z, side, 0, WALL_H, posMat, negMat);
      [x, z] = along(0); piece(axis, x, z, DOOR_W, DOOR_H, WALL_H, posMat, negMat, false);
    } else if (isOuter && rand() < 0.7) {
      const side = (L - WIN_W) / 2;
      const off = (WIN_W + side) / 2;
      let [x, z] = along(-off); piece(axis, x, z, side, 0, WALL_H, posMat, negMat);
      [x, z] = along(off); piece(axis, x, z, side, 0, WALL_H, posMat, negMat);
      [x, z] = along(0);
      piece(axis, x, z, WIN_W, 0, WIN_Y, posMat, negMat, false);
      piece(axis, x, z, WIN_W, WIN_Y + WIN_H, WALL_H, posMat, negMat, false);
      colliders.push({ minX: x - (axis === 'x' ? WIN_W / 2 : THICK / 2), maxX: x + (axis === 'x' ? WIN_W / 2 : THICK / 2),
                       minZ: z - (axis === 'x' ? THICK / 2 : WIN_W / 2), maxZ: z + (axis === 'x' ? THICK / 2 : WIN_W / 2) });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H),
        mat(tex.window[Math.floor(rand() * COUNT.window)], 0xffffff, THREE.DoubleSide));
      glass.position.set(x, WIN_Y + WIN_H / 2, z);
      if (axis === 'z') glass.rotation.y = Math.PI / 2;
      group.add(glass);
    } else {
      const [x, z] = along(0);
      piece(axis, x, z, L, 0, WALL_H, posMat, negMat);
    }
  }

  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    if (c < cols) wallEdgeSafe('h', c, r);
    if (r < rows) wallEdgeSafe('v', c, r);
  }
  // at(r=rows) is outside, so bottom/right borders need the neighbour's view flipped
  function wallEdgeSafe(dir, c, r) {
    if (dir === 'h' && r === rows) return bottomEdge(c);
    if (dir === 'v' && c === cols) return rightEdge(r);
    wallEdge(dir, c, r);
  }
  // Border walls on the far sides: draw them facing inward by reusing the
  // 'h'/'v' logic with the wall assigned to the last row/column's far edge.
  function bottomEdge(c) {
    const id = at(c, rows - 1), cx = (c + 0.5) * CELL, cz = rows * CELL;
    border('x', cx, cz, id, -1);
  }
  function rightEdge(r) {
    const id = at(cols - 1, r), cx = cols * CELL, cz = (r + 0.5) * CELL;
    border('z', cx, cz, id, -1);
  }
  function border(axis, cx, cz, id, _s) {
    const L = CELL + THICK;
    const inner = mat(look[id].wall);
    // neg face looks into the room for far-side walls
    if (rand() < 0.7) {
      const side = (L - WIN_W) / 2, off = (WIN_W + side) / 2;
      const p = (o) => (axis === 'x' ? [cx + o, cz] : [cx, cz + o]);
      let [x, z] = p(-off); piece(axis, x, z, side, 0, WALL_H, outside, inner);
      [x, z] = p(off); piece(axis, x, z, side, 0, WALL_H, outside, inner);
      [x, z] = p(0);
      piece(axis, x, z, WIN_W, 0, WIN_Y, outside, inner, false);
      piece(axis, x, z, WIN_W, WIN_Y + WIN_H, WALL_H, outside, inner, false);
      const half = WIN_W / 2, t = THICK / 2;
      colliders.push(axis === 'x'
        ? { minX: x - half, maxX: x + half, minZ: z - t, maxZ: z + t }
        : { minX: x - t, maxX: x + t, minZ: z - half, maxZ: z + half });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H),
        mat(tex.window[Math.floor(rand() * COUNT.window)], 0xffffff, THREE.DoubleSide));
      glass.position.set(x, WIN_Y + WIN_H / 2, z);
      if (axis === 'z') glass.rotation.y = Math.PI / 2;
      group.add(glass);
    } else {
      piece(axis, cx, cz, L, 0, WALL_H, outside, inner);
    }
  }

  // dim light per room
  const lights = [];
  for (const id of ids) {
    const lk = look[id];
    const l = new THREE.PointLight(0xffd9a0, 1.4, 8, 1.4);
    l.position.set(lk.center.x / lk.n, WALL_H - 0.4, lk.center.z / lk.n);
    l.userData.base = 0.5 + rand() * 0.5;
    group.add(l);
    lights.push(l);
  }

  const size = { w: cols * CELL, d: rows * CELL };
  return { group, colliders, lights, size, spawn: new THREE.Vector3(1.5 * CELL, 1.6, 1.5 * CELL), doors };
}
