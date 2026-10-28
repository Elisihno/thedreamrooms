// Browser-side walkability check: flood-fills the real collision + floor surfaces the way the player moves.
// Usage (in a page with window.LF): const { reach } = await import('/levelfun/tools/reach.js'); reach(LF.world, {x,z,y})
import { AREAS, LEVEL_Y } from '../src/world/layout.js';

export function reach(world, start, { step = 0.3, r = 0.28, h = 0.8, openDoors = true } = {}) {
  if (openDoors) for (const d of world.doors) { d.target = 1; d.openT = 1; d.box.enabled = false; }
  const col = world.collision;
  const key = (x, z, y) => Math.round(x / step) + ',' + Math.round(z / step) + ',' + Math.round(y * 2);
  const seen = new Map(), queue = [[start.x, start.z, world.floorAt(start.x, start.z, start.y + 0.2)]];
  seen.set(key(queue[0][0], queue[0][1], queue[0][2]), queue[0]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, z, y] = queue[qi];
    for (const [dx, dz] of dirs) {
      const nx = x + dx * step, nz = z + dz * step;
      const ny = world.floorAt(nx, nz, y, true);          // strict: no floor under the player = blocked
      if (ny === null || Math.abs(ny - y) > 0.65) continue;
      if (col.overlaps(nx, nz, r, ny + 0.15, ny + h)) continue;
      const k = key(nx, nz, ny);
      if (seen.has(k)) continue;
      const s = [nx, nz, ny]; seen.set(k, s); queue.push(s);
    }
  }
  const pts = [...seen.values()];
  const areas = {};
  for (const a of AREAS) {
    const y = LEVEL_Y[a.level], [x0, z0, x1, z1] = a.rect;
    areas[a.level + ':' + a.id] = pts.some(p => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1 && Math.abs(p[2] - y) < 0.7);
  }
  return { cells: pts.length, areas, pts };
}
