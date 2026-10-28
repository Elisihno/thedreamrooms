// LEVEL FUN building layout: pure data (no three.js) so tools/tests can validate it.
// Units: metres. x east, z south, y up. Each level is 4 m floor to floor with 2.9 m rooms,
// leaving a 0.9 m crawl gap (plenum) between floors that the secret passages use.

export const FLOOR_H = 4;
export const CEIL = 2.9;
export const LEVELS = ['B', '1', '2', '3'];
export const LEVEL_Y = { B: -4, 1: 0, 2: 4, 3: 8 };
export const LEVEL_NAME = { B: 'Basement', 1: 'Floor 1', 2: 'Floor 2', 3: 'Floor 3' };

// Central spiral staircase (the supplied cast-iron model), one flight per level at the same x/z.
// Each flight has 17 treads and rises FLOOR_H. Treads wind clockwise (angle decreases with height, measured
// atan2(z, x)); the quarter of the circle with no treads (x > cx, z < cz) is a landing floor on every level.
export const SPIRAL = {
  cx: 18, cz: 4, rise: 4, treads: 17,
  a0: -97.05, da: -16.43, half: 8.2,      // tread 0 centre angle, angle per tread, half-width (degrees)
  walkIn: 0.46, walkOut: 1.08,            // radii the player's centre may use (rail at 1.35, column at 0.25)
  holeR: 1.4,                             // radius of the opening cut in floors and ceilings
};
export const STAIR = { x0: SPIRAL.cx - SPIRAL.holeR, x1: SPIRAL.cx + SPIRAL.holeR, z0: SPIRAL.cz - SPIRAL.holeR, z1: SPIRAL.cz + SPIRAL.holeR };

// Rooms (counted) and corridors/halls (not counted). rect = [x0, z0, x1, z1].
// floor/wall = material keys (see assets/manifest.js).
const R = (level, id, name, rect, floor, wall, opts = {}) => ({ level, id, name, rect, floor, wall, room: opts.room !== false, mood: opts.mood || 'warm', ...opts });

export const AREAS = [
  // ---------- Floor 1: Party Floor (9 rooms) ----------
  R('1', 'reception', 'Reception', [0, 0, 12, 12], 'carpet_confetti', 'wallpaper_balloons', { mood: 'warm' }),
  R('1', 'hall', 'Main Party Hall', [12, 0, 36, 16], 'carpet_confetti', 'wallpaper_balloons', { mood: 'warm', lights: 4 }),
  R('1', 'kitchen', 'Kitchen', [36, 0, 48, 12], 'checker_red', 'tile_beige', { mood: 'cold' }),
  R('1', 'prep', 'Party Preparation Room', [48, 0, 60, 12], 'carpet_confetti', 'wallpaper_stripes', { mood: 'warm' }),
  R('1', 'exitroom', 'Emergency Exit Room', [0, 12, 12, 22], 'concrete_mid', 'paint_yellow', { mood: 'red' }),
  R('1', 'dining', 'Dining Room', [12, 16, 36, 30], 'carpet_confetti', 'wallpaper_balloons', { mood: 'warm', lights: 4 }),
  R('1', 'c1', 'Corridor', [36, 12, 60, 16], 'tile_beige', 'wallpaper_stripes', { room: false, mood: 'dim' }),
  R('1', 'c3', 'Corridor', [36, 16, 39, 26], 'tile_beige', 'wallpaper_stripes', { room: false, mood: 'dim' }),
  R('1', 'bath', 'Bathrooms', [39, 16, 48, 26], 'tile_metal', 'wall_cream_blue', { mood: 'cold' }),
  R('1', 'security', 'Security Room', [48, 16, 60, 26], 'rubber_studs', 'panel_concrete', { mood: 'cold' }),
  R('1', 'c2', 'Corridor', [36, 26, 48, 33], 'tile_beige', 'wallpaper_stripes', { room: false, mood: 'dim' }),
  R('1', 'supply', 'Supply Closet', [48, 26, 60, 33], 'concrete_mid', 'concrete_mid', { mood: 'dim' }),

  // ---------- Floor 2: Entertainment Floor (8 rooms) ----------
  R('2', 'partya', 'Party Room A', [0, 0, 12, 10], 'carpet_confetti', 'wallpaper_clouds', { mood: 'warm' }),
  R('2', 'landing', 'Landing', [12, 0, 24, 10], 'carpet_arcade', 'wallpaper_stripes', { room: false, mood: 'warm' }),
  R('2', 'arcade', 'Arcade', [24, 0, 48, 10], 'carpet_arcade', 'padding_purple', { mood: 'arcade', lights: 4 }),
  R('2', 'prize', 'Prize Counter', [48, 0, 60, 10], 'carpet_confetti', 'wallpaper_balloons', { mood: 'warm' }),
  R('2', 'c', 'Corridor', [0, 10, 60, 13], 'carpet_arcade', 'wallpaper_stripes', { room: false, mood: 'dim', lights: 5 }),
  R('2', 'partyb', 'Party Room B', [0, 13, 14, 25], 'carpet_confetti', 'wallpaper_stripes', { mood: 'warm' }),
  R('2', 'playground', 'Indoor Playground', [14, 13, 36, 33], 'foam_puzzle', 'padding_squares', { mood: 'warm', lights: 5 }),
  R('2', 'ballpit', 'Ball Pit', [36, 13, 48, 25], 'foam_puzzle', 'padding_squares', { mood: 'warm' }),
  R('2', 'storage2', 'Storage Closet', [48, 13, 60, 19], 'concrete_mid', 'concrete_mid', { mood: 'dim' }),
  R('2', 'service', 'Service Corridor', [48, 19, 60, 23], 'rubber_studs', 'panel_concrete', { mood: 'cold' }),

  // ---------- Floor 3: Abandoned Floor (7 rooms), darker ----------
  R('3', 'staff', 'Staff Office', [0, 0, 12, 12], 'concrete_mid', 'wall_cream_blue', { mood: 'dark' }),
  R('3', 'celeb', 'Abandoned Celebration Hall', [12, 0, 36, 16], 'tile_beige', 'wallpaper_stripes', { mood: 'dark', lights: 4 }),
  R('3', 'archives', 'Surveillance Archives', [36, 0, 48, 6], 'tile_metal', 'concrete_mid', { mood: 'dark' }),
  R('3', 'mcorr', 'Maintenance Corridor', [36, 6, 48, 9], 'concrete_dark', 'panel_concrete', { room: false, mood: 'dark' }),
  R('3', 'storage3', 'Storage Room', [36, 9, 48, 19], 'diamond_plate', 'concrete_mid', { mood: 'dark' }),
  R('3', 'maintoffice', 'Maintenance Office', [48, 4, 60, 14], 'rubber_studs', 'wall_green_peel', { mood: 'dark' }),
  R('3', 'elevroom', 'Elevator Room', [48, 14, 60, 24], 'diamond_plate', 'panel_concrete', { mood: 'dark' }),
  R('3', 'birthday', 'Birthday Chamber', [12, 16, 36, 30], 'carpet_confetti', 'wallpaper_balloons', { mood: 'dark', lights: 3 }),

  // ---------- Basement: Maintenance Level (5 rooms) ----------
  R('B', 'bhall', 'Basement Hall', [12, 0, 36, 8], 'concrete_dark', 'panel_concrete', { room: false, mood: 'cold', lights: 3 }),
  R('B', 'generator', 'Generator Room', [12, 8, 36, 22], 'concrete_dark', 'panel_concrete', { mood: 'cold', lights: 4 }),
  R('B', 'electrical', 'Electrical Room', [0, 0, 12, 12], 'rubber_studs', 'wall_green_peel', { mood: 'cold' }),
  R('B', 'mstorage', 'Maintenance Storage', [36, 0, 48, 12], 'diamond_plate', 'concrete_mid', { mood: 'dim' }),
  R('B', 'boiler', 'Boiler Room', [48, 0, 60, 14], 'concrete_dark', 'panel_concrete', { mood: 'red' }),
  R('B', 'bc1', 'Corridor', [36, 12, 48, 17], 'concrete_dark', 'panel_concrete', { room: false, mood: 'dim' }),
  R('B', 'bc2', 'Corridor', [48, 14, 60, 17], 'concrete_dark', 'panel_concrete', { room: false, mood: 'dim' }),
  R('B', 'records', 'Hidden Records Room', [0, 14, 12, 26], 'concrete_mid', 'wall_cream_blue2', { mood: 'dark' }),
];

// Openings in walls. axis 'x': wall runs along x at z=c. axis 'z': wall runs along z at x=c.
// kind: 'door' (1.2 m, swinging), 'heavy' (security/exit door), 'arch' (open doorway), 'wide' (large opening).
const D = (level, axis, c, a, b, kind = 'door', style = 'red') => ({ level, axis, c, a, b, kind, style });
export const OPENINGS = [
  // Floor 1
  D('1', 'z', 12, 4, 8, 'arch'),                 // Reception <-> Main Party Hall
  D('1', 'x', 12, 5.4, 6.6, 'door', 'red'),      // Reception <-> Emergency Exit Room
  D('1', 'z', 36, 3.4, 4.6, 'door', 'blue'),     // Main Party Hall <-> Kitchen
  D('1', 'x', 16, 20, 28, 'wide'),               // Main Party Hall <-> Dining Room (wide opening)
  D('1', 'z', 36, 12.5, 15.5, 'arch'),           // Main Party Hall <-> Corridor
  D('1', 'x', 12, 53.4, 54.6, 'door', 'blue'),   // Corridor <-> Party Preparation Room
  D('1', 'x', 16, 36.4, 38.6, 'arch'),           // Corridor <-> Corridor (south)
  D('1', 'z', 39, 20, 21.2, 'door', 'blue'),     // Corridor <-> Bathrooms
  D('1', 'x', 16, 53.35, 55.45, 'heavy', 'metal'), // Corridor <-> Security Room (turning handle)
  D('1', 'z', 36, 21.4, 22.6, 'door', 'red'),    // Dining Room <-> Corridor
  D('1', 'x', 26, 36.4, 38.6, 'arch'),           // Corridor <-> Corridor (far south)
  D('1', 'z', 36, 27, 29.4, 'arch'),             // Dining Room <-> Corridor (far south)
  D('1', 'z', 48, 29, 30.2, 'door', 'metal'),    // Corridor <-> Supply Closet
  D('1', 'z', 12, 18, 19.2, 'door', 'red'),      // Emergency Exit Room <-> Dining Room
  // Floor 2
  D('2', 'x', 10, 5.4, 6.6, 'door', 'red'),      // Party Room A <-> Corridor
  D('2', 'z', 12, 4.4, 5.6, 'door', 'red'),      // Party Room A <-> Landing
  D('2', 'z', 24, 3, 7, 'wide'),                 // Landing <-> Arcade
  D('2', 'x', 10, 14, 22, 'wide'),               // Landing <-> Corridor
  D('2', 'x', 10, 34, 37, 'wide'),               // Arcade <-> Corridor
  D('2', 'z', 48, 4, 5.2, 'door', 'blue'),       // Arcade <-> Prize Counter
  D('2', 'x', 10, 53.4, 54.6, 'door', 'blue'),   // Prize Counter <-> Corridor
  D('2', 'x', 13, 6.4, 7.6, 'door', 'red'),      // Corridor <-> Party Room B
  D('2', 'x', 13, 22, 28, 'wide'),               // Corridor <-> Indoor Playground
  D('2', 'x', 13, 41.4, 42.6, 'door', 'red'),    // Corridor <-> Ball Pit
  D('2', 'x', 13, 53.4, 54.6, 'door', 'metal'),  // Corridor <-> Storage Closet
  D('2', 'z', 48, 20, 21.2, 'door', 'metal'),    // Ball Pit <-> Service Corridor
  D('2', 'x', 19, 53, 54.2, 'door', 'metal'),    // Storage Closet <-> Service Corridor
  D('2', 'z', 36, 20, 22.4, 'arch'),             // Indoor Playground <-> Ball Pit
  D('2', 'z', 14, 18, 19.2, 'door', 'red'),      // Party Room B <-> Indoor Playground
  // Floor 3
  D('3', 'z', 12, 5, 6.2, 'door', 'metal'),      // Celebration Hall <-> Staff Office
  D('3', 'z', 36, 6.4, 8.6, 'arch'),             // Celebration Hall <-> Maintenance Corridor
  D('3', 'x', 6, 40, 41.2, 'door', 'metal'),     // Maintenance Corridor <-> Surveillance Archives
  D('3', 'x', 9, 40, 41.2, 'door', 'metal'),     // Maintenance Corridor <-> Storage Room
  D('3', 'z', 48, 6.4, 7.6, 'door', 'metal'),    // Maintenance Corridor <-> Maintenance Office
  D('3', 'x', 14, 53, 54.2, 'door', 'metal'),    // Maintenance Office <-> Elevator Room
  D('3', 'x', 16, 22, 23.2, 'door', 'red'),      // Celebration Hall <-> Birthday Chamber
  // Basement
  D('B', 'x', 8, 20, 28, 'wide'),                // Basement Hall <-> Generator Room
  D('B', 'z', 12, 3, 4.2, 'door', 'metal'),      // Basement Hall <-> Electrical Room
  D('B', 'z', 36, 3.4, 4.6, 'door', 'metal'),    // Basement Hall <-> Maintenance Storage
  D('B', 'z', 36, 13, 16, 'arch'),               // Generator Room <-> Corridor
  D('B', 'z', 12, 16, 17.2, 'door', 'metal'),    // Generator Room <-> Hidden Records Room
  D('B', 'z', 48, 5, 6.2, 'door', 'metal'),      // Maintenance Storage <-> Boiler Room
  D('B', 'x', 12, 41, 42.2, 'door', 'metal'),    // Maintenance Storage <-> Corridor
  D('B', 'x', 14, 53, 54.2, 'door', 'metal'),    // Boiler Room <-> Corridor
  D('B', 'z', 48, 14.2, 16.8, 'arch'),           // Corridor <-> Corridor (east)
];

// Exactly 21 dedicated hiding spots (Floor 1: 8, Floor 2: 5, Floor 3: 6, Basement: 2). No spot in the Security Room.
const H = (level, room, kind, x, z) => ({ level, room, kind, x, z });
export const HIDING = [
  H('1', 'dining', 'table', 22, 19.5), H('1', 'dining', 'table', 22, 23), H('1', 'dining', 'table', 22, 26.5),
  H('1', 'kitchen', 'table', 41.5, 5.5), H('1', 'reception', 'table', 3.2, 2.8),
  H('1', 'hall', 'table', 28, 11), H('1', 'bath', 'stall', 45.17, 16.9), H('1', 'prep', 'workbench', 51, 9.6),
  H('2', 'playground', 'tunnel', 20, 20), H('2', 'playground', 'tunnel', 27, 26),
  H('2', 'playground', 'tunnel', 31, 17.5), H('2', 'playground', 'nook', 18, 30), H('2', 'playground', 'nook', 24, 15.5),
  H('3', 'staff', 'locker', 1.2, 3), H('3', 'staff', 'table', 9, 9.1), H('3', 'archives', 'locker', 46.6, 2),
  H('3', 'storage3', 'locker', 37, 12), H('3', 'birthday', 'table', 24, 23), H('3', 'celeb', 'locker', 34.5, 2),
  H('B', 'electrical', 'workbench', 6, 9), H('B', 'mstorage', 'workbench', 38, 8.5),
];

// Exactly 9 security cameras (Floor 1: 4, Floor 2: 3, Floor 3: 2). Viewed only from the Security Room.
const C = (level, room, name, x, y, z, yaw) => ({ level, room, name, x, y, z, yaw });
export const CAMERAS = [
  C('1', 'hall', 'Main Party Hall', 34.6, 2.6, 1, 2.4), C('1', 'reception', 'Reception', 11.6, 2.6, 1, 2.4),
  C('1', 'dining', 'Dining Room', 34.6, 2.6, 28.8, -2.4), C('1', 'kitchen', 'Kitchen', 47.4, 2.6, 1, 2.4),
  C('2', 'arcade', 'Arcade', 47.4, 2.6, 1, 2.4), C('2', 'ballpit', 'Ball Pit', 47.4, 2.6, 14, 2.4),
  C('2', 'playground', 'Indoor Playground', 35.4, 2.6, 14, 2.4),
  C('3', 'celeb', 'Abandoned Celebration Hall', 35.4, 2.6, 1, 2.4), C('3', 'mcorr', 'Maintenance Corridor', 47.4, 2.6, 6.4, 2.4),
];

// Six secret passages. `upper` hatch in a floor, crawl through the gap between floors, `lower` ladder
// to the room below. Smiley cannot use them. #5 is the vertical maintenance shaft on the east side.
export const PASSAGES = [
  { id: 1, name: 'Ball Pit - Dining Room', requires: null,
    upper: { level: '2', x: 46, z: 14.4, dir: 'W' }, crawl: [[35.2, 14.4], [35.2, 17]], lower: { level: '1', x: 35.3, z: 17, dir: 'S' } },
  { id: 2, name: 'Kitchen - Maintenance Storage', requires: 'valve_wheel',
    upper: { level: '1', x: 46.4, z: 10.6, dir: 'W' }, crawl: [[43, 10.6]], lower: { level: 'B', x: 43, z: 10.6, dir: 'W' } },
  { id: 3, name: 'Indoor Playground - Supply Closet', requires: null,
    upper: { level: '2', x: 35, z: 31.8, dir: 'N' }, crawl: [[35, 28.8], [58.8, 28.8]], lower: { level: '1', x: 58.8, z: 28.8, dir: 'S' } },
  { id: 4, name: 'Storage Room - Service Corridor', requires: null,
    upper: { level: '3', x: 46.2, z: 17.4, dir: 'E' }, crawl: [[54, 17.4], [54, 22.1]], lower: { level: '2', x: 54, z: 22.1, dir: 'W' } },
  { id: 5, name: 'Maintenance Office - Boiler Room (shaft)', requires: 'maintenance_key', shaft: { x0: 60.1, x1: 61.6, zTop: 6.2, zBottom: 12.6, openTop: [5.4, 7], openBottom: [11.6, 13.2] } },
  { id: 6, name: 'Party Room B - Staff Office', requires: null,
    upper: { level: '3', x: 0.9, z: 9, dir: 'S' }, crawl: [[0.9, 14]], lower: { level: '2', x: 0.9, z: 14, dir: 'S' } },
];

// Escape-route fixtures (positions only; behaviour comes in Stage 5).
export const FIXTURES = {
  exitDoor: { level: '1', x: 0.15, z: 17, room: 'exitroom' },
  generator: { level: 'B', x: 24, z: 17, room: 'generator' },
  elevator: { level: '3', x: 59.9, z: 11, room: 'maintoffice' },
  securityDesk: { level: '1', x: 59, z: 20, room: 'security' },
  zapperBench: { level: '1', x: 56, z: 2, room: 'prep' },
  prizeCounter: { level: '2', x: 54, z: 1.2, room: 'prize' },
};

export const START = { level: '1', x: 22, z: 23, yaw: -Math.PI / 2 };

export function areaById(level, id) { return AREAS.find(a => a.level === level && a.id === id); }
