import * as THREE from '../vendor/three.module.min.js';
import { makeTextures, postcardCanvas } from './textures.js';
import { buildItem } from './models.js';
import { ITEMS, ROLE_ITEMS } from './props.js';
import { SUN } from './outdoors.js';

// ---- layout -------------------------------------------------------------
// One map per storey, bottom to top. Each letter is a room; every character is one
// CELL x CELL square. 'S' marks a stairwell that climbs to the storey above (see STAIRS).
// On the storey above, the stair's two cells plus the cell south of them belong to one
// room: that is where the stairs arrive.
const LEVELS = [
  {
    name: 'Cellar', windows: 0, bones: 6,
    // the one cellar window: a dirty pane up by the ceiling that you can shoot out
    windowEdges: [['v', 0, 4]],
    roles: { A: 'storage', B: 'meat', C: 'storage', D: 'storage', E: 'meat' },
    // the fuse box on the south wall; the storm hatch in the east wall is the second way out
    fixed: [{ item: 'fusebox', cell: [4, 5], side: 'S' }],
    floorItems: [{ item: 'gas', cell: [1, 4] }],
    exits: [
      { id: 'hatch', edge: ['v', 9, 4], style: 'metal', name: 'Storm hatch', locks: [['electric', 1.4], ['padlock', 1.05], ['padlock', 0.7]] },
    ],
  },
  {
    name: 'Ground Floor', windows: 0.78, bones: 1,
    roles: { P: 'living', Q: 'dining', R: 'kitchen', T: 'barn', U: 'hall', V: 'pantry' },
    fixed: [
      { item: 'tablechairs', cell: [4, 1] },
      { item: 'livingset', cell: [0, 0] },
      { item: 'truck', cell: [7, 4] },
      // the kitchen: the long run of cabinets with the sink fills the north wall to the east corner; the
      // icebox stands on the east wall; the stove, the butcher block and the drawers that hold the knife
      // stand along the rest of the north wall, and two counters along the west wall
      { item: 'kitchenrun', cell: [8, 0], side: 'N', shift: -0.83 },
      { item: 'fridge', cell: [8, 0], side: 'E', shift: 1.5 },
      { item: 'counter', cell: [6, 0], side: 'W', shift: -0.5 },
      { item: 'counter', cell: [6, 0], side: 'W', shift: -1.62 },
      { item: 'butcherblock', cell: [6, 0], side: 'N', shift: -0.9 },
      { item: 'kitchendrawers', cell: [6, 0], side: 'N', shift: 0.2 },
      { item: 'stove', cell: [6, 0], side: 'N', shift: 1.1 },
      { item: 'counter', cell: [7, 0], side: 'N', shift: -0.75 },
    ],
    // the front door, in the south wall of the hall: a keypad and two padlocks. The big barn door
    // opens only once the truck is started.
    exits: [
      { id: 'front', edge: ['h', 4, 6], style: 'wood', name: 'Front door', locks: [['code', 1.85], ['padlock', 1.4], ['padlock', 0.95]] },
      { id: 'barn', edge: ['h', 7, 6], style: 'barn', name: 'Barn door', width: 2.6, carOnly: true, locks: [] },
    ],
  },
  {
    name: 'Upper Floor', windows: 0.78, traps: 1,
    roles: { P: 'bedroom', Q: 'bedroom', R: 'study', T: 'bedroom', U: 'hall', V: 'bedroom' },
    // the player starts in room P: [col, row] of the spawn cell, plus pieces fixed to a cell
    spawn: [1, 1],
    fixed: [{ item: 'roundtable', cell: [1, 0], jar: true }],
    floorItems: [{ item: 'flashlight', cell: [2, 1], at: [0.7, 0.3] }],
  },
  {
    name: 'Hayloft', windows: 0.5, bones: 3,
    roles: { A: 'attic', B: 'attic', C: 'attic', D: 'attic' },
    scarecrows: [[2, 1], [1, 4], [6, 4]],   // [col, row] of each scarecrow's cell
    traps: 2,                               // rotten boards that give way under you
    fixed: [{ item: 'lockbox', cell: [8, 0], side: 'N' }],   // holds the shotgun
    floorItems: [{ item: 'battery', cell: [3, 1] }],
  },
];
const MAPS = [
  ['AAAABBBBB', 'ASAABBBBB', 'ASAABBBBB', 'CCCCDDDEE', 'CCCCDDDEE', 'CCCCDDDEE'],
  ['PPPQQQRRR', 'PPPQQQRRR', 'PPPQQQTTT', 'PPPUSUTTT', 'VVVUSUTTT', 'VVVUUUTTT'],
  ['PPPQQQRRR', 'PPPQQQRSR', 'PPPQQQRSR', 'VVVUUUTTT', 'VVVUUUTTT', 'VVVUUUTTT'],
  ['AAAAABBBB', 'AAAAABBBB', 'AAAAABBBB', 'CCCCCBBBB', 'CCCCCDDDD', 'CCCCCDDDD'],
];
LEVELS.forEach((l, i) => { l.map = MAPS[i]; });
export const GROUND = 1; // index of the Ground Floor

// what each kind of room looks like: indexes into the wall and floor textures
const LOOK = {
  living: { wall: [0, 2], floor: [0, 6] }, dining: { wall: [2, 0], floor: [1, 0] }, kitchen: { wall: [1, 7], floor: [2] },
  hall: { wall: [1, 3, 9], floor: [1] }, pantry: { wall: [8, 3], floor: [6] }, bedroom: { wall: [0, 2, 1], floor: [0, 1, 6] },
  study: { wall: [2, 9], floor: [1] }, barn: { wall: [4], floor: [4] }, attic: { wall: [4, 8], floor: [6, 4] },
  storage: { wall: [5, 7], floor: [3] }, meat: { wall: [5, 6], floor: [3] }, stairs: { wall: [3, 1], floor: [1] },
};

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
const WIN_W = 1.1, WIN_H = 1.87, WIN_Y = 0.7;
const TILE = 3;                                // world size one texture tile covers
const SPAN = 2;                                // stair length in cells

export const levelY = i => (i - GROUND) * WALL_H;

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

const matCache = new Map();
function mat(tex, tint = 0xffffff, side = THREE.FrontSide) {
  const key = tex.uuid + ':' + tint + ':' + side;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ map: tex, color: tint, side }));
  return matCache.get(key);
}

// Collects world-space geometry per material and builds one mesh per material.
// worldUV: texture coordinates come from world position, so a texture runs on
// unbroken across wall pieces, corners and rooms.
function makeBatch(tw = TILE, th = TILE) {
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
        if (mats[f]) add(part, mats[f]);   // a null material skips the face
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
        if (material.transparent) m.renderOrder = 2;
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

// A scarecrow on a post, feet at y=0. They tip over when the player comes close.
function buildScarecrow(tex) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, rx = 0, rz = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); g.add(mesh); return mesh; };
  const wood = new THREE.MeshLambertMaterial({ color: 0x6a5238 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x8a3a30 });
  const burlap = new THREE.MeshLambertMaterial({ map: tex.burlap });
  const straw = new THREE.MeshLambertMaterial({ color: 0xd2b25a });
  const dark = new THREE.MeshBasicMaterial({ color: 0x100c08 });
  add(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 12), wood, 0, 0.026, 0);                 // base
  add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), wood, 0, 1.1, 0);                   // post
  add(new THREE.BoxGeometry(1.5, 0.06, 0.06), wood, 0, 1.55, 0);                          // arms
  add(new THREE.CylinderGeometry(0.2, 0.17, 0.75, 10), shirt, 0, 1.4, 0);                 // body
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 8), shirt, s * 0.42, 1.55, 0, 0, Math.PI / 2);   // sleeves
    for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 3), straw, s * (0.74 + i * 0.01), 1.55 - 0.08 + i * 0.03 - 0.06, 0, 0, Math.PI / 2 + (i - 3) * 0.12);
  }
  const head = add(new THREE.SphereGeometry(0.17, 12, 10), burlap, 0, 1.95, 0); head.scale.set(0.9, 1.1, 0.95);
  add(new THREE.SphereGeometry(0.03, 6, 5), dark, -0.06, 1.99, 0.15); add(new THREE.SphereGeometry(0.03, 6, 5), dark, 0.06, 1.99, 0.15);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.012, 0.05, 0.01), dark, -0.075 + i * 0.03, 1.87 + (i % 2) * 0.012, 0.16);   // stitched grin
  add(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 14), straw, 0, 2.1, 0);               // straw hat
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 12), straw, 0, 2.17, 0);
  for (let i = 0; i < 12; i++) add(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 3), straw, Math.sin(i) * 0.15, 0.95, Math.cos(i * 2) * 0.12, 0, (i % 3 - 1) * 0.2);   // straw poking out the bottom
  return g;
}

// ---- generator ----------------------------------------------------------
export function buildHouse(renderer, seed = 1, props = {}) {
  const rand = rng(seed);
  const tex = makeTextures();
  const group = new THREE.Group();
  const colliders = []; // {minX,maxX,minZ,maxZ,level}
  const rooms = [];     // {pos, base, level, role}: one per room, feeds the light pool
  const outside = mat(tex.outside);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const scarecrows = [];
  const traps = [];      // rotten floor patches that collapse
  const parts = [];      // movable furniture parts (drawers, doors, lids)
  const partMeshes = [];
  const pickables = []; // everything the crosshair can land on
  // the front door keypad code: new on every load, separate from the seeded house layout
  const code = String((globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 4294967296)) % 10000).padStart(4, '0');
  const postcard = postcardCanvas(code);
  const postcardTex = new THREE.CanvasTexture(postcard);
  postcardTex.colorSpace = THREE.SRGBColorSpace;
  const hideSpots = [];
  const roomDoors = [];
  let jarStart = null;
  const falling = [];    // dropped jars, on their way down
  const shootables = []; // panes that can be shot out
  const shards = [];     // flying glass
  const timers = [];     // things that happen a moment later
  const doorLog = []; // door and window edges per storey, for debugging
  const exits = [];  // doors out of the house
  const wires = [];  // cuttable wires in the fuse box
  const sparks = [];
  const items = [];      // things to find in drawers and chests
  const itemMeshes = [];
  const floorDrops = [];  // items that lie on the floor of a reserved cell
  const sunWindows = [];  // every outer window, for the sunbeams
  const sunMeshes = [];   // beams and patches, shown only on the storey you are on
  const sunPatches = [];  // where the sun lies on the floor
  const partMat = new THREE.MeshLambertMaterial({ map: tex.wood, vertexColors: true });
  const fm = tint => mat(tex.wood, tint);
  const plainCache = new Map();
  const plain = color => {
    if (!plainCache.has(color)) plainCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return plainCache.get(color);
  };
  const pal = {
    body: fm(0xffffff), dark2: fm(0x7a5c40), light: plain(0xe2dac6), cloth: plain(0x9a4a3c), paper: mat(tex.burlap),
    hay: mat(tex.floor[4]), rust: plain(0x7a3d26), copper: plain(0xb4672f), dark: plain(0x161312), steel: plain(0x8c949a), red: plain(0xa8402a),
  };
  const winGlass = tex.windowOpen.map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xece4d2 }));
  const winGlare = new THREE.MeshBasicMaterial({ map: tex.windowGlare, side: THREE.DoubleSide });

  const makeItemMesh = (type, spin) => {
    const mesh = buildItem(type, { texture: postcardTex });
    // a generous invisible box to aim at, so small things are easy to pick up
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, 0.16) + 0.04, Math.max(size.y, 0.1) + 0.04, Math.max(size.z, 0.16) + 0.04), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.copy(mid);
    mesh.add(proxy);
    mesh.rotation.y = spin ?? rand() * Math.PI * 2;
    mesh.userData.proxy = proxy;
    return mesh;
  };

  LEVELS.forEach((cfg, level) => buildFloor(cfg, level));
  stairs.forEach(buildStairs);

  // ---- things you can pick up ---------------------------------------------------------
  // Put a carried item down: it lies on the surface at (x, y, z) and can be picked up again.
  function dropItem(type, x, y, z, yaw, level, board = null, fall = false) {
    const mesh = makeItemMesh(type, yaw);
    mesh.position.set(x, y, z);
    if (type === 'jar' && fall) {            // let go of it: it drops from hand height and smashes
      mesh.position.y = y + 1.0;
      falling.push({ mesh, floorY: y, vy: 0, level });
    }
    group.add(mesh);
    const item = { kind: 'item', type, part: null, mesh, floor: true, level, board };
    mesh.userData.proxy.userData.item = item;
    items.push(item);
    pickables.push(mesh.userData.proxy);
    return item;
  }

  function removeItem(item) {
    item.mesh.removeFromParent();
    const a = pickables.indexOf(item.mesh.userData.proxy); if (a >= 0) pickables.splice(a, 1);
    const b = items.indexOf(item); if (b >= 0) items.splice(b, 1);
    if (item.part) item.part.hasItem = false;
    if (item.board) item.board.peach = null;
  }

  // One pair of cutting pliers in a single drawer, one key per storey (preferably in a chest), and the rest of the puzzle pieces.
  function placeLoot() {
    const place = (type, part) => {
      const mesh = makeItemMesh(type, type === 'shotgun' ? 0 : undefined);
      mesh.position.set(...part.loot.pos);
      part.loot.parent.add(mesh);
      const item = { kind: 'item', type, part, mesh };
      mesh.userData.proxy.userData.item = item;
      items.push(item);
      itemMeshes.push(mesh.userData.proxy);
      part.hasItem = true;
    };
    const holders = parts.filter(p => p.loot);
    // the apple always lies in the icebox, the shotgun in the padlocked metal box
    const icebox = holders.find(p => p.tag === 'fridge');
    if (icebox) place('peach', icebox);
    const gunBox = holders.find(p => p.tag === 'gunbox');
    if (gunBox) place('shotgun', gunBox);
    // the spiral vase stands on the start bedroom's table
    if (jarStart) dropItem('jar', jarStart.x, jarStart.y, jarStart.z, 0.4, jarStart.level);
    for (const d of floorDrops) dropItem(d.item, d.x, d.y, d.z, d.spin, d.level);
    // a kitchen knife in one of the kitchen drawers
    const cleaverDrawers = holders.filter(p => p.kind === 'drawer' && p.role === 'kitchen' && !p.hasItem);
    if (cleaverDrawers.length) place('cleaver', pick(cleaverDrawers));
    else { const any = holders.filter(p => p.kind === 'drawer' && !p.hasItem); if (any.length) place('cleaver', pick(any)); }
    const cuttersAt = pick(holders.filter(p => p.kind === 'drawer' && !p.hasItem && p.role !== 'kitchen'));
    if (cuttersAt) place('cutters', cuttersAt);
    // the postcard with the front door code: always in a drawer in a living room
    const cardDrawers = holders.filter(p => p.kind === 'drawer' && p.role === 'living' && !p.hasItem);
    const fallback = holders.filter(p => p.kind === 'drawer' && p.level === GROUND && !p.hasItem);
    const cardAt = cardDrawers.length ? pick(cardDrawers) : fallback.length ? pick(fallback) : null;
    if (cardAt) place('postcard', cardAt);
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const here = holders.filter(p => p.level === lv && !p.hasItem);
      if (!here.length) continue;
      const chests = here.filter(p => p.kind === 'flap');
      place('key', pick(chests.length ? chests : here));
    }
    pickables.push(...partMeshes, ...itemMeshes);
  }
  placeLoot();

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
      const lk = LOOK[cfg.roles?.[id] ?? 'stairs'];
      look[id] = { wall: tex.wall[pick(lk.wall)], floor: tex.floor[pick(lk.floor)], sx: 0, sz: 0, n: 0 };
    }
    const wallMat = id => (id ? mat(look[id].wall) : outside);

    // which wall edges exist: 'h' = on top of cell (c,r), 'v' = on its left
    const key = (dir, c, r) => `${dir}${c},${r}`;
    const has = (dir, c, r) => (dir === 'h' ? at(c, r) !== at(c, r - 1) : at(c, r) !== at(c - 1, r));

    // doors: random spanning tree over room adjacency, plus a few loops
    const edgesByPair = new Map();
    const stairDoor = up ? key('h', up.col, up.row) : null;
    // wall edges that hand-placed furniture stands against must never get a doorway
    const reserved = new Set();
    // a doorway must not open straight onto the hole where the stairs come up
    if (down) reserved.add(key('h', down.col, down.row));
    for (const f of cfg.fixed ?? []) {
      const [c, r] = f.cell;
      if (!f.side) { // a free-standing set (table and chairs) must not stand in front of any doorway of its cell
        if (ITEMS[f.item]?.center) for (const k of [key('h', c, r), key('h', c, r + 1), key('v', c, r), key('v', c + 1, r)]) reserved.add(k);
        continue;
      }
      reserved.add({ N: key('h', c, r), S: key('h', c, r + 1), W: key('v', c, r), E: key('v', c + 1, r) }[f.side]);
    }
    const lastResort = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      for (const [dir, nc, nr] of [['h', c, r - 1], ['v', c - 1, r]]) {
        const a = at(c, r), b = at(nc, nr);
        if (!b || a === b) continue;
        // a stairwell opens only on its north end
        if ((a === 'S' || b === 'S') && key(dir, c, r) !== stairDoor) continue;
        const pair = [a, b].sort().join('|');
        if (reserved.has(key(dir, c, r))) { (lastResort.get(pair) ?? lastResort.set(pair, []).get(pair)).push(key(dir, c, r)); continue; }
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

    // safety: if the reserved edges left a room cut off, give it a doorway there after all
    for (const [p, list] of lastResort) {
      const [a, b] = p.split('|');
      if (!edgesByPair.has(p) && find(a) !== find(b)) { parent[find(a)] = find(b); doors.add(list[0]); doorLog.warn = (doorLog.warn ?? 0) + 1; }
    }
    const forcedWin = new Set((cfg.windowEdges ?? []).map(e => key(...e)));
    const doorWidth = new Map();
    for (const ex of cfg.exits ?? []) { doors.add(key(...ex.edge)); doorWidth.set(key(...ex.edge), ex.width ?? DOOR_W); } // an exit is a doorway in an outer wall
    doorLog.push({ level, map: MAP, doors: [...doors], windows: () => [...winEdges] });

    // floors & ceilings (the stair openings have neither on the storeys they join)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = at(c, r), lk = look[id], k = `${c},${r}`;
      const x = (c + 0.5) * CELL, z = (r + 0.5) * CELL;
      if (!floorHole.has(k)) batch.add(placed(new THREE.PlaneGeometry(CELL, CELL), x, Y, z, -Math.PI / 2), mat(lk.floor));
      if (!ceilHole.has(k)) batch.add(placed(new THREE.PlaneGeometry(CELL, CELL), x, Y + WALL_H, z, Math.PI / 2), mat(tex.ceiling, level === 0 ? 0x888888 : 0xc8c0aa));
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

    const side = plain(0x3a342c);
    // wall piece spanning a0..a1 along `axis` at fixed coordinate `f`
    function piece(axis, a0, a1, f, y0, y1, posMat, negMat, solid = true) {
      const len = a1 - a0, h = y1 - y0;
      if (len <= 0.001 || h <= 0.001) return;
      const mid = (a0 + a1) / 2;
      const sx = axis === 'x' ? len : THICK, sz = axis === 'x' ? THICK : len;
      const cx = axis === 'x' ? mid : f, cz = axis === 'x' ? f : mid;
      // The top face is skipped where it meets the ceiling (it would sit exactly level with the next
      // storey's floor and flicker against it), and the bottom face where it meets the floor.
      const top = y1 >= WALL_H - 1e-6 ? null : side, bottom = y0 <= 1e-6 ? null : side;
      batch.box(sx, h, sz, cx, Y + y0 + h / 2, cz,
        axis === 'x' ? [side, side, top, bottom, posMat, negMat] : [posMat, negMat, top, bottom, side, side]);
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
      const v0 = [c, r], v1 = dir === 'h' ? [c + 1, r] : [c, r + 1];
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
        const dw = doorWidth.get(k) ?? DOOR_W;
        opening(dw);
        piece(axis, mid - dw / 2, mid + dw / 2, f, DOOR_H, WALL_H, posMat, negMat, false);
      } else if ((!pos || !neg) && (forcedWin.has(k) || rand() < cfg.windows)) {
        winEdges.add(k);
        opening(WIN_W);
        piece(axis, mid - WIN_W / 2, mid + WIN_W / 2, f, 0, WIN_Y, posMat, negMat, false);
        piece(axis, mid - WIN_W / 2, mid + WIN_W / 2, f, WIN_Y + WIN_H, WALL_H, posMat, negMat, false);
        const hw = WIN_W / 2;
        colliders.push(axis === 'x'
          ? { minX: mid - hw, maxX: mid + hw, minZ: f - HT, maxZ: f + HT, level }
          : { minX: f - HT, maxX: f + HT, minZ: mid - hw, maxZ: mid + hw, level });
        const gm = level === 0 ? winGlare : pick(winGlass);
        if (forcedWin.has(k)) {   // a pane of its own, so it can be shot out
          const pane = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), gm);
          pane.position.set(axis === 'x' ? mid : f, Y + WIN_Y + WIN_H / 2, axis === 'x' ? f : mid);
          if (axis === 'z') pane.rotation.y = Math.PI / 2;
          group.add(pane);
          const w = { mesh: pane, level, broken: false, mat: gm };
          pane.userData.shootable = w;
          shootables.push(w);
        } else {
          const glass = placed(new THREE.PlaneGeometry(WIN_W, WIN_H),
            axis === 'x' ? mid : f, Y + WIN_Y + WIN_H / 2, axis === 'x' ? f : mid, 0, axis === 'z' ? Math.PI / 2 : 0);
          batch.add(glass, gm, false);
        }
        // which way is outside? that decides whether the sun shines in
        const outV = !neg ? (dir === 'h' ? [0, -1] : [-1, 0]) : (dir === 'h' ? [0, 1] : [1, 0]);
        sunWindows.push({ level, axis, f, mid, out: outV, Y });
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
      const rail = mat(tex.floor[1], 0x777777);
      const t = 0.08, w = down.x1 - down.x0, d = down.z1 - down.z0;
      const add = (x, z, sx, sz) => {
        batch.box(sx, 1, sz, x, Y + 0.5, z, [rail, rail, rail, null, rail, rail]);
        colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, level });
      };
      add(down.x0 + t / 2, down.z0 + d / 2, t, d);
      add(down.x1 - t / 2, down.z0 + d / 2, t, d);
      add(down.x0 + w / 2, down.z0 + t / 2, w, t);
    }

    // A hinged door in every doorway between rooms. It swings away from whoever opens it, blocks the
    // way while closed, and opens or closes with the hand cursor.
    function buildRoomDoors() {
      const exitKeys = new Set((cfg.exits ?? []).map(e => key(...e.edge)));
      const faceMat = new THREE.MeshLambertMaterial({ map: tex.door });
      const edgeMat = new THREE.MeshLambertMaterial({ color: 0x2a1c12 });
      const T = 0.06;
      for (const k of doors) {
        if (exitKeys.has(k)) continue;
        const dir = k[0], [c, r] = k.slice(1).split(',').map(Number);
        const axis = dir === 'h' ? 'x' : 'z';
        const f = (dir === 'h' ? r : c) * CELL, mid = (dir === 'h' ? c : r) * CELL + CELL / 2;
        const dw = DOOR_W;
        const hinge = new THREE.Group();
        hinge.position.set(axis === 'x' ? mid - dw / 2 : f, Y + 0.004, axis === 'x' ? f : mid - dw / 2);
        group.add(hinge);
        const dims = axis === 'x' ? [dw, DOOR_H, T] : [T, DOOR_H, dw];
        const mats = axis === 'x' ? [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat] : [faceMat, faceMat, edgeMat, edgeMat, edgeMat, edgeMat];
        const slab = new THREE.Mesh(new THREE.BoxGeometry(...dims), mats);
        slab.position.set(axis === 'x' ? dw / 2 : 0, DOOR_H / 2, axis === 'x' ? 0 : dw / 2);
        hinge.add(slab);
        const hw = dw / 2, t = 0.07;
        const col = axis === 'x'
          ? { minX: mid - hw, maxX: mid + hw, minZ: f - t, maxZ: f + t, level }
          : { minX: f - t, maxX: f + t, minZ: mid - hw, maxZ: mid + hw, level };
        const door = { kind: 'roomdoor', level, axis, f, mid, dw, hinge, col, open: false, t: 0, sign: 1 };
        colliders.push(col);   // every door starts closed
        door.target = { kind: 'roomdoor', door };
        slab.userData.roomDoor = door;
        pickables.push(slab);
        roomDoors.push(door);
      }
    }

    // A door in an outer wall, hinged on one side, with its locks on the inside face. The
    // opening is blocked until it is open.
    function buildExit(ex) {
      const DW = ex.width ?? DOOR_W;
      const [dir, ec, er] = ex.edge;
      const axis = dir === 'h' ? 'x' : 'z';
      const f = (dir === 'h' ? er : ec) * CELL;                 // wall centre line
      const mid = (dir === 'h' ? ec : er) * CELL + CELL / 2;    // middle of the doorway
      const out = dir === 'h' ? [0, er === rows ? 1 : -1] : [ec === cols ? 1 : -1, 0]; // outward (x, z)
      const inn = [-out[0], -out[1]];
      const doorMat = ex.style === 'metal' ? new THREE.MeshLambertMaterial({ color: 0x6a7073 })
        : ex.style === 'barn' ? new THREE.MeshLambertMaterial({ map: tex.wall[4], color: 0xd8c8c0 })
        : new THREE.MeshLambertMaterial({ map: tex.door, color: 0xd8c8b0 });
      const hinge = new THREE.Group();
      hinge.position.set(axis === 'x' ? mid - DW / 2 : f, Y + 0.004, axis === 'x' ? f : mid - DW / 2);
      group.add(hinge);
      // local frame of the hinge group: u along the door, v out of the inner face
      const at3 = (u, y, v) => (axis === 'x' ? [u, y, inn[1] * v] : [inn[0] * v, y, u]);
      const dims = (w, h, d) => (axis === 'x' ? [w, h, d] : [d, h, w]);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(...dims(DW, DOOR_H, 0.07)), doorMat);
      slab.position.set(...at3(DW / 2, DOOR_H / 2, 0));
      hinge.add(slab);

      const locks = [];
      for (const [type, y] of ex.locks) {
        const lockGroup = new THREE.Group();
        lockGroup.position.set(...at3(DW * 0.8, y, 0.06));
        if (type === 'padlock') {
          const body = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.1, 0.12, 0.05)), new THREE.MeshPhongMaterial({ color: 0xb89a32, shininess: 60 }));
          const shackle = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.06, 0.07, 0.03)), new THREE.MeshPhongMaterial({ color: 0x8a8f94, shininess: 80 }));
          shackle.position.set(...at3(0, 0.09, 0));
          lockGroup.add(body, shackle);
          locks.push({ type, done: false, mesh: lockGroup });
        } else if (type === 'code') {
          const body = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.17, 0.24, 0.05)), new THREE.MeshPhongMaterial({ color: 0x1d2024, shininess: 40 }));
          const led = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.12, 0.025, 0.012)), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
          led.position.set(...at3(0, 0.095, 0.03));
          lockGroup.add(body, led);
          const keyMat = new THREE.MeshPhongMaterial({ color: 0x9aa0a6 });
          for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
            const k = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.032, 0.024, 0.014)), keyMat);
            k.position.set(...at3((i - 1) * 0.045, 0.05 - j * 0.04, 0.03));
            lockGroup.add(k);
          }
          locks.push({ type, done: false, mesh: lockGroup, led, keypad: body });
        } else {
          const box = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.14, 0.2, 0.06)), new THREE.MeshPhongMaterial({ color: 0x2a2e33, shininess: 30 }));
          const led = new THREE.Mesh(new THREE.BoxGeometry(...dims(0.04, 0.04, 0.02)), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
          led.position.set(...at3(0, 0.06, 0.035));
          lockGroup.add(box, led);
          locks.push({ type, done: false, mesh: lockGroup, led });
        }
        hinge.add(lockGroup);
      }

      const hw = DW / 2, t = 0.1;
      const col = axis === 'x'
        ? { minX: mid - hw, maxX: mid + hw, minZ: f - t, maxZ: f + t, level }
        : { minX: f - t, maxX: f + t, minZ: mid - hw, maxZ: mid + hw, level };
      colliders.push(col);

      const angle = axis === 'x' ? (out[1] > 0 ? -1.9 : 1.9) : (out[0] > 0 ? 1.9 : -1.9); // swings outward
      const exit = { id: ex.id, name: ex.name, level, axis, f, mid, out, hinge, angle, locks, open: false, t: 0, col, escaped: false, width: DW, carOnly: !!ex.carOnly };
      if (ex.carOnly) {   // a big barn door: cross-braces
        const brace = new THREE.MeshLambertMaterial({ color: 0xd9d0b8 });
        for (let i = 1; i < 4; i++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(...dims(DW - 0.1, 0.12, 0.02)), brace);
          rib.position.set(...at3(DW / 2, i * DOOR_H / 4, 0.045));
          hinge.add(rib);
        }
      }
      exit.target = { kind: 'exit', exit };
      for (const l of locks) {
        if (l.type !== 'code') continue;
        l.keypad.userData.keypad = { kind: 'keypad', exit, lock: l };
        pickables.push(l.keypad);
      }
      slab.userData.exit = exit;
      pickables.push(slab);
      exits.push(exit);
    }

    // Furniture sits against walls, one item per cell, never in the stair cells or in
    // front of a doorway. Cells with a door only take shallow items, so paths stay clear.
    // Tables with chairs stand free in the middle of a roomy cell without a door.
    function furnish() {
      const fb = makeBatch(1.4, 1.4);
      const used = new Set([...ceilHole, ...floorHole]);
      if (down) used.add(`${down.col},${down.row + SPAN}`);
      if (up) used.add(`${up.col},${up.row - 1}`);
      for (const [c, r] of cfg.scarecrows ?? []) used.add(`${c},${r}`);
      if (cfg.spawn) used.add(cfg.spawn.join(','));
      const cellsByRoom = {};
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) (cellsByRoom[at(c, r)] ??= []).push([c, r]);
      const centred = new Set(); // rooms that already hold a free-standing set
      const hasDoor = (c, r) => [['h', c, r], ['h', c, r + 1], ['v', c, r], ['v', c + 1, r]].some(([d, ec, er]) => doors.has(key(d, ec, er)));

      for (const f of cfg.fixed ?? []) {
        const [c, r] = f.cell;
        used.add(`${c},${r}`);
        centred.add(at(c, r));
        placeItem(fb, ITEMS[f.item], c, r, f.side ?? null, f.turn ?? 0, f.shift ?? 0, !!f.jar);
      }
      // items that lie on the floor of a cell of their own
      for (const f of cfg.floorItems ?? []) {
        const [c, r] = f.cell;
        used.add(`${c},${r}`);
        const [ox, oz] = f.at ?? [(rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2];
        floorDrops.push({ item: f.item, x: (c + 0.5) * CELL + ox, y: Y, z: (r + 0.5) * CELL + oz, spin: rand() * 6, level });
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
            for (const [sd, d, ec, er] of edges) {
              const k = key(d, ec, er);
              if (has(d, ec, er) && !doors.has(k) && !(winEdges.has(k) && item.tall)) slots.push([c, r, sd]);
            }
          }
          if (!slots.length) continue;
          const [c, r, sd] = pick(slots);
          used.add(`${c},${r}`);
          placeItem(fb, item, c, r, sd);
        }
      }

      for (const [c, r] of cfg.scarecrows ?? []) {
        const x = (c + 0.5) * CELL, z = (r + 0.5) * CELL;
        const pivot = new THREE.Group();
        pivot.position.set(x, Y, z);
        const body = buildScarecrow(tex);
        body.rotation.y = rand() * Math.PI * 2;
        pivot.add(body);
        group.add(pivot);
        const col = { minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25, level };
        colliders.push(col);
        scarecrows.push({ pivot, x, z, y: Y, level, col, fell: false, landed: false, t: 0, axis: new THREE.Vector3() });
      }
      // rotten boards in an empty cell: stepping on them breaks the floor
      const emptyCells = [];
      for (const cells of Object.values(cellsByRoom)) for (const [c, r] of cells) if (!used.has(`${c},${r}`) && !hasDoor(c, r)) emptyCells.push([c, r]);
      for (let n = 0; n < (cfg.traps ?? 0) && emptyCells.length; n++) {
        const [c, r] = emptyCells.splice(Math.floor(rand() * emptyCells.length), 1)[0];
        used.add(`${c},${r}`);
        makeTrap(level, (c + 0.5) * CELL, (r + 0.5) * CELL, Y);
      }
      // piles of bones on the floor: something has been eaten here
      for (let n = 0; n < (cfg.bones ?? 0) && emptyCells.length && props.bone_pile; n++) {
        const [c, r] = emptyCells.splice(Math.floor(rand() * emptyCells.length), 1)[0];
        const pile = props.bone_pile.clone(true);
        pile.position.set((c + 0.5) * CELL + (rand() - 0.5) * 1.4, Y + 0.004, (r + 0.5) * CELL + (rand() - 0.5) * 1.4);
        pile.rotation.y = rand() * Math.PI * 2;
        pile.scale.setScalar(0.8 + rand() * 0.5);
        group.add(pile);
      }
      fb.flush(group);
    }

    let trapTex = null;
    function makeTrap(level, x, z, Y) {
      if (!trapTex) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#6e5a3e' : '#58452e'; g.fillRect(0, i * 32, 256, 32); }
        g.strokeStyle = '#120c06'; g.lineWidth = 3;
        for (let k = 0; k < 8; k++) {
          let px = 16 + Math.random() * 224, py = Math.random() * 120;
          g.beginPath(); g.moveTo(px, py);
          for (let s = 0; s < 5; s++) { px += (Math.random() - 0.5) * 60; py += 24 + Math.random() * 20; g.lineTo(px, py); }
          g.stroke();
        }
        trapTex = new THREE.CanvasTexture(cv);
        trapTex.colorSpace = THREE.SRGBColorSpace;
      }
      // a flat sheet, not a box: a box would have a bottom face sitting exactly in the ceiling of the room below
      const cover = new THREE.Group();
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshLambertMaterial({ map: trapTex, side: THREE.DoubleSide }));
      sheet.rotation.x = -Math.PI / 2;
      cover.add(sheet);
      cover.position.set(x, Y + 0.02, z);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(x, Y + 0.012, z);
      hole.visible = false;
      group.add(cover, hole);
      traps.push({ level, x, z, Y, half: 0.8, cover, hole, state: 'armed', t: 0, creaked: false });
    }

    // side: the wall the item backs onto ('N','S','W','E'), or null for a free-standing item
    // in the middle of the cell, turned by `turn` quarter turns.
    function placeItem(fb, item, c, r, sd, turn = 0, shift = 0, withJar = false) {
      const cx = (c + 0.5) * CELL, cz = (r + 0.5) * CELL, gap = HT + 0.03;
      const base = sd === 'N' ? [cx, r * CELL + gap] : sd === 'S' ? [cx, (r + 1) * CELL - gap]
        : sd === 'W' ? [c * CELL + gap, cz] : sd === 'E' ? [(c + 1) * CELL - gap, cz] : [cx, cz];
      const ang = sd ? { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[sd] : turn * Math.PI / 2;
      const cs = Math.round(Math.cos(ang)), sn = Math.round(Math.sin(ang));
      if (shift) { base[0] += shift * cs; base[1] -= shift * sn; } // slide along the wall
      // item-local (x across, z out) -> world; the rotation is a multiple of 90 degrees
      const xf = (lx, lz) => [base[0] + lx * cs + lz * sn, base[1] - lx * sn + lz * cs];
      const swap = sn !== 0;
      // Nothing may have a face exactly in the plane of a floor: from the storey below that face would fight the
      // ceiling and flicker through it. So a box standing on the floor gets no bottom, and a cylinder is lifted a hair.
      const b = (w, h, d, x, y0, zc, material) => {
        const [wx, wz] = xf(x, zc);
        const mats = Array(6).fill(material);
        if (y0 <= 0.001) mats[3] = null;
        fb.box(swap ? d : w, h, swap ? w : d, wx, Y + y0 + h / 2, wz, mats);
      };
      b.cyl = (rad, h, x, y0, zc, material) => {
        const [wx, wz] = xf(x, zc);
        fb.cyl(rad, h, wx, Y + y0 + h / 2 + (y0 <= 0.001 ? 0.004 : 0), wz, material);
      };

      let itemGroup = null, lastPart = null;
      const ensureGroup = () => {
        if (!itemGroup) {
          itemGroup = new THREE.Group();
          itemGroup.position.set(base[0], Y, base[1]);
          itemGroup.rotation.y = ang;
          group.add(itemGroup);
        }
        return itemGroup;
      };
      const makePart = (boxes, pivot, extra) => {
        ensureGroup();
        const pg = new THREE.Group();
        pg.position.set(...pivot);
        const mesh = new THREE.Mesh(partGeometry(boxes, pivot), partMat);
        pg.add(mesh);
        itemGroup.add(pg);
        const part = { pg, pivot, level, open: false, t: 0, role: cfg.roles?.[at(c, r)], ...extra };
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
        lastPart = part;
      };
      const mv = {
        drawer: (boxes, dist) => makePart(boxes, [0, 0, 0], { kind: 'drawer', dist }),
        door: (boxes, hx, hz, hinge, opts = {}) => makePart(boxes, [hx, 0, hz], { kind: 'door', angle: hinge > 0 ? -1.9 : 1.9, lootPos: opts.lootPos, tag: opts.tag }),
        flap: (boxes, hy, hz, angle, lootPos, opts = {}) => makePart(boxes, [0, hy, hz], { kind: 'flap', angle, lootPos, tag: opts.tag }),
        // a padlock on the part built just before it: the part stays shut until it is cut off
        lock: (x, y0, z) => {
          const lg = new THREE.Group();
          const brass = new THREE.MeshPhongMaterial({ color: 0xb89a32, specular: 0xffeeaa, shininess: 60 });
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.03), brass);
          const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), new THREE.MeshPhongMaterial({ color: 0x9aa0a6, shininess: 90 }));
          shackle.position.y = 0.04;
          lg.add(body, shackle);
          lg.position.set(x, y0 + 0.04, z + 0.015);
          ensureGroup().add(lg);
          lastPart.locked = true;
          lastPart.lockMesh = lg;
        },
        // an invisible box to look at and use (a butcher block, say)
        target: (kind, w, h, d, x, y0, zc) => {
          const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
          proxy.position.set(x, y0 + h / 2, zc);
          ensureGroup().add(proxy);
          const t = { kind, level, peach: null, proxy };
          proxy.userData.useTarget = t;
          pickables.push(proxy);
        },
        // a wire behind the lid built just before it
        wire: (color, x, y0, h, z) => {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.035), plain(color));
          mesh.position.set(x, y0 + h / 2, z);
          ensureGroup().add(mesh);
          const wire = { mesh, y0, h, cut: false, box: lastPart, level };
          wire.target = { kind: 'wire', wire };
          mesh.userData.wire = wire;
          pickables.push(mesh);
          wires.push(wire);
        },
      };
      const ctx = { has: n => !!props[n] };
      item.build(b, pal, mv, ctx);
      // real 3D models belonging to this piece of furniture, placed in its own frame
      const modelList = [...(item.model && props[item.model] ? [{ name: item.model, z: item.modelZ ?? 0 }] : []), ...(item.models ?? []).filter(m => props[m.name])];
      for (const m of modelList) {
        const inst = props[m.name].clone(true);
        inst.position.set(m.x ?? 0, (m.y ?? 0) + 0.004, m.z ?? 0);   // a hair off the floor, so its feet cannot fight the ceiling below
        inst.rotation.y = m.ry ?? 0;
        ensureGroup().add(inst);
      }

      if (item.jarSpot && withJar) {   // the spiral vase stands on the start bedroom's table
        const [vx, vz] = xf(item.jarSpot.x, item.jarSpot.z);
        jarStart = { x: vx, z: vz, y: Y + item.jarSpot.y, level };   // made into a pick-up item once the loot is placed
      }

      if (item.hide) {
        // an invisible box over the table, bed or wardrobe: look at it to hide there
        const hd = item.hide, [wx, wz] = xf(hd.x, hd.z);
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(swap ? hd.d : hd.w, hd.h, swap ? hd.w : hd.d), new THREE.MeshBasicMaterial({ visible: false }));
        proxy.position.set(wx, Y + hd.h / 2, wz);
        group.add(proxy);
        const spot = { x: wx, z: wz, level, eye: hd.eye, closet: !!hd.closet };
        spot.target = { kind: 'hide', spot };
        proxy.userData.hide = spot;
        pickables.push(proxy);
        hideSpots.push(spot);
      }

      const cols = typeof item.colliders === 'function' ? item.colliders(ctx) : item.colliders;
      for (const [w, d, lx, lz] of cols ?? [[item.w, item.d, 0, item.d / 2]]) {
        const [ax, az] = xf(lx - w / 2, lz - d / 2), [bx, bz] = xf(lx + w / 2, lz + d / 2);
        colliders.push({ minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz), level });
      }
    }

    for (const ex of cfg.exits ?? []) buildExit(ex);
    buildRoomDoors();
    furnish();
    batch.flush(group);
    for (const id of ids) {
      const lk = look[id];
      rooms.push({ pos: new THREE.Vector3(lk.sx / lk.n, Y + WALL_H - 0.4, lk.sz / lk.n), base: 0.6 + rand() * 0.5, level, role: cfg.roles?.[id] ?? 'stairs' });
    }
  }

  function buildStairs(st) {
    const batch = makeBatch();
    const steps = 15, run = (st.z1 - st.z0) / steps, rise = st.rise / steps, w = st.x1 - st.x0;
    const m = mat(tex.floor[1], 0x999999), mats = [m, m, m, null, m, m];   // no underside: the first step's would lie exactly in the ceiling of the room below
    const y0 = levelY(st.from);
    // each step is a slab one rise thick, so no faces overlap
    for (let i = 0; i < steps; i++) {
      batch.box(w, rise, run, st.x0 + w / 2, y0 + rise * (i + 0.5), st.z0 + run * (i + 0.5), mats);
    }
    batch.flush(group);
  }

  // ---- sunshine ------------------------------------------------------------------------------
  // Every outer window that faces the sun throws a beam into the room and a bright patch on the
  // floor, with the shadow of the window frame in it. Standing in a patch of sun calms you down.
  function buildSunlight() {
    const L = SUN.clone().negate();   // the way the light travels
    const beamMat = new THREE.MeshBasicMaterial({ map: tex.beam, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.3, color: 0xffe9b0 });
    const patchMat = new THREE.MeshBasicMaterial({ map: tex.patch, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7, color: 0xffe3a0 });
    const quad = (a, b, c, d, uvs, material, level) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
      const [ua, ub, uc, ud] = uvs;
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([...ua, ...ub, ...uc, ...ua, ...uc, ...ud], 2));
      const m = new THREE.Mesh(geo, material);
      m.frustumCulled = false; m.renderOrder = 3; m.userData.level = level; m.visible = false;
      group.add(m); sunMeshes.push(m);
    };
    for (const w of sunWindows) {
      if (w.level === 0) continue;
      const travelOut = L.x * w.out[0] + L.z * w.out[1];
      if (travelOut > -0.2) continue;   // this window faces away from the sun
      const hw = WIN_W / 2, yb = w.Y + WIN_Y, yt = w.Y + WIN_Y + WIN_H;
      const P = (u, y) => (w.axis === 'x' ? new THREE.Vector3(u, y, w.f) : new THREE.Vector3(w.f, y, u));
      const F = (u, y) => { const p = P(u, y), t = (y - w.Y - 0.015) / -L.y; return p.addScaledVector(L, t); };
      const arr = v => [v.x, v.y, v.z];
      // three thin sheets of light between the window and the floor
      for (const k of [-0.6, 0, 0.6]) {
        const u = w.mid + k * hw;
        quad(arr(P(u, yb)), arr(P(u, yt)), arr(F(u, yt)), arr(F(u, yb)), [[0, 1], [1, 1], [1, 0], [0, 0]], beamMat, w.level);
      }
      // the patch on the floor
      const a = F(w.mid - hw, yb), b = F(w.mid + hw, yb), c = F(w.mid + hw, yt), d = F(w.mid - hw, yt);
      quad(arr(a), arr(b), arr(c), arr(d), [[0, 0], [1, 0], [1, 1], [0, 1]], patchMat, w.level);
      const xs = [a.x, b.x, c.x, d.x], zs = [a.z, b.z, c.z, d.z];
      const cxm = (Math.min(...xs) + Math.max(...xs)) / 2, czm = (Math.min(...zs) + Math.max(...zs)) / 2;
      const hx = (Math.max(...xs) - Math.min(...xs)) / 2 * 0.7, hz = (Math.max(...zs) - Math.min(...zs)) / 2 * 0.7;
      sunPatches.push({ level: w.level, minX: cxm - hx, maxX: cxm + hx, minZ: czm - hz, maxZ: czm + hz });
    }
  }
  buildSunlight();

  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.3;
  const centre = new THREE.Vector2(0, 0);
  const spawnLevel = Math.max(0, LEVELS.findIndex(l => l.spawn));
  const spawnCell = LEVELS[spawnLevel].spawn ?? [4, 1];
  const first = LEVELS[0].map;
  const size = { w: first[0].length * CELL, d: first.length * CELL };
  const say = text => api.onMessage?.(text);

  function openExit(exit) {
    exit.open = true;
    const i = colliders.indexOf(exit.col);
    if (i >= 0) colliders.splice(i, 1);
    api.onSound?.('creak');
  }

  const remaining = exit => exit.locks.filter(l => !l.done);
  function afterUnlock(exit) {
    const left = remaining(exit);
    if (!left.length) { say('The last lock gives way. The door swings open.'); openExit(exit); }
    else say(`Click. ${left.length} lock${left.length > 1 ? 's' : ''} left.`);
  }

  // Padlocks take a key from the hand; the keypad takes the code; an electric lock only
  // gives way once the power is cut.
  function useExit(exit, held) {
    if (exit.carOnly && !exit.open) { say('The barn door is chained from the outside. Maybe the truck could go straight through it.'); return; }
    const pending = remaining(exit);
    if (!pending.length) { openExit(exit); return; }
    const padlock = pending.find(l => l.type === 'padlock');
    if (padlock && held === 'key') {
      padlock.done = true;
      padlock.mesh.visible = false;
      api.onConsume?.('key');
      api.onSound?.('unlock');
      afterUnlock(exit);
    } else if (padlock) {
      say('Padlocked. Hold a key to unlock it.');
    } else if (pending.some(l => l.type === 'code')) {
      say('Only the keypad is left. It wants a 4-digit code.');
    } else {
      say('The electric lock is humming. Find the fuse box and cut the wires.');
    }
  }

  function tryCode(target, entered) {
    if (entered !== code) { api.onSound?.('wrong'); return false; }
    target.lock.done = true;
    target.lock.led.material.color.set(0x2aff5a);
    api.onSound?.('unlock');
    afterUnlock(target.exit);
    return true;
  }

  function cutLock(part, held) {
    if (held !== 'cutters') { say('Padlocked tight. Something strong could cut through it.'); return; }
    part.locked = false;
    part.lockMesh.visible = false;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true }));
    spark.position.copy(part.lockMesh.position);
    part.lockMesh.parent.add(spark);
    sparks.push({ mesh: spark, t: 0 });
    api.onSound?.('cut');
    say('Snap. The padlock drops away.');
  }

  // The butcher block is a table: put the apple on it, then chop it with the knife and
  // shotgun shells spill out onto the block.
  function useBoard(board, held) {
    const wp = board.proxy.getWorldPosition(new THREE.Vector3());
    if (held === 'peach') {
      if (board.peach) { say('There is already an apple on the block.'); return; }
      api.onConsume?.('peach');
      board.peach = dropItem('peach', wp.x + 0.05, wp.y, wp.z, 0.4, board.level, board);
      api.onSound?.('drop');
      say('The apple sits on the block. Cut it with a knife.');
    } else if (held === 'cleaver') {
      if (!board.peach) { say('Nothing on the block to chop.'); return; }
      removeItem(board.peach);
      api.onSound?.('chop');
      dropItem('shells', wp.x + 0.04, wp.y, wp.z, 0.5, board.level);
      say('The apple splits open. Shotgun shells were hidden inside.');
    } else {
      say(board.peach ? 'Cut the apple with a knife.' : 'A butcher block, stained dark. Put something on it.');
    }
  }

  // ---- the truck: a battery under the hood, gas in the tank, a key in the ignition ---------
  const truck = { battery: false, fuel: false, started: false };
  function useTruck(target, held) {
    if (truck.started) return;
    const glow = wp => {                       // the headlights come on
      const m = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
      for (const s of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), m);
        lamp.position.set(wp.x + s * 0.6, wp.y - 0.05, wp.z + 0.62);
        group.add(lamp);
      }
    };
    if (target.kind === 'carhood') {
      if (truck.battery) { say('The battery is already in.'); return; }
      if (held !== 'battery') { say('The engine bay is empty. It needs a car battery.'); return; }
      truck.battery = true;
      api.onConsume?.('battery');
      glow(target.proxy.getWorldPosition(new THREE.Vector3()));
      api.onSound?.('unlock');
      say(truck.fuel ? 'The battery clicks in. The headlights flicker on.' : 'The battery clicks in. The headlights flicker on. The tank is still empty.');
    } else if (target.kind === 'carfuel') {
      if (truck.fuel) { say('The tank is full.'); return; }
      if (held !== 'gas') { say('The gas tank is bone dry. It needs gas.'); return; }
      truck.fuel = true;
      api.onConsume?.('gas');
      api.onSound?.('pour');
      say(truck.battery ? 'Glug glug. The tank is full.' : 'Glug glug. The tank is full. The engine is dead, though.');
    } else {
      if (!truck.battery) { say('The dash is dead. The engine needs a battery.'); return; }
      if (!truck.fuel) { say('The needle sits on empty. It needs gas.'); return; }
      if (held !== 'key') { say('The ignition needs a key. Hold a key.'); return; }
      truck.started = true;
      api.onConsume?.('key');
      const door = exits.find(e => e.carOnly);
      api.onSound?.('engine');
      say('The engine roars to life!');
      if (door) { openExit(door); door.escaped = true; }
      api.onDrive?.(door);
    }
  }

  // Shoot at what the camera is looking at: a window pane breaks, and the noise carries.
  function shatter(point, level, tint, loud) {
    for (let i = 0; i < 26; i++) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.05), tint);
      shard.position.set(point.x + (Math.random() - 0.5) * 0.8, point.y + (Math.random() - 0.5) * 0.6, point.z + (Math.random() - 0.5) * 0.8);
      group.add(shard);
      shards.push({ mesh: shard, vel: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 3), spin: Math.random() * 8, t: 0, floor: levelY(level) });
    }
    void loud;
  }
  function breakWindow(w, point) {
    w.broken = true;
    w.mesh.visible = false;
    const base = w.mesh.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(w.mesh.quaternion);
    for (let i = 0; i < 26; i++) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.05), new THREE.MeshBasicMaterial({ color: 0xe6e2c8 }));
      shard.position.set(base.x + (Math.random() - 0.5) * 1.0 * (1 - Math.abs(n.x)), base.y + (Math.random() - 0.5) * 1.6, base.z + (Math.random() - 0.5) * 1.0 * (1 - Math.abs(n.z)));
      group.add(shard);
      const sd = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 2.5);
      shards.push({ mesh: shard, vel: new THREE.Vector3(n.x * sd + (Math.random() - 0.5), 1 + Math.random() * 1.5, n.z * sd + (Math.random() - 0.5)), spin: Math.random() * 8, t: 0, floor: levelY(w.level) });
    }
    api.onSound?.('glass');
    say('The window shatters! The sound carries through the house...');
    api.onAlert?.({ x: point.x, z: point.z, level: w.level, kind: 'window' });
  }

  // Open or close a room door. It swings away from the player, and will not shut on someone standing in it.
  function toggleDoor(door) {
    const p = api.lastPlayer?.pos;
    if (door.open) {
      if (p) {
        const along = door.axis === 'x' ? p.x : p.z, across = door.axis === 'x' ? p.z : p.x;
        if (Math.abs(along - door.mid) < door.dw / 2 + 0.3 && Math.abs(across - door.f) < 0.75) { say('Something is in the way.'); return; }
      }
      door.open = false;
      api.onSound?.('doorClose');
    } else {
      if (p) door.sign = door.axis === 'x' ? (p.z > door.f ? 1 : -1) : (p.x < door.f ? 1 : -1);
      door.open = true;
      const i = colliders.indexOf(door.col);
      if (i >= 0) colliders.splice(i, 1);
      api.onSound?.('doorOpen');
    }
  }

  function cutWire(wire, held) {
    if (held !== 'cutters') { say('You need something to cut this wire.'); return; }
    wire.cut = true;
    wire.mesh.scale.y = 0.25;
    wire.mesh.position.y = wire.y0 + wire.h * 0.125;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true }));
    spark.position.set(wire.mesh.position.x, wire.y0 + wire.h * 0.3, wire.mesh.position.z + 0.03);
    wire.mesh.parent.add(spark);
    sparks.push({ mesh: spark, t: 0 });
    api.onSound?.('cut');
    if (wires.some(w => !w.cut)) { say('Snip. One more wire.'); return; }
    say('The power is cut. Somewhere a lock clicks open.');
    api.onSound?.('unlock');
    for (const exit of exits) {
      for (const l of exit.locks) {
        if (l.type === 'electric') { l.done = true; l.led.material.color.set(0x2aff5a); }
      }
    }
  }

  // A scarecrow topples away from the player once they walk up to it.
  const FALL = 0.8, BOUNCE = 0.3;
  let shownSunLevel = -99;
  const api = {
    group, colliders, rooms, size, stairs, scarecrows, traps,
    levels: LEVELS.map(l => l.name),
    spawn: new THREE.Vector3((spawnCell[0] + 0.5) * CELL, levelY(spawnLevel), (spawnCell[1] + 0.5) * CELL),
    spawnLevel,
    parts,
    onThud: null,
    onUse: null,
    onPickup: null,
    onHide: null,
    onMessage: null,   // (text) a hint for the player
    onSound: null,     // ('unlock' | 'cut' | 'creak' ...)
    onConsume: null,   // (type) an item was used up
    onEscape: null,    // (exit) the player walked out
    onTrap: null,      // (trap) the player stepped on rotten boards and is falling
    onAlert: null,     // ({x, z, level, kind}) something loud happened here: the Hillbilly should come
    sunPatches,
    inSun(player) {
      if (player.hidden) return false;
      return sunPatches.some(s => s.level === player.level && player.pos.x > s.minX && player.pos.x < s.maxX && player.pos.z > s.minZ && player.pos.z < s.maxZ);
    },
    shoot(camera, player) {
      raycaster.setFromCamera(centre, camera);
      const far = raycaster.far;
      raycaster.far = 16;
      const hit = raycaster.intersectObjects(shootables.filter(w => !w.broken && w.level === player.level).map(w => w.mesh), false)[0];
      raycaster.far = far;
      if (hit) breakWindow(hit.object.userData.shootable, hit.point);
      return !!hit;
    },
    onDrive: null,     // () the truck started: drive out through the barn door
    onKeypad: null,    // (target) the player wants to type a code
    canTake: null,     // () is the player's hand free?
    onRead: null,      // the postcard was read
    onLoad: null,      // shells were loaded into the shotgun
    dropItem,
    // the Hillbilly pushes a room door open from where he stands
    openDoorFor(door, from, silent) {
      if (door.open) return;
      door.sign = door.axis === 'x' ? (from.z > door.f ? 1 : -1) : (from.x < door.f ? 1 : -1);
      door.open = true;
      const i = colliders.indexOf(door.col);
      if (i >= 0) colliders.splice(i, 1);
      if (!silent) api.onSound?.('doorOpen');
    },
    tryCode,
    code,
    postcardIcon: postcard.toDataURL('image/png'),
    items,
    hideSpots,
    doorLog,
    roomDoors,
    exits,
    wires,
    truck,
    textures: tex,
    // what the camera is looking at within reach: an item lying in an opened drawer or
    // chest (preferred), otherwise a movable part, a hiding spot, an exit door or a wire
    pick(camera, player) {
      raycaster.setFromCamera(centre, camera);
      let found = null;
      for (const hit of raycaster.intersectObjects(pickables, false)) {
        const u = hit.object.userData;
        if (u.item) {
          const it = u.item;
          if (it.floor) { if (it.level === player.level) return it; }
          else if (it.part.open && it.part.t > 0.85 && it.part.level === player.level) return it;
          continue;
        }
        if (found) continue;
        if (u.hide) { if (u.hide.level === player.level) found = u.hide.target; }
        else if (u.exit) { if (u.exit.level === player.level && !u.exit.open) found = u.exit.target; }
        else if (u.keypad) { if (u.keypad.exit.level === player.level && !u.keypad.lock.done) found = u.keypad; }
        else if (u.useTarget) { if (u.useTarget.level === player.level) found = u.useTarget; }
        else if (u.roomDoor) { if (u.roomDoor.level === player.level) found = u.roomDoor.target; }
        else if (u.wire) {
          const w = u.wire;
          if (!w.cut && w.level === player.level && w.box.open && w.box.t > 0.85) found = w.target;
        } else if (u.part?.level === player.level) found = u.part;
      }
      return found;
    },
    // `held` is the type of the item in the player's hand ('key', 'cutters') or null
    use(target, held) {
      if (target.kind === 'hide') { api.onHide?.(target.spot); return; }
      if (target.kind === 'exit') { useExit(target.exit, held); return; }
      if (target.kind === 'roomdoor') { toggleDoor(target.door); return; }
      if (target.kind === 'keypad') { api.onKeypad?.(target); return; }
      if (target.kind === 'board') { useBoard(target, held); return; }
      if (target.kind === 'carhood' || target.kind === 'carfuel' || target.kind === 'cardoor') { useTruck(target, held); return; }
      if (target.locked) { cutLock(target, held); return; }
      if (target.kind === 'wire') { cutWire(target.wire, held); return; }
      if (target.kind === 'item') {
        if (target.type === 'postcard') { api.onRead?.(); return; }            // read where it lies
        if (target.board && held === 'cleaver') { useBoard(target.board, held); return; }
        if (target.type === 'shells' && held === 'shotgun') { removeItem(target); api.onLoad?.(); return; }
        if (target.type !== 'flashlight' && api.canTake && !api.canTake()) { say('Your hand is full. Drop what you are holding first.'); return; }
        removeItem(target);
        api.onPickup?.(target.type);
        return;
      }
      target.open = !target.open;
      api.onUse?.(target.kind, target.open);
    },
    update(dt, player) {
      api.lastPlayer = player;
      if (player.level !== shownSunLevel) {
        shownSunLevel = player.level;
        for (const m of sunMeshes) m.visible = m.userData.level === player.level;
      }
      for (let i = falling.length - 1; i >= 0; i--) {   // a dropped vase falls and smashes
        const w = falling[i];
        if (!w.mesh.parent) { falling.splice(i, 1); continue; }   // picked up again
        w.vy -= 11 * dt; w.mesh.position.y += w.vy * dt;
        if (w.mesh.position.y <= w.floorY) {
          const pos = w.mesh.position.clone();
          const it = items.find(x => x.mesh === w.mesh);
          if (it) removeItem(it);
          shatter(new THREE.Vector3(pos.x, w.floorY + 0.1, pos.z), w.level, new THREE.MeshBasicMaterial({ color: 0xd69a2a }), true);
          const jam = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), new THREE.MeshBasicMaterial({ color: 0x7a2410 }));
          jam.rotation.x = -Math.PI / 2; jam.position.set(pos.x, w.floorY + 0.012, pos.z);
          group.add(jam);
          api.onSound?.('jar');
          api.onAlert?.({ x: pos.x, z: pos.z, level: w.level, kind: 'jar' });
          falling.splice(i, 1);
        }
      }
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); } }
      for (let i = shards.length - 1; i >= 0; i--) {  // glass falls and fades
        const s = shards[i];
        s.t += dt;
        s.vel.y -= 9.5 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.rotation.x += s.spin * dt; s.mesh.rotation.z += s.spin * 0.7 * dt;
        if (s.mesh.position.y < s.floor + 0.03) { s.mesh.position.y = s.floor + 0.03; s.vel.set(0, 0, 0); s.spin = 0; }
        if (s.t > 6) { s.mesh.removeFromParent(); shards.splice(i, 1); }
      }
      for (const d of roomDoors) {
        const goal = d.open ? 1 : 0;
        if (d.t === goal) continue;
        d.t += Math.sign(goal - d.t) * Math.min(Math.abs(goal - d.t), dt * 2.2);
        d.hinge.rotation.y = d.sign * 1.65 * (d.t * d.t * (3 - 2 * d.t));
        if (d.t === 0 && !colliders.includes(d.col)) colliders.push(d.col);
      }
      for (const part of parts) {
        const goal = part.open ? 1 : 0;
        if (part.t === goal) continue;
        part.t += Math.sign(goal - part.t) * Math.min(Math.abs(goal - part.t), dt * 3.5);
        const e = part.t * part.t * (3 - 2 * part.t);
        if (part.kind === 'drawer') part.pg.position.z = part.pivot[2] + part.dist * e;
        else if (part.kind === 'door') part.pg.rotation.y = part.angle * e;
        else part.pg.rotation.x = part.angle * e;
      }
      for (const exit of exits) {
        if (exit.open && exit.t < 1) {
          exit.t = Math.min(1, exit.t + dt * 0.9);
          exit.hinge.rotation.y = exit.angle * (exit.t * exit.t * (3 - 2 * exit.t));
        }
        if (exit.open && !exit.escaped && player.level === exit.level) {
          const p = player.pos, o = exit.out;
          const past = exit.axis === 'x' ? (p.z - exit.f) * o[1] : (p.x - exit.f) * o[0];
          const across = Math.abs((exit.axis === 'x' ? p.x : p.z) - exit.mid);
          if (past > 0.35 && across < exit.width) { exit.escaped = true; api.onEscape?.(exit); }
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.t += dt;
        sp.mesh.scale.setScalar(1 + sp.t * 8);
        sp.mesh.material.opacity = Math.max(0, 1 - sp.t * 4);
        if (sp.t > 0.3) { sp.mesh.removeFromParent(); sparks.splice(i, 1); }
      }
      for (const tr of traps) {
        if (tr.state === 'armed') {
          tr.cover.visible = player.level === tr.level;   // seen only from its own floor: from below it would show through the ceiling
          if (player.level !== tr.level) continue;
          const dx = Math.abs(player.pos.x - tr.x), dz = Math.abs(player.pos.z - tr.z);
          if (!tr.creaked && dx < tr.half + 0.9 && dz < tr.half + 0.9 && !player.hidden) { tr.creaked = true; api.onSound?.('doorOpen'); }
          else if (tr.creaked && (dx > tr.half + 2 || dz > tr.half + 2)) tr.creaked = false;
          if (!player.hidden && dx < tr.half - 0.05 && dz < tr.half - 0.05 && Math.abs(player.y - tr.Y) < 0.5) {
            tr.state = 'falling'; tr.t = 0; tr.hole.visible = true;
            api.onTrap?.(tr);
          }
        } else if (tr.state === 'falling') {
          tr.t += dt;
          tr.cover.position.y = tr.Y + 0.02 - 7 * tr.t * tr.t;
          tr.cover.rotation.x = tr.t * 2.2; tr.cover.rotation.z = tr.t * 1.4;
          if (tr.t > 1.4) { tr.cover.visible = false; tr.state = 'open'; }
        }
      }
      for (const m of scarecrows) {
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
