import * as THREE from '../three.js';
import { AREAS, LEVEL_Y } from '../world/layout.js';
import { cloneModel, hasModel } from '../assets/models.js';
import { sfx } from '../audio/sfx.js';
import { Nav } from './nav.js';

// Per-difficulty behaviour. speed is a fraction of the player's walking speed; hear scales how far noises carry;
// hide is the chance he checks a hiding place he saw the player enter.
export const DIFFICULTY = {
  practice: null,
  easy: { speed: 0.75, hear: 1.0, hide: 0.5 },
  normal: { speed: 0.9, hear: 1.0, hide: 0.75 },
  hard: { speed: 1.0, hear: 1.15, hide: 0.9 },
  extreme: { speed: 1.1, hear: 1.5, hide: 1.0 },
};
const WALK = 2.4, EYE = 1.75, RADIUS = 0.26;
const DARK = { dark: 0.5, dim: 0.7, red: 0.8, cold: 0.85, warm: 1, arcade: 0.9 };
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// Splits the static model into torso / legs / arms (by triangle position) so he can walk and swing his arms.
function buildRig() {
  const src = cloneModel('smiley'); src.updateMatrixWorld(true);
  let body = null, balloon = null;
  src.traverse(o => { if (o.isMesh) { if (o.material.name === 'Baloon_red') balloon = o; else if (!body) body = o; } });
  const rig = { root: new THREE.Group(), phase: 0 };
  const g0 = body.geometry.clone(); g0.applyMatrix4(body.matrixWorld);
  const pos = g0.attributes.position, idx = g0.index ? g0.index.array : Uint32Array.from({ length: pos.count }, (_, i) => i);
  const buckets = { torso: [], legL: [], legR: [], armL: [], armR: [] };
  for (let t = 0; t < idx.length; t += 3) {
    const cx = (pos.getX(idx[t]) + pos.getX(idx[t + 1]) + pos.getX(idx[t + 2])) / 3, cy = (pos.getY(idx[t]) + pos.getY(idx[t + 1]) + pos.getY(idx[t + 2])) / 3;
    let k = 'torso';
    if (cy < 0.9) k = cx < 0 ? 'legL' : 'legR';
    else if (Math.abs(cx) > 0.22 && cy < 1.72) k = cx < 0 ? 'armL' : 'armR';
    buckets[k].push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const pivots = { torso: [0, 0, 0], legL: [-0.1, 0.92, 0], legR: [0.1, 0.92, 0], armL: [-0.2, 1.62, 0], armR: [0.2, 1.62, 0] };
  const mat = body.material;
  for (const [name, tris] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry(), p = pivots[name];
    const pp = pos.clone(); for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - p[0], pp.getY(i) - p[1], pp.getZ(i) - p[2]);
    g.setAttribute('position', pp); if (g0.attributes.normal) g.setAttribute('normal', g0.attributes.normal); if (g0.attributes.uv) g.setAttribute('uv', g0.attributes.uv);
    g.setIndex(tris);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    const holder = new THREE.Group(); holder.position.set(...p); holder.add(m); rig.root.add(holder); rig[name] = holder;
  }
  if (balloon) {   // the balloon rides in his right hand
    const bg = balloon.geometry.clone(); bg.applyMatrix4(balloon.matrixWorld); bg.translate(-pivots.armR[0], -pivots.armR[1], -pivots.armR[2]);
    const bm = new THREE.Mesh(bg, balloon.material); bm.frustumCulled = false; rig.armR.add(bm);
  }
  return rig;
}

export class Smiley {
  constructor({ scene, world, player, items, camera, difficulty = 'normal' }) {
    Object.assign(this, { scene, world, player, items, camera });
    this.nav = new Nav(world);
    this.rig = hasModel('smiley') ? buildRig() : { root: new THREE.Group(), phase: 0 };
    this.root = new THREE.Group(); this.root.add(this.rig.root); scene.add(this.root);
    this.pos = new THREE.Vector3(0, 0, 0); this.yaw = 0; this.state = 'patrol';
    this.difficulty = difficulty; this.path = null; this.pi = 0; this.timer = 0; this.stateT = 0;
    this.lastSeen = null; this.noiseSeen = new WeakSet(); this.sawHide = null; this.grace = 0; this.stun = 0; this.fall = 0;
    this.trackPlush = false; this.pathT = 0; this.stuckT = 0; this.stuckPos = new THREE.Vector3(); this.repaths = 0; this.bad = new Map();
    this.trapT = rnd(40, 80); this.stepT = 0; this.catching = false; this.look = 0; this.canSeeNow = false; this.unseenT = 0;
    this.onCatch = () => {}; this.traps = world.traps = [];
    this.patrolPts = AREAS.filter(a => a.id !== 'security').map(a => ({ level: a.level, x: (a.rect[0] + a.rect[2]) / 2, z: (a.rect[1] + a.rect[3]) / 2, y: LEVEL_Y[a.level], id: a.id, mood: a.mood }));
    this.root.visible = false;
  }

  // Test aid: a green glow that shows through walls, and he is drawn on every floor.
  setXray(on) {
    this.xray = on;
    if (on && !this.ghosts) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x20ff4a, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
      const meshes = []; this.rig.root.traverse(o => { if (o.isMesh) meshes.push(o); });
      this.ghosts = meshes.map(m => { const g = new THREE.Mesh(m.geometry, mat); g.renderOrder = 999; g.frustumCulled = false; m.parent.add(g); return g; });
    }
    for (const g of this.ghosts || []) g.visible = on;
  }
  get cfg() { return DIFFICULTY[this.difficulty] || null; }
  get present() { return !!this.cfg; }

  // Put him somewhere far from the player (never next to the start) at the beginning of a day.
  respawn(grace = 25) {
    const far = this.patrolPts.filter(p => this.nav.snap(p.x, p.z, p.y)).map(p => ({ p, d: Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z) + Math.abs(p.y - this.player.pos.y) * 3 })).filter(q => q.d > 28);
    const pick = far.length ? far[Math.floor(Math.random() * far.length)].p : this.patrolPts[0];
    const s = this.nav.snap(pick.x, pick.z, pick.y) || { ix: 0, iz: 0, y: pick.y };
    this.pos.set(s.ix * 0.25, s.y, s.iz * 0.25); this.yaw = Math.random() * 6.28;
    this.setState('patrol'); this.path = null; this.stun = 0; this.fall = 0; this.grace = grace; this.sawHide = null; this.lastSeen = null; this.catching = false; this.trackPlush = false;
    for (const t of this.traps) this.scene.remove(t.mesh); this.traps.length = 0;
    this.sync();
  }

  setState(s) { this.state = s; this.stateT = 0; }

  // ---------- perception ----------
  eyeOfPlayer() { return this.player.pos.y + (this.player.crouched ? 0.75 : 1.6); }
  sees(ignoreHidden = false) {
    const p = this.player; if (p.hide && !ignoreHidden) return false;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dy = p.pos.y - this.pos.y, d = Math.hypot(dx, dz);
    if (Math.abs(dy) > 2.2) return false;
    const area = this.nav.areaAt(this.pos.x, this.pos.z, this.pos.y);
    let range = 16 * (DARK[area ? area.mood : 'warm'] ?? 1) * (p.crouched ? 0.75 : 1) * (p.speed < 0.2 ? 0.7 : 1);
    if (d > range) return false;
    if (d > 1.4) { const ang = Math.abs(wrap(Math.atan2(-dx, -dz) - this.yaw)); if (ang > 1.15) return false; }   // about 130 degree field of view
    const ey = this.pos.y + EYE, ty = this.eyeOfPlayer(), n = Math.ceil(d / 0.3), col = this.world.collision;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = this.pos.x + dx * t, z = this.pos.z + dz * t, y = ey + (ty - ey) * t;
      for (const b of col.near(x, z, 0.04)) { if (b.y1 <= y - 0.03 || b.y0 >= y + 0.03) continue; if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return false; }
    }
    return true;
  }
  hearNoises() {
    const list = this.world.noises || []; let best = null;
    for (const n of list) {
      if (this.noiseSeen.has(n)) continue; this.noiseSeen.add(n);
      if (n.src === 'smiley') continue;
      const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z) + Math.abs(n.y - this.pos.y) * 2.5, range = (6 + 22 * n.loud) * this.cfg.hear;
      if (d <= range && (!best || n.loud / (d + 3) > best.score)) best = { n, score: n.loud / (d + 3) };
    }
    return best && best.n;
  }

  // ---------- pathing ----------
  goTo(x, z, y, label) {
    const key = Math.round(x) + ',' + Math.round(z) + ',' + Math.round(y / 2), bad = this.bad.get(key);
    if (bad && performance.now() - bad < 20000) return false;
    const path = this.nav.path(this.pos.x, this.pos.z, this.pos.y, x, z, y);
    if (!path || path.length < 1 || (!path.complete && path.length < 2)) { this.bad.set(key, performance.now()); return false; }
    if (!this.keepRepaths) this.repaths = 0;
    this.path = path; this.pi = 0; this.target = { x, z, y }; this.pathT = 0; this.stuckT = 0; return path.complete !== false;
  }
  arrived() { return !this.path || this.pi >= this.path.length; }

  // ---------- main update ----------
  update(dt) {
    if (!this.present) { this.root.visible = false; return; }
    const p = this.player, cfg = this.cfg;
    this.root.visible = this.xray || Math.abs(this.pos.y - this.camera.position.y) < 4.5;
    if (this.catching) { this.animate(dt, 0); return; }
    this.stateT += dt; this.grace = Math.max(0, this.grace - dt);

    if (this.stun > 0) {   // stunned: collapsed and twitching
      this.stun -= dt; this.fall = Math.min(1, this.fall + dt * 3);
      if (this.stun <= 0) { this.setState('search'); this.timer = 6; this.lastSeen = { x: p.pos.x, z: p.pos.z, y: p.pos.y }; }
      this.animate(dt, 0); return;
    }
    this.fall = Math.max(0, this.fall - dt * 1.2);
    if (this.fall > 0) { this.animate(dt, 0); return; }   // getting up

    this.processStuns();

    // perception (about every 0.15 s)
    this.look -= dt;
    if (this.look <= 0) {
      this.look = 0.15;
      const holdingPlush = this.items.heldId() === 'plush';
      this.canSeeNow = this.grace <= 0 && this.sees();
      if (this.canSeeNow) {
        this.unseenT = 0; this.lastSeen = { x: p.pos.x, z: p.pos.z, y: p.pos.y };
        if (holdingPlush) this.trackPlush = true;
        if (this.state !== 'chase') { this.setState('chase'); sfx.smileyNotice && sfx.smileyNotice(); }
      } else this.unseenT += 0.15;
      if (!holdingPlush) this.trackPlush = false;
      if (this.trackPlush && !p.hide) { this.lastSeen = { x: p.pos.x, z: p.pos.z, y: p.pos.y }; if (this.state !== 'chase') this.setState('chase'); }
      // noises
      if (this.grace <= 0 && this.state !== 'chase') {
        const n = this.hearNoises();
        if (n) { if (this.goTo(n.x, n.z, n.y)) { this.setState('investigate'); this.timer = rnd(5, 10); } }
      } else for (const n of this.world.noises || []) this.noiseSeen.add(n);
    }

    const speed = WALK * cfg.speed;
    switch (this.state) {
      case 'patrol': this.doPatrol(dt, speed); break;
      case 'idle': this.timer -= dt; this.turnTo(this.yaw + Math.sin(this.stateT * 1.3) * 0.02, dt); if (this.timer <= 0) this.nextPatrol(); this.animate(dt, 0); break;
      case 'investigate': this.doInvestigate(dt, speed); break;
      case 'search': this.doSearch(dt, speed); break;
      case 'chase': this.doChase(dt, speed); break;
      case 'checkhide': this.doCheckHide(dt, speed); break;
      case 'place': this.timer -= dt; this.animate(dt, 0); if (this.timer <= 0) this.nextPatrol(); break;
    }
    this.maybePlaceTrap(dt);
    this.checkCatch();
    this.sync();
  }

  nextPatrol() {
    const here = this.nav.areaAt(this.pos.x, this.pos.z, this.pos.y);
    for (let tries = 0; tries < 8; tries++) {
      let c = this.patrolPts[Math.floor(Math.random() * this.patrolPts.length)];
      if (here && c.level === here.level && Math.random() < 0.0) continue;
      if (here && c.level !== here.level && Math.random() > 0.3) continue;   // mostly stay on this floor
      if (here && c.id === here.id) continue;
      const j = { x: c.x + rnd(-2, 2), z: c.z + rnd(-1.5, 1.5) };
      if (this.goTo(j.x, j.z, c.y)) { this.setState('patrol'); return; }
    }
    this.setState('idle'); this.timer = 2;
  }
  doPatrol(dt, speed) {
    if (!this.path) { this.nextPatrol(); return; }
    this.follow(dt, speed);
    if (this.arrived()) { this.setState('idle'); this.timer = rnd(1.5, 3.5); this.path = null; }
  }
  doInvestigate(dt, speed) {
    if (!this.arrived()) { this.follow(dt, speed); return; }
    this.timer -= dt; this.turnTo(this.yaw + dt * 1.6, dt); this.animate(dt, 0);   // look around
    if (this.timer <= 0) { this.setState('search'); this.timer = 4; this.lastSeen = null; this.path = null; }
  }
  doSearch(dt, speed) {
    // after losing sight: go to where he last saw you, then poke around nearby for about ten seconds
    if (this.sawHide && this.stateT < 0.2 && Math.random() < this.cfg.hide) { this.setState('checkhide'); this.goTo(this.sawHide.sx, this.sawHide.sz, this.sawHide.y); return; }
    if (this.stateT === dt || (!this.path && this.lastSeen)) { if (this.lastSeen) { this.goTo(this.lastSeen.x, this.lastSeen.z, this.lastSeen.y); this.lastSeen = null; } }
    if (!this.arrived()) { this.follow(dt, speed); return; }
    this.timer -= dt; this.turnTo(this.yaw + dt * 1.2, dt); this.animate(dt, 0);
    this.wander = (this.wander || 0) - dt;
    if (this.wander <= 0) { this.wander = 3; const a = this.nav.areaAt(this.pos.x, this.pos.z, this.pos.y); if (a) this.goTo(rnd(a.rect[0] + 1, a.rect[2] - 1), rnd(a.rect[1] + 1, a.rect[3] - 1), this.pos.y); }
    if (this.stateT > 12 || this.timer < -6) { this.sawHide = null; this.nextPatrol(); }
  }
  doChase(dt, speed) {
    const p = this.player;
    this.pathT -= dt;
    const target = this.canSeeNow || this.trackPlush ? { x: p.pos.x, z: p.pos.z, y: p.pos.y } : this.lastSeen;
    if (target && (this.pathT <= 0 || this.arrived())) { this.goTo(target.x, target.z, target.y); this.pathT = 0.4; }
    if (!this.arrived()) this.follow(dt, speed); else { this.animate(dt, 0); }
    if (!this.canSeeNow && !this.trackPlush && this.unseenT > 1.2) { this.setState('search'); this.timer = 6; this.path = null; this.wander = 0; }
  }
  doCheckHide(dt, speed) {
    if (!this.arrived()) { this.follow(dt, speed); return; }
    const sh = this.sawHide; this.animate(dt, 0);
    this.timer = (this.timer || 0) + dt; if (this.timer < 1.2) return; this.timer = 0;
    if (this.player.hide && this.player.hide.spot === sh.spot) {
      const unreachable = sh.spot.kind === 'tunnel' || sh.spot.kind === 'nook';
      if (unreachable) { this.sawHide = null; this.setState('search'); this.timer = 3; this.wander = 0; return; }   // he cannot crawl in after you
      this.catchPlayer(sh.spot.kind === 'table' ? 'table' : 'grab');
    } else { this.sawHide = null; this.setState('search'); this.timer = 3; this.wander = 0; }
  }

  // The player just crept into a hiding place: if he was watching, he remembers it.
  noteHide(spot, sx, sz) {
    if (!this.present || this.grace > 0) return;
    if (this.sees(true)) { this.sawHide = { spot, sx, sz, y: spot.y }; }
  }

  // ---------- movement ----------
  turnTo(yaw, dt) { const d = wrap(yaw - this.yaw); this.yaw += Math.sign(d) * Math.min(Math.abs(d), 6 * dt); }
  follow(dt, speed) {
    const path = this.path; if (!path) return;
    while (this.pi < path.length) { const q = path[this.pi], h = Math.hypot(q.x - this.pos.x, q.z - this.pos.z); const flat = this.pi === 0 || Math.abs(q.y - path[this.pi - 1].y) < 0.05;
      if (h < 0.1 || (h < 0.28 && flat)) this.pi++; else break; }
    if (this.pi >= path.length) { this.animate(dt, 0); return; }
    const w = path[this.pi], dx = w.x - this.pos.x, dz = w.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    this.turnTo(Math.atan2(-dx, -dz), dt);
    this.openDoorsAhead(dx / d, dz / d);
    const step = Math.min(d, speed * dt);
    const px = this.pos.x, pz = this.pos.z;
    this.world.collision.move(this.pos, dx / d * step, dz / d * step, RADIUS, this.pos.y + 0.25, this.pos.y + 1.9);
    const f = this.world.floorAt(this.pos.x, this.pos.z, this.pos.y + 0.45, true);
    if (f === null) {   // stepped over an opening (stairwell edge): slide along it, or stay put
      const nx = this.pos.x, nz = this.pos.z, fy = this.pos.y + 0.45, W = this.world;
      if (W.floorAt(nx, pz, fy, true) !== null) this.pos.z = pz; else if (W.floorAt(px, nz, fy, true) !== null) this.pos.x = px; else { this.pos.x = px; this.pos.z = pz; }
    } else this.pos.y += (f - this.pos.y) * Math.min(1, dt * 14);
    this.moved = Math.hypot(this.pos.x - px, this.pos.z - pz);
    this.animate(dt, this.moved / dt);
    // stuck detection: re-plan; after that, wiggle sideways (never teleport)
    this.stuckT += dt;
    if (this.stuckT > 1.5) {
      if (Math.hypot(this.pos.x - this.stuckPos.x, this.pos.z - this.stuckPos.z) < 0.25 && this.target) {
        this.repaths++; this.stuckPos.copy(this.pos); this.stuckT = 0;
        if (this.repaths > 1) this.unstick();
        if (this.repaths > 3) { this.path = null; this.setState(this.state === 'chase' ? 'chase' : 'idle'); this.timer = 0.5; } else { this.keepRepaths = true; this.goTo(this.target.x, this.target.z, this.target.y); this.keepRepaths = false; }
      } else { this.stuckPos.copy(this.pos); this.stuckT = 0; }
    }
  }
  // Wedged against an edge (stairwell lip, furniture corner): step a little way to the nearest clear spot, away from the stair centre when close to it.
  unstick() {
    const W = this.world, col = W.collision, ox = this.pos.x, oz = this.pos.z, cx = this.nav.stairs.x, cz = this.nav.stairs.z;
    let best = null, bestScore = -1e9;
    for (let k = 0; k < 16; k++) for (const r of [0.12, 0.25]) {
      const a = k * Math.PI / 8 + Math.random() * 0.2, x = ox + Math.cos(a) * r, z = oz + Math.sin(a) * r;
      const f = W.floorAt(x, z, this.pos.y + 0.45, true); if (f === null || Math.abs(f - this.pos.y) > 0.45) continue;
      if (col.overlaps(x, z, RADIUS, f + 0.25, f + 1.9)) continue;
      const toStair = Math.hypot(x - cx, z - cz), margin = Math.min(toStair - 1.9, 0.2) * 0 ;
      const score = (Math.hypot(ox - cx, oz - cz) < 2.6 ? toStair * 2 : 0) + Math.random() + margin;
      if (score > bestScore) { bestScore = score; best = { x, z, f }; }
    }
    if (best) { this.pos.set(best.x, this.pos.y, best.z); }
  }
  openDoorsAhead(dx, dz) {
    for (const d of this.world.doors) {
      if (d.openT > 0.2 || d.target) continue;
      const o = d.o, cx = o.axis === 'x' ? (o.a + o.b) / 2 : o.c, cz = o.axis === 'x' ? o.c : (o.a + o.b) / 2;
      if (Math.abs(LEVEL_Y[o.level] - this.pos.y) > 1.5) continue;
      const rx = cx - this.pos.x, rz = cz - this.pos.z;
      if (Math.hypot(rx, rz) < 1.7 && rx * dx + rz * dz > 0 && !d.locked) { d.toggle(true); sfx.doorCreak && sfx.doorCreak(); }
    }
  }

  // ---------- noises he makes ----------
  animate(dt, speed) {
    const r = this.rig, sp = Math.min(1, speed / WALK);
    if (!r.legL) return;
    r.phase += speed * dt * 2.7;
    const sw = Math.sin(r.phase) * 0.5 * sp, chase = this.state === 'chase' ? 1 : 0;
    r.legL.rotation.x = sw; r.legR.rotation.x = -sw;
    r.armL.rotation.x = -sw * 0.7 - chase * 0.35; r.armR.rotation.x = sw * 0.45 - chase * 0.2;
    r.root.position.y = Math.abs(Math.sin(r.phase)) * 0.035 * sp;
    r.root.rotation.x += ((chase * 0.18 + (this.fall > 0 ? -1.45 * this.fall : 0)) - r.root.rotation.x) * Math.min(1, dt * 8);
    if (this.stun > 0) { r.armL.rotation.x = Math.sin(this.stateT * 40) * 0.3; r.legR.rotation.x = Math.sin(this.stateT * 33) * 0.25; }
    // footsteps and breathing
    const d = Math.hypot(this.pos.x - this.player.pos.x, this.pos.z - this.player.pos.z) + Math.abs(this.pos.y - this.player.pos.y) * 2;
    if (speed > 0.2) { this.stepT -= speed * dt; if (this.stepT <= 0) { this.stepT = 1.15; const a = wrap(Math.atan2(-(this.pos.x - this.player.pos.x), -(this.pos.z - this.player.pos.z)) - this.player.yaw); sfx.smileyStep(d, Math.sin(a)); } }
    sfx.setBreath(d < 14 ? (1 - d / 14) : 0, this.state === 'chase');
  }
  sync() { this.root.position.copy(this.pos); this.root.rotation.y = this.yaw + Math.PI; }   // the model faces +z, he walks toward -z of his yaw

  // ---------- traps ----------
  maybePlaceTrap(dt) {
    this.trapT -= dt; if (this.trapT > 0 || (this.state !== 'patrol' && this.state !== 'search')) return;
    this.trapT = rnd(45, 90);
    if (this.traps.length >= 5 || Math.hypot(this.pos.x - this.player.pos.x, this.pos.z - this.player.pos.z) < 4) return;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.025, 20), new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.3, emissive: 0x4a0a30, transparent: true, opacity: 0.85 }));
    mesh.position.set(this.pos.x - Math.sin(this.yaw) * 0.0, this.pos.y + 0.014, this.pos.z); this.scene.add(mesh);
    this.traps.push({ x: this.pos.x, z: this.pos.z, y: this.pos.y, mesh });
    this.setState('place'); this.timer = 1.1; this.path = null;
  }

  // ---------- stuns from the Party Stun Gun ----------
  processStuns() {
    const st = this.world.stuns; if (!st || !st.length) return;
    for (const s of st.splice(0)) {
      const dx = this.pos.x - s.x, dy = this.pos.y + 1.0 - s.y, dz = this.pos.z - s.z, d = Math.hypot(dx, dy, dz);
      if (d > 10.5 || d < 0.2) continue;
      const dot = (dx * s.dx + dy * s.dy + dz * s.dz) / d; if (dot < 0.97) continue;
      this.stun = 30; this.setState('stunned'); this.path = null; sfx.stunned && sfx.stunned();
    }
  }

  // ---------- catching ----------
  checkCatch() {
    const p = this.player; if (this.state !== 'chase' || p.hide) return;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (d < 1.0 && Math.abs(p.pos.y - this.pos.y) < 1.4) this.catchPlayer(Math.random() < 0.45 ? 'hit' : 'grab');
  }
  catchPlayer(kind) { if (this.catching) return; this.catching = true; this.path = null; this.onCatch(kind); }
}
