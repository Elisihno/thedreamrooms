// Data-driven house layout. Units are metres. Levels: 0 = basement, 1 = ground floor, 2 = upper floor, 3 = attic.
// Room names follow the Granny wiki; the geometry is our own.
// Edit this file to reshape the house; the world, collision and Granny's path graph are all built from it.

export const T = 0.2; // wall thickness
export const LH = 3; // level height
export const ly = (l) => l * LH;
// Wall tile per level (all tiles come straight from public/img/atlas.png; see src/textures.js).
const STYLE = { 0: 'gray', 1: 'plaster', 2: 'grime', 3: 'grime' };

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

// Walls stop 1cm short of the ceiling, so their tops never share a plane with the floor above (that flickers).
const WH = LH - 0.01;

// A wall running along `axis` at coordinate `fixed`, from a to b, with doorway gaps.
// Runs butt against the walls they meet (they stop at the other wall's face) so no faces overlap and flicker.
// `outer` runs (north and south walls) instead stretch past their ends to close the corners.
function run(level, axis, fixed, a, b, gaps = [], outer = false) {
  const tex = STYLE[level];
  const base = ly(level);
  const e = outer ? -T / 2 : T / 2;
  let cur = a + e;
  const end = b - e;
  for (const g of gaps.slice().sort((p, q) => p.c - q.c)) {
    const w = g.w ?? 1.1;
    piece(level, axis, fixed, cur, g.c - w / 2, base, WH, tex);
    piece(level, axis, fixed, g.c - w / 2, g.c + w / 2, base + 2.1, WH - 2.1, tex); // lintel
    doors.push({ id: g.id, name: g.name ?? 'Door', level, axis, fixed, c: g.c, w, key: g.key ?? null, swing: g.swing ?? 1 });
    cur = g.c + w / 2;
  }
  piece(level, axis, fixed, cur, end, base, WH, tex);
}

// Ground floor (level 1)
run(1, 'x', 0, 0, 20, [], true);
run(1, 'x', 14, 0, 20, [{ c: 10, w: 1.6, id: 'front', key: 'gold', name: 'Front door', swing: -1 }], true);
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

// Upper floor (level 2)
run(2, 'x', 0, 0, 20, [], true);
run(2, 'x', 14, 0, 20, [], true);
run(2, 'z', 0, 0, 14);
run(2, 'z', 20, 0, 14);
run(2, 'z', 7, 0, 14, [
  { c: 2.5, id: 'u_bed', name: 'Bedroom door' },
  { c: 12.5, id: 'u_book', name: 'Bookshelf room door' },
]);
run(2, 'z', 13, 0, 14, [
  { c: 2.5, id: 'u_b1', name: 'Bedroom 1 door' },
  { c: 12.5, id: 'u_b2', name: 'Bedroom 2 door' },
]);
run(2, 'x', 6, 0, 7, [{ c: 3.5, id: 'u_bath', name: 'Bathroom door' }]); // straight off the starting bedroom
run(2, 'x', 10, 0, 7, [{ c: 3.5, id: 'u_bath2', name: 'Bookshelf room door' }]);
run(2, 'x', 5, 13, 20, [{ c: 16.5, id: 'u_cl1', name: 'Closet door' }]);
run(2, 'x', 9, 13, 20, [{ c: 16.5, id: 'u_cl2', name: 'Closet door' }]);

// Attic (level 3)
run(3, 'x', 0, 0, 20, [], true);
run(3, 'x', 14, 0, 20, [], true);
run(3, 'z', 0, 0, 14);
run(3, 'z', 20, 0, 14);
run(3, 'z', 7, 0, 14, [
  { c: 2.5, id: 'a_nur', name: 'Nursery door' },
  { c: 12.5, id: 'a_man', name: 'Mannequin room door' },
]);
run(3, 'z', 13, 0, 14, [
  { c: 2.5, id: 'a_jail', name: 'Jail door' },
  { c: 12.5, id: 'a_spec', name: 'Special room door' },
]);
run(3, 'x', 7, 0, 7, [{ c: 3.5, id: 'a_nm' }]);
run(3, 'x', 7, 13, 20, [{ c: 16.5, id: 'a_js', name: 'Jail cell door' }]);

// Basement (level 0)
run(0, 'x', 0, 2, 18, [], true);
run(0, 'x', 12, 2, 18, [], true);
run(0, 'z', 2, 0, 12);
run(0, 'z', 18, 0, 12);
run(0, 'x', 5, 2, 7.4, [{ c: 4.5, id: 'b_dirt', name: 'Dirt room door' }]);
run(0, 'x', 5, 9.4, 18, [
  { c: 11.2, id: 'b_sauna', name: 'Sauna door' },
  { c: 15.5, id: 'b_garage', name: 'Garage door' },
]);
run(0, 'z', 13, 5, 12);

// ---------- stairs ----------
// `rise` is the direction the stairs climb. `low` is the level the bottom sits on.
export const stairs = [
  { id: 'down', x: 7.4, z: 5, w: 2, len: 6, rise: 'S', low: 0 }, // ground hall -> basement
  { id: 'up', x: 10.6, z: 5, w: 2, len: 6, rise: 'N', low: 1 }, // ground hall -> upper floor
  { id: 'up2', x: 7.4, z: 5, w: 2, len: 6, rise: 'N', low: 2 }, // upper gallery -> attic
];

for (const s of stairs) {
  const x1 = s.x + s.w;
  const z1 = s.z + s.len;
  const y0 = ly(s.low);
  // Side walls / railings, in two stacked pieces so each part wears the wall tile of the floor it is on.
  for (const sx of [s.x - 0.1, x1 + 0.1]) {
    walls.push({ kind: 'wall', level: s.low, x: sx, z: s.z + s.len / 2, w: 0.2, d: s.len, y0, h: LH, tex: STYLE[s.low] });
    walls.push({ kind: 'wall', level: s.low + 1, x: sx, z: s.z + s.len / 2, w: 0.2, d: s.len, y0: y0 + LH, h: 1, tex: STYLE[s.low + 1] });
  }
  const lowZ = s.rise === 'S' ? s.z - 0.1 : z1 + 0.1; // cap at the low end, on the upper level (railing)
  const highZ = s.rise === 'S' ? z1 + 0.1 : s.z - 0.1; // cap at the high end, on the lower level
  walls.push({ kind: 'wall', level: s.low + 1, x: s.x + s.w / 2, z: lowZ, w: s.w, d: 0.2, y0: y0 + LH, h: 1, tex: STYLE[s.low + 1] });
  walls.push({ kind: 'wall', level: s.low, x: s.x + s.w / 2, z: highZ, w: s.w, d: 0.2, y0, h: LH - 0.01, tex: STYLE[s.low] });
}

export function stairY(s, x, z) {
  const t = s.rise === 'S' ? (z - s.z) / s.len : (s.z + s.len - z) / s.len;
  return ly(s.low) + Math.min(1, Math.max(0, t)) * LH;
}

// Stairs can overlap in plan on different floors, so the height decides which one applies.
export function stairAt(x, z, y) {
  for (const s of stairs) {
    if (x < s.x || x > s.x + s.w || z < s.z || z > s.z + s.len) continue;
    if (y >= ly(s.low) - 0.35 && y <= ly(s.low) + LH + 0.35) return s;
  }
  return null;
}

// Floor height under (x,z) for something currently at height y.
export function groundY(x, z, y) {
  const s = stairAt(x, z, y);
  if (s) return stairY(s, x, z);
  return Math.min(3, Math.max(0, Math.round(y / LH))) * LH;
}

// The cellar door sits at the top of the basement stairs.
// The cellar door: an ordinary single door set into a short wall across the top of the stairs.
run(1, 'x', 11.1, 7.4, 9.4, [{ c: 8.4, w: 1.1, id: 'cellar', key: 'brass', name: 'Cellar door', swing: -1 }], true);

// ---------- rooms (floors / ceilings) ----------
const R = (level, name, x0, z0, x1, z1, floor, ceil) => rooms.push({ level, name, x0, z0, x1, z1, floor, ceil });
R(0, 'Basement', 2, 0, 18, 5, 'gray', 'concrete');
R(0, 'Dirt Room', 2, 5, 7.4, 12, 'gray', 'concrete');
R(0, 'Cellar stairs', 7.4, 5, 9.4, 12, 'gray', 'concrete');
R(0, 'Sauna', 9.4, 5, 13, 12, 'planks', 'gray');
R(0, 'Garage', 13, 5, 18, 12, 'gray', 'concrete');
R(1, 'Foyer', 7, 0, 13, 14, 'planks', 'gray');
R(1, 'Study', 0, 0, 7, 7, 'planks', 'gray');
R(1, 'Living Room', 0, 7, 7, 14, 'planks', 'gray');
R(1, 'Kitchen', 13, 0, 20, 7, 'planks', 'gray');
R(1, 'Dining Room', 13, 7, 20, 14, 'planks', 'gray');
R(2, 'Upper Hall', 7, 0, 13, 14, 'planks', 'gray');
R(2, 'Starting Bedroom', 0, 0, 7, 6, 'planks', 'gray');
R(2, 'Bathroom', 0, 6, 7, 10, 'gray', 'gray');
R(2, 'Bookshelf Room', 0, 10, 7, 14, 'planks', 'gray');
R(2, 'Bedroom 1', 13, 0, 20, 5, 'planks', 'gray');
R(2, 'Walk-In Closet', 13, 5, 20, 9, 'planks', 'gray');
R(2, 'Bedroom 2', 13, 9, 20, 14, 'planks', 'gray');
R(3, 'Attic Landing', 7, 0, 13, 14, 'planks', 'gray');
R(3, 'Nursery', 0, 0, 7, 7, 'planks', 'gray');
R(3, 'Mannequin Room', 0, 7, 7, 14, 'planks', 'gray');
R(3, 'Jail', 13, 0, 20, 7, 'gray', 'gray');
R(3, 'Special Room', 13, 7, 20, 14, 'planks', 'gray');

// ---------- furniture ----------
// hide: exit is the unit direction the player steps out toward (tables work out their own).
// table: a tabletop on legs you can hide under (press E). sink: a basin with a tap. tex picks an atlas tile.
const F = (level, x, z, w, d, h, color, extra = {}) => furniture.push({ level, x, z, w, d, h, color, elev: 0, tex: 'planks', ...extra });
const TABLE = { table: true, hide: { under: true }, label: 'table' };
// upper floor: starting bedroom
F(2, 1.3, 1.4, 1.8, 2.4, 0.6, 0x6b5b4b); // bed
F(2, 5.6, 5.55, 1.4, 0.7, 2.0, 0x4a3426, { hide: { exit: [0, -1] }, label: 'wardrobe' });
F(2, 6.6, 1.0, 0.7, 1.0, 0.8, 0x4a3426); // nightstand
F(2, 1.8, 4.6, 1.4, 0.8, 0.78, 0x4a3426, TABLE); // desk
// bathroom (next to the starting bedroom): the Padlock Key is in the sink
F(2, 1.2, 9.25, 2.0, 1.1, 0.7, 0xb9b5aa, { tex: 'concrete' }); // bathtub
F(2, 5.8, 6.45, 0.55, 0.45, 0.9, 0xb9b5aa, { tex: 'concrete', sink: true }); // sink
F(2, 6.1, 9.4, 0.6, 0.8, 0.45, 0xb9b5aa, { tex: 'concrete' }); // toilet
// bookshelf room
F(2, 0.4, 12.0, 0.5, 3.0, 2.2, 0x3b2c20); // bookshelves
F(2, 2.9, 12.9, 1.4, 0.8, 0.78, 0x4a3426, TABLE); // reading table
// bedroom 1, closet, bedroom 2
F(2, 18.0, 1.4, 2.4, 1.8, 0.6, 0x5a4a60); // bed
F(2, 15.0, 1.2, 1.4, 0.9, 0.78, 0x4a3426, TABLE); // table
F(2, 14.3, 4.55, 1.4, 0.7, 2.0, 0x4a3426, { hide: { exit: [0, -1] }, label: 'wardrobe' });
F(2, 19.4, 7.0, 0.8, 3.0, 2.0, 0x3b2c20); // closet racks
F(2, 17.6, 13.3, 1.8, 1.0, 0.7, 0x6b5238); // dresser
F(2, 14.3, 9.55, 1.4, 0.7, 2.0, 0x4a3426, { hide: { exit: [0, 1] }, label: 'wardrobe' });
F(2, 8.2, 13.5, 0.5, 0.5, 1.0, 0x3b2c20); // hall side table
// attic
F(3, 18.5, 1.2, 1.0, 1.8, 0.9, 0x8a7a68); // crib
F(3, 1.0, 1.2, 1.0, 1.8, 0.9, 0x8a7a68); // crib
F(3, 4.5, 1.4, 1.4, 0.8, 0.78, 0x4a3426, TABLE); // nursery table
F(3, 1.3, 5.7, 1.2, 1.2, 0.5, 0x5a4a60); // toy chest
F(3, 6.5, 4.5, 0.6, 1.4, 2.0, 0x4a3426, { hide: { exit: [-1, 0] }, label: 'cupboard' });
F(3, 1.0, 9.0, 0.5, 0.5, 1.8, 0x8f8a80); // mannequin
F(3, 5.2, 9.0, 0.5, 0.5, 1.8, 0x8f8a80); // mannequin
F(3, 2.2, 12.5, 0.5, 0.5, 1.8, 0x8f8a80); // mannequin
F(3, 15.5, 3.5, 2.0, 0.8, 0.5, 0x555555); // cell bench
F(3, 19.4, 10.5, 0.8, 4.0, 2.0, 0x3b2c20); // shelves
F(3, 15.5, 10.5, 1.6, 1.6, 1.0, 0x6b5238); // chest
F(3, 8.2, 13.5, 0.5, 0.5, 1.0, 0x3b2c20); // landing table
// ground floor
F(1, 3.0, 13.38, 3.0, 1.0, 0.9, 0x6b3b3b); // sofa
F(1, 3.5, 10.4, 1.6, 1.0, 0.8, 0x4a3426, TABLE); // coffee table
F(1, 0.55, 9.0, 0.7, 1.5, 2.0, 0x4a3426, { hide: { exit: [1, 0] }, label: 'cabinet' });
F(1, 3.5, 1.2, 2.4, 1.0, 0.9, 0x4a3426, TABLE); // study desk
F(1, 0.4, 4.2, 0.5, 3.0, 2.2, 0x3b2c20); // bookshelf
F(1, 16.5, 10.5, 3.0, 1.4, 0.85, 0x4a3426, TABLE); // dining table
F(1, 19.5, 11.5, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [-1, 0] }, label: 'cabinet' });
F(1, 14.7, 4.9, 1.8, 1.0, 0.78, 0x4a3426, TABLE); // kitchen table
F(1, 16.5, 0.5, 5.0, 0.9, 0.9, 0x7a7266, { tex: 'concrete' }); // kitchen counter
F(1, 19.4, 3.0, 1.0, 1.0, 2.0, 0xaaa59a, { tex: 'concrete' }); // fridge
F(1, 7.6, 0.6, 0.7, 0.5, 2.0, 0x3b2c20); // grandfather clock
// basement
F(0, 3.0, 1.2, 1.4, 1.4, 1.0, 0x6b5238); // crates
F(0, 16.5, 1.3, 1.0, 1.0, 1.0, 0x6b5238);
F(0, 2.6, 9.0, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [1, 0] }, label: 'cabinet' }); // dirt room
F(0, 11.2, 10.5, 1.4, 1.0, 0.9, 0x6b5238); // sauna bench (Master Key sits on top)
F(0, 16.0, 10.5, 3.0, 1.6, 0.9, 0x55504a, { tex: 'concrete' }); // garage workbench
F(0, 17.4, 6.4, 1.0, 1.2, 1.0, 0x6b5238); // garage crates

// ---------- items ----------
// y is the surface height the item rests on, plus 5cm.
export const KEYS = {
  brass: { label: 'Padlock Key', color: 0xc9a24d },
  red: { label: 'Master Key', color: 0xb3262b },
  gold: { label: 'Front Door Key', color: 0xf2c63c },
};
const K = (id, level, x, z, y) => items.push({ kind: 'key', id, level, x, z, y });
const V = (level, x, z, y) => items.push({ kind: 'vase', level, x, z, y });
K('brass', 2, 5.8, 6.45, 0.93); // in the bathroom sink, right next to the starting bedroom
K('red', 0, 11.2, 10.5, 0.95); // sauna bench
K('gold', 1, 3.5, 1.2, 0.95); // study desk
V(1, 3.5, 10.4, 0.85);
V(1, 16.5, 10.5, 0.9);
V(1, 16.5, 0.5, 0.95);
V(2, 2.9, 12.9, 0.85);
V(2, 8.2, 13.5, 1.05);
V(3, 1.3, 5.7, 0.55);

// ---------- Granny's path graph ----------
export const nodes = [];
const N = (id, level, x, z) => nodes.push({ id, level, x, z, y: ly(level) });
// basement
N('b_hw', 0, 4, 2.5); N('b_sb', 0, 8.4, 3.8); N('b_he', 0, 14, 2.5);
N('b_dw', 0, 4.5, 5); N('b_dirt', 0, 4.5, 8.5);
N('b_ds', 0, 11.2, 5); N('b_sauna', 0, 11.2, 8);
N('b_gd', 0, 15.5, 5); N('b_garage', 0, 15.5, 8.5);
// ground
N('g_n', 1, 10, 2.5); N('g_h', 1, 10, 8); N('g_s', 1, 10, 12.5);
N('g_sdt', 1, 8.4, 12.2); N('g_sub', 1, 11.6, 12.2);
N('g_study_d', 1, 7, 3.5); N('g_study', 1, 3.5, 3.5);
N('g_living_d', 1, 7, 12.5); N('g_living', 1, 3.5, 11.2);
N('g_kitchen_d', 1, 13, 3.5); N('g_kitchen', 1, 16.5, 3.5);
N('g_dining_d', 1, 13, 12.5); N('g_dining', 1, 16.5, 12.4);
N('g_kd', 1, 16.5, 7);
// upper floor
N('u_n', 2, 10, 2.5); N('u_m', 2, 10, 8); N('u_s', 2, 10, 12.5);
N('u_sut', 2, 11.6, 3.0); N('u_s2', 2, 8.4, 12.2);
N('u_bed_d', 2, 7, 2.5); N('u_bed', 2, 3.5, 3.0); N('u_bath_door', 2, 3.5, 6); N('u_bath', 2, 3.5, 8);
N('u_shelf_door', 2, 3.5, 10); N('u_shelf', 2, 3.5, 12); N('u_shelf_d', 2, 7, 12.5);
N('u_b1_d', 2, 13, 2.5); N('u_b1', 2, 16.5, 2.5); N('u_cl1', 2, 16.5, 5); N('u_closet', 2, 16.5, 7);
N('u_cl2', 2, 16.5, 9); N('u_b2', 2, 16.5, 11.5); N('u_b2_d', 2, 13, 12.5);
// attic
N('a_n', 3, 10, 2.5); N('a_m', 3, 10, 8); N('a_s', 3, 10, 12.5); N('a_sut', 3, 8.4, 3.2);
N('a_nur_d', 3, 7, 2.5); N('a_nur', 3, 3.5, 3.5); N('a_nm', 3, 3.5, 7); N('a_man', 3, 3.5, 11); N('a_man_d', 3, 7, 12.5);
N('a_jail_d', 3, 13, 2.5); N('a_jail', 3, 16.5, 2.5); N('a_js', 3, 16.5, 7); N('a_spec', 3, 16.5, 11); N('a_spec_d', 3, 13, 12.5);
export const stairEdges = [['b_sb', 'g_sdt'], ['g_sub', 'u_sut'], ['u_s2', 'a_sut']];

// player spawn: Starting Bedroom, facing the door
export const SPAWN = { x: 3.4, z: 3.0, level: 2, yaw: -Math.PI / 2 };
export const GRANNY_SPAWN = 'g_dining';
