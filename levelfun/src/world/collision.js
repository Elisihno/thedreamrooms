// 2D (XZ) axis-aligned boxes with a vertical span. A circle (the player/Smiley) collides with a
// box only when their vertical spans overlap, which is what lets the player crouch under tables.
const CELL = 4;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
    this.stamp = 0;
  }

  add(minX, minZ, maxX, maxZ, y0, y1) {
    const b = { minX, minZ, maxX, maxZ, y0, y1, seen: 0 };
    this.boxes.push(b);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = cx + ',' + cz;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, a = []);
        a.push(b);
      }
    }
    return b;
  }

  near(x, z, r) {
    const out = [];
    const s = ++this.stamp;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const a = this.grid.get(cx + ',' + cz);
        if (!a) continue;
        for (const b of a) if (b.seen !== s) { b.seen = s; out.push(b); }
      }
    }
    return out;
  }

  overlaps(x, z, r, y0, y1) {
    for (const b of this.near(x, z, r)) {
      if (b.y1 <= y0 || b.y0 >= y1) continue;
      const dx = x - Math.min(Math.max(x, b.minX), b.maxX);
      const dz = z - Math.min(Math.max(z, b.minZ), b.maxZ);
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  resolve(p, r, y0, y1) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const b of this.near(p.x, p.z, r)) {
        if (b.y1 <= y0 || b.y0 >= y1) continue;
        const cx = Math.min(Math.max(p.x, b.minX), b.maxX);
        const cz = Math.min(Math.max(p.z, b.minZ), b.maxZ);
        const dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        moved = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), k = (r - d) / d;
          p.x += dx * k; p.z += dz * k;
        } else {
          const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
          const m = Math.min(l, rr, t, bt);
          if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r;
          else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
        }
      }
      if (!moved) break;
    }
  }

  // Moves p (with .x/.z) by (dx,dz) in small steps, sliding along boxes.
  move(p, dx, dz, r, y0, y1) {
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / 0.1));
    for (let i = 0; i < steps; i++) {
      p.x += dx / steps; p.z += dz / steps;
      this.resolve(p, r, y0, y1);
    }
  }
}
