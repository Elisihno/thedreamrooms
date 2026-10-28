import * as THREE from '../three.js';
import { AREAS, OPENINGS, PASSAGES, STAIR, LEVELS, LEVEL_Y, CEIL, areaById } from './layout.js';
import { getMaterial } from '../assets/registry.js';
import { cloneModel, hasModel } from '../assets/models.js';
import { World, subtractRects } from './builder.js';
import { buildPassages, passageHoles } from './passages.js';
import { furnish } from './furnish.js';

const WALL_T = 0.1;
const DOOR_TOP = 2.25;
const DOOR_MAT = { red: 'slide_red', blue: 'slide_blue', metal: 'tile_metal' };

const MOODS = {
  warm:   { color: 0xffe2b0, intensity: 28, distance: 15, flicker: 0.08 },
  cold:   { color: 0xd4e4ff, intensity: 20, distance: 14, flicker: 0.2 },
  dim:    { color: 0xffd2a0, intensity: 14, distance: 12, flicker: 0.3 },
  dark:   { color: 0xffc890, intensity: 10, distance: 12, flicker: 0.6 },
  arcade: { color: 0xc8a0ff, intensity: 24, distance: 15, flicker: 0.15 },
  red:    { color: 0xff8466, intensity: 18, distance: 13, flicker: 0.25 },
};

class Door {
  constructor(world, o) {
    this.world = world; this.o = o; this.openT = 0; this.target = 0; this.locked = false;
    const L = o.b - o.a, isX = o.axis === 'x';
    const y0 = LEVEL_Y[o.level];
    this.pivot = new THREE.Group();
    this.pivot.position.set(isX ? o.a : o.c, y0, isX ? o.c : o.a);
    this.base = isX ? 0 : -Math.PI / 2;
    this.pivot.rotation.y = this.base;
    let leaf;
    if (o.kind === 'heavy' && hasModel('door')) {
      leaf = cloneModel('door');
      leaf.scale.set(L / 1.04, 1, 1.1);
      leaf.position.set(L / 2, 0, 0);
    } else {
      leaf = new THREE.Mesh(new THREE.BoxGeometry(L, 2.15, 0.07), getMaterial(DOOR_MAT[o.style] || 'slide_red'));
      leaf.position.set(L / 2, 1.075, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.14), getMaterial('diamond_plate'));
      handle.position.set(L - 0.15, 1.0, 0); leaf.add(handle);
    }
    leaf.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.pivot.add(leaf);
    world.group(o.level).add(this.pivot);
    this.box = isX
      ? world.collision.add(o.a, o.c - 0.06, o.b, o.c + 0.06, y0, y0 + 2.15)
      : world.collision.add(o.c - 0.06, o.a, o.c + 0.06, o.b, y0, y0 + 2.15);
    world.interactable({
      x: isX ? (o.a + o.b) / 2 : o.c, y: y0 + 1.1, z: isX ? o.c : (o.a + o.b) / 2, radius: 2.2, kind: 'door',
      onUse: () => this.toggle(),
    });
  }
  toggle() { if (this.locked) return false; this.target = this.target ? 0 : 1; return true; }
  update(dt) {
    if (this.openT === this.target) return;
    const s = dt * 2.2;
    this.openT = this.target > this.openT ? Math.min(this.target, this.openT + s) : Math.max(this.target, this.openT - s);
    this.pivot.rotation.y = this.base + this.openT * 1.55 * (this.o.axis === 'x' ? -1 : 1);
    this.box.enabled = this.openT < 0.3;
  }
}

export function buildBuilding(scene) {
  const w = new World(scene);

  // ---------- holes in floors and ceilings (stairwell, hatches, ladder shafts) ----------
  const S = STAIR;
  const stairFoot = [S.x0, S.z0, S.x1, S.z1];
  const floorHoles = { B: [], 1: [[S.runX0, S.lane1[0], S.runX1, S.lane1[1]]], 2: [stairFoot], 3: [stairFoot] };
  const ceilHoles = { B: [stairFoot], 1: [stairFoot], 2: [stairFoot], 3: [] };
  const ph = passageHoles();
  for (const l of LEVELS) { floorHoles[l].push(...(ph.floor[l] || [])); ceilHoles[l].push(...(ph.ceil[l] || [])); }

  // ---------- shells: floors, ceilings, walls ----------
  const shaftOpenings = PASSAGES.filter(p => p.shaft).flatMap(p => [
    { level: '3', axis: 'z', c: 60, a: p.shaft.openTop[0], b: p.shaft.openTop[1], kind: 'cover' },
    { level: 'B', axis: 'z', c: 60, a: p.shaft.openBottom[0], b: p.shaft.openBottom[1], kind: 'cover' },
  ]);
  const openings = [...OPENINGS, ...shaftOpenings];

  for (const a of AREAS) {
    const y0 = LEVEL_Y[a.level], [x0, z0, x1, z1] = a.rect;
    w.slab(a.level, a.rect, y0, 0.2, a.floor, floorHoles[a.level], { cast: false });
    w.slab(a.level, a.rect, y0 + CEIL + 0.1, 0.2, a.level === '3' ? 'concrete_dark' : 'ceiling', ceilHoles[a.level], { cast: false });
    w.flat(a.rect, y0, floorHoles[a.level], a.id);

    const edges = [
      { axis: 'x', c: z0, a: x0, b: x1, off: WALL_T / 2 },     // north edge, wall inside = +z
      { axis: 'x', c: z1, a: x0, b: x1, off: -WALL_T / 2 },    // south edge
      { axis: 'z', c: x0, a: z0, b: z1, off: WALL_T / 2 },     // west edge
      { axis: 'z', c: x1, a: z0, b: z1, off: -WALL_T / 2 },    // east edge
    ];
    for (const e of edges) {
      const ops = openings.filter(o => o.level === a.level && o.axis === e.axis && Math.abs(o.c - e.c) < 1e-6 && o.b > e.a && o.a < e.b).sort((p, q) => p.a - q.a);
      const seg = (s0, s1, yb, yt) => {
        if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
        if (e.axis === 'x') w.block(a.level, s0, e.c + e.off - WALL_T / 2, s1, e.c + e.off + WALL_T / 2, y0 + yb, y0 + yt, a.wall);
        else w.block(a.level, e.c + e.off - WALL_T / 2, s0, e.c + e.off + WALL_T / 2, s1, y0 + yb, y0 + yt, a.wall);
      };
      let cur = e.a;
      for (const o of ops) {
        seg(cur, o.a, 0, CEIL);
        if (o.kind !== 'wide') seg(o.a, o.b, DOOR_TOP, CEIL); else seg(o.a, o.b, 2.5, CEIL);
        cur = Math.max(cur, o.b);
      }
      seg(cur, e.b, 0, CEIL);
    }

    // ceiling lights
    const mood = MOODS[a.mood] || MOODS.warm;
    const wd = x1 - x0, dp = z1 - z0;
    const n = a.lights || Math.max(1, Math.min(3, Math.round(wd * dp / 70)));
    const pts = [];
    const f = (t, lo, hi) => lo + (hi - lo) * t;
    if (n === 1) pts.push([0.5, 0.5]);
    else if (n === 2) pts.push(wd >= dp ? [0.27, 0.5] : [0.5, 0.27], wd >= dp ? [0.73, 0.5] : [0.5, 0.73]);
    else if (n === 3) for (const t of [1 / 6, 0.5, 5 / 6]) pts.push(wd >= dp ? [t, 0.5] : [0.5, t]);
    else if (n === 4) pts.push([0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]);
    else pts.push([0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8], [0.5, 0.5]);
    if (a.id === 'c') { pts.length = 0; for (let i = 0; i < 5; i++) pts.push([(i + 0.5) / 5, 0.5]); }
    const per = mood.intensity * (n > 3 ? 0.8 : 1);
    for (const [u, v] of pts) w.light({ level: a.level, x: f(u, x0, x1), y: y0 + CEIL - 0.2, z: f(v, z0, z1), color: mood.color, intensity: per, distance: mood.distance, flicker: mood.flicker });
  }

  // ---------- doors ----------
  for (const o of OPENINGS) if (o.kind === 'door' || o.kind === 'heavy') w.doors.push(new Door(w, o));

  // ---------- stairs ----------
  buildStairs(w);

  // ---------- secret passages ----------
  w.passages = buildPassages(w);

  // ---------- furniture, props, hiding spots, cameras ----------
  furnish(w);

  w.finalize();
  return w;
}

// Two-lane open staircase on every level; same footprint everywhere.
function buildStairs(w) {
  const S = STAIR;
  const lane0 = [S.runX0, S.lane0[0], S.runX1, S.lane0[1]], lane1 = [S.runX0, S.lane1[0], S.runX1, S.lane1[1]];
  const landing = [S.landing[0], S.lane0[0], S.landing[1], S.lane1[1]];
  const steps = 10;

  // flight: rect, axis x, heights at x=runX0 (h0) and x=runX1 (h1)
  function flight(g, rect, h0, h1, ground) {
    w.ramp(rect, 'x', h0, h1, 'stairs');
    const run = rect[2] - rect[0], dz = rect[3] - rect[1];
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps, h = h0 + (h1 - h0) * t, x = rect[0] + run * i / steps;
      w.block(g, x, rect[1], x + run / steps, rect[3], h - 0.16, h, 'diamond_plate', { collide: false });
    }
    // side rails (visual) and collision walls
    const lo = Math.min(h0, h1), hi = Math.max(h0, h1);
    for (const zEdge of [rect[1] - 0.05, rect[3] + 0.05]) {
      w.collision.add(rect[0], zEdge - 0.05, rect[2], zEdge + 0.05, lo - 0.3, hi + 1.3);
      for (let i = 0; i < steps; i += 2) {   // low railing panels that follow the slope
        const x = rect[0] + run * i / steps, hSeg = Math.min(h0 + (h1 - h0) * i / steps, h0 + (h1 - h0) * (i + 2) / steps);
        w.block(g, x, zEdge - 0.03, x + run * 2 / steps, zEdge + 0.03, hSeg - 0.05, hSeg + 1.05, 'chainlink', { collide: false });
      }
    }
    // blocks the space under the flight where headroom is too low
    for (let i = 0; i < steps; i++) {
      const hLow = Math.min(h0 + (h1 - h0) * i / steps, h0 + (h1 - h0) * (i + 1) / steps);
      if (hLow - ground > 1.9 || hLow - 0.3 <= ground) continue;
      const x = rect[0] + run * i / steps;
      w.collision.add(x, rect[1], x + run / steps, rect[3], ground, hLow - 0.3);
    }
  }
  function landingAt(g, y) {
    w.flat(landing, y, [], 'landing');
    w.block(g, landing[0], landing[1], landing[2], landing[3], y - 0.2, y, 'diamond_plate', { collide: false });
    w.block(g, landing[2] - 0.05, landing[1], landing[2] + 0.05, landing[3], y - 0.3, y + 1.3, 'chainlink', { collide: false }); w.collision.add(landing[2] - 0.05, landing[1], landing[2] + 0.05, landing[3], y - 0.3, y + 1.3);
    for (const zEdge of [landing[1] - 0.05, landing[3] + 0.05]) { w.block(g, landing[0], zEdge - 0.05, landing[2], zEdge + 0.05, y, y + 1.1, 'chainlink', { collide: false }); w.collision.add(landing[0], zEdge - 0.05, landing[2], zEdge + 0.05, y - 0.3, y + 1.3); }
  }
  const gId = k => 'S' + k;

  // Climbing flights from level k to k+1 (levels 1->2, 2->3) and the descending pair 1 -> basement.
  [['1', 1], ['2', 2]].forEach(([lvl, k]) => {
    const y0 = LEVEL_Y[lvl], g = gId(k);
    flight(g, lane0, y0, y0 + 2, y0);
    landingAt(g, y0 + 2);
    flight(g, lane1, y0 + 4, y0 + 2, y0 + 0);
    // railing between the lanes
    w.block(g, lane0[0], S.lane0[1], lane0[2], S.lane1[0], y0, y0 + 4 + 1.0, 'chainlink', { collide: false });
  });
  // down to basement (stair group S0)
  flight(gId(0), lane1, 0, -2, -4);
  landingAt(gId(0), -2);
  flight(gId(0), lane0, -4, -2, -4);
  w.block(gId(0), lane0[0], S.lane0[1], lane0[2], S.lane1[0], -4, 1, 'chainlink', { collide: false });

  // guards around the open stairwell edge on floors 2 and 3
  for (const lvl of ['2', '3']) {
    const y = LEVEL_Y[lvl], g = lvl;
    w.block(g, S.x0, S.z0 - 0.05, S.x1, S.z0, y, y + 1.1, 'chainlink', { collide: false }); w.collision.add(S.x0, S.z0 - 0.05, S.x1, S.z0, y, y + 1.2);
    w.block(g, S.x0, S.z1, S.x1, S.z1 + 0.05, y, y + 1.1, 'chainlink', { collide: false }); w.collision.add(S.x0, S.z1, S.x1, S.z1 + 0.05, y, y + 1.2);
    w.block(g, S.x1, S.z0, S.x1 + 0.05, S.z1, y, y + 1.1, 'chainlink', { collide: false }); w.collision.add(S.x1, S.z0, S.x1 + 0.05, S.z1, y, y + 1.2);
  }
  // floor 1: guard where the descending flight begins beside the climbing one is the divider above.
}
