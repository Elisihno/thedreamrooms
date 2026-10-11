// Data-driven house layout. Units are metres. Levels: 0 = basement, 1 = ground floor, 2 = upstairs.
// Edit this file to reshape the house; the world, collision and Granny's path graph are all built from it.

export const T = 0.2; // wall thickness
export const LH = 3; // level height
export const ly = (l) => l * LH;
const STYLE = { 0: 'concrete', 1: 'floral', 2: 'peel' };

export const walls = [];
export const doors = [];
export const rooms = [];
export const furniture = [];
export const items = [];

// ---------- walls & doors ----------
function piece(level, axis, fixed, p0, p1, y0, h, tex) {
  const len = p1 - p0;
  if (len < 0.01) return;
  const c = (p0 + p1) / 2;
  walls.push(
    axis === 'x'
      ? { kind: 'wall', level, x: c, z: fixed, w: len, d: T, y0, h, tex }
      : { kind: 'wall', level, x: fixed, z: c, w: T, d: len, y0, h, tex },
  );
}

// A wall running along `axis` at coordinate `fixed`, from a to b, with doorway gaps.
function run(level, axis, fixed, a, b, gaps = []) {
  const tex = STYLE[level];
  const base = ly(level);
  let cur = a - T / 2;
  for (const g of gaps.slice().sort((p, q) => p.c - q.c)) {
    const w = g.w ?? 1.1;
    piece(level, axis, fixed, cur, g.c - w / 2, base, LH, tex);
    piece(level, axis, fixed, g.c - w / 2, g.c + w / 2, base + 2.1, LH - 2.1, tex); // lintel
    doors.push({ id: g.id, name: g.name ?? 'Door', level, axis, fixed, c: g.c, w, key: g.key ?? null, swing: g.swing ?? 1 });
    cur = g.c + w / 2;
  }
  piece(level, axis, fixed, cur, b + T / 2, base, LH, tex);
}

// Ground floor (level 1)
run(1, 'x', 0, 0, 20);
run(1, 'x', 14, 0, 20, [{ c: 10, w: 1.6, id: 'front', key: 'gold', name: 'Front door', swing: -1 }]);
run(1, 'z', 0, 0, 14);
run(1, 'z', 20, 0, 14);
run(1, 'z', 7, 0, 14, [
  { c: 3.5, id: 'g_study', key: 'red', name: 'Study door' },
  { c: 12.5, id: 'g_living' },
]);
run(1, 'z', 13, 0, 14, [
  { c: 3.5, id: 'g_kitchen' },
  { c: 12.5, id: 'g_dining' },
]);
run(1, 'x', 7, 0, 7);
run(1, 'x', 7, 13, 20, [{ c: 16.5, id: 'g_kd' }]);

// Upstairs (level 2)
run(2, 'x', 0, 0, 20);
run(2, 'x', 14, 0, 20);
run(2, 'z', 0, 0, 14);
run(2, 'z', 20, 0, 14);
run(2, 'z', 7, 0, 14, [
  { c: 3.5, id: 'u_bed' },
  { c: 12.5, id: 'u_bath' },
]);
run(2, 'z', 13, 0, 14, [
  { c: 3.5, id: 'u_nursery' },
  { c: 12.5, id: 'u_storage' },
]);
run(2, 'x', 7, 0, 7);
run(2, 'x', 7, 13, 20);

// Basement (level 0)
run(0, 'x', 0, 2, 18);
run(0, 'x', 12, 2, 18);
run(0, 'z', 2, 0, 12);
run(0, 'z', 18, 0, 12);
run(0, 'x', 5, 2, 7.4, [{ c: 4.5, id: 'b_store' }]);
run(0, 'x', 5, 9.4, 18, [{ c: 14, id: 'b_boiler' }]);

// ---------- stairs ----------
// `rise` is the direction the stairs climb. `low` is the level the bottom sits on.
export const stairs = [
  { id: 'down', x: 7.4, z: 5, w: 2, len: 6, rise: 'S', low: 0 }, // ground hall -> basement
  { id: 'up', x: 10.6, z: 5, w: 2, len: 6, rise: 'N', low: 1 }, // ground hall -> upstairs
];

for (const s of stairs) {
  const x1 = s.x + s.w;
  const z1 = s.z + s.len;
  const y0 = ly(s.low);
  // side walls / railings
  walls.push({ kind: 'wall', level: s.low, x: s.x - 0.1, z: s.z + s.len / 2, w: 0.2, d: s.len, y0, h: 4, tex: 'darkwood' });
  walls.push({ kind: 'wall', level: s.low, x: x1 + 0.1, z: s.z + s.len / 2, w: 0.2, d: s.len, y0, h: 4, tex: 'darkwood' });
  const lowZ = s.rise === 'S' ? s.z - 0.1 : z1 + 0.1; // cap at the low end, on the upper level (railing)
  const highZ = s.rise === 'S' ? z1 + 0.1 : s.z - 0.1; // cap at the high end, on the lower level
  walls.push({ kind: 'wall', level: s.low + 1, x: s.x + s.w / 2, z: lowZ, w: s.w, d: 0.2, y0: y0 + LH, h: 1, tex: 'darkwood' });
  walls.push({ kind: 'wall', level: s.low, x: s.x + s.w / 2, z: highZ, w: s.w, d: 0.2, y0, h: LH, tex: 'darkwood' });
}

export function stairY(s, x, z) {
  const t = s.rise === 'S' ? (z - s.z) / s.len : (s.z + s.len - z) / s.len;
  return ly(s.low) + Math.min(1, Math.max(0, t)) * LH;
}

export function stairAt(x, z) {
  for (const s of stairs) {
    if (x >= s.x && x <= s.x + s.w && z >= s.z && z <= s.z + s.len) return s;
  }
  return null;
}

// Floor height under (x,z) for something currently at height y.
export function groundY(x, z, y) {
  const s = stairAt(x, z);
  if (s) return stairY(s, x, z);
  return Math.min(2, Math.max(0, Math.round(y / LH))) * LH;
}

// The cellar door sits at the top of the basement stairs.
doors.push({ id: 'cellar', name: 'Cellar door', level: 1, axis: 'x', fixed: 11.1, c: 8.4, w: 2.0, key: 'brass', swing: -1 });

// ---------- rooms (floors / ceilings) ----------
const R = (level, name, x0, z0, x1, z1, floor, ceil) => rooms.push({ level, name, x0, z0, x1, z1, floor, ceil });
R(0, 'Cellar', 2, 0, 18, 5, 'gray', 'concrete');
R(0, 'Storeroom', 2, 5, 7.4, 12, 'gray', 'concrete');
R(0, 'Cellar stairs', 7.4, 5, 9.4, 12, 'gray', 'concrete');
R(0, 'Boiler room', 9.4, 5, 18, 12, 'gray', 'concrete');
R(1, 'Hall', 7, 0, 13, 14, 'planks', 'darkwood');
R(1, 'Study', 0, 0, 7, 7, 'planks', 'darkwood');
R(1, 'Living room', 0, 7, 7, 14, 'planks', 'darkwood');
R(1, 'Kitchen', 13, 0, 20, 7, 'planks', 'darkwood');
R(1, 'Dining room', 13, 7, 20, 14, 'planks', 'darkwood');
R(2, 'Gallery', 7, 0, 13, 14, 'planks', 'darkwood');
R(2, 'Bedroom', 0, 0, 7, 7, 'planks', 'darkwood');
R(2, 'Bathroom', 0, 7, 7, 14, 'gray', 'darkwood');
R(2, 'Nursery', 13, 0, 20, 7, 'planks', 'darkwood');
R(2, 'Storage', 13, 7, 20, 14, 'planks', 'darkwood');

// ---------- furniture ----------
// hide: exit is the unit direction the player steps out toward.
const F = (level, x, z, w, d, h, color, extra = {}) => furniture.push({ level, x, z, w, d, h, color, elev: 0, ...extra });
// upstairs
F(2, 1.4, 1.5, 1.8, 2.4, 0.6, 0x6b5b4b); // bed
F(2, 4.5, 6.55, 1.4, 0.7, 2.0, 0x4a3426, { hide: { exit: [0, -1] }, label: 'wardrobe' });
F(2, 6.6, 1.0, 0.7, 1.0, 0.8, 0x4a3426); // nightstand
F(2, 18.5, 1.2, 1.0, 1.8, 0.9, 0x8a7a68); // crib
F(2, 16.5, 6.55, 1.4, 0.7, 2.0, 0x4a3426, { hide: { exit: [0, -1] }, label: 'wardrobe' });
F(2, 14.0, 4.5, 1.2, 1.2, 0.5, 0x5a4a60); // toy chest
F(2, 1.1, 12.7, 2.0, 1.1, 0.7, 0xb9b5aa); // bathtub
F(2, 5.5, 7.6, 2.0, 0.6, 0.9, 0x6a6258); // sink counter
F(2, 19.4, 10.5, 0.8, 5.0, 2.0, 0x3b2c20); // shelves
F(2, 15.0, 13.0, 1.2, 1.0, 1.0, 0x6b5238); // crates
F(2, 8.0, 12.4, 0.5, 0.5, 1.0, 0x3b2c20); // gallery side table
// ground floor
F(1, 3.5, 13.2, 3.0, 1.0, 0.9, 0x6b3b3b); // sofa
F(1, 3.5, 10.4, 1.6, 1.0, 0.8, 0x4a3426); // coffee table
F(1, 0.55, 9.0, 0.7, 1.5, 2.0, 0x4a3426, { hide: { exit: [1, 0] }, label: 'cabinet' });
F(1, 3.5, 1.2, 2.4, 1.0, 0.9, 0x4a3426); // desk
F(1, 0.4, 4.2, 0.5, 3.0, 2.2, 0x3b2c20); // bookshelf
F(1, 16.5, 10.5, 3.0, 1.4, 0.85, 0x4a3426); // dining table
F(1, 19.5, 11.5, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [-1, 0] }, label: 'cabinet' });
F(1, 16.5, 0.5, 5.0, 0.9, 0.9, 0x7a7266); // kitchen counter
F(1, 19.4, 3.0, 1.0, 1.0, 2.0, 0xaaa59a); // fridge
F(1, 7.6, 0.6, 0.7, 0.5, 2.0, 0x3b2c20); // grandfather clock
// basement
F(0, 3.0, 1.2, 1.4, 1.4, 1.0, 0x6b5238); // crates
F(0, 16.5, 1.3, 1.0, 1.0, 1.0, 0x6b5238);
F(0, 2.6, 9.0, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [1, 0] }, label: 'cabinet' });
F(0, 14.0, 9.0, 1.4, 1.2, 0.9, 0x6b5238); // crate (red key sits on top)
F(0, 16.5, 6.4, 2.0, 1.2, 2.0, 0x55504a); // boiler

// ---------- items ----------
// y is the offset above the level floor.
export const KEYS = {
  brass: { label: 'Brass Key', color: 0xd9a441 },
  red: { label: 'Red Key', color: 0xc23b3b },
  gold: { label: 'Gold Key', color: 0xffd84a },
};
const K = (id, level, x, z, y) => items.push({ kind: 'key', id, level, x, z, y });
const V = (level, x, z, y) => items.push({ kind: 'vase', level, x, z, y });
K('brass', 2, 5.5, 7.6, 0.95); // bathroom counter
K('red', 0, 14.0, 9.0, 0.95); // boiler-room crate
K('gold', 1, 3.5, 1.2, 0.95); // study desk
V(1, 3.5, 10.4, 0.85);
V(1, 16.5, 10.5, 0.9);
V(1, 16.5, 0.5, 0.95);
V(2, 8.0, 12.4, 1.05);
V(2, 14.0, 4.5, 0.55);

// ---------- Granny's path graph ----------
export const nodes = [];
const N = (id, level, x, z) => nodes.push({ id, level, x, z, y: ly(level) });
// basement
N('b_hw', 0, 4, 2.5); N('b_sb', 0, 8.4, 3.8); N('b_he', 0, 14, 2.5);
N('b_dw', 0, 4.5, 5); N('b_store', 0, 4.5, 8.5);
N('b_de', 0, 14, 5); N('b_boiler', 0, 13, 8.5);
// ground
N('g_n', 1, 10, 2.5); N('g_h', 1, 10, 8); N('g_s', 1, 10, 12.5);
N('g_sdt', 1, 8.4, 12.2); N('g_sub', 1, 11.6, 12.2);
N('g_study_d', 1, 7, 3.5); N('g_study', 1, 3.5, 3.5);
N('g_living_d', 1, 7, 12.5); N('g_living', 1, 3.5, 11.2);
N('g_kitchen_d', 1, 13, 3.5); N('g_kitchen', 1, 16.5, 3.5);
N('g_dining_d', 1, 13, 12.5); N('g_dining', 1, 16.5, 12.4);
N('g_kd', 1, 16.5, 7);
// upstairs
N('u_n', 2, 10, 2.5); N('u_m', 2, 10, 8); N('u_s', 2, 10, 12.5); N('u_sut', 2, 11.6, 3.0);
N('u_bed_d', 2, 7, 3.5); N('u_bed', 2, 3.5, 4.0);
N('u_bath_d', 2, 7, 12.5); N('u_bath', 2, 3.5, 10.5);
N('u_nur_d', 2, 13, 3.5); N('u_nur', 2, 16.5, 3.5);
N('u_sto_d', 2, 13, 12.5); N('u_sto', 2, 16.5, 11.5);
export const stairEdges = [['b_sb', 'g_sdt'], ['g_sub', 'u_sut']];

// player spawn: upstairs bedroom, facing east
export const SPAWN = { x: 3.4, z: 3.8, level: 2, yaw: -Math.PI / 2 };
export const GRANNY_SPAWN = 'g_dining';
