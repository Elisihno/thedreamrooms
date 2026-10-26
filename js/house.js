import * as THREE from '../vendor/three.module.min.js';
import { ITEMS, ROLE_ITEMS, buildMannequin } from './furniture.js';
import { makeApple } from './apple.js';
import { makeVase } from './vase.js';
import { paperCanvas, crumpledPaperGeometry } from './icons.js';

// ---- layout -------------------------------------------------------------
// The house follows the plan of "Granny 1 House" (see the README): the rooms, doorways and stairs
// below are read off that model in its own units and scaled to metres by mx() / mz().
// Each storey builds its own grid whose lines fall exactly on its walls, so a room is a set of cells
// and a doorway is one cell edge. Cells outside every room are '#': solid, never seen.
const SH = 0.5, MX = -19.7, MZ = -12.75;                 // metres per model unit, and the model's north-west corner
const mx = X => (X - MX) * SH, mz = Z => (Z - MZ) * SH;
const OUT_X = [-19.7, 20.85], OUT_Z = [-12.75, 14.05];   // the outer walls

// Doorways are ['x', z, x0, x1] (a gap in a wall that runs along x) or ['z', x, z0, z1]; exits use `at` the same way.
// Fixed items are { item, side, at: [x, z] } (backed onto the wall at that spot) or { item, at, turn } (free-standing).
const LEVELS = [
  {
    name: 'Lower Basement', windows: 0, barred: true,
    // the smallest room: shelves, a weird wooden machine, and a little barred window high in the north wall
    rooms: [{ id: 'S', x: [-8.5, 2.0], z: [-7.5, 4.5] }],
    windowAt: [['x', -7.5, -2.0, -0.5]],
    roles: { S: 'storage' },
    fixed: [
      { item: 'shelves', side: 'W', at: [-8.5, -3.0] }, { item: 'shelves', side: 'W', at: [-8.5, 0.5] },
      { item: 'shelves', side: 'S', at: [-1.5, 4.5] }, { item: 'barrel', side: 'E', at: [2.0, 3.0] },
      { item: 'rackmachine', at: [-0.2, -2.8], turn: 0 },
    ],
    walls: [0, 1, 4, 6], floors: [1, 5, 6],
  },
  {
    name: 'Upper Basement', windows: 0, barred: true,
    // bigger: scrap metal, and behind the boxes in the east wall a hidden way through
    rooms: [
      { id: 'B', x: [-8.4, 9.5], z: [-8.35, 9.7] },
      { id: 'H', x: [-14.5, -8.4], z: [2.0, 8.5] },       // the hidden room behind the boxes
    ],
    doors: [['z', -8.4, 3.0, 6.0]],
    openings: [['z', -8.4, 3.0, 6.0]],   // no door: the crates hide this way
    windowAt: [['x', -8.35, -1.5, 0.0]],
    roles: { B: 'storage', H: 'storage' },
    fixed: [
      { item: 'circuitbox', side: 'N', at: [0.5, -8.35] },
      { item: 'scrap', at: [-6.0, 6.5], turn: 0 }, { item: 'scrap', at: [7.2, 7.8], turn: 1 }, { item: 'scrap', at: [-2.0, 8.2], turn: 0 },
      { item: 'shelves', side: 'N', at: [-5.5, -8.35] }, { item: 'shelves', side: 'N', at: [4.5, -8.35] },
      { item: 'boiler', side: 'W', at: [-8.4, -3.0] },
      { item: 'chest', side: 'W', at: [-14.5, 3.5] },       // in the hidden room
      { item: 'barrel', side: 'W', at: [-14.5, 7.0] },
    ],
    // crates you shove by walking into them (model units, size in metres): the first one hides the doorway
    pushBoxes: [{ at: [-6.9, 4.5], size: 0.95 }, { at: [-6.9, 8.0], size: 0.9 }, { at: [-5.1, 8.6], size: 0.8 }],
    walls: [0, 1, 4, 6], floors: [1, 5, 6],
  },
  {
    name: 'Ground Floor', windows: 0.7,
    rooms: [
      { id: 'D', x: [-19.7, -6.25], z: [-12.75, -1.65] },  // dining room
      { id: 'N', x: [-6.25, 7.35], z: [-12.75, -1.65] },   // living room one
      { id: 'M', x: [7.35, 20.85], z: [-12.75, -1.65] },   // living room two
      { id: 'K', x: [-19.7, -6.25], z: [-1.65, 14.05] },   // kitchen
      { id: 'H', x: [-6.25, 7.35], z: [-1.65, 14.05] },    // the hall: front door and both staircases
      { id: 'Q', x: [7.35, 20.85], z: [-1.65, 14.05] },    // kids room
    ],
    doors: [['z', -6.25, -10.7, -7.3], ['z', 7.35, -10.7, -7.3], ['x', -1.65, -1.2, 2.2], ['x', -1.65, -16.0, -12.6],
            ['z', -6.25, 9.6, 13.0], ['z', 7.35, 9.6, 13.0]],
    roles: { D: 'dining', N: 'living', M: 'living', K: 'kitchen', H: 'hall', Q: 'kids' },
    // the front door in the south wall of the hall: a code lock and three padlocks
    exits: [
      { id: 'front', at: ['x', 14.05, -1.2, 2.2], width: 1.5, style: 'wood', locks: [['code', 1.85], ['padlock', 1.5], ['padlock', 1.1], ['padlock', 0.7]] },
      { id: 'window', at: ['z', -19.7, 2.0, 5.0], width: 1.4, style: 'window', locks: [['padlock', 1.6], ['padlock', 0.9]] },   // the kitchen window: a way out too
    ],
    fixed: [
      // the kitchen: a run of units along the north wall, the fridge and more along the west wall, a table with its chairs
      { item: 'counter', side: 'N', at: [-18.4, -1.65] },
      { item: 'cuttingboard', side: 'N', at: [-18.4, -1.65] },
      { item: 'microcounter', side: 'N', at: [-16.2, -1.65] },
      { item: 'stove', side: 'N', at: [-14.1, -1.65] },
      { item: 'kitchendrawers', side: 'N', at: [-12.0, -1.65] },
      { item: 'fridge', side: 'W', at: [-19.7, 11.8] },
      { item: 'counter', side: 'W', at: [-19.7, 9.7] },
      { item: 'kitchendrawers', side: 'W', at: [-19.7, 7.7] },
      { item: 'tablechairs', at: [-12.5, 6.4], turn: 0 },
      // the dining room: a long table in the middle, a sideboard and a clock
      { item: 'tablechairs', at: [-13.0, -7.2], turn: 0 }, { item: 'drawers', side: 'N', at: [-13.0, -12.75] },
      { item: 'bookshelf', side: 'W', at: [-19.7, -5.0] },
      // living room one: the sofa facing the fireplace
      { item: 'fireplace', side: 'N', at: [0.5, -12.75] }, { item: 'livingset', at: [0.5, -7.0], turn: 2 },
      { item: 'armchair', side: 'E', at: [7.35, -4.0] }, { item: 'bookshelf', side: 'S', at: [-3.0, -1.65] },
      // living room two: the television
      { item: 'tvunit', side: 'N', at: [14.0, -12.75] }, { item: 'sofa', at: [14.0, -6.5], turn: 2 },
      { item: 'bookshelf', side: 'E', at: [20.85, -9.0] }, { item: 'drawers', side: 'S', at: [18.0, -1.65] },
      // the hall
      { item: 'grandclock', side: 'N', at: [0.5, -1.65] }, { item: 'drawers', side: 'E', at: [7.35, 5.0] },
      // the kids room
      { item: 'kidsbed', side: 'E', at: [20.85, 3.0] }, { item: 'toybox', side: 'N', at: [14.0, -1.65] },
      { item: 'smalltable', at: [13.0, 7.0], turn: 0 }, { item: 'drawers', side: 'S', at: [14.0, 14.05] },
    ],
    furnishing: {},
    walls: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], floors: [0, 2, 3, 4, 7, 8, 9],
  },
  {
    name: 'Upper Floor', windows: 0.7, traps: 0,
    rooms: [
      { id: 'A', x: [-19.7, 0.5], z: [-12.75, -1.65] },     // the big bedroom: you start here
      { id: 'C', x: [0.5, 3.6], z: [-12.75, -1.65] },       // the narrow stairs to the attic
      { id: 'B', x: [3.6, 20.85], z: [-12.75, -1.65] },     // Nanny's bedroom
      { id: 'D', x: [-19.7, -6.25], z: [-1.65, 14.05] },    // the bathroom
      { id: 'L', x: [-6.25, 7.35], z: [-1.65, 14.05] },     // the landing, with the stairs
      { id: 'F', x: [7.35, 20.85], z: [-1.65, 14.05] },     // the kids room
    ],
    doors: [['x', -1.65, -3.1, 0.5], ['x', -1.65, 1.2, 2.9], ['x', -1.65, 4.6, 7.0], ['z', -6.25, -1.65, 2.0], ['z', 7.35, 9.6, 13.0], ['x', -1.65, 13.0, 16.8]],
    roles: { A: 'bedroom', B: 'bedroom', C: 'closet', D: 'bathroom', L: 'hall', F: 'kids' },
    looks: { D: { walls: [0, 6], floors: [6], tint: 0xeeeeee } },   // the bathroom: pale walls, tiles
    spawnAt: [-10.0, -6.0],
    fixed: [
      { item: 'roundtable', at: [-14.5, -8.0], turn: 0, vase: true }, { item: 'bed', side: 'N', at: [-10.0, -12.75] },   // your bed: Nanny tucks you in here
      { item: 'nightstand', side: 'N', at: [-7.6, -12.75] }, { item: 'wardrobe', side: 'W', at: [-19.7, -4.0] }, { item: 'drawers', side: 'S', at: [-6.0, -1.65] },
      { item: 'bed', side: 'N', at: [12.0, -12.75] }, { item: 'nightstand', side: 'N', at: [9.6, -12.75] }, { item: 'wardrobe', side: 'E', at: [20.85, -8.0] },
      { item: 'drawers', side: 'N', at: [16.5, -12.75] }, { item: 'bookshelf', side: 'S', at: [14.0, -1.65] },
      { item: 'bathtub', side: 'N', at: [-17.0, -1.65] }, { item: 'toilet', side: 'W', at: [-19.7, 6.0] }, { item: 'sink', side: 'W', at: [-19.7, 10.0] },
      { item: 'kidsbed', side: 'E', at: [20.85, 6.0] }, { item: 'toybox', side: 'S', at: [14.0, 14.05] }, { item: 'smalltable', at: [13.0, 8.0], turn: 0 },
      { item: 'drawers', side: 'W', at: [-6.25, 10.0] },
    ],
    guarantee: [{ item: 'trashcan', room: 'A' }],   // the trash can stands against a wall of the start bedroom
    furnishing: {},
    walls: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], floors: [0, 2, 3, 4, 7, 8, 9],
  },
  {
    name: 'Lower Attic', windows: 0.2,
    // the dummy room, a locked stairwell, and the prison room with the electric machine
    rooms: [
      { id: 'R', x: [-4.0, 7.0], z: [-12.75, 3.0] },
      { id: 'K', x: [-13.0, -4.0], z: [-12.75, 3.0] },
      { id: 'P', x: [7.0, 20.85], z: [-12.75, 3.0] },
    ],
    doors: [['z', -4.0, -8.0, -5.0], ['z', 7.0, -8.0, -5.0]],
    roles: { R: 'attic', K: 'attic', P: 'attic' },
    fixed: [
      { item: 'dummy', at: [4.5, 0.5], turn: 0 },
      { item: 'doubledoor', side: 'W', at: [7.0, -11.0] },   // sealed: it needs a hammer
      { item: 'crates', side: 'N', at: [5.0, -12.75] }, { item: 'covered', side: 'S', at: [-1.5, 3.0] },
      { item: 'electricmachine', side: 'N', at: [14.0, -12.75] }, { item: 'chest', side: 'E', at: [20.85, -9.0] },
    ],
    trapAt: [[5.2, -6.5]],               // the floor in front of the prison doorway gives way
    lockedDoors: [['z', -4.0, -8.0, -5.0]],   // the stairwell to the upper attic needs a key
    drops: [['paper', 4.0, -6.0, 0.5]],   // the smiley paper
    furnishing: {},
    walls: [2, 5, 7, 9], floors: [0, 2, 3, 4, 7, 9],
  },
  {
    name: 'Upper Attic', windows: 0.2,
    rooms: [{ id: 'T', x: [-13.0, -1.0], z: [-12.75, 6.0] }],
    roles: { T: 'attic' },
    fixed: [
      { item: 'lockbox', side: 'S', at: [-6.5, 6.0] },    // the locker at the end of the room
      { item: 'chest', side: 'W', at: [-13.0, -2.0] }, { item: 'crates', side: 'W', at: [-13.0, 2.0] }, { item: 'covered', side: 'E', at: [-1.0, 2.0] },
    ],
    furnishing: {},
    walls: [2, 5, 7, 9], floors: [0, 2, 3, 4, 7, 9],
  },
];
export const GROUND = 2; // index of the Ground Floor

// stairs[k] climbs from LEVELS[k] to LEVELS[k+1]. x is its width and bottom / top the z where it starts
// and ends, so it climbs north when top < bottom (the numbers are the model's).
const STAIR_DEFS = [
  { x: [-6.0, -3.0], bottom: -5.0, top: 2.5 },     // lower basement to upper: climbing south
  { x: [4.6, 7.35], bottom: -1.65, top: 6.7 },     // upper basement to ground: down the east side of the hall, climbing south
  { x: [-6.25, -3.1], bottom: 9.6, top: 2.0 },     // ground to upper floor: up the west side of the hall, climbing north
  { x: [0.8, 3.3], bottom: -2.6, top: -10.3 },     // upper floor to the lower attic: the narrow stairs behind the little door
  { x: [-9.5, -6.7], bottom: -2.0, top: -9.5 },   // lower attic to the upper attic, behind the locked door
];

export const WALL_H = 3; // also the height of one storey
const THICK = 0.2, HT = THICK / 2;
const DOOR_W = 1.2, DOOR_H = 2.2;
const WIN_W = 1.1, WIN_H = 1.87, WIN_Y = 0.7; // window tiles are ~0.59 aspect
const TILE_W = 2.5, TILE_H = 4.2;             // world size one texture tile covers

export const levelY = i => (i - GROUND) * WALL_H;
const WALL_TINTS = [0x8f8478, 0x857a70, 0x948476, 0x7c746c];   // the wallpapers carry their own colours now; a light tint just varies them
const FLOOR_TINT = 0x8a7c72;
let bloodMat = null;
function bloodDecal() {
  if (bloodMat) return bloodMat;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  for (let i = 0; i < 38; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * Math.random() * 90, r = 6 + Math.random() * 26 * (1 - d / 120);
    const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(96,6,6,.95)'); gr.addColorStop(.75, 'rgba(70,3,3,.9)'); gr.addColorStop(1, 'rgba(50,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(80,4,4,.85)'; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * (60 + Math.random() * 60), 128 + Math.sin(a) * (60 + Math.random() * 60)); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  bloodMat = new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return bloodMat;
}
const COUNT = { wall: 10, floor: 10, window: 10, furniture: 1, door: 1 };

export const stairs = STAIR_DEFS.map((d, k) => {
  const zb = mz(d.bottom), zt = mz(d.top);
  return { from: k, x0: mx(d.x[0]), x1: mx(d.x[1]), zb, zt, z0: Math.min(zb, zt), z1: Math.max(zb, zt), dir: Math.sign(zt - zb), rise: WALL_H };
});

let dummyTex = null;
function dummyTexture() {
  if (!dummyTex) { dummyTex = new THREE.TextureLoader().load(globalThis.__DR_TEX?.dummy ?? 'assets/textures/dummy.jpg'); dummyTex.colorSpace = THREE.SRGBColorSpace; dummyTex.wrapS = dummyTex.wrapT = THREE.MirroredRepeatWrapping; }
  return dummyTex;
}

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

// The sticky note with the front door code, drawn as a picture.
function drawNote(code) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#f0dd6a'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, 256, 18);
  g.save();
  g.translate(128, 140); g.rotate(-0.05);
  g.fillStyle = '#3a2f1d'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 26px "Segoe Print", "Bradley Hand", cursive, system-ui'; g.fillText('front door', 0, -62);
  g.font = 'bold 64px "Segoe Print", "Bradley Hand", cursive, system-ui'; g.fillText(code.split('').join(' '), 0, 6);
  g.strokeStyle = '#3a2f1d'; g.lineWidth = 3; g.beginPath(); g.moveTo(-84, 52); g.quadraticCurveTo(0, 60, 84, 50); g.stroke();
  g.restore();
  return cv;
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
  const traps = [];      // cracked floor patches that collapse
  const pushBoxes = [];  // crates that slide when you walk into them
  const parts = [];      // movable furniture parts (drawers, doors, lids)
  const partMeshes = [];
  const pickables = []; // everything the crosshair can land on
  // the front door keypad code: new on every load, separate from the seeded house layout
  const code = String((globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 4294967296)) % 10000).padStart(4, '0');
  const noteCanvas = drawNote(code);
  const hideSpots = [];
  const roomDoors = [];
  let vaseStart = null;
  let carSeat = null;   // where the driver sits, once the car is placed
  const wobbles = [];   // dropped vases, falling and wobbling
  const shootables = []; // panes that can be shot out
  const shards = [];     // flying glass
  const timers = [];     // things that happen a moment later
  const pops = [];       // items flying out of the trash can
  const doorLog = []; // door and window edges per storey, for debugging
  const exits = [];  // doors out of the house
  const wires = [];  // cuttable wires in the power box
  const sparks = [];
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
    body: fm(0xc8b8a4), dark2: fm(0x8a7e70), light: fm(0xf0e8dc), white: fm(0xf4f0ea), blood: plain(0x5e0a0a),
    cloth: fm(0xa89288), paper: fm(0xb09a78), dark: plain(0x161312), steel: fm(0x8c949a),
    dummy: new THREE.MeshLambertMaterial({ map: dummyTexture() }),   // the punching dummy wears the bloodstained plaster texture
  };

  LEVELS.forEach((cfg, level) => buildFloor(cfg, level));
  stairs.forEach(buildStairs);

  // ---- things you can pick up ---------------------------------------------------------
  const loader = new THREE.TextureLoader();
  const spec = { key: { w: 0.34, h: 0.19 }, pliers: { w: 0.27, h: 0.28 }, note: { w: 0.14, h: 0.14 }, paper: { w: 0.2, h: 0.276 } };
  const col = hex => ({ color: new THREE.Color(hex) });
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  const boxesMesh = boxes => new THREE.Mesh(partGeometry(boxes, [0, 0, 0]), solid);
  const steel = col(0xb9bec3), darkSteel = col(0x2a3035), wood = col(0x5a3a22), brass = col(0xb89a32), red = col(0xc8321f);
  const texCache = {};
  const itemTexture = type => {
    if (!texCache[type]) {
      const t = type === 'note' ? new THREE.CanvasTexture(noteCanvas)
        : type === 'paper' ? new THREE.CanvasTexture(paperCanvas(256))
        : loader.load(globalThis.__DR_TEX?.[`item_${type}`] ?? `assets/textures/item_${type}.png`);
      t.colorSpace = THREE.SRGBColorSpace;
      texCache[type] = t;
    }
    return texCache[type];
  };
  // How far above the surface the mesh's origin sits when it lies there.
  const LIFT = { apple: 0.045, shotgun: 0.05, shells: 0.015, knife: 0.01, battery: 0.005, fuel: 0.005, flashlight: 0.02, paper: 0.004, vase: 0 };

  // `spin` is the yaw to lie at (random when not given).
  function makeItemMesh(type, spin) {
    let mesh;
    if (type === 'apple') {
      mesh = makeApple(0.05);
      mesh.rotation.y = spin ?? 0.6;
    } else if (type === 'knife') {
      mesh = boxesMesh([[.09, .016, .024, -.07, 0, 0, wood], [.012, .02, .026, -.015, 0, 0, steel], [.15, .004, .03, .06, .004, 0, steel]]);
      mesh.rotation.y = spin ?? rand() * Math.PI * 2;
    } else if (type === 'shotgun') {
      mesh = boxesMesh([
        [.55, .026, .026, .22, .03, 0, darkSteel], [.44, .02, .02, .15, .005, 0, steel], [.18, .05, .04, -.1, 0, 0, darkSteel],
        [.15, .04, .044, .12, -.012, 0, wood], [.34, .06, .034, -.37, -.012, 0, wood], [.05, .1, .036, -.55, -.034, 0, wood],
      ]);
      mesh.rotation.y = spin ?? 0;
    } else if (type === 'vase') {
      mesh = makeVase(1.3);
      mesh.rotation.y = spin ?? 0;
    } else if (type === 'flashlight') {
      mesh = boxesMesh([[.16, .04, .04, -.02, 0, 0, col(0x3a3f45)], [.05, .065, .065, .085, -.012, 0, steel], [.01, .055, .055, .115, -.008, 0, col(0xfff0b0)],
        [.02, .012, .02, -.03, .04, 0, red], [.012, .042, .042, -.07, 0, 0, col(0x23272b)], [.012, .042, .042, -.04, 0, 0, col(0x23272b)]]);
      mesh.rotation.y = spin ?? rand() * Math.PI * 2;
    } else if (type === 'battery') {
      mesh = boxesMesh([[.26, .18, .16, 0, 0, 0, darkSteel], [.264, .03, .164, 0, .12, 0, col(0x3a5aa0)],
        [.045, .035, .045, -.07, .18, 0, brass], [.045, .035, .045, .07, .18, 0, brass]]);
      mesh.rotation.y = spin ?? rand() * Math.PI * 2;
    } else if (type === 'fuel') {
      mesh = boxesMesh([[.3, .36, .13, 0, 0, 0, red], [.14, .04, .1, .06, .36, 0, red], [.05, .06, .05, -.09, .36, 0, steel],
        [.1, .02, .136, 0, .22, 0, col(0x8a1c10)], [.02, .12, .1, .17, .24, 0, darkSteel]]);
      mesh.rotation.y = spin ?? rand() * Math.PI * 2;
    } else if (type === 'shells') {
      mesh = boxesMesh([-1, 0, 1].flatMap(k => [[.07, .022, .022, 0, 0, k * .026, red], [.022, .024, .024, -.044, 0, k * .026, brass]]));
      mesh.rotation.y = spin ?? rand() * Math.PI * 2;
    } else {
      mesh = new THREE.Mesh(
        type === 'paper' ? crumpledPaperGeometry(spec[type].w, spec[type].h) : new THREE.PlaneGeometry(spec[type].w, spec[type].h),
        new THREE.MeshBasicMaterial({ map: itemTexture(type), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xd8d8d8 }));
      mesh.rotation.order = 'YXZ';
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.y = spin ?? (rand() - 0.5) * 1.4;
    }
    return mesh;
  }

  // Put a carried item down: it lies on the surface at (x, y, z) and can be picked up again.
  function dropItem(type, x, y, z, yaw, level, board = null, fall = false) {
    const mesh = makeItemMesh(type, yaw);
    mesh.position.set(x, y + (LIFT[type] ?? 0.02), z);
    if (type === 'vase' && fall) {            // let go of it: it drops from hand height, lands and wobbles
      mesh.position.y = y + 1.0;
      wobbles.push({ mesh, floorY: y, vy: 0, landed: false, t: 0, level });
    }
    group.add(mesh);
    const item = { kind: 'item', type, part: null, mesh, floor: true, level, board };
    mesh.userData.item = item;
    items.push(item);
    pickables.push(mesh);
    return item;
  }

  function removeItem(item) {
    item.mesh.removeFromParent();
    const a = pickables.indexOf(item.mesh); if (a >= 0) pickables.splice(a, 1);
    const b = items.indexOf(item); if (b >= 0) items.splice(b, 1);
    if (item.part) item.part.hasItem = false;
    if (item.board) item.board.apple = null;
  }

  // One pair of cutting pliers in a single drawer, one key per storey (preferably in a chest), and a spare key.
  function placeLoot() {
    const place = (type, part) => {
      const mesh = makeItemMesh(type);
      mesh.position.set(...part.loot.pos);
      mesh.position.y += type === 'shotgun' ? 0.08 : 0;
      part.loot.parent.add(mesh);
      const item = { kind: 'item', type, part, mesh };
      mesh.userData.item = item;
      items.push(item);
      itemMeshes.push(mesh);
      part.hasItem = true;
    };
    const holders = parts.filter(p => p.loot);
    // the apple always lies in the fridge, the shotgun in the locked metal box
    const fridgeDoor = holders.find(p => p.tag === 'fridge');
    if (fridgeDoor) place('apple', fridgeDoor);
    const gunBox = holders.find(p => p.tag === 'gunbox');
    if (gunBox) place('shotgun', gunBox);
    // things that lie about in the open: the smiley-face paper in the attic, the fuel can in the cellar, the battery
    LEVELS.forEach((cfg, lv) => { for (const [type, X, Z, yaw] of cfg.drops ?? []) dropItem(type, mx(X), levelY(lv), mz(Z), yaw, lv); });
    // the vase starts on the start bedroom's round table
    if (vaseStart) dropItem('vase', vaseStart.x, vaseStart.y, vaseStart.z, 0.4, vaseStart.level);
    // a kitchen knife in one of the kitchen drawers
    const knifeDrawers = holders.filter(p => p.kind === 'drawer' && p.role === 'kitchen' && !p.hasItem);
    if (knifeDrawers.length) place('knife', pick(knifeDrawers));
    const pliersAt = pick(holders.filter(p => p.kind === 'drawer' && !p.hasItem));
    place('pliers', pliersAt);
    // the sticky note with the front door code: always in a drawer in a living room
    const noteDrawers = holders.filter(p => p.kind === 'drawer' && p.role === 'living' && !p.hasItem);
    if (noteDrawers.length) place('note', pick(noteDrawers));
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const here = holders.filter(p => p.level === lv && !p.hasItem);
      if (!here.length) continue;
      const chests = here.filter(p => p.kind === 'flap');
      place('key', pick(chests.length ? chests : here));
    }
    // one spare key, anywhere, so the front door (3 keys) and the hatch (2 keys) can both be opened
    const spare = holders.filter(p => !p.hasItem);
    if (spare.length) place('key', pick(spare));
    pickables.push(...partMeshes, ...itemMeshes);
  }
  placeLoot();

  function buildFloor(cfg, level) {
    const Y = levelY(level);
    const batch = makeBatch();
    const up = stairs[level];       // stairs leaving this storey
    const down = stairs[level - 1]; // stairs arriving from below

    // ---- this storey's grid: its lines fall exactly on its walls, doorways, stairs and exits ----
    const xs = new Set(OUT_X.map(mx)), zs = new Set(OUT_Z.map(mz));
    for (const r of cfg.rooms) { r.x.forEach(v => xs.add(mx(v))); r.z.forEach(v => zs.add(mz(v))); }
    const gapLines = g => {
      if (g[0] === 'x') { zs.add(mz(g[1])); xs.add(mx(g[2])); xs.add(mx(g[3])); }
      else { xs.add(mx(g[1])); zs.add(mz(g[2])); zs.add(mz(g[3])); }
    };
    (cfg.doors ?? []).forEach(gapLines);
    (cfg.exits ?? []).forEach(e => gapLines(e.at));
    (cfg.windowAt ?? []).forEach(gapLines);
    for (const st of [up, down]) if (st) { xs.add(st.x0); xs.add(st.x1); zs.add(st.zb); zs.add(st.zt); }
    (cfg.extraX ?? []).forEach(v => xs.add(mx(v)));
    (cfg.extraZ ?? []).forEach(v => zs.add(mz(v)));
    const lineList = set => { const out = []; for (const v of [...set].sort((p, q) => p - q)) if (!out.length || v - out[out.length - 1] > 0.04) out.push(v); return out; };
    const XS = lineList(xs), ZS = lineList(zs);
    const cols = XS.length - 1, rows = ZS.length - 1;
    const findIn = (arr, v) => { for (let i = 0; i < arr.length - 1; i++) if (v >= arr[i] - 1e-6 && v <= arr[i + 1] + 1e-6) return i; return -1; };
    const colAt = x => findIn(XS, x), rowAt = z => findIn(ZS, z);
    const MAP = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const cx = (XS[c] + XS[c + 1]) / 2, cz = (ZS[r] + ZS[r + 1]) / 2;
        let id = '#';
        for (const room of cfg.rooms) if (cx > mx(room.x[0]) && cx < mx(room.x[1]) && cz > mz(room.z[0]) && cz < mz(room.z[1])) id = room.id;
        line += id;
      }
      MAP.push(line);
    }
    const at = (c, r) => (r < 0 || c < 0 || r >= rows || c >= cols ? null : MAP[r][c]);
    const roomAt = (x, z) => { const c = colAt(x), r = rowAt(z); return c < 0 || r < 0 ? null : MAP[r][c]; };
    const holeOf = st => {
      const out = new Set();
      if (st) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cx = (XS[c] + XS[c + 1]) / 2, cz = (ZS[r] + ZS[r + 1]) / 2;
        if (cx > st.x0 && cx < st.x1 && cz > st.z0 && cz < st.z1) out.add(`${c},${r}`);
      }
      return out;
    };
    const ceilHole = holeOf(up), floorHole = holeOf(down);

    // per-room look
    const ids = [...new Set(MAP.join(''))].filter(id => id !== '#');
    const look = {};
    for (const id of ids) {
      const rc = cfg.looks?.[id] ?? {};
      // each room gets its own wallpaper tint, like the colours of Granny's house
      look[id] = { wall: tex.wall[pick(rc.walls ?? cfg.walls)], floor: tex.floor[pick(rc.floors ?? cfg.floors)], tint: rc.tint ?? pick(WALL_TINTS), sx: 0, sz: 0, n: 0 };
    }
    const wallMat = id => (id && id !== '#' ? mat(look[id].wall, look[id].tint) : outside);

    // which wall edges exist: 'h' = on top of cell (c,r), 'v' = on its left
    const key = (dir, c, r) => `${dir}${c},${r}`;
    const has = (dir, c, r) => (dir === 'h' ? at(c, r) !== at(c, r - 1) : at(c, r) !== at(c - 1, r));
    // the one cell edge that a gap ['x', z, x0, x1] or ['z', x, z0, z1] fills
    const near = (arr, v) => arr.findIndex(q => Math.abs(q - v) < 0.06);
    const edgeKey = g => {
      const alongX = g[0] === 'x';
      const line = alongX ? near(ZS, mz(g[1])) : near(XS, mx(g[1]));
      const a0 = alongX ? near(XS, mx(g[2])) : near(ZS, mz(g[2]));
      const a1 = alongX ? near(XS, mx(g[3])) : near(ZS, mz(g[3]));
      if (line < 0 || a0 < 0 || a1 !== a0 + 1) throw new Error(`gap ${g} is not one cell edge of ${cfg.name}`);
      return alongX ? key('h', a0, line) : key('v', line, a0);
    };
    const parseKey = k => [k[0], ...k.slice(1).split(',').map(Number)];

    // doorways and exits are given in the plan; every doorway is one cell edge
    const doors = new Set();
    const winEdges = new Set();
    const doorWidth = new Map();
    for (const g of cfg.doors ?? []) {
      const k = edgeKey(g);
      doors.add(k);
      doorWidth.set(k, Math.min(1.5, (g[0] === 'x' ? mx(g[3]) - mx(g[2]) : mz(g[3]) - mz(g[2])) - 0.1));
    }
    const exitList = (cfg.exits ?? []).map(ex => ({ ...ex, edge: parseKey(edgeKey(ex.at)) }));
    for (const ex of exitList) { const k = key(...ex.edge); doors.add(k); doorWidth.set(k, ex.width ?? DOOR_W); }
    const forcedWin = new Set((cfg.windowAt ?? []).map(edgeKey));
    doorLog.push({ level, map: MAP, doors: [...doors], windows: () => [...winEdges] });

    // ---- where things stand: footprints, and the rectangles kept clear ----
    const GAP = HT + 0.03;
    const baseOf = f => {   // the item's back-centre and facing angle from its plan entry
      const X = mx(f.at[0]), Z = mz(f.at[1]);
      if (!f.side) return [[X, Z], (f.turn ?? 0) * Math.PI / 2];
      return { N: [[X, Z + GAP], 0], S: [[X, Z - GAP], Math.PI], W: [[X + GAP, Z], Math.PI / 2], E: [[X - GAP, Z], -Math.PI / 2] }[f.side];
    };
    const rectsOf = (item, base, ang) => {
      const cs = Math.round(Math.cos(ang)), sn = Math.round(Math.sin(ang));
      const xf = (lx, lz) => [base[0] + lx * cs + lz * sn, base[1] - lx * sn + lz * cs];
      return (item.colliders ?? [[item.w, item.d, 0, item.d / 2]]).map(([w, d, lx, lz]) => {
        const [ax, az] = xf(lx - w / 2, lz - d / 2), [bx, bz] = xf(lx + w / 2, lz + d / 2);
        return { minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz) };
      });
    };
    const hits = (a, b, m = 0) => a.minX < b.maxX + m && a.maxX > b.minX - m && a.minZ < b.maxZ + m && a.maxZ > b.minZ - m;
    const fixedRects = (cfg.fixed ?? []).flatMap(f => { const [bs, an] = baseOf(f); return rectsOf(ITEMS[f.item], bs, an); });
    const furn = [];      // footprints placed on this storey
    const keep = [];      // rectangles that stay clear: doorways, stairs, the spawn, things lying about
    const winKeep = [];   // where windows are, for tall furniture

    // floors & ceilings (the stair openings have neither on the storeys they join)
    const ceilTex = tex.floor[3];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = at(c, r), k = `${c},${r}`;
      const cw = XS[c + 1] - XS[c], ch = ZS[r + 1] - ZS[r];
      if (id === '#') { // solid ground or rock: nothing to see, nowhere to walk
        colliders.push({ minX: XS[c], maxX: XS[c + 1], minZ: ZS[r], maxZ: ZS[r + 1], level });
        continue;
      }
      const lk = look[id], x = XS[c] + cw / 2, z = ZS[r] + ch / 2;
      if (!floorHole.has(k)) batch.add(placed(new THREE.PlaneGeometry(cw, ch), x, Y, z, -Math.PI / 2), mat(lk.floor, lk.tint === 0xeeeeee ? 0xffffff : FLOOR_TINT));
      if (!ceilHole.has(k)) batch.add(placed(new THREE.PlaneGeometry(cw, ch), x, Y + WALL_H, z, Math.PI / 2), mat(ceilTex, 0xaaaaaa));
      lk.sx += x * cw * ch; lk.sz += z * cw * ch; lk.n += cw * ch;
    }

    // old blood on the floor, here and there
    for (let n = 0; n < (level === GROUND ? 2 : 3); n++) {
      const c = Math.floor(rand() * cols), r = Math.floor(rand() * rows), k = `${c},${r}`;
      if (at(c, r) === '#' || floorHole.has(k) || ceilHole.has(k)) continue;
      const size = 0.9 + rand() * 1.2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), bloodDecal());
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.rotateZ(rand() * Math.PI * 2);
      m.position.set(XS[c] + (0.2 + rand() * 0.6) * (XS[c + 1] - XS[c]), Y + 0.006, ZS[r] + (0.2 + rand() * 0.6) * (ZS[r + 1] - ZS[r]));
      group.add(m);
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
      const f = dir === 'h' ? ZS[r] : XS[c]; // wall centre line
      const start = dir === 'h' ? XS[c] : ZS[r], end = dir === 'h' ? XS[c + 1] : ZS[r + 1];
      const v0 = dir === 'h' ? [c, r] : [c, r], v1 = dir === 'h' ? [c + 1, r] : [c, r + 1];
      const a0 = start - reach(v0[0], v0[1], dir, c, r);
      const a1 = end + reach(v1[0], v1[1], dir, c, r);
      const mid = (start + end) / 2;
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
      } else if ((!pos || !neg || pos === '#' || neg === '#') && (forcedWin.has(k) || (end - start >= WIN_W + 0.6 && rand() < cfg.windows && !fixedRects.some(q => hits(q, axis === 'x' ? { minX: mid - 0.7, maxX: mid + 0.7, minZ: f - 0.3, maxZ: f + 0.3 } : { minX: f - 0.3, maxX: f + 0.3, minZ: mid - 0.7, maxZ: mid + 0.7 }))))) {
        winEdges.add(k);
        winKeep.push(axis === 'x' ? { minX: mid - WIN_W / 2 - 0.2, maxX: mid + WIN_W / 2 + 0.2, minZ: f - 0.4, maxZ: f + 0.9 } : { minX: f - 0.4, maxX: f + 0.9, minZ: mid - WIN_W / 2 - 0.2, maxZ: mid + WIN_W / 2 + 0.2 }, axis === 'x' ? { minX: mid - WIN_W / 2 - 0.2, maxX: mid + WIN_W / 2 + 0.2, minZ: f - 0.9, maxZ: f + 0.4 } : { minX: f - 0.9, maxX: f + 0.4, minZ: mid - WIN_W / 2 - 0.2, maxZ: mid + WIN_W / 2 + 0.2 });
        const wy = cfg.barred ? 1.95 : WIN_Y, wh = cfg.barred ? 0.7 : WIN_H;     // basement windows are small and high
        opening(WIN_W);
        piece(axis, mid - WIN_W / 2, mid + WIN_W / 2, f, 0, wy, posMat, negMat, false);
        piece(axis, mid - WIN_W / 2, mid + WIN_W / 2, f, wy + wh, WALL_H, posMat, negMat, false);
        const hw = WIN_W / 2;
        colliders.push(axis === 'x'
          ? { minX: mid - hw, maxX: mid + hw, minZ: f - HT, maxZ: f + HT, level }
          : { minX: f - HT, maxX: f + HT, minZ: mid - hw, maxZ: mid + hw, level });
        if (cfg.barred) {   // jail bars of our own over a black opening
          const iron = new THREE.MeshLambertMaterial({ color: 0x2c2d30 });
          const dark = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, wh), new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.DoubleSide }));
          const cx = axis === 'x' ? mid : f, cz = axis === 'x' ? f : mid, cy = Y + wy + wh / 2;
          dark.position.set(cx, cy, cz);
          if (axis === 'z') dark.rotation.y = Math.PI / 2;
          group.add(dark);
          for (let bx = -hw + 0.1; bx <= hw - 0.05; bx += 0.17) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.035 : 0.06, wh, axis === 'x' ? 0.06 : 0.035), iron);
            bar.position.set(axis === 'x' ? mid + bx : f, cy, axis === 'x' ? f : mid + bx);
            group.add(bar);
          }
          for (const ry of [-wh / 2 + 0.05, wh / 2 - 0.05]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? WIN_W : 0.07, 0.05, axis === 'x' ? 0.07 : WIN_W), iron);
            rail.position.set(cx, cy + ry, cz);
            group.add(rail);
          }
        } else {
        const gm = mat(tex.window[Math.floor(rand() * COUNT.window)], 0xffffff, THREE.DoubleSide);
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
        }
      } else {
        piece(axis, a0, a1, f, 0, WALL_H, posMat, negMat);
      }
    }

    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      if (c < cols) wallEdge('h', c, r);
      if (r < rows) wallEdge('v', c, r);
    }

    // railings along the stairs: the long sides on the storey the stairs leave, and for stairs arriving
    // here the sides plus the far end, so the only way onto them is the proper one
    {
      const rail = mat(tex.floor[2], 0x777777), t = 0.08;
      const addRail = (x0, x1, z0, z1) => {
        batch.box(x1 - x0, 1, z1 - z0, (x0 + x1) / 2, Y + 0.5, (z0 + z1) / 2, Array(6).fill(rail));
        colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, level });
      };
      for (const st of [up, down]) {
        if (!st) continue;
        addRail(st.x0, st.x0 + t, st.z0, st.z1);
        addRail(st.x1 - t, st.x1, st.z0, st.z1);
        if (st === down) { if (st.dir > 0) addRail(st.x0, st.x1, st.z0, st.z0 + t); else addRail(st.x0, st.x1, st.z1 - t, st.z1); }
        else if (st.dir > 0) addRail(st.x0, st.x1, st.z1 - t, st.z1); else addRail(st.x0, st.x1, st.z0, st.z0 + t);   // its top end, under the hole above
        keep.push({ minX: st.x0 - 0.4, maxX: st.x1 + 0.4, minZ: st.z0 - 1.0, maxZ: st.z1 + 1.0 });
      }
    }


    // A hinged door in every doorway between rooms. It swings away from whoever opens it, blocks the
    // way while closed, and opens or closes with the hand cursor.
    function buildRoomDoors() {
      const exitKeys = new Set(exitList.map(e => key(...e.edge)));
      const faceTex = tex.door[0];
      faceTex.wrapS = faceTex.wrapT = THREE.ClampToEdgeWrapping;
      const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
      const edgeMat = new THREE.MeshLambertMaterial({ color: 0x2a1c12 });
      const T = 0.06;
      const openSet = new Set((cfg.openings ?? []).map(edgeKey)), lockedSet = new Set((cfg.lockedDoors ?? []).map(edgeKey));
      for (const k of doors) {
        if (exitKeys.has(k) || openSet.has(k)) continue;
        const dir = k[0], [c, r] = k.slice(1).split(',').map(Number);
        const axis = dir === 'h' ? 'x' : 'z';
        const f = dir === 'h' ? ZS[r] : XS[c], mid = dir === 'h' ? (XS[c] + XS[c + 1]) / 2 : (ZS[r] + ZS[r + 1]) / 2;
        const dw = doorWidth.get(k) ?? DOOR_W;
        const hinge = new THREE.Group();
        hinge.position.set(axis === 'x' ? mid - dw / 2 : f, Y, axis === 'x' ? f : mid - dw / 2);
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
        if (lockedSet.has(k)) {   // a padlock on both faces: it needs a key
          const lockMesh = new THREE.Group();
          for (const side of [-1, 1]) {
            const body = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.1 : 0.05, 0.12, axis === 'x' ? 0.05 : 0.1), new THREE.MeshPhongMaterial({ color: 0xb89a32, shininess: 60 }));
            const shackle = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.06 : 0.03, 0.07, axis === 'x' ? 0.03 : 0.06), new THREE.MeshPhongMaterial({ color: 0x8a8f94 }));
            body.position.set(axis === 'x' ? dw * 0.85 : side * 0.05, 1.1, axis === 'x' ? side * 0.05 : dw * 0.85);
            shackle.position.set(body.position.x, 1.19, body.position.z);
            lockMesh.add(body, shackle);
          }
          hinge.add(lockMesh);
          door.lock = { done: false, mesh: lockMesh };
        }
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
      const f = dir === 'h' ? ZS[er] : XS[ec];                  // wall centre line
      const mid = dir === 'h' ? (XS[ec] + XS[ec + 1]) / 2 : (ZS[er] + ZS[er + 1]) / 2;    // middle of the doorway
      const out = dir === 'h' ? [0, er === rows ? 1 : -1] : [ec === cols ? 1 : -1, 0]; // outward (x, z)
      const inn = [-out[0], -out[1]];
      const metal = ex.style === 'metal';
      const doorMat = ex.style === 'window' ? new THREE.MeshLambertMaterial({ map: tex.window[6] }) : new THREE.MeshLambertMaterial({ map: tex.floor[metal ? 5 : 2], color: metal ? 0x80858a : 0xa07f58 });
      const hinge = new THREE.Group();
      hinge.position.set(axis === 'x' ? mid - DW / 2 : f, Y, axis === 'x' ? f : mid - DW / 2);
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
      const exit = { id: ex.id, level, axis, f, mid, out, hinge, angle, locks, open: false, t: 0, col, escaped: false, width: DW, carOnly: !!ex.carOnly };
      if (ex.carOnly) {   // a big shutter: ribs across it
        for (let i = 1; i < 5; i++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(...dims(DW - 0.1, 0.05, 0.02)), new THREE.MeshLambertMaterial({ color: 0x50565c }));
          rib.position.set(...at3(DW / 2, i * DOOR_H / 5, 0.045));
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


    // Furniture: the fixed pieces of the plan first, then each room's own list, backed onto the walls or
    // standing free, never on top of each other, in front of a doorway or on the stairs.
    function furnish() {
      const fb = makeBatch(1.4, 1.4);
      // keep clear: doorways and exits, the spawn, things lying about, where mannequins stand
      for (const k of doors) {
        const [dir, c, r] = parseKey(k), w = (doorWidth.get(k) ?? DOOR_W) / 2 + 0.3;
        if (dir === 'h') { const f = ZS[r], m = (XS[c] + XS[c + 1]) / 2; keep.push({ minX: m - w, maxX: m + w, minZ: f - 1.2, maxZ: f + 1.2 }); }
        else { const f = XS[c], m = (ZS[r] + ZS[r + 1]) / 2; keep.push({ minX: f - 1.2, maxX: f + 1.2, minZ: m - w, maxZ: m + w }); }
      }
      const spot = (X, Z, h) => { const x = mx(X), z = mz(Z); keep.push({ minX: x - h, maxX: x + h, minZ: z - h, maxZ: z + h }); };
      if (cfg.spawnAt) spot(cfg.spawnAt[0], cfg.spawnAt[1], 1.0);
      for (const [, X, Z] of cfg.drops ?? []) spot(X, Z, 0.7);
      for (const [X, Z] of cfg.mannequins ?? []) spot(X, Z, 0.8);

      // is the whole footprint inside room `id`?
      const inside = (id, rects) => rects.every(q => [[q.minX, q.minZ], [q.maxX, q.minZ], [q.minX, q.maxZ], [q.maxX, q.maxZ]].every(([x, z]) => roomAt(x, z) === id));
      const clear = (rects, item, margin = 0.12) => rects.every(q => !furn.some(o => hits(q, o, margin)) && !keep.some(o => hits(q, o)) && !(item.tall && winKeep.some(o => hits(q, o))));
      // the stretches of wall a room has, each a line with the room on one side
      const wallRuns = id => {
        const runs = new Map();
        const add = (side, line, a0, a1) => {
          const k = side + line.toFixed(3);
          if (!runs.has(k)) runs.set(k, { side, line, spans: [] });
          runs.get(k).spans.push([a0, a1]);
        };
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (MAP[r][c] !== id) continue;
          if (at(c, r - 1) !== id) add('N', ZS[r], XS[c], XS[c + 1]);
          if (at(c, r + 1) !== id) add('S', ZS[r + 1], XS[c], XS[c + 1]);
          if (at(c - 1, r) !== id) add('W', XS[c], ZS[r], ZS[r + 1]);
          if (at(c + 1, r) !== id) add('E', XS[c + 1], ZS[r], ZS[r + 1]);
        }
        const out = [];
        for (const run of runs.values()) {
          run.spans.sort((p, q) => p[0] - q[0]);
          let cur = null;
          for (const [a0, a1] of run.spans) {
            if (cur && a0 <= cur.a1 + 1e-6) cur.a1 = Math.max(cur.a1, a1);
            else { cur = { side: run.side, line: run.line, a0, a1 }; out.push(cur); }
          }
        }
        return out;
      };
      const ANG = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };
      const wallSpots = (id, item) => {
        const out = [];
        for (const run of wallRuns(id)) {
          for (let p = run.a0 + item.w / 2 + 0.12; p <= run.a1 - item.w / 2 - 0.12 + 1e-6; p += 0.3) {
            const base = run.side === 'N' ? [p, run.line + GAP] : run.side === 'S' ? [p, run.line - GAP]
              : run.side === 'W' ? [run.line + GAP, p] : [run.line - GAP, p];
            const rects = rectsOf(item, base, ANG[run.side]);
            if (inside(id, rects) && clear(rects, item)) out.push([base, ANG[run.side]]);
          }
        }
        return out;
      };
      const freeSpots = (id, item, turn) => {
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (MAP[r][c] === id) {
          x0 = Math.min(x0, XS[c]); x1 = Math.max(x1, XS[c + 1]); z0 = Math.min(z0, ZS[r]); z1 = Math.max(z1, ZS[r + 1]);
        }
        const ang = turn * Math.PI / 2, out = [];
        for (let x = x0 + 1; x <= x1 - 1; x += 0.5) for (let z = z0 + 1; z <= z1 - 1; z += 0.5) {
          const rects = rectsOf(item, [x, z], ang);
          const wide = rects.map(q => ({ minX: q.minX - 0.6, maxX: q.maxX + 0.6, minZ: q.minZ - 0.6, maxZ: q.maxZ + 0.6 }));
          if (inside(id, wide) && clear(rects, item, 0.5)) out.push([[x, z], ang]);
        }
        return out;
      };

      for (const f of cfg.fixed ?? []) {
        const [base, ang] = baseOf(f);
        placeItem(fb, ITEMS[f.item], base, ang, !!f.vase);
      }

      for (const [X, Z] of cfg.mannequins ?? []) {
        const x = mx(X), z = mz(Z);
        const pivot = new THREE.Group();
        pivot.position.set(x, Y, z);
        const body = buildMannequin(fm(0xd0c8bc));
        body.rotation.y = rand() * Math.PI * 2;
        pivot.add(body);
        group.add(pivot);
        const col = { minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25, level };
        colliders.push(col);
        furn.push(col);
        mannequins.push({ pivot, x, z, y: Y, level, col, fell: false, landed: false, t: 0, axis: new THREE.Vector3() });
      }

      // items that must exist
      for (const g of cfg.guarantee ?? []) {
        const spots = wallSpots(g.room, ITEMS[g.item]);
        if (!spots.length) { doorLog.missing = (doorLog.missing ?? []).concat(g.item); continue; }
        const [base, ang] = pick(spots);
        placeItem(fb, ITEMS[g.item], base, ang);
      }

      for (const [id, names] of Object.entries(cfg.furnishing ?? {})) {
        for (const name of names) {
          const item = ITEMS[name];
          const spots = item.center ? freeSpots(id, item, rand() < 0.5 ? 0 : 1) : wallSpots(id, item);
          if (!spots.length) continue;
          const [base, ang] = pick(spots);
          placeItem(fb, item, base, ang);
        }
      }

      // cracked boards in an empty stretch of floor: stepping on them breaks the floor
      for (let n = 0; n < (cfg.traps ?? 0); n++) {
        for (let tries = 0; tries < 80; tries++) {
          const id = pick(ids), cells = [];
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (MAP[r][c] === id) cells.push([c, r]);
          const [c, r] = pick(cells);
          const x = XS[c] + rand() * (XS[c + 1] - XS[c]), z = ZS[r] + rand() * (ZS[r + 1] - ZS[r]);
          const patch = { minX: x - 0.95, maxX: x + 0.95, minZ: z - 0.95, maxZ: z + 0.95 };
          const wide = { minX: x - 1.8, maxX: x + 1.8, minZ: z - 1.8, maxZ: z + 1.8 };
          if (!inside(id, [wide]) || furn.some(o => hits(patch, o, 0.4)) || keep.some(o => hits(patch, o, 0.3))) continue;
          furn.push(patch);
          makeTrap(level, x, z, Y);
          break;
        }
      }
      for (const [X, Z] of cfg.trapAt ?? []) {   // a patch of floor in a fixed place that gives way
        const x = mx(X), z = mz(Z);
        furn.push({ minX: x - 0.95, maxX: x + 0.95, minZ: z - 0.95, maxZ: z + 0.95 });
        makeTrap(level, x, z, Y);
      }
      fb.flush(group);
    }

    let trapTex = null;
    function makeTrap(level, x, z, Y) {
      if (!trapTex) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#54422f' : '#3e301f'; g.fillRect(0, i * 32, 256, 32); }
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
      const cover = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 1.8), new THREE.MeshLambertMaterial({ map: trapTex }));
      cover.position.set(x, Y + 0.02, z);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(x, Y + 0.012, z);
      hole.visible = false;
      group.add(cover, hole);
      traps.push({ level, x, z, Y, half: 0.8, cover, hole, state: 'armed', t: 0, creaked: false });
    }

    // base: where the item's back-centre stands (the middle for a free-standing item); ang: the way it
    // faces, a multiple of a quarter turn.
    function placeItem(fb, item, base, ang, withVase = false) {
      const cs = Math.round(Math.cos(ang)), sn = Math.round(Math.sin(ang));
      const roomId = roomAt(base[0], base[1]);
      furn.push(...rectsOf(item, base, ang));
      if (item === ITEMS.car) carSeat = { x: base[0] - 0.4, z: base[1] - 0.1 };
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
        const part = { pg, pivot, level, open: false, t: 0, role: cfg.roles?.[roomId], ...extra };
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
        // an invisible box to look at and use (a cutting board, say)
        target: (kind, w, h, d, x, y0, zc) => {
          const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
          proxy.position.set(x, y0 + h / 2, zc);
          ensureGroup().add(proxy);
          const t = { kind, level, apple: null, proxy };
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
      item.build(b, pal, mv);

      if (item.vaseSpot && withVase) {   // the spiral vase stands on the start bedroom's round table
        const [vx, vz] = xf(item.vaseSpot.x, item.vaseSpot.z);
        vaseStart = { x: vx, z: vz, y: Y + item.vaseSpot.y, level };   // made into a pick-up item once the loot is placed
      }

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

    for (const ex of exitList) buildExit(ex);
    buildRoomDoors();
    for (const pb of cfg.pushBoxes ?? []) {   // crates that slide when you walk into them
      const size = pb.size, x = mx(pb.at[0]), z = mz(pb.at[1]);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshLambertMaterial({ map: tex.furniture[0], color: 0x9a8466 }));
      mesh.position.set(x, Y + size / 2, z);
      group.add(mesh);
      const col = { minX: x - size / 2, maxX: x + size / 2, minZ: z - size / 2, maxZ: z + size / 2, level };
      colliders.push(col);
      furn.push(col);
      pushBoxes.push({ mesh, col, level, x, z, half: size / 2 });
    }
    furnish();
    batch.flush(group);
    // lights: one point light for every few metres of room
    for (const id of ids) {
      const lk = look[id], pts = [];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (MAP[r][c] === id) { x0 = Math.min(x0, XS[c]); x1 = Math.max(x1, XS[c + 1]); z0 = Math.min(z0, ZS[r]); z1 = Math.max(z1, ZS[r + 1]); }
      const nx = Math.max(1, Math.round((x1 - x0) / 6)), nz = Math.max(1, Math.round((z1 - z0) / 6));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = x0 + (i + 0.5) * (x1 - x0) / nx, z = z0 + (j + 0.5) * (z1 - z0) / nz;
        if (roomAt(x, z) === id) pts.push([x, z]);
      }
      if (!pts.length) pts.push([lk.sx / lk.n, lk.sz / lk.n]);
      for (const [x, z] of pts) rooms.push({ pos: new THREE.Vector3(x, Y + WALL_H - 0.4, z), base: 0.6 + rand() * 0.5, level });
    }
  }

  function buildStairs(st) {
    const batch = makeBatch();
    const steps = 15, run = (st.z1 - st.z0) / steps, rise = st.rise / steps, w = st.x1 - st.x0;
    const m = mat(tex.floor[2], 0x999999), mats = Array(6).fill(m);
    const y0 = levelY(st.from);
    // each step is a slab one rise thick, so no faces overlap
    for (let i = 0; i < steps; i++) {
      batch.box(w, rise, run, st.x0 + w / 2, y0 + rise * (i + 0.5), st.zb + st.dir * run * (i + 0.5), mats);
    }
    batch.flush(group);
  }

  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.3;
  const centre = new THREE.Vector2(0, 0);
  const spawnLevel = Math.max(0, LEVELS.findIndex(l => l.spawnAt));
  const spawnAt = LEVELS[spawnLevel].spawnAt;
  const size = { w: mx(OUT_X[1]), d: mz(OUT_Z[1]) };
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
    if (exit.carOnly && !exit.open) { say('The garage door is sealed shut. Maybe the car could break through it.'); return; }
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
      say('Locked. Hold a key to unlock it.');
    } else if (pending.some(l => l.type === 'code')) {
      say('Only the keypad is left. It wants a 4-digit code.');
    } else {
      say('The electric lock is humming. Find the power box and cut the wires.');
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
    if (held !== 'pliers') { say('Locked tight. Something strong could cut through this padlock.'); return; }
    part.locked = false;
    part.lockMesh.visible = false;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true }));
    spark.position.copy(part.lockMesh.position);
    part.lockMesh.parent.add(spark);
    sparks.push({ mesh: spark, t: 0 });
    api.onSound?.('cut');
    say('Snip. The lock drops away.');
  }

  // The cutting board is a table: put the apple on it, then cut it with the knife and shotgun
  // shells spill out onto the board.
  function useBoard(board, held) {
    const wp = board.proxy.getWorldPosition(new THREE.Vector3());
    if (held === 'apple') {
      if (board.apple) { say('There is already an apple on the board.'); return; }
      api.onConsume?.('apple');
      board.apple = dropItem('apple', wp.x + 0.05, wp.y, wp.z, 0.4, board.level, board);
      api.onSound?.('drop');
      say('The apple lies on the board. Cut it with a knife.');
    } else if (held === 'knife') {
      if (!board.apple) { say('Nothing on the board to cut.'); return; }
      removeItem(board.apple);
      api.onSound?.('chop');
      dropItem('shells', wp.x + 0.04, wp.y, wp.z, 0.5, board.level);
      say('The apple splits open. Shotgun shells were hidden inside.');
    } else {
      say(board.apple ? 'Cut the apple with a knife.' : 'A cutting board, stained dark. Put something on it.');
    }
  }

  // ---- the car: a battery under the hood, fuel in the tank, a key in the ignition ---------
  const car = { battery: false, fuel: false, started: false, seat: carSeat };
  function useCar(target, held) {
    if (car.started) return;
    const glow = (wp) => {                       // the headlights come on
      const m = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
      for (const s of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.03), m);
        lamp.position.set(wp.x + s * 0.55, wp.y - 0.23, wp.z + 0.59);
        group.add(lamp);
      }
    };
    if (target.kind === 'carhood') {
      if (car.battery) { say('The battery is already in.'); return; }
      if (held !== 'battery') { say('The engine bay is empty. It needs a car battery.'); return; }
      car.battery = true;
      api.onConsume?.('battery');
      glow(target.proxy.getWorldPosition(new THREE.Vector3()));
      api.onSound?.('unlock');
      say(car.fuel ? 'The battery clicks in. The headlights flicker on.' : 'The battery clicks in. The headlights flicker on. The tank is still empty.');
    } else if (target.kind === 'carfuel') {
      if (car.fuel) { say('The tank is full.'); return; }
      if (held !== 'fuel') { say('The fuel tank is empty. It needs fuel.'); return; }
      car.fuel = true;
      api.onConsume?.('fuel');
      api.onSound?.('pour');
      say(car.battery ? 'Glug glug. The tank is full.' : 'Glug glug. The tank is full. The engine is dead, though.');
    } else {
      if (!car.battery) { say('The dashboard is dead. The engine needs a battery.'); return; }
      if (!car.fuel) { say('The tank is empty. It needs fuel.'); return; }
      if (held !== 'key') { say('The ignition needs a key. Hold a key.'); return; }
      car.started = true;
      api.onConsume?.('key');
      const garage = exits.find(e => e.carOnly);
      api.onSound?.('engine');
      say('The engine roars to life!');
      if (garage) { openExit(garage); garage.escaped = true; }
      api.onDrive?.(garage);
    }
  }

  // The trash can in the start bedroom: throw the smiley paper in and a flashlight pops out.
  const trash = { done: false };
  function useTrash(target, held) {
    if (trash.done) { say('The trash can is empty now.'); return; }
    if (held !== 'paper') { say(held ? 'That does not belong in the trash.' : 'A dented metal trash can. It smells faintly of smoke.'); return; }
    trash.done = true;
    api.onConsume?.('paper');
    api.onSound?.('drop');
    say('You drop the paper in the trash can. Something rattles inside...');
    const wp = target.proxy.getWorldPosition(new THREE.Vector3());
    const a = target.proxy.parent.rotation.y, out = [Math.sin(a), Math.cos(a)];
    timers.push({ t: 1.2, fn: () => {
      const floorY = levelY(target.level);
      const to = new THREE.Vector3(wp.x + out[0] * 0.85, floorY + LIFT.flashlight, wp.z + out[1] * 0.85);
      const item = dropItem('flashlight', to.x, floorY, to.z, rand() * 6, target.level);
      const from = new THREE.Vector3(wp.x, wp.y + 0.3, wp.z);
      item.mesh.position.copy(from);
      pops.push({ mesh: item.mesh, from, to, t: 0, dur: 0.8 });
      api.onSound?.('pop');
      say('A flashlight pops out of the trash can!');
    } });
  }

  // Shoot at what the camera is looking at: a window pane breaks, and the noise carries.
  function breakWindow(w, point) {
    w.broken = true;
    w.mesh.visible = false;
    const base = w.mesh.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(w.mesh.quaternion);
    for (let i = 0; i < 26; i++) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.05), w.mat);
      shard.position.set(base.x + (Math.random() - 0.5) * 1.0 * (1 - Math.abs(n.x)), base.y + (Math.random() - 0.5) * 1.6, base.z + (Math.random() - 0.5) * 1.0 * (1 - Math.abs(n.z)));
      group.add(shard);
      const side = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 2.5);
      shards.push({ mesh: shard, vel: new THREE.Vector3(n.x * side + (Math.random() - 0.5), 1 + Math.random() * 1.5, n.z * side + (Math.random() - 0.5)), spin: Math.random() * 8, t: 0, floor: levelY(w.level) });
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
    if (held !== 'pliers') { say('You need something to cut this wire.'); return; }
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

  // A mannequin topples away from the player once they walk up to it.
  const FALL = 0.8, BOUNCE = 0.3;
  const api = {
    group, colliders, rooms, size, stairs, mannequins, traps, pushBoxes,
    levels: LEVELS.map(l => l.name),
    spawn: new THREE.Vector3(mx(spawnAt[0]), levelY(spawnLevel), mz(spawnAt[1])),
    spawnLevel,
    parts,
    onThud: null,
    onUse: null,
    onPickup: null,
    onHide: null,
    onMessage: null,   // (text) a hint for the player
    onSound: null,     // ('unlock' | 'cut' | 'creak')
    onConsume: null,   // (type) an item was used up
    onEscape: null,    // (exit) the player walked out
    onTrap: null,      // (trap) the player stepped on cracked boards and is falling
    onAlert: null,     // ({x, z, level, kind}) something loud happened here: the entity should come
    shoot(camera, player) {
      raycaster.setFromCamera(centre, camera);
      const far = raycaster.far;
      raycaster.far = 16;
      const hit = raycaster.intersectObjects(shootables.filter(w => !w.broken && w.level === player.level).map(w => w.mesh), false)[0];
      raycaster.far = far;
      if (hit) breakWindow(hit.object.userData.shootable, hit.point);
      return !!hit;
    },
    onDrive: null,     // () the car started: drive out through the garage door
    onKeypad: null,    // (target) the player wants to type a code
    canTake: null,     // () is the player's hand free?
    onRead: null,      // the sticky note was read
    onLoad: null,      // shells were loaded into the shotgun
    dropItem,
    // the creature pushes a room door open from where it stands
    openDoorFor(door, from, silent) {
      if (door.open || (door.lock && !door.lock.done)) return;
      door.sign = door.axis === 'x' ? (from.z > door.f ? 1 : -1) : (from.x < door.f ? 1 : -1);
      door.open = true;
      const i = colliders.indexOf(door.col);
      if (i >= 0) colliders.splice(i, 1);
      if (!silent) api.onSound?.('doorOpen');
    },
    tryCode,
    code,
    noteIcon: noteCanvas.toDataURL('image/png'),
    items,
    hideSpots,
    doorLog,
    roomDoors,
    exits,
    wires,
    car,
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
        } else if (u.part.level === player.level) found = u.part;
      }
      return found;
    },
    // `held` is the type of the item in the player's hand ('key', 'pliers') or null
    use(target, held) {
      if (target.kind === 'hide') { api.onHide?.(target.spot); return; }
      if (target.kind === 'exit') { useExit(target.exit, held); return; }
      if (target.kind === 'roomdoor') {
        const lk = target.door.lock;
        if (lk && !lk.done) {
          if (held === 'key') { lk.done = true; lk.mesh.visible = false; api.onConsume?.('key'); api.onSound?.('unlock'); say('Unlocked.'); } else say('Locked. It needs a key.');
          return;
        }
        toggleDoor(target.door); return;
      }
      if (target.kind === 'keypad') { api.onKeypad?.(target); return; }
      if (target.kind === 'board') { useBoard(target, held); return; }
      if (target.kind === 'trash') { useTrash(target, held); return; }
      if (target.kind === 'carhood' || target.kind === 'carfuel' || target.kind === 'cardoor') { useCar(target, held); return; }
      if (target.locked) { cutLock(target, held); return; }
      if (target.kind === 'wire') { cutWire(target.wire, held); return; }
      if (target.kind === 'item') {
        if (target.type === 'note') { api.onRead?.(); return; }            // read where it lies
        if (target.board && held === 'knife') { useBoard(target.board, held); return; }
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
      for (let i = wobbles.length - 1; i >= 0; i--) {   // a dropped vase falls, lands with a clink and rocks about its foot
        const w = wobbles[i];
        if (!w.mesh.parent) { wobbles.splice(i, 1); continue; }   // picked up again
        if (!w.landed) {
          w.vy -= 11 * dt; w.mesh.position.y += w.vy * dt;
          if (w.mesh.position.y <= w.floorY) { w.mesh.position.y = w.floorY; w.landed = true; w.t = 0; api.onSound?.('vase'); api.onAlert?.({ x: w.mesh.position.x, z: w.mesh.position.z, level: w.level, kind: 'vase' }); }
        } else {
          w.t += dt;
          const k = Math.exp(-w.t * 3.0);
          w.mesh.rotation.x = 0.24 * k * Math.sin(w.t * 27);
          w.mesh.rotation.z = 0.2 * k * Math.cos(w.t * 23 + 1);
          w.mesh.position.x += Math.sin(w.t * 60) * 0.0015 * k;   // a little skitter
          if (w.t > 1.8) { w.mesh.rotation.x = w.mesh.rotation.z = 0; wobbles.splice(i, 1); }
        }
      }
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); } }
      for (let i = pops.length - 1; i >= 0; i--) {   // the flashlight flies out of the can in an arc
        const p = pops[i];
        p.t += dt;
        const k = Math.min(1, p.t / p.dur);
        p.mesh.position.lerpVectors(p.from, p.to, k);
        p.mesh.position.y += 0.9 * 4 * k * (1 - k);
        p.mesh.rotation.z = (1 - k) * 12;
        if (k >= 1) { p.mesh.rotation.z = 0; pops.splice(i, 1); }
      }
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
      for (const bx of pushBoxes) {
        if (player.level !== bx.level || !player.push) continue;
        const dx = bx.x - player.pos.x, dz = bx.z - player.pos.z, r = bx.half + 0.38;
        if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
        const alongX = Math.abs(dx) >= Math.abs(dz), v = alongX ? player.push.x : player.push.z, dir = Math.sign(alongX ? dx : dz);
        if (v * dir <= 0) continue;
        const step = Math.min(Math.abs(v), 0.1) * dir, nx = bx.x + (alongX ? step : 0), nz = bx.z + (alongX ? 0 : step);
        const rect = { minX: nx - bx.half, maxX: nx + bx.half, minZ: nz - bx.half, maxZ: nz + bx.half };
        if (colliders.some(c => c !== bx.col && c.level === bx.level && rect.minX < c.maxX && rect.maxX > c.minX && rect.minZ < c.maxZ && rect.maxZ > c.minZ)) continue;
        bx.x = nx; bx.z = nz; bx.mesh.position.x = nx; bx.mesh.position.z = nz;
        Object.assign(bx.col, rect);
        if (!bx.scraped || bx.scraped < performance.now() - 450) { bx.scraped = performance.now(); api.onSound?.('doorOpen'); }
      }
      for (const tr of traps) {
        if (tr.state === 'armed') {
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
