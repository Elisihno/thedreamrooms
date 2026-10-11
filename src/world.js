import * as THREE from 'three';
import { makeItemModel } from './models.js';
import { walls, doors, rooms, stairs, furniture, items, KEYS, ly, LH, groundY, T as T_WALL } from './layout.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// A box whose UVs repeat the texture every `tile` metres. `mat` can be one material or six (one per face:
// +x, -x, +y, -y, +z, -z). Wide tiles (plaster) keep their proportions.
function scaledBox(w, h, d, mat, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const m = Array.isArray(mat) ? mat[f] : mat;
    const aspect = m.userData?.aspect ?? 1;
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / (tile * aspect), (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return new THREE.Mesh(g, mat);
}

function subtract(r, h) {
  const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1);
  const iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
  if (ix0 >= ix1 || iz0 >= iz1) return [r];
  const out = [];
  if (r.z0 < iz0) out.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: iz0 });
  if (iz1 < r.z1) out.push({ x0: r.x0, z0: iz1, x1: r.x1, z1: r.z1 });
  if (r.x0 < ix0) out.push({ x0: r.x0, z0: iz0, x1: ix0, z1: iz1 });
  if (ix1 < r.x1) out.push({ x0: ix1, z0: iz0, x1: r.x1, z1: iz1 });
  return out;
}

export class World {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.colliders = []; // {x,z,w,d,y0,h,kind,door?}
    this.blockers = []; // meshes that block interaction rays
    this.interactables = []; // meshes with userData.ref
    this.doors = [];
    this.pickups = [];
    this.hides = [];
    this.noises = [];
    this.projectiles = [];
    this.build();
  }

  mat(name) { return this.mats[name] ?? this.mats.planks; }

  build() {
    const { scene } = this;
    // walls
    for (const w of walls) {
      let mat = this.mat(w.tex);
      if (w.axis) {
        // broad faces take the tile of the room they face: +z/-z for walls along x, +x/-x for walls along z
        const base = this.mat(w.tex), pos = this.mat(w.texPos), neg = this.mat(w.texNeg);
        mat = w.axis === 'x' ? [base, base, base, base, pos, neg] : [pos, neg, base, base, base, base];
      }
      const m = scaledBox(w.w, w.h, w.d, mat);
      m.position.set(w.x, w.y0 + w.h / 2, w.z);
      scene.add(m);
      this.blockers.push(m);
      this.colliders.push({ kind: 'wall', x: w.x, z: w.z, w: w.w, d: w.d, y0: w.y0, h: w.h });
    }
    this.buildSlabs();
    this.buildStairs();
    this.buildDoors();
    this.buildFurniture();
    this.buildItems();
    this.buildExterior();
  }

  buildSlabs() {
    const addPlane = (r, y, matName, up) => {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const g = new THREE.PlaneGeometry(w, d);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * d) / 2);
      const m = new THREE.Mesh(g, this.mat(matName));
      m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
      m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
      this.scene.add(m);
    };
    for (const room of rooms) {
      let floors = [room];
      let ceils = [room];
      for (const s of stairs) {
        const hole = { x0: s.x, z0: s.z, x1: s.x + s.w, z1: s.z + s.len };
        if (room.level === s.low + 1) floors = floors.flatMap((r) => subtract(r, hole));
        if (room.level === s.low) ceils = ceils.flatMap((r) => subtract(r, hole));
      }
      floors.forEach((r) => addPlane(r, ly(room.level), room.floor, true));
      ceils.forEach((r) => addPlane(r, ly(room.level) + LH, room.ceil, false));
    }
  }

  buildStairs() {
    const n = 12;
    for (const s of stairs) {
      const run = s.len / n;
      for (let i = 0; i < n; i++) {
        const top = ly(s.low) + ((i + 0.5) / n) * LH;
        const along = s.rise === 'S' ? s.z + (i + 0.5) * run : s.z + s.len - (i + 0.5) * run;
        const m = scaledBox(s.w, top - ly(s.low), run, this.mat('planks'));
        m.position.set(s.x + s.w / 2, ly(s.low) + (top - ly(s.low)) / 2, along);
        this.scene.add(m);
      }
    }
  }

  buildDoors() {
    const fw = 0.06; // door frame thickness
    const metal = new THREE.MeshPhongMaterial({ color: 0xb9bcc0, shininess: 70 });
    for (const d of doors) {
      const door = { ...d, open: false, angle: 0, target: 0, unlocked: !d.key };
      const base = ly(d.level);
      const alongX = d.axis === 'x';
      const clearH = 2.1;
      // the frame lines the doorway so the opening looks finished
      const frame = (w, h, x, y) => {
        const dim = alongX ? [w, h, T_WALL + 0.02] : [T_WALL + 0.02, h, w];
        const m = scaledBox(dim[0], dim[1], dim[2], this.mat('planks'), 1.5);
        m.position.set(alongX ? x : d.fixed, base + y, alongX ? d.fixed : x);
        this.scene.add(m);
      };
      frame(fw, clearH, d.c - d.w / 2 + fw / 2, clearH / 2);
      frame(fw, clearH, d.c + d.w / 2 - fw / 2, clearH / 2);
      frame(d.w - 2 * fw, fw, d.c, clearH - fw / 2);

      // the leaf: the wood texture is stretched once over the whole door (no repeating seam across it)
      const leafW = d.w - 2 * fw - 0.01, leafH = clearH - fw - 0.005;
      const pivot = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.07), this.mat('vert'));
      leaf.position.set(leafW / 2, leafH / 2, 0);
      leaf.userData.ref = { type: 'door', door };
      pivot.add(leaf);
      for (const side of [-1, 1]) {
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), metal);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(leafW - 0.1, 1.0, side * 0.06);
        pivot.add(knob);
      }
      const hinge = d.c - d.w / 2 + fw + 0.005;
      if (alongX) pivot.position.set(hinge, base, d.fixed);
      else pivot.position.set(d.fixed, base, hinge);
      door.pivot = pivot;
      door.closedRot = alongX ? 0 : -Math.PI / 2;
      pivot.rotation.y = door.closedRot;
      this.scene.add(pivot);
      this.interactables.push(leaf);
      this.blockers.push(leaf);
      door.cx = alongX ? d.c : d.fixed;
      door.cz = alongX ? d.fixed : d.c;
      door.collider = {
        kind: 'door', door,
        x: door.cx, z: door.cz,
        w: alongX ? d.w : 0.14, d: alongX ? 0.14 : d.w,
        y0: base, h: clearH,
      };
      this.colliders.push(door.collider);
      this.doors.push(door);
    }
  }

  buildFurniture() {
    for (const f of furniture) {
      const mat = this.mat(f.tex ?? 'planks');
      const base = ly(f.level) + f.elev;
      const parts = [];
      let col = { kind: 'furn', x: f.x, z: f.z, w: f.w, d: f.d, y0: base, h: f.h };
      if (f.table) {
        const top = scaledBox(f.w, 0.07, f.d, mat, 1.5);
        top.position.set(f.x, base + f.h - 0.035, f.z);
        parts.push(top);
        const lx = f.w / 2 - 0.08, lz = f.d / 2 - 0.08;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const leg = scaledBox(0.07, f.h - 0.07, 0.07, mat, 1.5);
          leg.position.set(f.x + sx * lx, base + (f.h - 0.07) / 2, f.z + sz * lz);
          parts.push(leg);
        }
        col = { ...col, y0: base + f.h - 0.1, h: 0.1 }; // the tabletop is what blocks you; you hide under it with [E]
      } else if (f.sink) {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.78, 14), mat);
        ped.position.set(f.x, base + 0.39, f.z);
        // a lathed basin: outer wall, rim, then the inner bowl
        const prof = [[0.07, 0.78], [0.2, 0.8], [0.27, 0.86], [0.27, 0.9], [0.245, 0.9], [0.235, 0.87], [0.17, 0.83], [0, 0.82]].map(([x, y]) => new THREE.Vector2(x, y));
        const basin = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), new THREE.MeshLambertMaterial({ map: mat.map, side: THREE.DoubleSide }));
        basin.position.set(f.x, base, f.z);
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 8), new THREE.MeshPhongMaterial({ color: 0xb8bcc2, shininess: 80 }));
        tap.position.set(f.x, base + 0.96, f.z - 0.2);
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 8), tap.material);
        spout.rotation.x = Math.PI / 2;
        spout.position.set(f.x, base + 1.02, f.z - 0.15);
        parts.push(ped, basin, tap, spout);
      } else {
        const box = scaledBox(f.w, f.h, f.d, mat, 1.5);
        box.position.set(f.x, base + f.h / 2, f.z);
        parts.push(box);
      }
      parts.forEach((m) => { this.scene.add(m); this.blockers.push(m); });
      this.colliders.push(col);
      if (f.hide) {
        const hide = { type: 'hide', x: f.x, z: f.z, level: f.level, exit: f.hide.exit, under: !!f.hide.under, label: f.label, col, w: f.w, d: f.d };
        parts.forEach((m) => { m.userData.ref = hide; this.interactables.push(m); });
        this.hides.push(hide);
        if (!f.hide.under) {
          // a dark door-line so wardrobes and cabinets read as hiding spots
          const dir = f.hide.exit;
          const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.04, f.h * 0.85), new THREE.MeshBasicMaterial({ color: 0x0c0c0e }));
          slit.position.set(f.x, base + f.h / 2, f.z + dir[1] * (f.d / 2 + 0.01));
          if (dir[0]) { slit.position.set(f.x + dir[0] * (f.w / 2 + 0.01), base + f.h / 2, f.z); slit.rotation.y = dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2; }
          else if (dir[1] < 0) slit.rotation.y = Math.PI;
          this.scene.add(slit);
        }
      }
    }
  }

  buildItems() {
    for (const it of items) {
      const g = new THREE.Group();
      const model = makeItemModel(it, KEYS);
      if (it.kind === 'key') {
        model.rotation.x = -Math.PI / 2; // lie flat on the surface
        model.scale.setScalar(0.85);
      }
      g.add(model);
      g.userData.label = it.kind === 'key' ? KEYS[it.id].label : 'Vase';
      const base = ly(it.level) + it.y - 0.05 + (it.kind === 'key' ? 0.022 : 0);
      g.position.set(it.x, base, it.z);
      const pickup = { type: 'pickup', item: it, group: g, taken: false, baseY: base, origin: { x: it.x, z: it.z, y: base, level: it.level } };
      // invisible, generous hit-box for aiming
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(it.x, base + 0.12, it.z);
      hit.userData.ref = pickup;
      pickup.hit = hit;
      this.scene.add(g, hit);
      this.interactables.push(hit);
      this.pickups.push(pickup);
    }
  }

  buildExterior() {
    const mat = this.mat('moss');
    const quad = (x0, z0, x1, z1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / 4, (uv.getY(i) * (z1 - z0)) / 4);
      const m = new THREE.Mesh(g, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, ly(1) - 0.02, (z0 + z1) / 2);
      this.scene.add(m);
    };
    quad(-80, -80, 0, 80); quad(20, -80, 100, 80);
    quad(0, -80, 20, 0); quad(0, 14, 20, 80);
    // a few dead trees for the escape view
    const trunk = new THREE.MeshLambertMaterial({ color: 0x1c1712 });
    for (let i = 0; i < 14; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 6, 6), trunk);
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 25;
      t.position.set(10 + Math.cos(a) * r, ly(1) + 3, 7 + Math.sin(a) * r);
      if (t.position.x > -2 && t.position.x < 22 && t.position.z > -2 && t.position.z < 16) continue;
      this.scene.add(t);
    }
  }

  // ---------- collision ----------
  collide(px, pz, feet, r) {
    for (const c of this.colliders) {
      if (c.door?.open) continue;
      if (!(feet + 0.35 < c.y0 + c.h && feet + 1.5 > c.y0)) continue;
      const cx = clamp(px, c.x - c.w / 2, c.x + c.w / 2);
      const cz = clamp(pz, c.z - c.d / 2, c.z + c.d / 2);
      const dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        px += (dx / d) * (r - d);
        pz += (dz / d) * (r - d);
      } else {
        const ox = c.w / 2 - Math.abs(px - c.x), oz = c.d / 2 - Math.abs(pz - c.z);
        if (ox < oz) px += (px >= c.x ? 1 : -1) * (ox + r);
        else pz += (pz >= c.z ? 1 : -1) * (oz + r);
      }
    }
    return [px, pz];
  }

  // Does a straight line at the given height band hit a wall or closed door?
  blocked(ax, az, bx, bz, y, ignoreDoors = false) {
    const lo = y + 0.7, hi = y + 1.5;
    for (const c of this.colliders) {
      if (c.kind === 'furn') continue;
      if (c.kind === 'door' && (ignoreDoors || c.door.open)) continue;
      if (!(c.y0 < hi && c.y0 + c.h > lo)) continue;
      if (segHitsRect(ax, az, bx, bz, c.x - c.w / 2, c.z - c.d / 2, c.x + c.w / 2, c.z + c.d / 2)) return true;
    }
    return false;
  }

  noise(x, y, z, radius) { this.noises.push({ x, y, z, radius }); }

  setDoor(door, open) {
    door.open = open;
    door.target = open ? 1 : 0;
  }

  update(dt, time, camPos) {
    for (const d of this.doors) {
      d.angle += (d.target - d.angle) * Math.min(1, dt * 7);
      d.pivot.rotation.y = d.closedRot + d.angle * 1.5 * d.swing;
    }
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.group.rotation.y = time * 1.4;
      p.group.position.y = p.baseY + Math.sin(time * 2 + p.baseY) * 0.012;
    }
    // thrown vases
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.vel.y -= 9.8 * dt;
      const nx = p.mesh.position.x + p.vel.x * dt;
      const nz = p.mesh.position.z + p.vel.z * dt;
      const ny = p.mesh.position.y + p.vel.y * dt;
      const floor = groundY(nx, nz, p.mesh.position.y);
      const hitWall = this.colliders.some(
        (c) => c.kind !== 'furn' && !c.door?.open && ny > c.y0 && ny < c.y0 + c.h &&
          Math.abs(nx - c.x) < c.w / 2 + 0.05 && Math.abs(nz - c.z) < c.d / 2 + 0.05,
      );
      if (ny <= floor + 0.1 || hitWall) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        p.onLand(p.mesh.position.x, Math.max(floor, p.mesh.position.y), p.mesh.position.z);
        continue;
      }
      p.mesh.position.set(nx, ny, nz);
      p.mesh.rotation.x += dt * 8;
    }
  }
}

function segHitsRect(ax, az, bx, bz, x0, z0, x1, z1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const test = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return test(-dx, ax - x0) && test(dx, x1 - ax) && test(-dz, az - z0) && test(dz, z1 - az);
}
