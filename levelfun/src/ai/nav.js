import { AREAS, LEVEL_Y, SPIRAL } from '../world/layout.js';

// Walking-grid pathfinding for Smiley. The grid is evaluated lazily from the same collision and floor data the player walks on,
// so Smiley can only go where a standing person can go: through doors (he opens them), up and down the spiral staircase,
// never into crawl tunnels, hatches or secret passages (they are too low for a 1.95 m creature).
const STEP = 0.25, RADIUS = 0.3, HEIGHT = 1.95, MAXSTEP = 0.45;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Nav {
  constructor(world) {
    this.world = world; this.col = world.collision; this.memo = new Map();
    this.doorBoxes = new Map(); for (const d of world.doors) this.doorBoxes.set(d.box, d);
    this.stairs = { x: SPIRAL.cx, z: SPIRAL.cz };
  }

  doorBlocks(b) { const d = this.doorBoxes.get(b); return !!d && d.locked; }   // closed doors can be opened; locked ones cannot
  blocked(x, z, y) {
    for (const b of this.col.near(x, z, RADIUS)) {
      if (b.y1 <= y + 0.2 || b.y0 >= y + HEIGHT) continue;
      if (this.doorBoxes.has(b) && !this.doorBlocks(b)) continue;
      const dx = x - Math.min(Math.max(x, b.minX), b.maxX), dz = z - Math.min(Math.max(z, b.minZ), b.maxZ);
      if (dx * dx + dz * dz < RADIUS * RADIUS) return true;
    }
    return false;
  }
  key(ix, iz, y) { return ix + ',' + iz + ',' + Math.round(y / 0.6); }
  // Height of the floor at a grid cell reachable from height `y`, or null when the cell cannot be walked on.
  cell(ix, iz, yFrom) {
    const x = ix * STEP, z = iz * STEP, f = this.world.floorAt(x, z, yFrom + MAXSTEP, true);
    if (f === null || f < yFrom - 0.9) return null;
    if (Math.abs(x - this.stairs.x) < 2.3 && Math.abs(z - this.stairs.z) < 2.3) {   // around the stairwell keep clear of the edge so he never hugs the lip (less on the narrow treads)
      const flat = Object.values(LEVEL_Y).some(ly => Math.abs(f - ly) < 0.02);
      // flat floor close to the opening is only used on the landing side (x > centre, z < centre): everywhere else it is the lip
      if (flat && Math.hypot(x - this.stairs.x, z - this.stairs.z) < 1.75 && !(x >= this.stairs.x - 0.1 && z <= this.stairs.z + 0.05)) return null;
      const d = flat ? 0.2 : 0.04;
      for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4 + 0.29, ox = Math.cos(ang) * d, oz = Math.sin(ang) * d; const g = this.world.floorAt(x + ox, z + oz, yFrom + MAXSTEP, true); if (g === null || Math.abs(g - f) > 0.5) return null; }
    }
    return this.blocked(x, z, f) ? null : f;
  }
  // Nearest walkable cell to a point (spiral outward).
  snap(x, z, y) {
    const ix0 = Math.round(x / STEP), iz0 = Math.round(z / STEP);
    for (let r = 0; r <= 8; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const f = this.cell(ix0 + dx, iz0 + dz, y); if (f !== null && Math.abs(f - y) < 1.0) return { ix: ix0 + dx, iz: iz0 + dz, y: f };
    }
    return null;
  }
  areaAt(x, z, y) {
    let lv = 'B', best = 1e9; for (const l of Object.keys(LEVEL_Y)) if (Math.abs(LEVEL_Y[l] - y) < best) { best = Math.abs(LEVEL_Y[l] - y); lv = l; }
    return AREAS.find(a => a.level === lv && x >= a.rect[0] && x <= a.rect[2] && z >= a.rect[1] && z <= a.rect[3]) || null;
  }

  // A* from (sx, sz, sy) to (gx, gz, gy). Returns [{x, z, y}] or null.
  path(sx, sz, sy, gx, gz, gy, maxNodes = 9000) {
    const s = this.snap(sx, sz, sy), g = this.snap(gx, gz, gy); if (!s || !g) return null;
    const open = new Map(), closed = new Set(), nodes = [];   // simple binary-heap-free A*: open list scanned via a heap array
    const heap = []; const push = n => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const goalX = g.ix * STEP, goalZ = g.iz * STEP, sameFloor = Math.abs(s.y - g.y) < 1.5;
    const h = (x, z, y) => {
      const d = Math.hypot(goalX - x, goalZ - z);
      if (Math.abs(y - g.y) < 1.5) return d;   // already on the goal's floor
      return Math.hypot(this.stairs.x - x, this.stairs.z - z) + Math.hypot(goalX - this.stairs.x, goalZ - this.stairs.z) + Math.abs(y - g.y) * 1.2;   // different floors: head for the staircase
    };
    const W = sameFloor ? 1.2 : 2.2;   // weighted A*: a little greedy for speed (paths stay close to shortest)
    const start = { ix: s.ix, iz: s.iz, y: s.y, g: 0, f: h(s.ix * STEP, s.iz * STEP, s.y), parent: null };
    const best = new Map([[this.key(s.ix, s.iz, s.y), 0]]); push(start);
    let goal = null, expanded = 0, nearest = start;
    while (heap.length && expanded < maxNodes) {
      const n = pop(); const k = this.key(n.ix, n.iz, n.y);
      if (closed.has(k)) continue; closed.add(k); expanded++;
      if (n.ix === g.ix && n.iz === g.iz && Math.abs(n.y - g.y) < 0.9) { goal = n; break; }
      if (h(n.ix * STEP, n.iz * STEP, n.y) < h(nearest.ix * STEP, nearest.iz * STEP, nearest.y)) nearest = n;
      for (const [dx, dz] of DIRS) {
        const ix = n.ix + dx, iz = n.iz + dz, f = this.cell(ix, iz, n.y);
        if (f === null || Math.abs(f - n.y) > MAXSTEP) continue;
        if (dx && dz && this.cell(n.ix + dx, n.iz, n.y) === null && this.cell(n.ix, n.iz + dz, n.y) === null) continue;   // diagonal needs at least one open side
        if (Math.abs(ix * STEP - this.stairs.x) < 3 && Math.abs(iz * STEP - this.stairs.z) < 3) {   // around the stairwell edge, check the ground between the two cells too
          let ok = true; for (const t of [0.25, 0.5, 0.75]) if (this.world.floorAt((n.ix + dx * t) * STEP, (n.iz + dz * t) * STEP, n.y + 0.45, true) === null) { ok = false; break; }
          if (!ok) continue;
        }
        const nk = this.key(ix, iz, f); if (closed.has(nk)) continue;
        const gc = n.g + (dx && dz ? 1.414 : 1) * STEP + Math.abs(f - n.y) * 0.5;
        if (best.has(nk) && best.get(nk) <= gc) continue; best.set(nk, gc);
        push({ ix, iz, y: f, g: gc, f: gc + W * h(ix * STEP, iz * STEP, f), parent: n });
      }
    }
    const end = goal || nearest; if (!end || end === start) return goal ? [{ x: g.ix * STEP, z: g.iz * STEP, y: g.y }] : null;
    const out = []; for (let n = end; n; n = n.parent) out.push({ x: n.ix * STEP, z: n.iz * STEP, y: n.y });
    out.reverse(); out.complete = !!goal; return this.simplify(out);
  }

  // Drops waypoints that lie on a straight, unobstructed line so Smiley walks smoothly.
  simplify(p) {
    if (p.length < 3) return p;
    const out = [p[0]]; let i = 0;
    while (i < p.length - 1) {
      let j = p.length - 1;
      for (; j > i + 1; j--) if (this.clear(p[i], p[j])) break;
      out.push(p[j]); i = j;
    }
    out.complete = p.complete; return out;
  }
  clear(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), near = Math.abs(a.x - this.stairs.x) < 3.5 && Math.abs(a.z - this.stairs.z) < 3.5, n = Math.ceil(d / (near ? 0.08 : 0.25));
    if (Math.abs(b.y - a.y) > 0.3) return false;   // stairs and ramps keep their cell-by-cell path
    for (let i = 1; i < n; i++) { const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; const f = this.world.floorAt(x, z, a.y + MAXSTEP, true); if (f === null || Math.abs(f - a.y) > 0.15 || this.blocked(x, z, f)) return false; }
    return true;
  }
}
