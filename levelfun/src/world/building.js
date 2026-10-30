import * as THREE from '../three.js';
import { AREAS, OPENINGS, PASSAGES, SPIRAL, LEVELS, LEVEL_Y, CEIL, BALLPIT, areaById } from './layout.js';
import { getMaterial } from '../assets/registry.js';
import { cloneModel, hasModel, instanceModel } from '../assets/models.js';
import { World, subtractRects } from './builder.js';
import { doubleSidedModel } from './doorleaf.js';
import { buildPassages, passageHoles } from './passages.js';
import { furnish } from './furnish.js';

const WALL_T = 0.1;
const DOOR_TOP = 2.25;

const MOODS = {
  warm:   { color: 0xffe2b0, intensity: 28, distance: 15, flicker: 0.08 },
  cold:   { color: 0xd4e4ff, intensity: 28, distance: 15, flicker: 0.2 },
  dim:    { color: 0xffd2a0, intensity: 18, distance: 13, flicker: 0.3 },
  dark:   { color: 0xffc890, intensity: 10, distance: 12, flicker: 0.6 },
  arcade: { color: 0xc8a0ff, intensity: 24, distance: 15, flicker: 0.15 },
  red:    { color: 0xff8466, intensity: 18, distance: 13, flicker: 0.25 },
};

class Door {
  constructor(world, o) {
    this.world = world; this.o = o; this.openT = 0; this.target = 0; this.locked = false; this.rattle = 0;
    const L = o.b - o.a, isX = o.axis === 'x';
    const y0 = LEVEL_Y[o.level];
    this.pivot = new THREE.Group();
    this.pivot.position.set(isX ? o.a : o.c, y0, isX ? o.c : o.a);
    this.base = isX ? 0 : -Math.PI / 2;
    this.pivot.rotation.y = this.base;
    // every door uses the supplied metal door model; the security room's heavy door is the double door with windows
    const heavy = o.kind === 'heavy', key = heavy ? 'door_heavy' : 'door';
    let leaf;
    if (hasModel(key)) {
      leaf = doubleSidedModel(key, L / (heavy ? 2.1 : 1.04), heavy ? 1.1 : 1.07, heavy ? 0.2 : 0.133);
      leaf.position.set(L / 2, 0, 0);
    } else {
      leaf = new THREE.Mesh(new THREE.BoxGeometry(L, 2.15, 0.07), getMaterial('tile_metal'));
      leaf.position.set(L / 2, 1.075, 0);
    }
    leaf.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.pivot.add(leaf);
    world.group(o.level).add(this.pivot);
    this.box = isX
      ? world.collision.add(o.a, o.c - 0.06, o.b, o.c + 0.06, y0, y0 + 2.15)
      : world.collision.add(o.c - 0.06, o.a, o.c + 0.06, o.b, y0, y0 + 2.15);
    world.interactable({
      x: isX ? (o.a + o.b) / 2 : o.c, y: y0 + 1.1, z: isX ? o.c : (o.a + o.b) / 2, radius: 2.2, kind: 'door',
      onUse: () => { if (this.toggle()) { if (this.o.kind === 'heavy') world.fixtures.heavyDoor?.(); world.noises?.push({ x: this.o.axis === 'x' ? (this.o.a + this.o.b) / 2 : this.o.c, y: y0, z: this.o.axis === 'x' ? this.o.c : (this.o.a + this.o.b) / 2, loud: this.o.kind === 'heavy' ? 1 : 0.3, src: 'door', t: -99 }); } },
    });
  }
  toggle(quiet) { if (this.locked) { this.rattle = 0.5; this.world.fixtures.onLocked?.(); return false; } this.target = this.target ? 0 : 1; return true; }
  update(dt) {
    if (this.rattle > 0) { this.rattle = Math.max(0, this.rattle - dt); this.pivot.rotation.y = this.base + Math.sin(this.rattle * 60) * 0.03 * (this.rattle / 0.5); if (!this.rattle) this.pivot.rotation.y = this.base; }
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
  const wellL = spiralHoles();
  const floorHoles = { B: [], 1: [...wellL], 2: [...wellL], 3: [...wellL] };
  const ceilHoles = { B: [...wellL], 1: [...wellL], 2: [...wellL], 3: [] };
  const ph = passageHoles();
  floorHoles['2'].push([BALLPIT.cx - BALLPIT.half, BALLPIT.cz - BALLPIT.half, BALLPIT.cx + BALLPIT.half, BALLPIT.cz + BALLPIT.half]);   // sunken ball pit
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
    w.flat(a.rect, y0, a.level === 'B' ? [...floorHoles.B, ...wellL] : floorHoles[a.level], a.id);   // no walking under the low treads

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
  buildSpiral(w);

  // ---------- secret passages ----------
  w.passages = buildPassages(w);

  // ---------- furniture, props, hiding spots, cameras ----------
  furnish(w);

  w.finalize();
  return w;
}

// Opening for the spiral: a disc (stepped into 0.2 m strips) without the landing quarter (x > cx, z < cz).
function spiralHoles() {
  const { cx, cz, holeR: R } = SPIRAL, step = 0.2, out = [];
  for (let x0 = cx - R; x0 < cx + R - 1e-6; x0 += step) {
    const x1 = x0 + step, xe = Math.max(Math.abs(x0 - cx), Math.abs(x1 - cx)), ze = Math.sqrt(Math.max(0, R * R - xe * xe));
    if (ze < 0.05) continue;
    out.push(x0 >= cx - 1e-6 ? [x0, cz, x1, cz + ze] : [x0, cz - ze, x1, cz + ze]);
  }
  return out;
}

// Three stacked flights of the spiral staircase (Basement->1, 1->2, 2->3) sharing one centre column.
function buildSpiral(w) {
  const { cx, cz, rise, treads, a0, da, half, walkIn, walkOut } = SPIRAL;
  LEVELS.slice(0, -1).forEach((id, k) => {
    const yb = LEVEL_Y[id], g = 'S' + k;
    instanceModel(w.group(g), 'spiral', [{ x: cx, y: yb, z: cz }]);
    w.spiral({ cx, cz, y0: yb, rIn: walkIn, rOut: walkOut, treads, a0, da, rise });
    w.collision.add(cx - 0.2, cz - 0.2, cx + 0.2, cz + 0.2, yb, yb + rise + 1.2);   // centre column
    // close the hollow between this level's ceiling and the next floor around the stairwell (otherwise you look into a black void)
    const y0 = yb + CEIL - 0.05, y1 = yb + rise + 0.05, R = SPIRAL.holeR;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, y1 - y0, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x57524b, roughness: 1, side: THREE.DoubleSide }));
    tube.position.set(cx, (y0 + y1) / 2, cz); w.group(g).add(tube);
  });
}
