import * as THREE from '../three.js';
import { AREAS, LEVEL_Y, OPENINGS, SPIRAL } from '../world/layout.js';
import { ITEMS, buildItem } from './catalog.js';

const SAVE_KEY = 'levelfun.save.v2';
const G = 9.8;
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Items lying around, carried, dropped and thrown. One item can be held at a time.
export class ItemSystem {
  constructor(scene, camera, world) {
    this.scene = scene; this.camera = camera; this.world = world;
    this.items = [];            // { uid, id, def, mesh, outline, state: 'world'|'held'|'air', x, y, z, vx, vy, vz, home }
    this.held = null;
    this.hand = new THREE.Group(); camera.add(this.hand);
    this.targetItem = null;
    this.noises = world.noises = [];   // { x, y, z, loud, src, t } for the AI (Stage 4)
    this.rewards = {};          // arcade game -> true once its prize has appeared
    this.seed = 1; this.exitCode = '0000';
    this.dirty = false; this.time = 0;
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  // ---------- save / load ----------
  static load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return s; } catch (_) { /* no storage */ }
    return null;
  }
  static clear() { try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* no storage */ } }
  save() {
    const data = {
      v: 2, seed: this.seed, exitCode: this.exitCode, rewards: this.rewards, extra: this.extraSave ? this.extraSave() : null,
      items: this.items.map(i => ({ uid: i.uid, id: i.id, x: i.x, y: i.y, z: i.z, state: i === this.held ? 'held' : i.state === 'air' ? 'world' : i.state, home: i.home, charges: i.charges, slot: i.slot, recorded: i.recorded })),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.dirty = false; return true; } catch (_) { return false; }
  }

  // ---------- creation ----------
  // New game: random placement from a seed. Continue: restore the saved positions.
  init(save) {
    if (save) {
      this.seed = save.seed; this.exitCode = save.exitCode; this.rewards = save.rewards || {};
      this.loadedExtra = save.extra || null;
      for (const q of save.items) {
        if (!ITEMS[q.id]) continue;
        const it = this.create(q.id, q.uid, q.home);
        it.x = q.x; it.y = q.y; it.z = q.z; it.charges = q.charges || 0; it.slot = q.slot; it.recorded = q.recorded;
        if (q.state === 'held') this.pickUp(it, true);
        else if (q.state === 'hidden') this.hide(it);
        else if (q.state === 'used') this.consume(it, true);
        else if (q.state === 'installed' && q.slot) this.installAt(it, q.slot, true);
        else this.place(it);
      }
    } else {
      this.seed = (Math.random() * 1e9) | 0;
      const r = mulberry(this.seed);
      this.exitCode = String(1000 + Math.floor(r() * 9000));
      this.scatter(r);
    }
  }

  hide(it) { it.state = 'hidden'; it.mesh.visible = false; if (it.mesh.parent !== this.scene) this.scene.add(it.mesh); }
  // Spent for good (keys, batteries, confetti poppers...): stays in the save so it does not come back.
  consume(it, silent = false) {
    if (this.held === it) this.held = null;
    it.state = 'used'; it.mesh.visible = false; if (this.targetItem === it) this.targetItem = null;
    if (it.mesh.parent === this.hand) { this.hand.remove(it.mesh); this.scene.add(it.mesh); }
    this.dirty = true; if (!silent) this.save();
  }
  // Fixed in place on a machine (motor, circuit, fuses, handle...).
  installAt(it, slot, silent = false) {
    if (this.held === it) this.held = null;
    if (it.mesh.parent !== this.scene) { it.mesh.parent?.remove(it.mesh); this.scene.add(it.mesh); }
    this.glow(it.mesh, 0.2);
    it.state = 'installed'; it.slot = slot; it.vx = it.vy = it.vz = 0;
    it.mesh.visible = true; it.mesh.position.set(slot.x, slot.y, slot.z); it.mesh.rotation.set(slot.rx || 0, slot.ry || 0, slot.rz || 0);
    it.x = slot.x; it.y = slot.y; it.z = slot.z; it.outline.visible = false; if (this.targetItem === it) this.targetItem = null;
    this.dirty = true; if (!silent) this.save();
  }
  // Brings a hidden item into the world, popping out of a compartment or machine.
  reveal(it, x, y, z) {
    it.x = x; it.y = y; it.z = z; this.place(it); it.state = 'air'; it.rest = false; it.vy = 1.5; it.vz = 0.6;
    this.dirty = true; this.save();
  }

  create(id, uid, home) {
    const def = ITEMS[id];
    const mesh = buildItem(id, { exitCode: this.exitCode });
    mesh.userData.item = true;
    const outline = this.makeOutline(mesh); mesh.add(outline); outline.visible = false;
    this.glow(mesh, 0.2);
    const holdQuat = def.tool ? this.toolOrientation(mesh, def.tool === 'flip') : null;
    this.scene.add(mesh);
    const it = { holdQuat, uid: uid ?? `${id}#${this.items.filter(i => i.id === id).length}`, id, def, mesh, outline, state: 'world', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, home: home || null, rest: true, radius: Math.max(0.14, def.size * 0.5) };
    this.items.push(it);
    return it;
  }

  // Tools (keys, screwdriver, cutters, popper, zapper...) are held with their working end pointing straight ahead.
  // The long axis of the model is found, the thinner end is the tip, and the flat side is kept facing up.
  toolOrientation(mesh, flipEnd = false) {
    mesh.updateMatrixWorld(true);
    const pts = [], v = new THREE.Vector3();
    mesh.traverse(o => { if (!o.isMesh || o.userData.outline) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 400))) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone()); });
    // principal axes of the point cloud (the model may be lying at an angle): long axis, and the flat direction
    const c = pts.reduce((m, q) => m.add(q), new THREE.Vector3()).divideScalar(pts.length);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const q of pts) { const d = [q.x - c.x, q.y - c.y, q.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
    const mulv = (M, v) => new THREE.Vector3(M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z, M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z, M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z);
    const power = (M, v0) => { let v = v0.clone().normalize(); for (let i = 0; i < 40; i++) { v = mulv(M, v); if (v.lengthSq() < 1e-18) break; v.normalize(); } return v; };
    const long = power(C, new THREE.Vector3(0.3, 0.2, 1));
    const l1 = mulv(C, long).dot(long), C2 = C.map((row, i) => row.map((x, j) => x - l1 * [long.x, long.y, long.z][i] * [long.x, long.y, long.z][j]));
    const mid = power(C2, new THREE.Vector3(1, 0.1, 0.2).sub(long.clone().multiplyScalar(long.x * 1 + long.y * 0.1 + long.z * 0.2)));
    const flat = new THREE.Vector3().crossVectors(long, mid).normalize();
    let lmin = 1e9, lmax = -1e9; for (const q of pts) { const t = q.clone().sub(c).dot(long); lmin = Math.min(lmin, t); lmax = Math.max(lmax, t); }
    const half = (lmax - lmin) / 2, lc = (lmax + lmin) / 2;
    const lo = [], hi = [];
    for (const q of pts) { const t = q.clone().sub(c), along = t.dot(long), rad = t.addScaledVector(long, -along).length(); const k = (along - lc) / half; if (k < -0.45) lo.push(rad); else if (k > 0.45) hi.push(rad); }
    const widest = a => a.length ? Math.max(...a) : 1e9;   // the working end is the slimmer one
    let tip = widest(lo) < widest(hi) ? long.clone().negate() : long.clone();
    if (flipEnd) tip.negate();
    const aim = new THREE.Vector3(-0.2, 0.14, -1).normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(tip, aim);
    // roll about the aim so the flattest side faces up
    const f = flat.clone().applyQuaternion(q1), up = new THREE.Vector3(0, 0.65, 0.76);   // flat side turned up and toward you
    const fp = f.clone().addScaledVector(aim, -f.dot(aim)).normalize(), upp = up.clone().addScaledVector(aim, -up.dot(aim)).normalize();
    let ang = Math.acos(Math.min(1, Math.max(-1, fp.dot(upp)))); if (fp.clone().cross(upp).dot(aim) < 0) ang = -ang;
    if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;   // the flat side may face up or down: take the smaller turn
    return new THREE.Quaternion().setFromAxisAngle(aim, ang).multiply(q1);
  }

  // A faint glowing shell around the item (inverted hull), shown only when it can be picked up.
  makeOutline(mesh) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0xfff0b0, side: THREE.BackSide, transparent: true, opacity: 0.8, depthWrite: false });
    const bb = new THREE.Box3().setFromObject(mesh), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const k = 1 + Math.min(0.5, 0.012 / Math.max(0.02, Math.min(s.x, s.y, s.z, 0.12)) + 0.1);
    mesh.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    mesh.traverse(o => {
      if (!o.isMesh || o.userData.outline) return;
      const mm = new THREE.Mesh(o.geometry, m); mm.userData.outline = true;
      mm.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      g.add(mm);
    });
    g.scale.setScalar(k); g.position.copy(c).multiplyScalar(1 - k);
    return g;
  }

  // Random placement: every item picks a clear, reachable floor spot in one of its allowed rooms.
  scatter(r) {
    const taken = [];
    const spots = {};
    const forRoom = id => spots[id] || (spots[id] = this.roomSpots(id));
    const surf = {}; const forSurf = id => surf[id] || (surf[id] = this.surfaceSpots(id));
    const order = Object.keys(ITEMS);
    for (const id of order) {
      const def = ITEMS[id];
      const n = def.count || 1;
      for (let i = 0; i < n; i++) {
        const it = this.create(id, n > 1 ? `${id}#${i}` : id);
        if (def.reward || def.hidden || def.compartment && def.compartment[i - 1]) { this.hide(it); continue; }   // appears later: arcade prize, assembly or compartment
        let spot = null;
        if (def.fixed) spot = { level: def.fixed.level, x: def.fixed.x, z: def.fixed.z, y: LEVEL_Y[def.fixed.level] + def.fixed.y };
        else {
          // about half of the small items sit on tables, counters, benches, shelves and inside trash cans instead of the floor
          if (def.size <= 0.36 && r() < 0.55) {
            const sp = def.where.flatMap(forSurf).filter(s => !taken.some(t => Math.hypot(t.x - s.x, t.z - s.z) < 0.5 && t.level === s.level && Math.abs((t.y ?? 0) - s.y) < 0.6));
            spot = sp[Math.floor(r() * sp.length)] || null;
          }
          if (!spot) {
            const pool = def.where.flatMap(forRoom).filter(s => !taken.some(t => Math.hypot(t.x - s.x, t.z - s.z) < 1.2 && t.level === s.level));
            spot = pool[Math.floor(r() * pool.length)] || forRoom(def.where[0])[0];
          }
        }
        taken.push(spot);
        it.x = spot.x; it.z = spot.z; it.y = spot.y ?? LEVEL_Y[spot.level];
        it.home = { x: it.x, y: it.y, z: it.z };
        this.place(it);
      }
    }
  }

  // Boxes whose flat top is a believable place for an item: tables, counters, benches, shelves, crates, trash cans (0.3 - 1.25 m above their floor).
  getSupports() {
    if (this.supports) return this.supports;
    const lv = Object.entries(LEVEL_Y), doorBoxes = new Set(this.world.doors.map(d => d.box));
    this.supports = [];
    for (const b of this.world.collision.boxes) {
      if (!b.enabled || doorBoxes.has(b)) continue;
      let base = -Infinity, level = null; for (const [l, y] of lv) if (y <= b.y1 + 0.01 && y > base) { base = y; level = l; }
      const rel = b.y1 - base, w = b.maxX - b.minX, d = b.maxZ - b.minZ;
      if (rel < 0.3 || rel > 1.25 || Math.min(w, d) < 0.25 || b.y0 > base + 1.3) continue;
      const bin = Math.abs(w - 0.76) < 0.03 && Math.abs(d - 0.76) < 0.03 && Math.abs(b.y1 - b.y0 - 0.75) < 0.03;
      this.supports.push({ b, level, base, top: b.y1, bin });
    }
    return this.supports;
  }
  // Is there somewhere to stand within arm's reach of this point?
  reachable(x, z, base) {
    for (const r of [0.75, 1.0, 1.3]) for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, f = this.world.floorAt(px, pz, base + 0.1, true);
      if (f === null || Math.abs(f - base) > 0.02) continue;
      if (!this.world.collision.overlaps(px, pz, 0.3, base + 0.2, base + 1.7)) return true;
    }
    return false;
  }
  surfaceSpots(areaId) {
    const a = AREAS.find(q => q.id === areaId); if (!a) return [];
    const out = [], col = this.world.collision, doors = OPENINGS.filter(o => o.level === a.level);
    for (const sp of this.getSupports()) {
      if (sp.level !== a.level) continue;
      const { b } = sp, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      if (cx < a.rect[0] + 0.3 || cx > a.rect[2] - 0.3 || cz < a.rect[1] + 0.3 || cz > a.rect[3] - 0.3) continue;
      const pts = [];
      if (sp.bin) pts.push([cx, cz]);
      else for (let x = b.minX + 0.2; x <= b.maxX - 0.2 + 1e-6; x += 0.4) for (let z = b.minZ + 0.2; z <= b.maxZ - 0.2 + 1e-6; z += 0.4) pts.push([x, z]);
      if (!pts.length) pts.push([cx, cz]);
      for (const [x, z] of pts) {
        if (Math.hypot(x - SPIRAL.cx, z - SPIRAL.cz) < 2.6) continue;
        if (!sp.bin && col.overlaps(x, z, 0.14, sp.top + 0.03, sp.top + 0.5)) continue;   // something sits on or above it
        if (doors.some(o => (o.axis === 'x' ? Math.hypot(x - (o.a + o.b) / 2, z - o.c) : Math.hypot(x - o.c, z - (o.a + o.b) / 2)) < 1.0)) continue;
        if (!this.reachable(x, z, sp.base)) continue;
        out.push({ level: a.level, x, z, y: sp.bin ? sp.top - 0.28 : sp.top, surface: true, bin: sp.bin });
      }
    }
    return out;
  }

  // Candidate floor points in a room: open flat floor, away from furniture, walls and doorways.
  roomSpots(areaId) {
    const a = AREAS.find(q => q.id === areaId); if (!a) return [];
    const y = LEVEL_Y[a.level], out = [];
    const doors = OPENINGS.filter(o => o.level === a.level);
    for (let x = a.rect[0] + 0.7; x < a.rect[2] - 0.7; x += 0.5) for (let z = a.rect[1] + 0.7; z < a.rect[3] - 0.7; z += 0.5) {
      const f = this.world.floorAt(x, z, y + 0.1, true);
      if (f === null || Math.abs(f - y) > 0.01) continue;
      if (this.world.collision.overlaps(x, z, 0.55, y + 0.1, y + 1.2)) continue;
      if (this.world.collision.overlaps(x, z, 0.4, y + 1.2, y + 1.75)) continue;   // low roofs (huts, tunnels): you must be able to stand there
      if (Math.hypot(x - SPIRAL.cx, z - SPIRAL.cz) < 2.6) continue;               // keep the staircase clear
      if (doors.some(o => (o.axis === 'x' ? Math.hypot(x - (o.a + o.b) / 2, z - o.c) : Math.hypot(x - o.c, z - (o.a + o.b) / 2)) < 1.4)) continue;
      out.push({ level: a.level, x, z, y });
    }
    return out;
  }

  place(it) {
    it.state = 'world'; it.vx = it.vy = it.vz = 0; it.rest = true;
    it.mesh.visible = true; it.mesh.position.set(it.x, it.y, it.z);
    it.mesh.rotation.set(0, (it.x * 7.3 + it.z * 3.1) % 6.28, 0);
    this.scene.add(it.mesh);
  }

  // Test helper: lay every item out on the floor in front of the player (8 per row).
  spawnAllInFront(player) {
    if (this.held) this.drop();
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    this.items.forEach((it, i) => {
      const col = i % 8, row = Math.floor(i / 8);
      const d = 1.3 + row * 0.55, off = (col - 3.5) * 0.45;
      it.x = player.pos.x + fx * d + rx * off; it.z = player.pos.z + fz * d + rz * off;
      const f = this.world.floorAt(it.x, it.z, player.pos.y + 0.3, false);
      it.y = Number.isFinite(f) ? f : player.pos.y;
      if (ITEMS[it.id].reward) this.rewards[ITEMS[it.id].reward] = true;
      this.place(it);
    });
    this.dirty = true; this.save();
  }

  // A prize pops out of an arcade machine.
  spawnReward(game, x, y, z) {
    if (this.rewards[game]) return null;
    const id = Object.keys(ITEMS).find(k => ITEMS[k].reward === game); if (!id) return null;
    this.rewards[game] = true;
    const it = this.items.find(i => i.id === id) || this.create(id);
    it.x = x; it.y = y + 1.0; it.z = z; it.home = { x, y, z };
    this.place(it); it.state = 'air'; it.rest = false; it.vz = 1.2; it.vy = 2.5;
    this.dirty = true; this.save();
    return it;
  }

  // ---------- targeting ----------
  heldId() { return this.held ? this.held.id : null; }

  // The item the player is looking at, if it is within reach.
  target() {
    const eye = this.camera.position, d = this.camera.getWorldDirection(this._d);
    let best = null, bd = 1e9;
    for (const it of this.items) {
      if (it.state !== 'world' && it.state !== 'air') continue;
      const cx = it.x - eye.x, cy = it.y + it.def.size * 0.3 - eye.y, cz = it.z - eye.z;
      const along = cx * d.x + cy * d.y + cz * d.z;
      if (along < 0.1 || along > 2.1) continue;
      const px = cx - d.x * along, py = cy - d.y * along, pz = cz - d.z * along;
      const off = Math.hypot(px, py, pz);
      const tol = 0.16 + Math.max(0.1, it.def.size) * 0.5 + along * 0.1;
      if (off < tol && off + along * 0.02 < bd) { best = it; bd = off + along * 0.02; }
    }
    return best;
  }

  setHighlight(it) {
    if (it === this.targetItem) return;
    if (this.targetItem) this.targetItem.outline.visible = false;
    this.targetItem = it;
    if (it) it.outline.visible = true;
  }

  // Items glow faintly by themselves (more in the hand) so they stay readable in dark rooms.
  glow(mesh, k) {
    mesh.traverse(m => {
      if (!m.isMesh || m.userData.outline || !m.material || !m.material.emissive) return;
      const mt = m.material;
      if (m.userData.e0 === undefined) { m.userData.e0 = mt.emissive.getHex(); m.userData.ei0 = mt.emissiveIntensity; }
      if (mt.map) { mt.emissiveMap = mt.map; mt.emissive.setScalar(k * 1.2); }
      else mt.emissive.copy(mt.color).multiplyScalar(k).add(new THREE.Color(m.userData.e0));
      mt.needsUpdate = true;
    });
  }

  // ---------- pick up / drop / throw ----------
  pickUp(it, silent = false) {
    if (this.held && this.held !== it) this.drop(0.5);   // hands full: the old item drops at your feet
    this.held = it; it.state = 'held'; it.rest = true; it.mesh.visible = true;
    it.outline.visible = false; if (this.targetItem === it) this.targetItem = null;
    this.hand.add(it.mesh); this.glow(it.mesh, 0.4);
    const h = it.def.hold || {};
    it.mesh.position.set(0, 0, -0.5);   // the hand group places it on screen (see update)
    it.mesh.scale.setScalar(Math.min(1, 0.24 / it.def.size));   // big things are held a little smaller so they stay clear of the buttons
    if (it.holdQuat) it.mesh.quaternion.copy(it.holdQuat); else it.mesh.rotation.set(...(h.rot || [0, 0, 0]));
    this.dirty = true; if (!silent) this.save();
  }

  release(speed, lift) {
    const it = this.held; if (!it) return null;
    const eye = this.camera.position, d = this.camera.getWorldDirection(this._d);
    this.hand.remove(it.mesh); this.scene.add(it.mesh); this.glow(it.mesh, 0.2);
    it.mesh.quaternion.identity(); it.mesh.rotation.set(0, Math.random() * 6.28, 0); it.mesh.scale.setScalar(1);
    const flat = Math.hypot(d.x, d.z) || 1;
    it.x = eye.x + d.x / flat * 0.45; it.z = eye.z + d.z / flat * 0.45; it.y = eye.y - 0.35;
    it.vx = d.x * speed; it.vz = d.z * speed; it.vy = d.y * speed + lift;
    it.state = 'air'; it.rest = false; this.held = null;
    it.mesh.position.set(it.x, it.y, it.z);
    // never start inside a wall: if the spawn point is blocked, drop where the player stands
    if (this.world.collision.overlaps(it.x, it.z, 0.1, it.y, it.y + 0.2)) { it.x = eye.x; it.z = eye.z; }
    this.dirty = true;
    return it;
  }
  drop() { const it = this.release(0.8, 0.5); if (it) this.save(); return it; }
  throwHeld() {
    const it = this.release(7.5, 1.6); if (!it) return;
    it.thrown = true; this.save();
  }

  // ---------- simulation ----------
  update(dt, player) {
    this.time += dt;
    const pad = 0.03;
    for (const it of this.items) {
      if (it.state === 'air') this.step(it, dt);
      const m = it.mesh;
      if (it.state === 'world' || it.state === 'air') {
        m.visible = Math.abs(it.y - player.pos.y) < 3.5 && Math.hypot(it.x - player.pos.x, it.z - player.pos.z) < 26;
      }
      // lost items (out of the world) go back to where they started
      if (it.y < -30 || !Number.isFinite(it.x + it.y + it.z)) { const h = it.home || { x: 22, y: 0, z: 23 }; it.x = h.x; it.y = h.y + 0.2; it.z = h.z; it.vx = it.vy = it.vz = 0; it.state = 'air'; it.rest = false; }
    }
    this.setHighlight(this.target());
    // the held item sways with your steps
    if (this.held) {
      const k = Math.min(1, player.speed / 2.4), b = player.bob;
      // the held item sits at a fixed spot on screen: between the lean-right button and the USE / DROP buttons
      const th = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), d = 0.5;
      const bx = (2 * 0.73 - 1) * th * this.camera.aspect * d, by = -(2 * 0.74 - 1) * th * d;
      this.hand.position.set(bx + Math.sin(b * 0.5) * 0.02 * k, by - Math.abs(Math.sin(b)) * 0.02 * k, 0);
      this.hand.rotation.set(Math.sin(b) * 0.04 * k, 0, Math.sin(b * 0.5) * 0.08 * k);
    } else this.hand.position.set(0, 0, 0);
    if (this.dirty && this.time - (this.lastSave || 0) > 30) { this.lastSave = this.time; this.save(); }
  }

  step(it, dt) {
    const w = this.world, r = 0.1;
    it.vy -= G * dt;
    if (w.knock && Math.hypot(it.vx, it.vz) + Math.abs(it.vy) > 2.2) {   // a thrown item that hits a standing prop knocks it over
      const k = w.knock.touching(it.x, it.y, it.z, 0.14);
      if (k && it.y < k.y + k.K.h) { w.knock.knock(k, it.vx, it.vz, 'item'); it.vx *= -0.3; it.vz *= -0.3; }
    }
    const nx = it.x + it.vx * dt, nz = it.z + it.vz * dt;
    const p = { x: nx, z: nz };
    w.collision.resolve(p, r, it.y, it.y + 0.2);
    if (Math.abs(p.x - nx) > 1e-4) it.vx *= -0.35;
    if (Math.abs(p.z - nz) > 1e-4) it.vz *= -0.35;
    it.x = p.x; it.z = p.z;
    const ny = it.y + it.vy * dt;
    let fl = w.floorAt(it.x, it.z, it.y + 0.02, false);
    for (const sp of this.getSupports()) { const bb = sp.b; if (!bb.enabled) continue; if (it.x > bb.minX - 0.02 && it.x < bb.maxX + 0.02 && it.z > bb.minZ - 0.02 && it.z < bb.maxZ + 0.02 && sp.top <= it.y + 0.03 && sp.top > fl) fl = sp.top; }   // items land on tables, counters and bins
    if (Number.isFinite(fl) && ny <= fl) {
      const impact = -it.vy;
      it.y = fl;
      if (impact > 1.2) { it.vy = impact * 0.28; it.vx *= 0.6; it.vz *= 0.6; if (impact > 2.5) this.noise(it, Math.min(1, impact / 8) * (it.def.loud + 0.3), it.thrown ? 'throw' : 'drop'); }
      else it.vy = 0;
      it.vx *= Math.pow(0.02, dt); it.vz *= Math.pow(0.02, dt);
      if (it.vy === 0 && Math.hypot(it.vx, it.vz) < 0.15) { it.vx = it.vz = 0; it.state = 'world'; it.rest = true; it.thrown = false; this.dirty = true; }
    } else it.y = ny;
    it.mesh.position.set(it.x, it.y, it.z);
    it.mesh.rotation.y += Math.hypot(it.vx, it.vz) * dt * 2.5;
  }

  // Items resting inside or on top of a prop that was just knocked over spill out and fall.
  spill(k) {
    for (const it of this.items) {
      if (it.state !== 'world' || Math.hypot(it.x - k.x, it.z - k.z) > k.K.r + 0.05 || it.y < k.y + 0.1 || it.y > k.y + k.K.h + 0.1) continue;
      it.state = 'air'; it.rest = false; it.vx = k.dx * 1.6; it.vz = k.dz * 1.6; it.vy = 1.2; this.dirty = true;
    }
  }

  noise(it, loud, src) { this.noises.push({ x: it.x, y: it.y, z: it.z, loud, src, t: this.time }); if (this.noises.length > 32) this.noises.shift(); }
}
