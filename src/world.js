import * as THREE from 'three';
import { makeItemModel } from './models.js';
import { walls, doors, rooms, stairs, furniture, items, containers, KEYS, TRASH, CRAWL, itemInfo, ly, LH, groundY, T as T_WALL } from './layout.js';

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
    this.containers = new Map(); // id -> container (boxes, drawer, safe, sealed box, locker)
    this.sauna = null;
    this.onEvent = null; // (type) => void, set by the game for things like the sauna heating up
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
    this.buildContainers();
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
      if (room.ceil) ceils.forEach((r) => addPlane(r, ly(room.level) + LH, room.ceil, false));
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
      const door = { ...d, open: false, angle: 0, target: 0, unlocked: d.keys.length === 0, lockMeshes: [], filled: new Set() };
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
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.07), this.mat(d.tex ?? 'vert'));
      leaf.position.set(leafW / 2, leafH / 2, 0);
      leaf.userData.ref = { type: 'door', door };
      pivot.add(leaf);
      for (const side of [-1, 1]) {
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), metal);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(leafW - 0.1, 1.0, side * 0.06);
        pivot.add(knob);
      }
      // a padlock on the door for each key it needs, on both faces; they come off when it is unlocked
      d.keys.forEach((k, i) => {
        const y = d.keys.length === 1 ? 1.25 : 0.95 + i * 0.32;
        for (const side of [-1, 1]) {
          const lock = new THREE.Group();
          const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.05), new THREE.MeshPhongMaterial({ color: KEYS[k].color, shininess: 60 }));
          const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 8, 14, Math.PI), new THREE.MeshPhongMaterial({ color: 0xc9ccd1, shininess: 80 }));
          shackle.position.y = 0.05;
          lock.add(bodyM, shackle);
          lock.position.set(leafW * 0.5, y, side * 0.06);
          pivot.add(lock);
          door.lockMeshes.push({ key: k, mesh: lock });
        }
      });
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
      } else if (f.shelf) {
        // a metal shelving unit: four posts and boards (a visual only; the whole footprint is one collider)
        const post = (px, pz) => { const m = scaledBox(0.05, f.h, 0.05, mat, 1); m.position.set(px, base + f.h / 2, pz); parts.push(m); };
        const hx = f.w / 2 - 0.03, hz = f.d / 2 - 0.03;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => post(f.x + sx * hx, f.z + sz * hz));
        [...f.boards, f.h - 0.03].forEach((bh) => { const b = scaledBox(f.w, 0.03, f.d, mat, 1); b.position.set(f.x, base + bh - 0.015, f.z); parts.push(b); });
      } else if (f.bin) {
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.21, f.h, 18, 1, true), new THREE.MeshLambertMaterial({ map: mat.map, side: THREE.DoubleSide }));
        can.position.set(f.x, base + f.h / 2, f.z);
        const floorD = new THREE.Mesh(new THREE.CircleGeometry(0.21, 18), new THREE.MeshBasicMaterial({ color: 0x0b0b0d }));
        floorD.rotation.x = -Math.PI / 2;
        floorD.position.set(f.x, base + 0.02, f.z);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 20), new THREE.MeshLambertMaterial({ map: mat.map }));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(f.x, base + f.h, f.z);
        parts.push(can, floorD, rim);
        const ref = { type: 'bin' };
        parts.forEach((m) => { m.userData.ref = ref; this.interactables.push(m); });
        col = { ...col, w: 0.55, d: 0.55 };
      } else if (f.heater) {
        const stove = scaledBox(f.w, f.h, f.d, mat, 1.5);
        stove.position.set(f.x, base + f.h / 2, f.z);
        // the glowing grate on the side facing the room, and a pile of hot stones on top
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x331208 });
        const grate = new THREE.Mesh(new THREE.PlaneGeometry(f.d * 0.7, f.h * 0.4), glowMat);
        grate.position.set(f.x - f.w / 2 - 0.006, base + f.h * 0.4, f.z);
        grate.rotation.y = -Math.PI / 2;
        const stones = new THREE.Group();
        for (let i = 0; i < 6; i++) {
          const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + (i % 3) * 0.015, 0), new THREE.MeshLambertMaterial({ color: 0x4a4744 }));
          s.position.set(f.x + (Math.random() - 0.5) * 0.4, base + f.h + 0.06, f.z + (Math.random() - 0.5) * 0.7);
          stones.add(s);
        }
        parts.push(stove, grate);
        this.scene.add(stones);
        this.buildSauna(f, base, glowMat);
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

  // The sauna: a stove that is cold until a vase goes in the trash can, then it glows, steams, lights the room
  // orange and, a few seconds later, drops a lockpick on the bench.
  buildSauna(f, base, glowMat) {
    const light = new THREE.PointLight(0xff7a2a, 0, 6, 1.6);
    light.position.set(f.x - 0.7, base + 1.5, f.z);
    this.scene.add(light);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const steam = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xe8e2da }));
      sp.scale.setScalar(0.7);
      sp.userData = { phase: Math.random(), ox: (Math.random() - 0.5) * 1.2, oz: (Math.random() - 0.5) * 2.2 };
      this.scene.add(sp);
      steam.push(sp);
    }
    this.sauna = { on: false, t: 0, revealed: false, glowMat, light, steam, x: f.x, z: f.z, base, h: f.h };
  }

  // Everything you can open: shelf boxes, the drawer, the safe, the sealed box and the locker.
  buildContainers() {
    const cardboard = this.mat('streak');
    const dark = new THREE.MeshLambertMaterial({ color: 0x1f1b17 }); // the inside of an open box
    const steel = (c) => new THREE.MeshPhongMaterial({ color: c, shininess: 45 });
    for (const c of containers) {
      const base = ly(c.level) + (c.y ?? 0);
      const root = new THREE.Group();
      root.position.set(c.x, base, c.z);
      root.rotation.y = Math.atan2(c.face[0], c.face[1]); // local +z points out of the front
      this.scene.add(root);
      const cont = { ...c, root, t: 0, target: 0, opened: false, type: 'container', oneWay: ['safe', 'locker', 'sealed', 'drawer'].includes(c.kind) || items.some((i) => i.inside === c.id) };
      const reg = (m) => { m.userData.ref = cont; this.interactables.push(m); this.blockers.push(m); return m; };
      // footprint in the world (width runs across the front, depth runs out of it)
      const alongX = c.face[0] === 0;
      const fp = { w: alongX ? c.w : c.d, d: alongX ? c.d : c.w };
      const solid = ['safe', 'locker', 'drawer'].includes(c.kind) || (c.kind === 'box' && c.y === 0);
      if (solid) this.colliders.push({ kind: 'furn', x: c.x, z: c.z, w: fp.w, d: fp.d, y0: base, h: c.h });

      if (c.kind === 'box' || c.kind === 'sealed') {
        const red = c.color != null;
        const side = red ? new THREE.MeshLambertMaterial({ color: c.color }) : cardboard;
        const mats = [side, side, red ? side : dark, side, side, side]; // +y (the top) is dark so an opened box looks hollow
        const body = reg(scaledBox(c.w, c.h, c.d, mats, 0.8));
        body.position.y = c.h / 2;
        root.add(body);
        const pivot = new THREE.Group();
        pivot.position.set(0, c.h, -c.d / 2);
        const lid = reg(scaledBox(c.w + 0.02, 0.025, c.d + 0.02, side, 0.8));
        lid.position.set(0, 0.0125, (c.d + 0.02) / 2);
        pivot.add(lid);
        root.add(pivot);
        cont.pivot = pivot;
        if (c.kind === 'sealed') {
          const tapeMat = new THREE.MeshLambertMaterial({ color: 0xd8cdb2, emissive: 0x2a2620 });
          const tape = [];
          const strip = (w, d, x, y, z, ry = 0) => { const m = reg(new THREE.Mesh(new THREE.PlaneGeometry(w, d), tapeMat)); m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, y, z); root.add(m); tape.push(m); };
          strip(0.07, c.d + 0.03, 0, c.h + 0.028, 0);
          strip(c.w + 0.03, 0.07, 0, c.h + 0.029, 0);
          const front = reg(new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.2), tapeMat));
          front.position.set(0, c.h - 0.05, c.d / 2 + 0.012);
          root.add(front);
          tape.push(front);
          cont.tape = tape;
        }
      } else if (c.kind === 'drawer') {
        const body = reg(scaledBox(c.w, c.h, c.d, this.mat('planks'), 1.5));
        body.position.y = c.h / 2;
        root.add(body);
        const drawer = new THREE.Group();
        drawer.position.set(0, 0.8, c.d / 2);
        const front = reg(scaledBox(c.w - 0.08, 0.22, 0.04, this.mat('planks'), 1));
        front.position.set(0, 0, 0.02);
        const tray = reg(scaledBox(c.w - 0.12, 0.04, 0.42, this.mat('gray'), 1));
        tray.position.set(0, -0.05, -0.19);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), steel(0xb9bcc0));
        knob.position.set(0, 0, 0.06);
        drawer.add(front, tray, knob);
        root.add(drawer);
        cont.drawer = drawer;
      } else if (c.kind === 'safe' || c.kind === 'locker') {
        const metal = steel(c.kind === 'safe' ? 0x3b3f45 : 0x4f6b66);
        const body = reg(new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), metal));
        body.position.y = c.h / 2;
        root.add(body);
        // the dark inside, and a little shelf that sticks out for the key
        const inside = new THREE.Mesh(new THREE.PlaneGeometry(c.w - 0.12, c.h - 0.12), new THREE.MeshBasicMaterial({ color: 0x08080a }));
        inside.position.set(0, c.h / 2, c.d / 2 + 0.003);
        root.add(inside);
        const shelfY = c.kind === 'safe' ? 0.525 : 1.335;
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(c.w - 0.16, 0.03, 0.24), metal);
        shelf.position.set(0, shelfY, c.d / 2 + 0.12);
        root.add(shelf);
        // the door, hinged on its left edge
        const dw = c.w - 0.08, dh = c.h - 0.08;
        const pivot = new THREE.Group();
        pivot.position.set(-c.w / 2 + 0.04, c.h / 2, c.d / 2);
        const door = reg(new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.06), metal));
        door.position.set(dw / 2, 0, 0.03);
        pivot.add(door);
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(c.kind === 'safe' ? 0.07 : 0.03, c.kind === 'safe' ? 0.07 : 0.03, 0.04, 16), steel(0xc9ccd1));
        dial.rotation.x = Math.PI / 2;
        dial.position.set(dw * 0.62, c.kind === 'safe' ? 0.08 : 0, 0.08);
        pivot.add(dial);
        if (c.kind === 'locker') {
          for (let i = 0; i < 3; i++) { // vent slits near the top
            const slit = new THREE.Mesh(new THREE.PlaneGeometry(dw * 0.6, 0.025), new THREE.MeshBasicMaterial({ color: 0x0a0c0c }));
            slit.position.set(dw / 2, dh / 2 - 0.12 - i * 0.07, 0.062);
            pivot.add(slit);
          }
        }
        root.add(pivot);
        cont.pivot = pivot;
        cont.dial = dial;
      }
      this.containers.set(c.id, cont);
    }
  }

  buildItems() {
    for (const it of items) {
      const g = new THREE.Group();
      const model = makeItemModel(it, KEYS);
      const flat = it.kind === 'key' || it.kind === 'tool';
      if (flat) {
        model.rotation.x = -Math.PI / 2; // lie flat on the surface
        model.scale.setScalar(it.kind === 'tool' ? 0.95 : 0.85);
      }
      g.add(model);
      g.userData.label = itemInfo(it).label;
      const base = ly(it.level) + it.y - 0.05 + (flat ? 0.022 : 0);
      g.position.set(it.x, base, it.z);
      const pickup = { type: 'pickup', item: it, group: g, taken: false, hidden: !!it.inside, uses: it.kind === 'tool' ? itemInfo(it).uses ?? null : null, baseY: base, origin: { x: it.x, z: it.z, y: base, level: it.level } };
      g.visible = !pickup.hidden;
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

  // Show whatever lies inside a container (or the sauna).
  reveal(id) {
    for (const p of this.pickups) {
      if (p.item.inside !== id || !p.hidden) continue;
      p.hidden = false;
      if (!p.taken) p.group.visible = true;
    }
  }

  setContainer(c, open) {
    c.target = open ? 1 : 0;
    if (open) { c.opened = true; this.reveal(c.id); }
  }

  // Cut the tape / break the lock: containers that need a tool call this once it has been used.
  unseal(c) {
    c.requires = null;
    if (c.tape) c.tape.forEach((m) => { m.visible = false; });
  }

  // A vase in the trash can sets the sauna going.
  throwInBin() {
    const s = this.sauna;
    if (!s || s.on) return false;
    s.on = true;
    s.t = 0;
    this.onEvent?.('sauna-start');
    return true;
  }

  inCrawl(x, z, level) {
    const c = CRAWL.inside;
    return level === c.level && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1;
  }

  crawlHint(x, z, level) {
    return CRAWL.hints.some((h) => level === h.level && x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1);
  }

  // Put everything back the way it was at the start of a run.
  resetState() {
    for (const d of this.doors) {
      d.unlocked = d.keys.length === 0;
      this.setDoor(d, false);
      d.angle = 0;
      d.lockMeshes.forEach((l) => { l.mesh.visible = true; });
      d.filled.clear();
    }
    for (const c of this.containers.values()) {
      c.t = c.target = 0;
      c.opened = false;
      const orig = containers.find((o) => o.id === c.id);
      c.requires = orig.requires ?? null;
      if (c.tape) c.tape.forEach((m) => { m.visible = true; });
    }
    for (const p of this.pickups) {
      const o = p.origin;
      p.taken = false; p.baseY = o.y;
      p.hidden = !!p.item.inside;
      p.group.visible = !p.hidden;
      p.group.position.set(o.x, o.y, o.z);
      p.hit.position.set(o.x, o.y + 0.12, o.z);
      p.item.x = o.x; p.item.z = o.z; p.item.level = o.level;
      if (p.item.kind === 'tool') p.uses = itemInfo(p.item).uses ?? null;
    }
    const s = this.sauna;
    if (s) { s.on = false; s.t = 0; s.revealed = false; s.light.intensity = 0; s.glowMat.color.set(0x331208); s.steam.forEach((sp) => { sp.material.opacity = 0; }); }
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles.length = 0;
  }

  buildExterior() {
    // daylight at the far end of the exit tunnel
    const day = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), new THREE.MeshBasicMaterial({ color: 0xf2f6ff }));
    day.position.set(3.5, 1.5, 27.95);
    day.rotation.y = Math.PI;
    this.scene.add(day);
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
  collide(px, pz, feet, r, head = 1.5) {
    for (const c of this.colliders) {
      if (c.door?.open) continue;
      if (!(feet + 0.35 < c.y0 + c.h && feet + head > c.y0)) continue;
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
    // opening boxes, drawers and doors
    for (const c of this.containers.values()) {
      if (Math.abs(c.target - c.t) < 0.001) continue;
      c.t += (c.target - c.t) * Math.min(1, dt * 6);
      if (c.pivot) c.pivot.rotation[c.dial ? 'y' : 'x'] = c.dial ? -1.8 * c.t : -1.85 * c.t;
      if (c.dial) c.dial.rotation.z = c.t * 6;
      if (c.drawer) c.drawer.position.z = c.d / 2 + 0.36 * c.t;
    }
    // the sauna
    const s = this.sauna;
    if (s && s.on) {
      s.t += dt;
      const heat = Math.min(1, s.t / 6);
      s.light.intensity = 16 * heat * (0.92 + Math.sin(time * 7) * 0.08);
      s.glowMat.color.setRGB(0.2 + 0.8 * heat, 0.07 + 0.38 * heat, 0.03 + 0.08 * heat);
      for (const sp of s.steam) {
        const u = (time * 0.18 + sp.userData.phase) % 1;
        sp.position.set(s.x - 0.9 + sp.userData.ox * 0.7, s.base + 0.9 + u * 1.5, s.z + sp.userData.oz * 0.8);
        sp.material.opacity = heat * 0.28 * Math.sin(u * Math.PI);
        sp.scale.setScalar(0.5 + u * 0.9);
      }
      if (!s.revealed && s.t > 6.5) {
        s.revealed = true;
        this.reveal('sauna');
        this.onEvent?.('lockpick');
      }
    }
    for (const p of this.pickups) {
      if (p.taken || p.hidden) continue;
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
      // into the trash can in the sauna?
      if (this.sauna && !this.sauna.on && p.mesh.position.y < 3 && ny < TRASH.catchTop && ny > 0.1 &&
          Math.hypot(nx - TRASH.x, nz - TRASH.z) < TRASH.r) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        this.throwInBin();
        p.onLand?.(nx, 0.5, nz);
        continue;
      }
      // the floor under the vase, measured from the floor its thrower stood on (not from its own height,
      // which rounds up to the next floor when thrown from eye level)
      const floor = groundY(nx, nz, p.refY ?? p.mesh.position.y);
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
