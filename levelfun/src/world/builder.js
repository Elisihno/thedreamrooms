import * as THREE from '../three.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';
import { getMaterial, getBasic } from '../assets/registry.js';
import { TILE } from '../assets/manifest.js';
import { LEVEL_Y, LEVELS, CEIL } from './layout.js';

const geoCache = new Map();

// Box whose UVs are scaled to world units so any texture tiles at `tile` metres.
function worldBox(w, h, d, tile) {
  const k = [w, h, d, tile].map(v => +v.toFixed(4)).join('|');
  if (geoCache.has(k)) return geoCache.get(k);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  geoCache.set(k, g);
  return g;
}

// Rectangles [x0,z0,x1,z1] minus holes.
export function subtractRects(rect, holes) {
  let pieces = [rect];
  for (const h of holes) {
    const next = [];
    for (const p of pieces) {
      if (h[0] >= p[2] || h[2] <= p[0] || h[1] >= p[3] || h[3] <= p[1]) { next.push(p); continue; }
      if (h[0] > p[0]) next.push([p[0], p[1], h[0], p[3]]);
      if (h[2] < p[2]) next.push([h[2], p[1], p[2], p[3]]);
      const x0 = Math.max(p[0], h[0]), x1 = Math.min(p[2], h[2]);
      if (h[1] > p[1]) next.push([x0, p[1], x1, h[1]]);
      if (h[3] < p[3]) next.push([x0, h[3], x1, p[3]]);
    }
    pieces = next;
  }
  return pieces.filter(p => p[2] - p[0] > 0.005 && p[3] - p[1] > 0.005);
}

const STEP_TOL = 0.55;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.collision = new CollisionWorld();
    this.levels = {};
    this.always = new THREE.Group();     // geometry outside any level (the east maintenance shaft)
    this.always.visible = false;
    scene.add(this.always);
    this.surfaces = [];
    this.lightDefs = [];
    this.doors = [];
    this.interactables = [];
    this.batches = new Map();
    this.passages = [];
    this.optional = [];     // decorative meshes hidden on Low graphics
    this.fixtures = {};
    this.balloons = [];   // poppable balloons: { key, meshes[], index, x, y, z, r, popped }
    this.ranges = {};   // group id -> [minY, maxY] of player feet for which the group is drawn
    for (const id of LEVELS) {
      const g = new THREE.Group(); g.name = 'level-' + id; this.levels[id] = g; scene.add(g);
      this.ranges[id] = [LEVEL_Y[id] - 1.2, LEVEL_Y[id] + CEIL + 0.3];
    }
    LEVELS.slice(0, -1).forEach((id, k) => {          // stair flights between level k and k+1
      const g = new THREE.Group(); g.name = 'stairs-' + k; this.levels['S' + k] = g; scene.add(g);
      this.ranges['S' + k] = [LEVEL_Y[id] - 0.9, LEVEL_Y[LEVELS[k + 1]] + 2.6];
    });
  }

  group(level) { return level === 'always' ? this.always : this.levels[level]; }

  // Static axis-aligned box; batched per (level, material) and merged in finalize().
  box({ level, x, y, z, w, h, d, mat, tile, collide = true, y0, y1, cast = true, receive = true, basic = false }) {
    const key = `${level}|${mat}|${cast ? 1 : 0}${receive ? 1 : 0}${basic ? 'b' : ''}|${Math.floor(x / 16)},${Math.floor(z / 14)}`;
    let b = this.batches.get(key);
    if (!b) this.batches.set(key, b = { level, mat, cast, receive, basic, geos: [] });
    b.geos.push(worldBox(w, h, d, tile ?? TILE[mat] ?? 2.5).clone().translate(x, y, z));
    if (collide) return this.collision.add(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y0 ?? y - h / 2, y1 ?? y + h / 2);
    return null;
  }

  // Box described by its min corner and size (often easier to author).
  block(level, x0, z0, x1, z1, yBottom, yTop, mat, o = {}) {
    return this.box({ level, x: (x0 + x1) / 2, y: (yBottom + yTop) / 2, z: (z0 + z1) / 2, w: x1 - x0, h: yTop - yBottom, d: z1 - z0, mat, ...o });
  }

  // A flat slab (floor or ceiling) of a rect minus holes. `top` is the upper surface height.
  slab(level, rect, top, thick, mat, holes = [], o = {}) {
    for (const p of subtractRects(rect, holes)) this.block(level, p[0], p[1], p[2], p[3], top - thick, top, mat, { collide: false, ...o });
  }

  finalize() {
    for (const b of this.batches.values()) {
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos, false);
      const mesh = new THREE.Mesh(merged, b.basic ? getBasic(b.mat) : getMaterial(b.mat));
      mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
      this.group(b.level).add(mesh);
      b.geos.length = 0;
    }
    this.batches.clear();
  }

  // ---- walkable surfaces (floors, ramps) ----
  flat(rect, y, holes = [], tag) { const s = { type: 'flat', rect, y, holes, enabled: true, tag }; this.surfaces.push(s); return s; }
  ramp(rect, axis, h0, h1, tag) { const s = { type: 'ramp', rect, axis, h0, h1, enabled: true, tag }; this.surfaces.push(s); return s; }
  // Spiral flight: treads wind around (cx, cz); tread i (0-based) is a flat step at y0 + (i + 1) * rise / treads.
  spiral(p) { const s = { type: 'spiral', rect: [p.cx - p.rOut, p.cz - p.rOut, p.cx + p.rOut, p.cz + p.rOut], ...p, enabled: true }; this.surfaces.push(s); return s; }

  // Height of the highest enabled surface at (x,z) not more than a step above `y`.
  // With strict = true, returns null where there is no surface at all (a hole), so movement can be blocked.
  floorAt(x, z, y, strict = false) {
    let best = -Infinity;
    for (const s of this.surfaces) {
      if (!s.enabled) continue;
      const r = s.rect;
      if (x < r[0] || x > r[2] || z < r[1] || z > r[3]) continue;
      let h;
      if (s.type === 'flat') {
        h = s.y;
        if (h > y + STEP_TOL || h <= best) continue;
        let inHole = false;
        for (const q of s.holes) if (x > q[0] && x < q[2] && z > q[1] && z < q[3]) { inHole = true; break; }
        if (inHole) continue;
      } else if (s.type === 'ramp') {
        const t = s.axis === 'x' ? (x - r[0]) / (r[2] - r[0]) : (z - r[1]) / (r[3] - r[1]);
        h = s.h0 + (s.h1 - s.h0) * t;
        if (h > y + STEP_TOL || h <= best) continue;
      } else {   // spiral
        const dx = x - s.cx, dz = z - s.cz, rad = Math.hypot(dx, dz);
        if (rad < s.rIn || rad > s.rOut) continue;
        const P = 360 / Math.abs(s.da);
        let t = (Math.atan2(dz, dx) * 180 / Math.PI - s.a0) / s.da;
        t = ((t % P) + P) % P;
        if (t > P - 0.5) t -= P;
        const i = Math.floor(t + 0.5);
        if (i < 0 || i >= s.treads) continue;
        h = s.y0 + (i + 1) * s.rise / s.treads;
        if (h > y + STEP_TOL || h <= best) continue;
      }
      best = h;
    }
    if (best === -Infinity) return strict ? null : y;
    return best;
  }

  // ---- lights (shared pool, see lightpool.js) ----
  light({ level, x, y, z, color = 0xffd9a0, intensity = 12, distance = 14, flicker = 0, lamp = true }) {
    this.lightDefs.push({ level, x, y, z, color, intensity, distance, flicker });
    if (lamp) this.box({ level, x, y: y + 0.17, z, w: 0.7, h: 0.06, d: 0.25, mat: color, basic: true, collide: false, cast: false, receive: false });
  }

  interactable(o) { this.interactables.push(o); return o; }

  update(dt) {
    for (const d of this.doors) d.update(dt);
  }

  // Show only the groups near the player's height (plus the shaft when beside it).
  updateVisibility(px, py) {
    for (const id in this.ranges) this.levels[id].visible = py > this.ranges[id][0] && py < this.ranges[id][1];
    this.always.visible = px > 58.8;
  }
}
