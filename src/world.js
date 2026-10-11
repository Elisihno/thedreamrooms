import * as THREE from 'three';
import { walls, doors, rooms, stairs, furniture, items, KEYS, ly, LH, groundY } from './layout.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function scaledBox(w, h, d, mat, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
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
      const m = scaledBox(w.w, w.h, w.d, this.mat(w.tex));
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
    for (const d of doors) {
      const door = { ...d, open: false, angle: 0, target: 0, unlocked: !d.key };
      const pivot = new THREE.Group();
      const h = 2.1;
      const leaf = scaledBox(d.w - 0.04, h, 0.08, this.mat('vert'), 1.5);
      leaf.position.set(d.w / 2, h / 2, 0);
      leaf.userData.ref = { type: 'door', door };
      pivot.add(leaf);
      const hinge = d.c - d.w / 2;
      if (d.axis === 'x') pivot.position.set(hinge, ly(d.level), d.fixed);
      else pivot.position.set(d.fixed, ly(d.level), hinge);
      door.pivot = pivot;
      door.closedRot = d.axis === 'x' ? 0 : -Math.PI / 2;
      pivot.rotation.y = door.closedRot;
      this.scene.add(pivot);
      this.interactables.push(leaf);
      this.blockers.push(leaf);
      door.cx = d.axis === 'x' ? d.c : d.fixed;
      door.cz = d.axis === 'x' ? d.fixed : d.c;
      door.collider = {
        kind: 'door', door,
        x: door.cx, z: door.cz,
        w: d.axis === 'x' ? d.w : 0.14, d: d.axis === 'x' ? 0.14 : d.w,
        y0: ly(d.level), h,
      };
      this.colliders.push(door.collider);
      this.doors.push(door);
    }
  }

  buildFurniture() {
    for (const f of furniture) {
      const m = scaledBox(f.w, f.h, f.d, this.mat('darkwood'), 1.5);
      m.material = m.material.clone();
      m.material.color.set(f.color);
      m.position.set(f.x, ly(f.level) + f.elev + f.h / 2, f.z);
      this.scene.add(m);
      this.blockers.push(m);
      const col = { kind: 'furn', x: f.x, z: f.z, w: f.w, d: f.d, y0: ly(f.level) + f.elev, h: f.h };
      this.colliders.push(col);
      if (f.hide) {
        const hide = { type: 'hide', x: f.x, z: f.z, level: f.level, exit: f.hide.exit, label: f.label, col, w: f.w, d: f.d };
        m.userData.ref = hide;
        this.interactables.push(m);
        this.hides.push(hide);
        // a dark door-line so hiding spots read as wardrobes
        const dir = f.hide.exit;
        const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.04, f.h * 0.85), new THREE.MeshBasicMaterial({ color: 0x0c0806 }));
        slit.position.set(f.x + dir[0] * (f.w / 2 + 0.01) * (dir[0] ? 1 : 0), ly(f.level) + f.h / 2, f.z + dir[1] * (f.d / 2 + 0.01));
        if (dir[0]) { slit.position.x = f.x + dir[0] * (f.w / 2 + 0.01); slit.rotation.y = dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else if (dir[1] < 0) slit.rotation.y = Math.PI;
        this.scene.add(slit);
      }
    }
  }

  buildItems() {
    for (const it of items) {
      const g = new THREE.Group();
      if (it.kind === 'key') {
        const col = KEYS[it.id].color;
        const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.55 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), mat);
        ring.position.y = 0.12;
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), mat);
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), mat);
        tooth.position.set(0.04, -0.07, 0);
        g.add(ring, shaft, tooth);
        g.userData.label = KEYS[it.id].label;
      } else {
        const mat = new THREE.MeshLambertMaterial({ color: 0x7aa0b8 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
        body.scale.y = 1.3;
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.12, 8), mat);
        neck.position.y = 0.19;
        g.add(body, neck);
        g.userData.label = 'Vase';
      }
      g.position.set(it.x, ly(it.level) + it.y + 0.15, it.z);
      g.scale.setScalar(1.4);
      const pickup = { type: 'pickup', item: it, group: g, taken: false, baseY: g.position.y };
      // invisible, generous hit-box for aiming
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(g.position);
      hit.userData.ref = pickup;
      pickup.hit = hit;
      this.scene.add(g, hit);
      this.interactables.push(hit);
      this.pickups.push(pickup);
    }
  }

  buildExterior() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x151d14 });
    const quad = (x0, z0, x1, z1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
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
      p.group.position.y = p.baseY + Math.sin(time * 2 + p.baseY) * 0.03;
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
