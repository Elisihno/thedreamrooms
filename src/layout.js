// Data-driven house layout. Units are metres. Levels: 0 = basement, 1 = ground floor, 2 = upper floor, 3 = attic.
// Room names follow the Granny wiki; the geometry is our own.
// Edit this file to reshape the house; the world, collision and Granny's path graph are all built from it.

export const T = 0.2; // wall thickness
export const LH = 3; // level height
export const ly = (l) => l * LH;
// Wall tile per level (all tiles come straight from public/img/atlas.png; see src/textures.js).
const STYLE = { 0: 'gray', 1: 'plaster', 2: 'concrete', 3: 'concrete' }; // default wall tile per floor (halls, landings)

export const walls = [];
export const doors = [];
export const rooms = [];
export const furniture = [];
export const items = [];
export const containers = []; // things you open: boxes, a drawer, a safe, a sealed box, a locker

// ---------- rooms (floors / ceilings) ----------
// `wall` is the wall tile used inside that room. Halls and landings leave it out and share the floor's default (STYLE).
const R = (level, name, x0, z0, x1, z1, floor, ceil, wall) => rooms.push({ level, name, x0, z0, x1, z1, floor, ceil, wall });
// basement: a hall, the dirt room (safe), the sauna, a boiler room, the garage (shelves of boxes), and below the yard
// a crawlspace into the vault with the three-lock exit door
R(0, 'Basement', 0, 0, 20, 5, 'gray', 'concrete');
R(0, 'Dirt Room', 0, 5, 7.4, 14, 'gray', 'concrete', 'grime');
R(0, 'Cellar stairs', 7.4, 5, 9.4, 11.2, 'gray', 'concrete');
R(0, 'Sauna', 9.6, 5, 14, 10, 'planks', 'planks', 'planks');
R(0, 'Boiler Room', 9.6, 10, 14, 14, 'gray', 'concrete', 'concrete');
R(0, 'Garage', 14, 5, 20, 14, 'gray', 'concrete', 'concrete');
R(0, 'Crawlspace', 2.9, 14, 4.1, 18, 'gray', null, 'gray'); // low: the ceiling is a block at 1.1m, see below
R(0, 'Vault', 0, 18, 8, 24, 'gray', 'concrete', 'concrete');
R(0, 'Exit tunnel', 2.8, 24, 4.2, 28, 'gray', 'concrete', 'gray');
R(1, 'Foyer', 7, 0, 13, 14, 'planks', 'gray');
R(1, 'Study', 0, 0, 7, 7, 'planks', 'gray');
R(1, 'Dining Room', 0, 7, 7, 14, 'planks', 'gray');
R(1, 'Kitchen', 13, 0, 20, 7, 'planks', 'gray');
R(1, 'Living Room', 13, 7, 20, 14, 'planks', 'gray');
R(2, 'Upper Hall', 7, 0, 13, 14, 'planks', 'gray');
R(2, 'Starting Bedroom', 0, 0, 7, 6, 'planks', 'gray', 'floral');
R(2, 'Bathroom', 0, 6, 7, 10, 'gray', 'gray', 'plaster');
R(2, 'Bookshelf Room', 0, 10, 7, 14, 'planks', 'gray', 'planks');
R(2, 'Master Bedroom', 13, 0, 20, 5, 'planks', 'gray', 'streak');
R(2, 'Walk-In Closet', 13, 5, 20, 9, 'planks', 'gray', 'vert');
R(2, 'Bedroom 2', 13, 9, 20, 14, 'planks', 'gray', 'gray');
R(3, 'Attic Landing', 7, 0, 13, 14, 'planks', 'gray');
R(3, 'Nursery', 0, 0, 7, 7, 'planks', 'gray', 'streak');
R(3, 'Mannequin Room', 0, 7, 7, 14, 'planks', 'gray', 'planks');
R(3, 'Jail', 13, 0, 20, 7, 'gray', 'gray', 'gray');
R(3, 'Special Room', 13, 7, 20, 14, 'planks', 'gray', 'floral');

// ---------- walls & doors ----------
const roomAt = (level, x, z) => rooms.find((r) => r.level === level && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
const tileAt = (level, x, z) => roomAt(level, x, z)?.wall ?? STYLE[level];

// A wall segment. It is split wherever a room boundary crosses it, and each broad face takes the wall tile
// of the room it faces, so a wall between a bedroom and the hall can look different on each side.
function piece(level, axis, fixed, p0, p1, y0, h, tex) {
  const cuts = [p0, p1];
  for (const r of rooms) {
    if (r.level !== level) continue;
    for (const e of axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]) if (e > p0 + 0.05 && e < p1 - 0.05) cuts.push(e);
  }
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], len = b - a;
    if (len < 0.05) continue;
    const c = (a + b) / 2, o = T / 2 + 0.06;
    const pos = axis === 'x' ? tileAt(level, c, fixed + o) : tileAt(level, fixed + o, c);
    const neg = axis === 'x' ? tileAt(level, c, fixed - o) : tileAt(level, fixed - o, c);
    walls.push(
      axis === 'x'
        ? { kind: 'wall', level, axis, x: c, z: fixed, w: len, d: T, y0, h, tex, texPos: pos, texNeg: neg }
        : { kind: 'wall', level, axis, x: fixed, z: c, w: T, d: len, y0, h, tex, texPos: pos, texNeg: neg },
    );
  }
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
    // a crawl gap is a low opening with no door; you have to crouch to get through
    const top = g.crawl ? 1.1 : 2.1;
    piece(level, axis, fixed, g.c - w / 2, g.c + w / 2, base + top, WH - top, tex); // lintel
    if (!g.crawl) doors.push({ id: g.id, name: g.name ?? 'Door', level, axis, fixed, c: g.c, w, keys: [].concat(g.key ?? []), swing: g.swing ?? 1, tex: g.tex });
    cur = g.c + w / 2;
  }
  piece(level, axis, fixed, cur, end, base, WH, tex);
}

// Ground floor (level 1). The Front Door is not the way out: it opens the east wing (kitchen and living room).
run(1, 'x', 0, 0, 20, [], true);
run(1, 'x', 14, 0, 20, [], true);
run(1, 'z', 0, 0, 14);
run(1, 'z', 20, 0, 14);
run(1, 'z', 7, 0, 14, [
  { c: 3.5, id: 'g_study', name: 'Study door' },
  { c: 12.5, id: 'g_dining', name: 'Dining room door' },
]);
run(1, 'z', 13, 0, 14, [{ c: 3.5, w: 1.5, id: 'front', key: ['fd1', 'fd2'], name: 'Front door' }]);
run(1, 'x', 7, 0, 7);
run(1, 'x', 7, 13, 20, [{ c: 16.5, id: 'g_kd', name: 'Kitchen door' }]);

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
  { c: 2.5, id: 'u_b1', name: 'Master bedroom door' },
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
  { c: 12.5, id: 'a_spec', key: 'attic', name: 'Special room door' }, // the Attic Key from the red box opens this
]);
run(3, 'x', 7, 0, 7, [{ c: 3.5, id: 'a_nm', name: 'Door' }]);
run(3, 'x', 7, 13, 20, [{ c: 16.5, id: 'a_js', name: 'Jail cell door' }]);

// Basement (level 0)
run(0, 'x', 0, 0, 20, [], true);
run(0, 'x', 14, 0, 20, [{ c: 3.5, w: 1.2, crawl: true }], true); // the crawlspace entrance, in the dirt room's south wall
run(0, 'z', 0, 0, 14);
run(0, 'z', 20, 0, 14);
run(0, 'x', 5, 0, 7.3, [{ c: 3.5, id: 'b_dirt', name: 'Dirt room door' }]);
run(0, 'x', 5, 9.5, 20, [
  { c: 11.8, id: 'b_sauna', name: 'Sauna door' },
  { c: 17, w: 1.6, id: 'b_garage', name: 'Garage door' },
]);
run(0, 'z', 7.3, 11, 14); // dirt room's east wall, below the stairs
run(0, 'z', 9.5, 11, 14); // sauna / boiler room's west wall, below the stairs
run(0, 'x', 10, 9.5, 14); // between the sauna and the boiler room
run(0, 'z', 14, 5, 14, [{ c: 12, id: 'b_boiler', name: 'Boiler room door' }]); // sauna + boiler | garage
// the crawlspace: a 1.2m wide tunnel under the yard, ceiling at 1.1m (crouch to get through), into the vault
run(0, 'z', 2.8, 14, 18);
run(0, 'z', 4.2, 14, 18);
walls.push({ kind: 'wall', level: 0, x: 3.5, z: 16, w: 1.4, d: 3.8, y0: 1.1, h: WH - 1.1, tex: 'gray' }); // block over the tunnel
run(0, 'x', 18, 0, 8, [{ c: 3.5, w: 1.2, crawl: true }], true);
run(0, 'z', 0, 18, 24);
run(0, 'z', 8, 18, 24);
// the Vault: the exit door with three locks, and the tunnel beyond it
run(0, 'x', 24, 0, 8, [{ c: 3.5, w: 1.4, id: 'vault', key: ['rusty', 'silver', 'black'], name: 'Vault door', tex: 'gray' }], true);
run(0, 'z', 2.7, 24, 28);
run(0, 'z', 4.3, 24, 28);
export const WIN_Z = 26.3; // walk past here (below ground) and you are out

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

// ---------- furniture ----------
// hide: exit is the unit direction the player steps out toward (tables work out their own).
// table: a tabletop on legs you can hide under (press E). sink: a basin with a tap. tex picks an atlas tile.
// shelf: a metal shelving unit (the boxes on it are containers). bin: a trash can. heater: the sauna stove.
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
// master bedroom, closet, bedroom 2
F(2, 18.0, 1.4, 2.4, 1.8, 0.6, 0x5a4a60); // bed
F(2, 15.0, 1.2, 1.4, 0.9, 0.78, 0x4a3426, TABLE); // table (the sealed box sits on it)
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
F(3, 15.5, 10.5, 1.6, 1.6, 1.0, 0x6b5238); // chest (the two Front Door Keys lie on it)
F(3, 8.2, 13.5, 0.5, 0.5, 1.0, 0x3b2c20); // landing table
// ground floor: west wing (study, dining room)
F(1, 3.5, 1.2, 2.4, 1.0, 0.9, 0x4a3426, TABLE); // study desk
F(1, 0.4, 4.2, 0.5, 3.0, 2.2, 0x3b2c20); // bookshelf
F(1, 3.5, 10.5, 3.0, 1.4, 0.85, 0x4a3426, TABLE); // dining table
F(1, 0.55, 9.0, 0.7, 1.5, 2.0, 0x4a3426, { hide: { exit: [1, 0] }, label: 'cabinet' });
F(1, 7.6, 0.6, 0.7, 0.5, 2.0, 0x3b2c20); // grandfather clock
// ground floor: east wing (kitchen, living room) behind the Front Door
F(1, 14.7, 4.9, 1.8, 1.0, 0.78, 0x4a3426, TABLE); // kitchen table
F(1, 16.5, 0.5, 5.0, 0.9, 0.9, 0x7a7266, { tex: 'concrete' }); // kitchen counter
F(1, 19.4, 3.0, 1.0, 1.0, 2.0, 0xaaa59a, { tex: 'concrete' }); // fridge
F(1, 17.0, 13.38, 3.0, 1.0, 0.9, 0x6b3b3b); // sofa
F(1, 16.5, 10.4, 1.6, 1.0, 0.8, 0x4a3426, TABLE); // coffee table
F(1, 19.5, 12.1, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [-1, 0] }, label: 'cabinet' });
// basement
F(0, 3.0, 1.2, 1.4, 1.4, 1.0, 0x6b5238); // crates
F(0, 16.5, 1.3, 1.0, 1.0, 1.0, 0x6b5238);
F(0, 19.5, 2.2, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [-1, 0] }, label: 'cabinet' }); // hall
F(0, 6.9, 8.0, 0.7, 1.6, 2.0, 0x4a3426, { hide: { exit: [-1, 0] }, label: 'cabinet' }); // dirt room
F(0, 2.0, 12.4, 1.4, 1.4, 1.0, 0x6b5238); // dirt room crates
F(0, 6.3, 12.8, 0.8, 0.8, 0.9, 0x6b5238);
F(0, 10.3, 8.0, 0.7, 3.0, 0.5, 0x6b5238, { tex: 'planks' }); // sauna bench (the lockpick drops here)
F(0, 13.45, 7.4, 0.8, 1.3, 1.0, 0x55504a, { tex: 'concrete', heater: true }); // sauna stove
F(0, 12.7, 9.4, 0.5, 0.5, 0.7, 0x55504a, { bin: true }); // the trash can
F(0, 10.9, 12.9, 1.4, 1.2, 1.9, 0x55504a, { tex: 'concrete' }); // boiler
F(0, 13.2, 10.9, 0.8, 0.8, 0.9, 0x6b5238); // boiler room crates
F(0, 16.7, 10.0, 2.4, 0.9, 0.9, 0x55504a, { tex: 'concrete' }); // garage workbench
// the garage's shelving: metal units along the east, west and south walls, loaded with cardboard boxes
const SHELVES = [
  { id: 'A', x: 19.45, z: 7.4, along: 'z', len: 3.0, face: [-1, 0] },
  { id: 'B', x: 19.45, z: 11.0, along: 'z', len: 3.0, face: [-1, 0] },
  { id: 'C', x: 14.55, z: 7.4, along: 'z', len: 3.0, face: [1, 0] },
  { id: 'D', x: 16.6, z: 13.45, along: 'x', len: 3.0, face: [0, -1] },
];
const BOARDS = [0.34, 1.04, 1.74];
const JUNK = ['Old photographs.', 'Christmas lights, all tangled.', 'Dusty tablecloths.', 'A broken toy.', 'Nothing but dust.',
  'Rusty nails.', 'Moth-eaten blankets.', 'Paint cans.', 'Old newspapers.', 'Tangled cables.', 'Empty.', 'A single glove.'];
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
for (const s of SHELVES) {
  const wx = s.along === 'z' ? 0.5 : s.len, wz = s.along === 'z' ? s.len : 0.5;
  F(0, s.x, s.z, wx, wz, 2.1, 0x55504a, { shelf: true, boards: BOARDS, along: s.along });
  BOARDS.forEach((board, bi) => {
    const n = 5, slot = s.len / n;
    for (let k = 0; k < n; k++) {
      const w = 0.34 + rnd() * 0.12, h = 0.2 + rnd() * 0.14;
      const along = -s.len / 2 + slot * (k + 0.5);
      const x = s.along === 'z' ? s.x : s.x + along, z = s.along === 'z' ? s.z + along : s.z;
      const red = s.id === 'B' && bi === 1 && k === 3; // THE red box
      containers.push({
        id: red ? 'redbox' : `box_${s.id}${bi}${k}`, kind: 'box', level: 0, x, z, w, d: 0.34, h, y: board,
        face: s.face, color: red ? 0xb3262b : null, junk: JUNK[Math.floor(rnd() * JUNK.length)], open: false,
      });
    }
  });
}
// loose boxes in the dirt room
for (const [x, z] of [[1.2, 6.2], [2.0, 6.0], [1.6, 6.15]]) {
  containers.push({ id: `box_d${x}${z}`, kind: 'box', level: 0, x, z, w: 0.45, d: 0.38, h: 0.3, y: x === 1.6 ? 0.3 : 0, face: [0, 1], color: null, junk: JUNK[Math.floor(rnd() * JUNK.length)], open: false });
}
// the safe in the dirt room (needs the scissors), the drawer in the living room (holds the scissors),
// the sealed box on the master bedroom table (needs the scissors) and the locker in the starting bedroom (needs the lockpick)
containers.push({ id: 'safe', kind: 'safe', level: 0, x: 0.55, z: 8.6, w: 0.9, d: 0.8, h: 0.95, y: 0, face: [1, 0], requires: 'scissors', open: false,
  hint: 'The safe is shut tight. The lock has a thin slot in it. Something sharp might work.', done: 'You jab the scissors into the lock. Click. The safe swings open.' });
containers.push({ id: 'drawer', kind: 'drawer', level: 1, x: 19.5, z: 8.5, w: 1.4, d: 0.7, h: 0.9, y: 0, face: [-1, 0], open: false });
containers.push({ id: 'sealed', kind: 'sealed', level: 2, x: 15.0, z: 1.2, w: 0.55, d: 0.42, h: 0.32, y: 0.78, face: [0, 1], requires: 'scissors', open: false,
  hint: 'A box, wrapped in tape. You need something sharp to cut it open.', done: 'You slice through the tape.' });
containers.push({ id: 'locker', kind: 'locker', level: 2, x: 0.4, z: 4.2, w: 0.6, d: 0.6, h: 1.9, y: 0, face: [1, 0], requires: 'lockpick', open: false,
  hint: 'A locker, locked. The lock looks old and simple. A lockpick would do it.', done: 'You work the lockpick. Click. The locker opens.' });

// ---------- items ----------
// y is the surface height the item rests on, plus 5cm. `inside` hides the item until that container is opened.
export const KEYS = {
  brass: { label: 'Padlock Key', color: 0xc9a24d },
  attic: { label: 'Attic Key', color: 0xb8702f },
  fd1: { label: 'Front Door Key 1', color: 0xf2c63c },
  fd2: { label: 'Front Door Key 2', color: 0x7fb6a0 },
  rusty: { label: 'Rusty Key', color: 0xa1573a },
  silver: { label: 'Silver Key', color: 0xc9ced6 },
  black: { label: 'Black Key', color: 0x34343a },
};
export const TOOLS = {
  scissors: { label: 'Scissors', color: 0xd24b3a, uses: 2 },
  lockpick: { label: 'Lockpick', color: 0xbfc3c8 },
};
export const itemInfo = (item) => (item.kind === 'key' ? KEYS[item.id] : item.kind === 'tool' ? TOOLS[item.id] : { label: 'Vase', color: 0x86a3b8 });
const K = (id, level, x, z, y, inside) => items.push({ kind: 'key', id, level, x, z, y, inside });
const TL = (id, level, x, z, y, inside) => items.push({ kind: 'tool', id, level, x, z, y, inside });
const V = (level, x, z, y) => items.push({ kind: 'vase', level, x, z, y });
const box = (id) => containers.find((c) => c.id === id);
const rb = box('redbox');
K('brass', 2, 5.8, 6.45, 0.93); // in the bathroom sink, right next to the starting bedroom
K('attic', 0, rb.x, rb.z, rb.y + rb.h + 0.06, 'redbox'); // in the red box
K('fd1', 3, 15.2, 10.5, 1.05); // attic Special Room: the two keys for the Front Door
K('fd2', 3, 15.9, 10.5, 1.05);
TL('scissors', 1, 19.0, 8.5, 0.82, 'drawer'); // on the tray of the living room drawer
K('rusty', 0, 0.55 + 0.52, 8.6, 0.55 + 0.04, 'safe'); // in the safe
K('silver', 2, 15.0, 1.2, 0.78 + 0.32 + 0.06, 'sealed'); // in the sealed box
K('black', 2, 0.4 + 0.42, 4.2, 1.35 + 0.05, 'locker'); // in the locker
TL('lockpick', 0, 10.3, 8.4, 0.55, 'sauna'); // appears on the sauna bench once the sauna has heated up
V(1, 3.5, 10.5, 0.9);
V(1, 16.5, 10.4, 0.85);
V(1, 16.5, 0.5, 0.95);
V(2, 2.9, 12.9, 0.85);
V(2, 8.2, 13.5, 1.05);
V(3, 1.3, 5.7, 0.55);
V(0, 3.0, 1.2, 1.05); // basement hall crates
V(0, 16.7, 10.0, 0.95); // garage workbench

// ---------- triggers and zones ----------
// A vase thrown in here heats the sauna. The catch zone is generous so a throw aimed at the can goes in.
export const TRASH = { level: 0, x: 12.7, z: 9.4, r: 0.45, top: 0.72, catchTop: 1.25 };
export const CRAWL = {
  inside: { level: 0, x0: 2.8, x1: 4.2, z0: 14, z1: 18 }, // too low to stand up in here
  hints: [{ level: 0, x0: 2.3, x1: 4.7, z0: 12.4, z1: 14.3 }, { level: 0, x0: 2.3, x1: 4.7, z0: 17.8, z1: 19.6 }],
};

// ---------- Granny's path graph (she is switched off for now; this is a rough pass for the new basement) ----------
export const nodes = [];
const N = (id, level, x, z) => nodes.push({ id, level, x, z, y: ly(level) });
// basement
N('b_hw', 0, 3.5, 2.5); N('b_sb', 0, 8.4, 3.8); N('b_he', 0, 16, 2.5);
N('b_dw', 0, 3.5, 5); N('b_dirt', 0, 3.5, 9);
N('b_ds', 0, 11.8, 5); N('b_sauna', 0, 11.8, 7.5);
N('b_gd', 0, 17, 5); N('b_garage', 0, 17, 8.5);
N('b_gb', 0, 14, 12); N('b_boiler', 0, 11.8, 12);
// ground
N('g_n', 1, 10, 2.5); N('g_h', 1, 10, 8); N('g_s', 1, 10, 12.5);
N('g_sdt', 1, 8.4, 12.2); N('g_sub', 1, 11.6, 12.2);
N('g_study_d', 1, 7, 3.5); N('g_study', 1, 3.5, 3.5);
N('g_dining_d', 1, 7, 12.5); N('g_dining', 1, 3.5, 12.2);
N('g_front_d', 1, 13, 3.5); N('g_kitchen', 1, 16.5, 3.5);
N('g_kd', 1, 16.5, 7); N('g_living', 1, 16.5, 12.4);
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
