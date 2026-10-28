import * as THREE from '../three.js';
import { AREAS, HIDING, CAMERAS, FIXTURES, LEVEL_Y, SPIRAL, CEIL } from './layout.js';
import { getMaterial, getBasic } from '../assets/registry.js';
import { instanceModel, hasModel, cloneModel, modelSize } from '../assets/models.js';
import { partySet, instanced } from './partyprops.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

// Furniture, props and fixtures for every room. All static pieces go through the batched box builder.
export function furnish(w) {
  const Y = l => LEVEL_Y[l];
  const bx = (l, x0, z0, x1, z1, h, mat, y = 0, o = {}) => w.block(l, x0, z0, x1, z1, Y(l) + y, Y(l) + y + h, mat, o);
  const deco = { collide: false };
  const stairRect = [SPIRAL.cx - SPIRAL.holeR - 0.6, SPIRAL.cz - SPIRAL.holeR - 0.6, SPIRAL.cx + SPIRAL.holeR + 0.6, SPIRAL.cz + SPIRAL.holeR + 0.6];

  // ----- reusable pieces -----
  // desk/bench with knee space: top slab at 0.85-0.95 m (crouched player fits under), panels on 3 sides, open toward +z.
  const hideDesk = (l, x0, z0, x1, z1, mat = 'wood', top = mat) => {
    bx(l, x0, z0, x1, z1, 0.1, top, 0.85, { y0: Y(l) + 0.85, y1: Y(l) + 0.95 });
    bx(l, x0, z0, x0 + 0.08, z1, 0.85, mat); bx(l, x1 - 0.08, z0, x1, z1, 0.85, mat); bx(l, x0, z0, x1, z0 + 0.08, 0.85, mat);
  };
  const shelf = (l, x0, z0, x1, z1, mat = 'tile_metal', h = 2.0) => {
    bx(l, x0, z0, x1, z1, h, mat);
    const horiz = x1 - x0 >= z1 - z0;
    for (const y of [0.55, 1.15, 1.75]) {   // items sitting on the shelves (visual)
      const n = Math.floor((horiz ? x1 - x0 : z1 - z0) / 0.7);
      for (let i = 0; i < n; i++) {
        const a = 0.2 + i * 0.7, c = i % 3 === 0 ? 'wood' : i % 3 === 1 ? 'metal_yellow' : 'diamond_plate';
        if (horiz) bx(l, x0 + a, z1 - 0.02, x0 + a + 0.45, z1 + 0.16, 0.3, c, y, deco); else bx(l, x1 - 0.02, z0 + a, x1 + 0.16, z0 + a + 0.45, 0.3, c, y, deco);
      }
    }
  };
  // model props are collected per level and instanced at the end
  const place = new Map();
  const put = (name, l, p) => { const k = name + '|' + l; (place.get(k) || place.set(k, []).get(k)).push({ y: Y(l), ...p }); };
  const solid = (l, x, z, hx, hz, h, y = 0) => w.collision.add(x - hx, z - hz, x + hx, z + hz, Y(l) + y, Y(l) + y + h);
  const crate = (l, x, z, s = 0.8, y = 0) => { put('crate', l, { x, z, y: Y(l) + y, s: s / 0.8, ry: (x * 7 + z * 3) % 6.28 }); solid(l, x, z, s / 2, s / 2, s, y); };
  // lockers in a row; `face` is the direction the doors face (S = +z, E = +x, N = -z, W = -x)
  const locker = (l, x, z, face = 'S', n = 1) => {
    const ry = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 }[face], alongX = face === 'S' || face === 'N';
    for (let i = 0; i < n; i++) {
      const cx = x + (alongX ? i * 0.55 : 0), cz = z + (alongX ? 0 : i * 0.55);
      put('locker', l, { x: cx, z: cz, ry });
      solid(l, cx, cz, alongX ? 0.27 : 0.31, alongX ? 0.31 : 0.27, 1.9);
    }
  };
  const bin = (l, x, z) => { put('trash_can', l, { x, z, ry: x * 5 }); solid(l, x, z, 0.38, 0.38, 0.75); };
  const metalTable = (l, x, z, rot = true) => { put('metal_table', l, { x, z, ry: rot ? Math.PI / 2 : 0 }); w.collision.add(x - (rot ? 0.87 : 0.49), z - (rot ? 0.49 : 0.87), x + (rot ? 0.87 : 0.49), z + (rot ? 0.49 : 0.87), Y(l) + 0.85, Y(l) + 0.95); };
  const picnic = (l, x, z, ry = 0) => { put('bench', l, { x, z, ry }); solid(l, x, z, ry ? 0.87 : 0.9, ry ? 0.9 : 0.87, 0.7); };
  const lamp = (l, x, z) => { put('floor_lamp', l, { x, z }); solid(l, x, z, 0.2, 0.2, 1.6); };
  const exitSign = (l, x, y, z, ry) => put('exit_sign', l, { x, z, y: Y(l) + y, ry });
    // pipe runs: one cheap instanced pipe section (tube + two flanges, ~100 triangles), 1.65 m long, laid end to end
  const pipeItems = new Map();
  const pipe = (l, x0, z0, x1, z1, y) => {
    const alongX = (x1 - x0) >= (z1 - z0), len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / 1.65));
    const arr = pipeItems.get(l) || pipeItems.set(l, []).get(l);
    for (let i = 0; i < n; i++) arr.push({ x: alongX ? x0 + (i + 0.5) * len / n : (x0 + x1) / 2, z: alongX ? (z0 + z1) / 2 : z0 + (i + 0.5) * len / n, y: Y(l) + y + 0.09, rz: alongX ? Math.PI / 2 : 0, rx: alongX ? 0 : Math.PI / 2, sy: len / n / 1.65 });
  };
  // wall-mounted breaker panel (model is 0.55 x 0.5 x 0.37; front = +z). cx,cz = centre of its back; face = direction it faces
  const breaker = (l, x, z, face, yBase = 1.1, s = 1.3) => {
    const ry = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 }[face], d = 0.37 * s / 2 + 0.02;
    const cx = x + (face === 'E' ? d : face === 'W' ? -d : 0), cz = z + (face === 'S' ? d : face === 'N' ? -d : 0);
    put('breaker', l, { x: cx, z: cz, y: Y(l) + yBase - 0.5 * s, ry, s });   // model starts 0.5 m above its own origin
    const alongX = face === 'S' || face === 'N';
    solid(l, cx, cz, alongX ? 0.36 : d, alongX ? d : 0.36, 0.7, yBase - 0.05);
  };
  const desk = (l, x, z, ry = 0) => { put('desk', l, { x, z, ry }); const r = Math.abs(Math.sin(ry)) > 0.5; solid(l, x, z, r ? 0.42 : 1.0, r ? 1.0 : 0.42, 0.7); };
  const officeChair = (l, x, z, ry = 0) => { put('chair_office', l, { x, z, ry }); solid(l, x, z, 0.28, 0.28, 0.9); };
  const winch = (l, x, z, ry = 0) => { put('winch', l, { x, z, ry }); const r = Math.abs(Math.sin(ry)) > 0.5; solid(l, x, z, r ? 0.95 : 0.85, r ? 0.85 : 0.95, 0.96); };
  const screen = (l, x, y, z, w2, h2, d2, color) => w.box({ level: l, x, y: Y(l) + y, z, w: w2, h: h2, d: d2, mat: color, basic: true, collide: false, cast: false, receive: false });
  const bunch = (l, x, z, s = 1) => instanceModel(w.group(l), 'balloons', [{ x, y: Y(l), z, ry: x * 3.1, s }]);
  const bench = (l, x0, z0, x1, z1) => { bx(l, x0, z0, x1, z1, 0.45, 'wood'); };
  const couch = (l, x0, z0, x1, z1, mat = 'padding_purple') => { bx(l, x0, z0, x1, z1, 0.5, mat); if (x1 - x0 > z1 - z0) bx(l, x0, z0, x1, z0 + 0.25, 0.5, mat, 0.5); else bx(l, x0, z0, x0 + 0.25, z1, 0.5, mat, 0.5); };
  const arcade = (l, x, z, faceS, color, scr) => {
    const x0 = x - 0.45, x1 = x + 0.45, z0 = faceS ? z : z - 0.75, z1 = faceS ? z + 0.75 : z;
    bx(l, x0, z0, x1, z1, 1.75, color);
    screen(l, x, 1.25, faceS ? z1 + 0.01 : z0 - 0.01, 0.65, 0.5, 0.02, scr);
    screen(l, x, 1.72, faceS ? z1 + 0.01 : z0 - 0.01, 0.85, 0.16, 0.02, 0xffd23c);
    bx(l, x0 + 0.05, faceS ? z1 : z0 - 0.3, x1 - 0.05, faceS ? z1 + 0.3 : z0, 0.12, color, 0.85, deco);
  };

  // ============================== FLOOR 1 ==============================
  // Reception: desk (hiding spot), couches, balloons
  put('counter', '1', { x: 7.6, z: 2.7, s: 1.5 }); solid('1', 7.6, 2.7, 1.9, 0.38, 0.95); metalTable('1', 3.2, 2.8);
  couch('1', 0.3, 6, 1.3, 10); couch('1', 3.5, 9.7, 8, 10.7, 'tile_metal');
  bx('1', 5, 5.5, 6, 6.5, 0.5, 'wood'); bunch('1', 2, 2); bunch('1', 10.5, 10.5);
  // Main Party Hall: stage with curtain, gift table (hiding), banquet tables
  bx('1', 24, 0.1, 34.5, 3.3, 0.5, 'wood'); bx('1', 24, 0.1, 34.5, 0.5, 2.6, 'padding_purple', 0.5, deco);
  partySet(w, '1', { tables: [{ x: 28, z: 11, len: 1.2 }, { x: 20, z: 11.5, len: 1.0 }], bounds: { x0: 12, x1: 36, z0: 0, z1: 16 }, avoid: [stairRect, [35, 3, 36, 5], [35, 12, 36, 16]], ceilingBalloons: 14, seed: 11, confetti: 500 });
  // Kitchen: counters, island with knee space (hiding), fridges
  for (let i = 0; i < 5; i++) metalTable('1', 37.4 + i * 1.8, 0.65);
  for (const z of [2.2, 3.2, 6.2]) { put('fridge', '1', { x: 47.45, z, ry: -Math.PI / 2 }); solid('1', 47.45, z, 0.39, 0.37, 1.85); }
  bin('1', 37.2, 11.3); bin('1', 47.3, 9.3);
  metalTable('1', 41.5, 5.5); metalTable('1', 43.4, 5.5); metalTable('1', 38.2, 10.3, false); metalTable('1', 42.3, 11.3);
  // Dining Room: three long party tables (start under the middle one), cake, balloons, confetti, bunting
  partySet(w, '1', { tables: [{ x: 22, z: 19.5 }, { x: 22, z: 23, cake: true }, { x: 22, z: 26.5 }], bounds: { x0: 12, x1: 36, z0: 16, z1: 30 }, avoid: [[34, 16.5, 36, 20.5], [35, 21, 36, 23], [35, 27, 36, 29.5]], ceilingBalloons: 28, bunting: true, seed: 5, confetti: 700 });
  // Bathrooms: stall row on the north wall (textured), a dirty public toilet in every stall, sinks on the south wall
  const STALL_X0 = 40.17, STALL_W = 1.11, STALL_Z = 17.35;   // six open stalls against the north wall, each 1.12 m wide, 1.22 m deep
  for (let i = 0; i < 6; i++) {
    const sx = STALL_X0 + STALL_W * (i + 0.5);
    put('stall', '1', { x: sx, z: STALL_Z - 0.61 });
    put('toilet', '1', { x: sx, z: 16.1 + 0.4 }); solid('1', sx, 16.5, 0.21, 0.365, 0.8);
  }
  for (let k = 0; k <= 6; k++) solid('1', STALL_X0 + STALL_W * k, 16.73, 0.03, 0.63, 1.9);
  for (const x of [41.4, 43.0, 44.6, 46.2]) { put('sink', '1', { x, z: 25.7, y: Y('1') + 0.5, ry: Math.PI }); solid('1', x, 25.7, 0.23, 0.2, 0.65, 0.45); }
  // Security Room: monitor wall + desk (no hiding spot here)
  for (const z of [18.6, 20.6, 22.6]) { desk('1', 59.35, z, Math.PI / 2); officeChair('1', 58.35, z + 0.15, Math.PI / 2); }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) screen('1', 59.85, 1.25 + r * 0.55, 17.8 + c * 2.2, 0.04, 0.45, 1.9, r === 1 ? 0x2c6b5c : 0x1f4f46);
  breaker('1', 50, 25.9, 'N'); breaker('1', 52, 25.9, 'N');
  // Supply Closet: shelves + crates (keeps the ladder corner free)
  shelf('1', 49, 26.1, 57, 26.8); shelf('1', 49, 32.1, 57, 32.9, 'diamond_plate');
  crate('1', 51, 29.5, 0.9); crate('1', 52.2, 29.5, 0.7); crate('1', 51.6, 29.5, 0.7, 0.9); crate('1', 55.5, 30, 1.0);
  // Emergency Exit Room: exit door, four mechanisms, warning stripes
  exitFixtures();
  // Party Preparation Room: assembly bench, hiding bench, shelves, boxes
  metalTable('1', 55, 0.8); metalTable('1', 56.9, 0.8);
  metalTable('1', 51, 9.6);
  shelf('1', 58.8, 3, 59.8, 10.5, 'wood'); shelf('1', 48.2, 2, 49.2, 7, 'wood');
  crate('1', 55.5, 5, 0.9); crate('1', 56.5, 5.4, 0.7); bunch('1', 51, 4, 0.9);
  // corridors
  bench('1', 37, 15.2, 40, 15.8); bench('1', 56, 12.2, 59, 12.8);
  bx('1', 36.2, 26.2, 36.9, 26.9, 0.8, 'tile_metal'); crate('1', 46.5, 31.5, 0.8);

  // ============================== FLOOR 2 ==============================
  // Party Room A / B
  partySet(w, '2', { tables: [{ x: 6.5, z: 3, len: 1.1 }, { x: 6.5, z: 7, len: 1.1 }], bounds: { x0: 0, x1: 12, z0: 0, z1: 10 }, ceilingBalloons: 10, seed: 21, confetti: 350 });
  partySet(w, '2', { tables: [{ x: 8, z: 18, len: 1.1 }, { x: 8, z: 22, len: 1.0 }], bounds: { x0: 0, x1: 14, z0: 13, z1: 25 }, avoid: [[0, 13.5, 3, 18]], ceilingBalloons: 10, seed: 23, confetti: 350 });
  couch('2', 12.3, 7, 13, 9.5, 'tile_metal');
  // Landing: benches
  bench('2', 21.5, 0.3, 23.5, 0.9); bench('2', 21.5, 9.1, 23.5, 9.7);
  // Arcade: rows of machines (the model); three are the playable games, marked by a lit sign
  const games = [['pop', 29.5], ['dash', 37.5], ['find', 44.5]];
  w.fixtures.arcade = [];
  const asz = modelSize('arcade') || { x: 0.9, z: 0.9, y: 1.85 };
  const placements = [];
  const addMachine = (x, z, facingSouth) => {
    placements.push({ x, y: Y('2'), z: facingSouth ? z + asz.z / 2 : z - asz.z / 2, ry: facingSouth ? 0 : Math.PI });
    w.collision.add(x - asz.x / 2, facingSouth ? z : z - asz.z, x + asz.x / 2, facingSouth ? z + asz.z : z, Y('2'), Y('2') + 1.9);
  };
  for (let i = 0; i < 15; i++) {
    const x = 27.4 + i * 1.3; if (x > 46.4) break;
    addMachine(x, 0.12, true);
    const g = games.find(q => Math.abs(q[1] - x) < 0.7);
    if (g) { screen('2', x, 2.15, 0.12 + asz.z / 2, 0.8, 0.14, 0.04, 0xffd23c); w.fixtures.arcade.push({ game: g[0], x, z: 0.12 + asz.z + 0.4 }); }
  }
  for (let i = 0; i < 6; i++) { const x = 29 + i * 1.8; addMachine(x, 4.4, true); addMachine(x, 5.5 + asz.z, false); }
  instanceModel(w.group('2'), 'arcade', placements);
  // Prize Counter: counter model, plush shelves, token spot
  if (hasModel('counter')) { instanceModel(w.group('2'), 'counter', [{ x: 54, y: Y('2'), z: 1.2, s: 1.5 }]); w.collision.add(52.1, 0.1, 55.9, 1.55, Y('2'), Y('2') + 0.95); }
  shelf('2', 58.8, 1.5, 59.8, 8.5, 'wood'); shelf('2', 49, 8.8, 53, 9.8, 'wood', 1.8);
  bunch('2', 50, 5, 0.9); bunch('2', 57, 6, 0.9);
  // Indoor Playground: elevated decks with crawl-under tunnels, hide-and-seek huts, foam pillars
  playground();
  // Ball Pit: padded rim with entrances, sea of balls (not a hiding spot)
  ballPit();
  // Storage Closet and Service Corridor
  shelf('2', 49, 13.2, 52.5, 14, 'tile_metal'); shelf('2', 56, 13.2, 58.5, 14, 'tile_metal'); shelf('2', 49, 18, 58, 18.8, 'diamond_plate'); crate('2', 56, 16, 1.0); crate('2', 54, 16.2, 0.7);
  pipe('2', 48.2, 19.1, 59.8, 19.4, 2.2); pipe('2', 48.2, 19.5, 59.8, 19.8, 1.9, 'panel_concrete'); crate('2', 58.5, 21.6, 0.9);
  bench('2', 20, 12.1, 24, 12.7);

  // ============================== FLOOR 3 (abandoned) ==============================
  // Celebration Hall: knocked-over party remains
  partySet(w, '3', { tables: [{ x: 28, z: 11, len: 1.1 }, { x: 22, z: 13, len: 0.8 }], bounds: { x0: 12, x1: 36, z0: 0, z1: 16 }, avoid: [stairRect, [35, 5, 36, 10]], ceilingBalloons: 5, seed: 31, bunting: true, confetti: 250 });
  locker('3', 33.8, 0.35, 'S', 3); crate('3', 14, 12, 0.9); crate('3', 14.9, 12.2, 0.7);
  // Staff Office: lockers, desks (one with knee space), cabinets
  locker('3', 0.45, 2, 'E', 4); metalTable('3', 9, 9.1); desk('3', 5.5, 4.6); officeChair('3', 5.5, 5.6, Math.PI); locker('3', 10.4, 0.9, 'S', 2);
  couch('3', 3, 10.2, 6, 11.4, 'tile_metal');
  // Surveillance Archives: shelf rows
  shelf('3', 37, 1.1, 46, 1.9, 'tile_metal'); shelf('3', 37, 4.3, 46, 5.1, 'tile_metal'); locker('3', 47.55, 1, 'W', 2); screen('3', 36.15, 1.4, 3, 0.03, 0.6, 1.0, 0x1f4f46);
  // Maintenance Corridor
  pipe('3', 36.2, 6.1, 47.8, 6.4, 2.3); pipe('3', 36.2, 8.6, 47.8, 8.9, 2.0, 'panel_concrete');
  // Storage Room: stacked crates and lockers (hatch corner kept clear)
  for (const [x, z] of [[38, 11.5], [39.2, 11.5], [38.6, 14], [41, 16.5], [43.5, 11.2]]) { crate('3', x, z, 1.0); }
  crate('3', 38.6, 11.5, 0.9, 1.0); locker('3', 38.2, 18.6, 'N', 3);
  // Maintenance Office: workbench + elevator door + parts
  metalTable('3', 51.5, 6.2); metalTable('3', 53.4, 6.2); breaker('3', 56, 4.1, 'S'); breaker('3', 57.8, 4.1, 'S');
  shelf('3', 49, 11, 54, 11.9, 'tile_metal');
  elevator();
  // Elevator Room: machinery
  winch('3', 52, 16.6); winch('3', 56.6, 17.2, Math.PI / 2); for (const x of [51, 53.2, 55.4]) breaker('3', x, 23.9, 'N');
  pipe('3', 48.2, 14.1, 59.8, 14.4, 2.3);
  // Birthday Chamber: the main table with the cake
  partySet(w, '3', { tables: [{ x: 24, z: 23, len: 1.5, cake: true }], bounds: { x0: 12, x1: 36, z0: 16, z1: 30 }, ceilingBalloons: 12, seed: 41, bunting: true, confetti: 500 });

  // ============================== BASEMENT ==============================
  // Basement Hall and Generator Room
  pipe('B', 12.2, 0.1, 35.8, 0.4, 2.3); pipe('B', 12.2, 7.4, 35.8, 7.7, 2.0, 'panel_concrete'); crate('B', 33.5, 6.5, 0.9);
  put('generator', 'B', { x: 24, z: 16.5, ry: Math.PI / 2, s: 1.4 }); solid('B', 24, 16.5, 1.4, 0.65, 1.16);
  put('generator', 'B', { x: 31.5, z: 11, ry: Math.PI / 2 }); solid('B', 31.5, 11, 1.0, 0.47, 0.83);
  for (const x of [17, 20, 27, 30]) breaker('B', x, 21.9, 'N');
  w.light({ level: 'B', x: 24, y: Y('B') + 2.5, z: 16.5, color: 0xffc080, intensity: 26, distance: 10, flicker: 0.2, lamp: false });
  for (const [x, z] of [[14, 20.5], [15.2, 20.5], [34, 9.5], [34, 20.5]]) crate('B', x, z, 0.8);
  pipe('B', 12.2, 8.2, 35.8, 8.5, 2.3);
  // Electrical Room: cabinets and a workbench (hiding spot)
  for (let i = 0; i < 4; i++) breaker('B', 1.6 + i * 1.7, 0.1, 'S'); locker('B', 11.55, 4, 'W', 5); metalTable('B', 6, 9);
  // Maintenance Storage: shelves, workbench (hiding spot), crates; ladder corner kept clear
  shelf('B', 37, 0.2, 46, 1.0, 'tile_metal'); metalTable('B', 38, 8.5); crate('B', 46.5, 3, 0.9); crate('B', 46.5, 4.1, 0.7);
  // Boiler Room: tanks and pipes (shaft corner kept clear)
  w.light({ level: 'B', x: 54.5, y: Y('B') + 2.4, z: 6, color: 0xff7a50, intensity: 24, distance: 10, flicker: 0.3, lamp: false });
  put('boiler', 'B', { x: 52.5, z: 3.8 }); solid('B', 52.5, 3.8, 0.73, 0.54, 2.5); put('boiler', 'B', { x: 56.8, z: 3.6, ry: 0.2 }); solid('B', 56.8, 3.6, 0.73, 0.54, 2.5); pipe('B', 49, 0.2, 59.8, 0.5, 2.4, 'panel_concrete'); pipe('B', 49, 8, 56, 8.3, 0.4);
  // Hidden Records Room: filing cabinets
  locker('B', 1.2, 14.45, 'S', 8); locker('B', 1.2, 25.55, 'N', 8);

  // ---- extra model props ----
  put('table_bell', '1', { x: 8.4, z: 2.7, y: Y('1') + 0.93 });
  lamp('1', 1, 1.3); lamp('1', 11, 6); lamp('1', 35, 15); lamp('2', 22.5, 1.2); lamp('2', 49, 9); lamp('3', 13, 15); lamp('3', 11, 11);
  picnic('1', 7, 7.8, 0); picnic('2', 55, 6, Math.PI / 2);
  bin('1', 59, 15.2); bin('1', 37.2, 13); bin('2', 3, 11.7); bin('2', 59, 11.7); bin('1', 38.4, 25.2); bin('3', 47.3, 8.4); bin('B', 13, 7); bin('B', 47, 16);
  exitSign('1', 0.4, 2.4, 17, Math.PI / 2); exitSign('1', 11.8, 2.3, 6, -Math.PI / 2); exitSign('2', 12.2, 2.3, 8.5, Math.PI / 2); exitSign('3', 12.4, 2.3, 14, Math.PI / 2); exitSign('B', 14, 2.3, 7.8, Math.PI);
  for (const [k, arr] of place) { const [name, l] = k.split('|'); instanceModel(w.group(l), name, arr); }
  {
    const tube = new THREE.CylinderGeometry(0.13, 0.13, 1.65, 12, 1, true), fl = [-0.8, 0.8].map(yy => new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12).translate(0, yy, 0));
    const geo = mergeGeometries([tube, ...fl]);
    for (const [l, items] of pipeItems) instanced(w.group(l), geo, getMaterial('pipe_paint'), items, { receive: false });
  }

  // ============================== markers ==============================
  hidingSpots();
  cameras();

  // ---- local builders needing access to the helpers above ----
  function exitFixtures() {
    const l = '1', y = Y(l);
    w.fixtures.exitDoor = { level: l, x: 0.15, z: 17 };
    for (const z of [16.2, 17.8]) {
      if (hasModel('door')) {
        const d = cloneModel('door'); d.rotation.y = Math.PI / 2; d.scale.set(1.2, 1.05, 1.0); d.position.set(0.12, y, z); w.group(l).add(d);
      } else bx(l, 0.05, z - 0.7, 0.2, z + 0.7, 2.1, 'padding_purple', 0, deco);
    }
    bx(l, 0, 15.3, 0.25, 15.5, 2.4, 'metal_yellow'); bx(l, 0, 18.5, 0.25, 18.7, 2.4, 'metal_yellow'); bx(l, 0, 15.3, 0.25, 18.7, 0.3, 'metal_yellow', 2.1, deco);
    w.collision.add(0, 15.4, 0.3, 18.6, y, y + 2.3);
    bx(l, 0.3, 14.5, 2.5, 19.5, 0.02, 'hazard_stripes', 0, deco);
    // mechanisms (positions only for now): key lock, wire panel, keypad, fuse box
    const specs = [[13.2, 'panel_concrete', 0x2a2a2a], [14.2, 'wall_green_peel', 0x2a2a2a], [19.6, 'panel_concrete', 0x38ff6a], [20.7, 'wall_green_peel', 0xff3a2a]];
    specs.forEach(([z, mat, lamp]) => { put('cabinet', l, { x: 0.18, z: z + 0.4, y: y + 1.0, ry: Math.PI / 2, s: 1.3 }); screen(l, 0.38, 1.0 + 0.62 * 1.3 + 0.1, z + 0.4, 0.03, 0.1, 0.3, lamp); });
    w.fixtures.exitMechanisms = ['key', 'wires', 'code', 'fuse'];
  }
  function elevator() {
    const l = '3', y = Y(l);
    w.fixtures.elevator = { level: l, x: 59.9, z: 11 };
    bx(l, 59.5, 9.7, 59.9, 12.3, 2.3, 'diamond_plate', 0, deco);
    bx(l, 59.3, 9.55, 59.9, 9.7, 2.5, 'metal_yellow'); bx(l, 59.3, 12.3, 59.9, 12.45, 2.5, 'metal_yellow'); bx(l, 59.3, 9.55, 59.9, 12.45, 0.2, 'metal_yellow', 2.3, deco);
    bx(l, 59.2, 10.95, 59.5, 11.05, 2.0, 'panel_concrete', 0.1, deco);
    screen(l, 59.45, 1.7, 12.6, 0.06, 0.25, 0.25, 0xff3a2a);
    w.collision.add(59.2, 9.55, 60, 12.45, y, y + 2.5);
  }
  function playground() {
    const l = '2', y = Y(l);
    const deck = (x0, z0, x1, z1, mat, post = 'slide_red') => {
      bx(l, x0, z0, x1, z1, 0.25, mat, 0.85, { y0: y + 0.85, y1: y + 1.1 });
      for (const [px, pz] of [[x0, z0], [x1 - 0.25, z0], [x0, z1 - 0.25], [x1 - 0.25, z1 - 0.25]]) bx(l, px, pz, px + 0.25, pz + 0.25, 0.85, post);
      bx(l, x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, 0.8, 'padding_squares', 1.1, deco);
    };
    deck(17, 16, 25, 24, 'slide_blue'); deck(24, 22, 32, 30, 'slide_red', 'slide_blue'); deck(28, 15, 34, 20, 'padding_purple', 'slide_red');
    // huts (open on one side) with low roofs
    const hut = (x0, z0, x1, z1, open) => {
      const t = 0.15;
      if (open !== 'N') bx(l, x0, z0, x1, z0 + t, 1.5, 'padding_squares'); if (open !== 'S') bx(l, x0, z1 - t, x1, z1, 1.5, 'padding_squares');
      if (open !== 'W') bx(l, x0, z0, x0 + t, z1, 1.5, 'padding_squares'); if (open !== 'E') bx(l, x1 - t, z0, x1, z1, 1.5, 'padding_squares');
      bx(l, x0, z0, x1, z1, 0.15, 'slide_blue', 1.5, { y0: y + 1.5, y1: y + 1.65 });
    };
    hut(16, 28.2, 20, 32, 'E'); hut(22.5, 14.1, 26.5, 17, 'S');
    // foam pillars and a climbing wall
    for (const [x, z] of [[16.5, 14.5], [22, 19.5], [30, 24.5], [34, 24], [20, 26], [27, 17.5], [30.5, 32]]) bx(l, x - 0.4, z - 0.4, x + 0.4, z + 0.4, 2.6, 'slide_red');
    bx(l, 14.2, 21, 14.9, 29, 2.6, 'padding_squares'); bx(l, 15, 20.8, 17, 21.2, 1.6, 'slide_blue');
    put('slide', l, { x: 33.9, z: 24.5 }); solid(l, 33.9, 24.5, 0.4, 2.0, 1.9);
  }
  function ballPit() {
    const l = '2', y = Y(l);
    const rim = 0.6, x0 = 38, x1 = 46.4, z0 = 17.2, z1 = 24;
    const gaps = { N: [40, 42], S: [41, 43.5] };
    const seg = (a, b, c, d, mat) => bx(l, a, c, b, d, rim, mat);
    seg(x0, gaps.N[0], z0 - 0.2, z0, 'padding_squares'); seg(gaps.N[1], x1, z0 - 0.2, z0, 'padding_squares');
    seg(x0, gaps.S[0], z1, z1 + 0.2, 'padding_squares'); seg(gaps.S[1], x1, z1, z1 + 0.2, 'padding_squares');
    bx(l, x0 - 0.2, z0, x0, z1, rim, 'padding_purple'); bx(l, x1, z0, x1 + 0.2, z1, rim, 'padding_purple');
    const cols = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xff7eb6];
    const balls = []; let s = 5;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 520; i++) balls.push({ x: x0 + rnd() * (x1 - x0), y: y + 0.09 + rnd() * 0.12, z: z0 + rnd() * (z1 - z0), color: cols[i % 6] });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), balls.length);
    const o = new THREE.Object3D(), c = new THREE.Color();
    balls.forEach((b, i) => { o.position.set(b.x, b.y, b.z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(b.color)); });
    im.computeBoundingSphere(); im.userData.optional = true; w.optional.push(im); w.group(l).add(im);
    bunch(l, 38.5, 14.5, 0.9);
  }
  function hidingSpots() {
    // visible markers are the furniture itself (tables, desks, lockers, huts); the list drives AI/gameplay later
    w.hiding = HIDING.map((h, i) => ({ id: i, ...h, y: Y(h.level) }));
  }
  function cameras() {
    w.cameraPoints = CAMERAS.map((c, i) => ({ id: i, ...c }));
    for (const c of CAMERAS) {
      const y = Y(c.level) + c.y;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.34), getMaterial('panel_concrete'));
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), getBasic(0x111111)); lens.rotation.x = Math.PI / 2; lens.position.z = 0.18;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), getBasic(0xff2a2a)); led.position.set(0.07, 0.06, 0.15);
      g.add(body, lens, led); g.position.set(c.x, y, c.z); g.rotation.y = c.yaw; w.group(c.level).add(g);
    }
  }
}
