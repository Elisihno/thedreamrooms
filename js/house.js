import * as THREE from '../vendor/three.module.min.js';
import { ITEMS, ROLE_ITEMS, buildMannequin } from './furniture.js';

// ---- layout -------------------------------------------------------------
// One map per storey, bottom to top. Each letter is a room; every character is one
// CELL x CELL square. 'S' marks a stairwell that climbs to the storey above (see STAIRS).
// On the storey above, the stair's two cells plus the cell south of them belong to one
// room: that is where the stairs arrive.
const LEVELS = [
  {
    name: 'Basement', windows: 0,
    roles: { A: 'storage', B: 'storage', C: 'storage', D: 'storage', E: 'storage' },
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
    roles: { P: 'living', Q: 'dining', R: 'kitchen', T: 'living', U: 'hall', V: 'pantry', W: 'bedroom' },
    // kitchen table in the kitchen, a rug and coffee table in each of the two living rooms
    fixed: [
      { item: 'tablechairs', cell: [7, 0] },
      { item: 'livingset', cell: [0, 0] },
      { item: 'livingset', cell: [7, 2] },
    ],
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
    roles: { P: 'bedroom', Q: 'bedroom', R: 'study', T: 'bedroom', U: 'hall', V: 'bedroom' },
    // the player starts in room P: [col, row] of the spawn cell, plus pieces fixed to a cell
    spawn: [1, 1],
    fixed: [{ item: 'roundtable', cell: [1, 0] }, { item: 'tablechairs', cell: [0, 1], turn: 1 }],
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
    roles: { A: 'attic', B: 'attic', C: 'attic', D: 'attic' },
    mannequins: [[2, 1], [1, 4], [6, 4]], // [col, row] of each mannequin's cell
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
const COUNT = { wall: 10, floor: 10, window: 10, furniture: 1 };

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
function makeBatch(tw = TILE_W, th = TILE_H) {
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
        if (ay >= ax && ay >= az) { u = x / tw; v = z / th; }
        else if (ax >= az) { u = z / tw; v = y / th; }
        else { u = x / tw; v = y / th; }
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
    // upright cylinder centred at (cx, cy, cz)
    cyl(r, h, cx, cy, cz, material) {
      const geo = new THREE.CylinderGeometry(r, r, h, 20).toNonIndexed();
      geo.translate(cx, cy, cz);
      add(geo, material);
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

// Merged geometry for one movable part, built around its pivot. Colours come from the
// boxes' materials as vertex colours, so a part is a single mesh with one shared material.
function partGeometry(boxes, pivot) {
  const P = [], N = [], U = [], C = [];
  for (const [w, h, d, x, y0, zc, material] of boxes) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / 1.4, uv.getY(i) * dims[f][1] / 1.4);
    }
    g.translate(x - pivot[0], y0 + h / 2 - pivot[1], zc - pivot[2]);
    const ng = g.toNonIndexed(), n = ng.attributes.position.count;
    P.push(ng.attributes.position.array); N.push(ng.attributes.normal.array); U.push(ng.attributes.uv.array);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = material.color.r; col[i * 3 + 1] = material.color.g; col[i * 3 + 2] = material.color.b; }
    C.push(col);
  }
  const cat = a => { const o = new Float32Array(a.reduce((t, x) => t + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cat(P), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(cat(N), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(cat(U), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(cat(C), 3));
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
  const mannequins = [];
  const parts = [];      // movable furniture parts (drawers, doors, lids)
  const partMeshes = [];
  const pickables = []; // everything the crosshair can land on
  const hideSpots = [];
  const items = [];      // things to find in drawers and chests
  const itemMeshes = [];
  const partMat = new THREE.MeshLambertMaterial({ map: tex.furniture[0], vertexColors: true });
  const fm = tint => mat(tex.furniture[0], tint);
  const plainCache = new Map();
  const plain = color => {
    if (!plainCache.has(color)) plainCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return plainCache.get(color);
  };
  const pal = {
    body: fm(0xc8b8a4), dark2: fm(0x8a7e70), light: fm(0xf0e8dc),
    cloth: fm(0xa89288), paper: fm(0xb09a78), dark: plain(0x161312),
  };

  LEVELS.forEach((cfg, level) => buildFloor(cfg, level));
  stairs.forEach(buildStairs);
  placeLoot();

  // One pair of cutting pliers in a single drawer, and one key per storey, preferably in a chest.
  function placeLoot() {
    const loader = new THREE.TextureLoader();
    const spec = { key: { w: 0.34, h: 0.19 }, pliers: { w: 0.27, h: 0.28 } };
    const place = (type, part) => {
      const t = loader.load(globalThis.__DR_TEX?.[`item_${type}`] ?? `assets/textures/item_${type}.png`);
      t.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(spec[type].w, spec[type].h),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xd8d8d8 }));
      mesh.rotation.order = 'YXZ';
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.y = (rand() - 0.5) * 1.4;
      mesh.position.set(...part.loot.pos);
      part.loot.parent.add(mesh);
      const item = { kind: 'item', type, part, mesh };
      mesh.userData.item = item;
      items.push(item);
      itemMeshes.push(mesh);
      part.hasItem = true;
    };
    const holders = parts.filter(p => p.loot);
    const pliersAt = pick(holders.filter(p => p.kind === 'drawer'));
    place('pliers', pliersAt);
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const here = holders.filter(p => p.level === lv && !p.hasItem);
      if (!here.length) continue;
      const chests = here.filter(p => p.kind === 'flap');
      place('key', pick(chests.length ? chests : here));
    }
    pickables.push(...partMeshes, ...itemMeshes);
  }

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
    const winEdges = new Set();
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
        winEdges.add(k);
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


    // Furniture sits against walls, one item per cell, never in the stair cells or in
    // front of a doorway. Cells with a door only take shallow items, so paths stay clear.
    // Tables with chairs stand free in the middle of a roomy cell without a door.
    function furnish() {
      const fb = makeBatch(1.4, 1.4);
      const used = new Set([...ceilHole, ...floorHole]);
      if (down) used.add(`${down.col},${down.row + SPAN}`);
      if (up) used.add(`${up.col},${up.row - 1}`);
      for (const [c, r] of cfg.mannequins ?? []) used.add(`${c},${r}`);
      if (cfg.spawn) used.add(cfg.spawn.join(','));
      const cellsByRoom = {};
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) (cellsByRoom[at(c, r)] ??= []).push([c, r]);
      const centred = new Set(); // rooms that already hold a free-standing set
      const hasDoor = (c, r) => [['h', c, r], ['h', c, r + 1], ['v', c, r], ['v', c + 1, r]].some(([d, ec, er]) => doors.has(key(d, ec, er)));

      for (const f of cfg.fixed ?? []) {
        const [c, r] = f.cell;
        used.add(`${c},${r}`);
        centred.add(at(c, r));
        placeItem(fb, ITEMS[f.item], c, r, null, f.turn ?? 0);
      }

      for (const [id, role] of Object.entries(cfg.roles ?? {})) {
        const cells = cellsByRoom[id] ?? [];
        for (const name of ROLE_ITEMS[role] ?? []) {
          const item = ITEMS[name];
          if (item.center) {
            if (centred.has(id) || cells.length < 6) continue;
            const free = cells.filter(([c, r]) => !used.has(`${c},${r}`) && !hasDoor(c, r));
            if (!free.length) continue;
            const [c, r] = pick(free);
            used.add(`${c},${r}`);
            centred.add(id);
            placeItem(fb, item, c, r, null, rand() < 0.5 ? 0 : 1);
            continue;
          }
          const slots = [];
          for (const [c, r] of cells) {
            if (used.has(`${c},${r}`)) continue;
            const edges = [['N', 'h', c, r], ['S', 'h', c, r + 1], ['W', 'v', c, r], ['E', 'v', c + 1, r]];
            if (hasDoor(c, r) && item.d > 0.75) continue;
            for (const [side, d, ec, er] of edges) {
              const k = key(d, ec, er);
              if (has(d, ec, er) && !doors.has(k) && !(winEdges.has(k) && item.tall)) slots.push([c, r, side]);
            }
          }
          if (!slots.length) continue;
          const [c, r, side] = pick(slots);
          used.add(`${c},${r}`);
          placeItem(fb, item, c, r, side);
        }
      }

      for (const [c, r] of cfg.mannequins ?? []) {
        const x = (c + 0.5) * CELL, z = (r + 0.5) * CELL;
        const pivot = new THREE.Group();
        pivot.position.set(x, Y, z);
        const body = buildMannequin(fm(0xd0c8bc));
        body.rotation.y = rand() * Math.PI * 2;
        pivot.add(body);
        group.add(pivot);
        const col = { minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25, level };
        colliders.push(col);
        mannequins.push({ pivot, x, z, y: Y, level, col, fell: false, landed: false, t: 0, axis: new THREE.Vector3() });
      }
      fb.flush(group);
    }

    // side: the wall the item backs onto ('N','S','W','E'), or null for a free-standing item
    // in the middle of the cell, turned by `turn` quarter turns.
    function placeItem(fb, item, c, r, side, turn = 0) {
      const cx = (c + 0.5) * CELL, cz = (r + 0.5) * CELL, gap = HT + 0.03;
      const base = side === 'N' ? [cx, r * CELL + gap] : side === 'S' ? [cx, (r + 1) * CELL - gap]
        : side === 'W' ? [c * CELL + gap, cz] : side === 'E' ? [(c + 1) * CELL - gap, cz] : [cx, cz];
      const ang = side ? { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[side] : turn * Math.PI / 2;
      const cs = Math.round(Math.cos(ang)), sn = Math.round(Math.sin(ang));
      // item-local (x across, z out) -> world; the rotation is a multiple of 90 degrees
      const xf = (lx, lz) => [base[0] + lx * cs + lz * sn, base[1] - lx * sn + lz * cs];
      const swap = sn !== 0;
      const b = (w, h, d, x, y0, zc, material) => {
        const [wx, wz] = xf(x, zc);
        fb.box(swap ? d : w, h, swap ? w : d, wx, Y + y0 + h / 2, wz, Array(6).fill(material));
      };
      b.cyl = (rad, h, x, y0, zc, material) => {
        const [wx, wz] = xf(x, zc);
        fb.cyl(rad, h, wx, Y + y0 + h / 2, wz, material);
      };

      let itemGroup = null;
      const makePart = (boxes, pivot, extra) => {
        if (!itemGroup) {
          itemGroup = new THREE.Group();
          itemGroup.position.set(base[0], Y, base[1]);
          itemGroup.rotation.y = ang;
          group.add(itemGroup);
        }
        const pg = new THREE.Group();
        pg.position.set(...pivot);
        const mesh = new THREE.Mesh(partGeometry(boxes, pivot), partMat);
        pg.add(mesh);
        itemGroup.add(pg);
        const part = { pg, pivot, level, open: false, t: 0, ...extra };
        if (extra.kind === 'drawer') {
          // on top of the drawer box, near its front, so it slides out into view
          const [, h, d, x, y0, zc] = boxes[0];
          part.loot = { parent: pg, pos: [x - pivot[0], y0 + h + 0.012 - pivot[1], zc + d * 0.2 - pivot[2]] };
        } else if (extra.lootPos) {
          part.loot = { parent: itemGroup, pos: extra.lootPos };
        }
        mesh.userData.part = part;
        parts.push(part);
        partMeshes.push(mesh);
      };
      const mv = {
        drawer: (boxes, dist) => makePart(boxes, [0, 0, 0], { kind: 'drawer', dist }),
        door: (boxes, hx, hz, hinge) => makePart(boxes, [hx, 0, hz], { kind: 'door', angle: hinge > 0 ? -1.9 : 1.9 }),
        flap: (boxes, hy, hz, angle, lootPos) => makePart(boxes, [0, hy, hz], { kind: 'flap', angle, lootPos }),
      };
      item.build(b, pal, mv);

      if (item.hide) {
        // an invisible box over the table or bed: look at it to hide underneath
        const hd = item.hide, [wx, wz] = xf(hd.x, hd.z);
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(swap ? hd.d : hd.w, hd.h, swap ? hd.w : hd.d), new THREE.MeshBasicMaterial({ visible: false }));
        proxy.position.set(wx, Y + hd.h / 2, wz);
        group.add(proxy);
        const spot = { x: wx, z: wz, level, eye: hd.eye };
        spot.target = { kind: 'hide', spot };
        proxy.userData.hide = spot;
        pickables.push(proxy);
        hideSpots.push(spot);
      }

      for (const [w, d, lx, lz] of item.colliders ?? [[item.w, item.d, 0, item.d / 2]]) {
        const [ax, az] = xf(lx - w / 2, lz - d / 2), [bx, bz] = xf(lx + w / 2, lz + d / 2);
        colliders.push({ minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz), level });
      }
    }

    furnish();
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

  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.3;
  const centre = new THREE.Vector2(0, 0);
  const spawnLevel = Math.max(0, LEVELS.findIndex(l => l.spawn));
  const spawnCell = LEVELS[spawnLevel].spawn ?? [4, 1];
  const first = LEVELS[0].map;
  const size = { w: first[0].length * CELL, d: first.length * CELL };
  // A mannequin topples away from the player once they walk up to it.
  const FALL = 0.8, BOUNCE = 0.3;
  const api = {
    group, colliders, rooms, size, stairs, mannequins,
    levels: LEVELS.map(l => l.name),
    spawn: new THREE.Vector3((spawnCell[0] + 0.5) * CELL, levelY(spawnLevel), (spawnCell[1] + 0.5) * CELL),
    spawnLevel,
    parts,
    onThud: null,
    onUse: null,
    onPickup: null,
    onHide: null,
    items,
    hideSpots,
    // what the camera is looking at within reach: an item lying in an opened drawer or
    // chest (preferred), otherwise a movable part
    pick(camera, player) {
      raycaster.setFromCamera(centre, camera);
      let part = null;
      for (const hit of raycaster.intersectObjects(pickables, false)) {
        const item = hit.object.userData.item;
        if (item) {
          if (item.part.open && item.part.t > 0.85 && item.part.level === player.level) return item;
        } else if (!part) {
          const spot = hit.object.userData.hide;
          if (spot) { if (spot.level === player.level) part = spot.target; }
          else if (hit.object.userData.part.level === player.level) part = hit.object.userData.part;
        }
      }
      return part;
    },
    use(target) {
      if (target.kind === 'hide') { api.onHide?.(target.spot); return; }
      if (target.kind === 'item') {
        target.mesh.removeFromParent();
        pickables.splice(pickables.indexOf(target.mesh), 1);
        target.part.hasItem = false;
        api.onPickup?.(target.type);
        return;
      }
      target.open = !target.open;
      api.onUse?.(target.kind, target.open);
    },
    update(dt, player) {
      for (const part of parts) {
        const goal = part.open ? 1 : 0;
        if (part.t === goal) continue;
        part.t += Math.sign(goal - part.t) * Math.min(Math.abs(goal - part.t), dt * 3.5);
        const e = part.t * part.t * (3 - 2 * part.t);
        if (part.kind === 'drawer') part.pg.position.z = part.pivot[2] + part.dist * e;
        else if (part.kind === 'door') part.pg.rotation.y = part.angle * e;
        else part.pg.rotation.x = part.angle * e;
      }
      for (const m of mannequins) {
        if (!m.fell) {
          const dx = m.x - player.pos.x, dz = m.z - player.pos.z, d = Math.hypot(dx, dz);
          if (player.level !== m.level || d > 0.8) continue;
          m.fell = true;
          m.axis.set(dz / (d || 1), 0, -dx / (d || 1)); // tips the head away from the player
          const i = colliders.indexOf(m.col);
          if (i >= 0) colliders.splice(i, 1);
        }
        if (m.t >= FALL + BOUNCE) continue;
        m.t += dt;
        let a;
        if (m.t < FALL) a = (Math.PI / 2) * (m.t / FALL) ** 2;
        else {
          a = Math.PI / 2 - 0.1 * Math.sin(Math.min(1, (m.t - FALL) / BOUNCE) * Math.PI);
          if (!m.landed) { m.landed = true; api.onThud?.(); }
        }
        m.pivot.quaternion.setFromAxisAngle(m.axis, a);
        m.pivot.position.y = m.y + 0.17 * Math.min(1, a / (Math.PI / 2));
      }
    },
  };
  return api;
}
