import * as THREE from '../three.js';
import { CollisionWorld } from './collision.js';
import { getMaterial } from '../assets/registry.js';
import { Flicker } from './lighting.js';

const geoCache = new Map();

// Box whose UVs are scaled to world units so any texture tiles at `tile` metres.
function worldBox(w, h, d, tile) {
  const k = [w, h, d, tile].join('|');
  if (geoCache.has(k)) return geoCache.get(k);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  geoCache.set(k, g);
  return g;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.collision = new CollisionWorld();
    this.lights = [];
    this.flickers = [];
    this.ramps = [];
  }

  box({ x, y, z, w, h, d, mat, tile = 2, collide = true, y0, y1, cast = true, receive = true }) {
    const m = new THREE.Mesh(worldBox(w, h, d, tile), getMaterial(mat));
    m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = receive;
    this.scene.add(m);
    if (collide) this.collision.add(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y0 ?? y - h / 2, y1 ?? y + h / 2);
    return m;
  }

  // Straight wall with openings: [[from, to, topHeight], ...] in the wall's own axis coordinates.
  wall(axis, c, a, b, { openings = [], thick = 0.2, height = 3, mat = 'wallpaper_main' } = {}) {
    const seg = (s0, s1, y0, y1) => {
      if (s1 - s0 < 0.01) return;
      const len = s1 - s0, mid = (s0 + s1) / 2, h = y1 - y0;
      this.box(axis === 'x'
        ? { x: mid, y: y0 + h / 2, z: c, w: len, h, d: thick, mat }
        : { x: c, y: y0 + h / 2, z: mid, w: thick, h, d: len, mat });
    };
    let cur = a;
    for (const [o0, o1, top] of [...openings].sort((p, q) => p[0] - q[0])) {
      seg(cur, o0, 0, height);
      if (top < height) seg(o0, o1, top, height);
      cur = o1;
    }
    seg(cur, b, 0, height);
  }

  room({ x0, x1, z0, z1, h = 3, floor = 'carpet_party', ceil = 'ceiling_tiles' }) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.box({ x: cx, y: -0.05, z: cz, w, h: 0.1, d, mat: floor, collide: false, cast: false });
    this.box({ x: cx, y: h + 0.05, z: cz, w, h: 0.1, d, mat: ceil, collide: false, cast: false });
  }

  // A ramp/stairs surface the player walks up. axis 'x': rises along +x from h0 to h1.
  ramp({ x0, x1, z0, z1, h0, h1, axis = 'x' }) { this.ramps.push({ x0, x1, z0, z1, h0, h1, axis }); }

  floorAt(x, z) {
    let best = 0;
    for (const r of this.ramps) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const t = r.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
      const h = r.h0 + (r.h1 - r.h0) * t;
      if (h > best) best = h;
    }
    return best;
  }

  light({ x, y, z, color = 0xffd9a0, intensity = 12, distance = 14, flicker = false, shadow = false, lamp = true }) {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    l.userData.shadowCapable = shadow;
    this.scene.add(l);
    this.lights.push(l);
    if (flicker) this.flickers.push(new Flicker(l, { chance: typeof flicker === 'number' ? flicker : 0.12 }));
    if (lamp) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.2), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y + 0.2, z);
      this.scene.add(m);
    }
    return l;
  }

  update(dt) { for (const f of this.flickers) f.update(dt); }
}
