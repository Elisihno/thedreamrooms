import * as THREE from '../three.js';
import { LEVEL_Y } from '../world/layout.js';
import { READ, ITEMS } from './catalog.js';
import { sfx } from '../audio/sfx.js';

const Y = l => LEVEL_Y[l];
// Items that do something on their own when you press USE.
const SELF = new Set(['needle', 'whistle', 'windup_toy', 'music_box', 'confetti_popper', 'tape_recorder', 'invitation', 'passage_diagram', 'exit_code_note', 'plush', 'zapper']);

// Confetti and pop particles (one pooled InstancedMesh).
class Fx {
  constructor(scene) {
    this.max = 360; this.live = [];
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
    this.o = new THREE.Object3D(); this.c = new THREE.Color();
    this.cols = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xff7eb6, 0xff8c1a];
  }
  spawn(x, y, z, vx, vy, vz, color, life = 1.6) { if (this.live.length < this.max) this.live.push({ x, y, z, vx, vy, vz, color, life, rx: Math.random() * 6, spin: (Math.random() - 0.5) * 12 }); }
  confetti(x, y, z, dir, n = 120) { for (let i = 0; i < n; i++) { const s = 2 + Math.random() * 4; this.spawn(x, y, z, dir.x * s + (Math.random() - 0.5) * 3, dir.y * s + 1 + Math.random() * 2, dir.z * s + (Math.random() - 0.5) * 3, this.cols[i % 7], 2 + Math.random()); } }
  burst(x, y, z, color, n = 22) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 2.5; this.spawn(x, y, z, Math.cos(a) * s, (Math.random() - 0.3) * 2.5, Math.sin(a) * s, color ?? this.cols[i % 7], 0.9); } }
  update(dt) {
    let n = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.life -= dt;
      if (p.life <= 0) { this.live.splice(i, 1); continue; }
      p.vy -= 6 * dt; p.vx *= 1 - 1.2 * dt; p.vz *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y = Math.max(p.y + p.vy * dt, p.floor ?? -1e9); p.z += p.vz * dt; p.rx += p.spin * dt;
    }
    for (const p of this.live) { this.o.position.set(p.x, p.y, p.z); this.o.rotation.set(p.rx, p.rx * 0.7, 0); this.o.updateMatrix(); this.mesh.setMatrixAt(n, this.o.matrix); this.mesh.setColorAt(n, this.c.setHex(p.color)); n++; }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// What items DO: pop balloons, whistle, music box, wind-up toy, recorder, confetti, notes, the zapper, and every
// install-into-a-machine action (exit mechanisms, elevator repairs, generator, security door, compartments, assembly bench).
export class UseSystem {
  constructor({ items, world, player, camera, scene, ui }) {
    Object.assign(this, { items, world, player, camera, scene, ui });
    this.fx = new Fx(scene);
    this._d = new THREE.Vector3();
    this.p = { exit: { key: false, wires: false, code: false, fuse: false }, exitOpen: false, elev: { motor: false, circuit: false, wiring: false }, genHandle: false, genFuse: false, elevOpen: false, handle: false, party: false, maint: false, bench: {}, passages: [], popped: [] };
    this.anim = []; this.time = 0; this.alarmT = 0; this.ended = false; this.zaps = [];
    world.stuns = []; world.fixtures.hatchGate = (P, held) => this.hatchGate(P, held);
    this.buildStations(); this.buildKeypadLight(); this.buildDoorSocket();
    world.interactable({ x: 58.7, y: Y('1') + 1.3, z: 20.6, radius: 3.2, kind: 'monitor', onUse: () => world.fixtures.openCameras && world.fixtures.openCameras() });   // the security monitors
    world.fixtures.onLocked = () => this.need(this.needText('turning_handle'));
    items.extraSave = () => this.p;
  }

  // ---------- persistence ----------
  restore(extra) {
    if (!extra) { this.applyDoors(); return; }
    const q = this.p;
    Object.assign(q, extra, { exit: { ...q.exit, ...extra.exit }, elev: { ...q.elev, ...extra.elev }, bench: { ...extra.bench } });
    for (const key of q.popped) this.popKey(key, true);
    for (const id of q.passages) this.world.passages.find(P => P.id === id)?.open();
    if (q.exit.code) this.setKeypadLight(true);
    if (q.exitOpen) this.openExit(true);
    if (q.elevOpen) this.openElevator(true);
    this.applyDoors();
  }
  applyDoors() {
    const d = this.world.doors.find(d => d.o.kind === 'heavy'); if (!d) return;
    d.locked = !this.p.handle; if (this.doorSocket) this.doorSocket.visible = !this.p.handle;
    // the bracket and the installed handle are mounted ON the door so they swing with it
    for (const obj of [this.doorSocket, this.p.handle && this.items.items.find(i => i.id === 'turning_handle' && i.state === 'installed')?.mesh]) { if (obj && obj.parent !== d.pivot) { obj.updateWorldMatrix(true, false); d.pivot.attach(obj); } }
  }

  // ---------- stations: places that take an item ----------
  buildStations() {
    const it = this.items, q = this.p, S = [];
    const add = s => { S.push(s); return s; };
    // Emergency Exit Room: four mechanisms (west wall, level 1)
    add({ id: 'ex_key', level: '1', x: 0.45, y: 1.2, z: 13.6, r: 2.2, accepts: ['exit_key'], done: () => q.exit.key, apply: h => { q.exit.key = true; it.installAt(h, { x: 0.5, y: 1.3, z: 13.6, ry: Math.PI / 2, rx: -Math.PI / 2 }); sfx.install(); this.checkExit(); } });
    add({ id: 'ex_wires', level: '1', x: 0.4, y: 1.2, z: 14.7, r: 2.2, accepts: ['wire_cutters'], done: () => q.exit.wires, apply: () => { q.exit.wires = true; sfx.zap(); this.fx.burst(0.5, Y('1') + 1.2, 14.7, 0xffe07a, 14); this.checkExit(); } });
    add({ id: 'ex_code', level: '1', x: 0.2, y: 1.4, z: 19.5, r: 2.2, accepts: ['exit_code_note'], done: () => q.exit.code, apply: () => { q.exit.code = true; this.setKeypadLight(true); sfx.click(); setTimeout(() => sfx.ding(), 120); this.checkExit(); } });
    add({ id: 'ex_fuse', level: '1', x: 0.3, y: 1.0, z: 20.7, r: 2.2, accepts: ['exit_fuse'], done: () => q.exit.fuse, apply: h => { q.exit.fuse = true; it.installAt(h, { x: 0.38, y: 1.15, z: 20.7, ry: Math.PI / 2, rx: -Math.PI / 2 }); sfx.install(); this.checkExit(); } });
    // Elevator Room (floor 3): motor, circuit, wiring; basement generator: handle + fuse; the elevator door itself
    const e3 = Y('3'), b = Y('B');
    add({ id: 'el_motor', level: '3', x: 52, y: e3 + 0.5, z: 17.9, r: 2.4, accepts: ['elevator_motor'], done: () => q.elev.motor, apply: h => { q.elev.motor = true; it.installAt(h, { x: 52, y: e3, z: 17.95 }); sfx.install(); } });
    add({ id: 'el_circuit', level: '3', x: 51, y: e3 + 1.2, z: 23.5, r: 2.4, accepts: ['elevator_circuit'], done: () => q.elev.circuit, apply: h => { q.elev.circuit = true; it.installAt(h, { x: 51, y: e3 + 1.1, z: 23.55, rx: -Math.PI / 2 }); sfx.install(); } });
    add({ id: 'el_wiring', level: '3', x: 55.4, y: e3 + 1.2, z: 23.5, r: 2.4, accepts: ['screwdriver'], done: () => q.elev.wiring, apply: () => { q.elev.wiring = true; sfx.zap(); this.fx.burst(55.4, e3 + 1.2, 23.4, 0xffe07a, 14); } });
    add({ id: 'gen_handle', level: 'B', x: 23, y: b + 0.9, z: 17.4, r: 2.2, accepts: ['generator_handle'], done: () => q.genHandle, apply: h => { q.genHandle = true; it.installAt(h, { x: 23, y: b + 0.6, z: 17.3 }); sfx.install(); this.checkPower(); } });
    add({ id: 'gen_fuse', level: 'B', x: 25.3, y: b + 0.9, z: 17.4, r: 2.2, accepts: ['power_fuse'], done: () => q.genFuse, apply: h => { q.genFuse = true; it.installAt(h, { x: 25.3, y: b + 0.9, z: 17.3, rx: -Math.PI / 2 }); sfx.install(); this.checkPower(); } });
    add({ id: 'el_door', need: 'I Need the Elevator Key', level: '3', x: 59.3, y: e3 + 1.1, z: 11, r: 2.4, accepts: ['elevator_key'], done: () => q.elevOpen,
      apply: h => { if (!(q.elev.motor && q.elev.circuit && q.elev.wiring && q.genHandle && q.genFuse)) { this.need('The Elevator Needs Repairs First'); return; } sfx.install(); this.items.consume(h); this.openElevator(); } });
    // Security Room door: the Turning Handle
    add({ id: 'sec_door', level: '1', x: 54.4, y: 1.1, z: 15.6, r: 2.2, accepts: ['turning_handle'], done: () => q.handle, apply: h => { q.handle = true; it.installAt(h, { x: 53.65, y: 1.05, z: 15.9, rx: -Math.PI / 2 }); sfx.install(); this.applyDoors(); } });
    // optional locked compartments (each holds one Battery)
    add({ id: 'lock_party', level: '1', x: 50.5, y: 1.1, z: 0.8, r: 2.0, accepts: ['party_room_key'], done: () => q.party, apply: h => { q.party = true; it.consume(h); sfx.install(); const b1 = it.items.find(i => i.uid === 'battery#1'); if (b1) it.reveal(b1, 50.5, Y('1') + 1.0, 1.1); } });
    add({ id: 'lock_maint', level: '3', x: 49.6, y: e3 + 1.1, z: 4.8, r: 2.0, accepts: ['maintenance_key'], done: () => q.maint, apply: () => { q.maint = true; sfx.install(); const b2 = it.items.find(i => i.uid === 'battery#2'); if (b2) it.reveal(b2, 49.6, e3 + 1.0, 5.1); } });
    // Party Zapper assembly bench (Party Preparation Room)
    const slots = { zap_a: 54.55, zap_b: 55.0, zap_c: 55.45 };
    add({ id: 'bench', need: 'I Need the Stun Gun Parts', level: '1', x: 55, y: 1.1, z: 1.4, r: 2.3, accepts: ['zap_a', 'zap_b', 'zap_c'], done: () => false, canAccept: h => !q.bench[h.id],
      apply: h => { q.bench[h.id] = true; it.installAt(h, { x: slots[h.id], y: 0.96, z: 0.8 }); sfx.install();
        if (q.bench.zap_a && q.bench.zap_b && q.bench.zap_c) {
          for (const id of Object.keys(slots)) { const p = it.items.find(i => i.id === id); if (p) it.consume(p, true); }
          const z = it.items.find(i => i.id === 'zapper'); if (z) { z.x = 55; z.y = 0.96; z.z = 0.8; z.charges = 0; it.place(z); }
          sfx.ding(); it.save();
        } } });
    this.stations = S;
  }

  checkExit() { const e = this.p.exit; if (e.key && e.wires && e.code && e.fuse && !this.p.exitOpen) this.openExit(); }
  checkPower() { if (this.p.genHandle && this.p.genFuse) { sfx.rumble(); this.items.save(); } }

  // The keypad's indicator: red until the Exit Code Note has been held up to it, then green.
  buildKeypadLight() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.036), new THREE.MeshBasicMaterial({ color: 0xcc2222 }));
    g.rotation.y = Math.PI / 2; g.position.set(0.198, Y('1') + 1.525, 19.5); this.scene.add(g); this.keypadLight = g;   // covers the keypad's display
  }
  // The empty bracket where the Turning Handle goes, on the Security Room door.
  buildDoorSocket() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xb59a4a, roughness: 0.4, metalness: 0.6 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.012), m), stub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10), m);
    stub.rotation.x = Math.PI / 2; stub.position.z = -0.02;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); led.position.set(0.04, 0.04, -0.01); g.add(plate, stub, led);
    g.position.set(53.65, Y('1') + 1.05, 15.9); this.scene.add(g); this.doorSocket = g; g.visible = !this.p.handle;
  }
  setKeypadLight(on) { this.keypadLight.material.color.setHex(on ? 0x39ff6a : 0xcc2222); }

  // ---------- doors that open the endings ----------
  slideDoors(doors, axisDir, instant, box, then) {
    if (box) box.enabled = false;
    const t0 = this.time;
    const apply = k => doors.forEach((d, i) => { d.position.z = d.userData.z0 + (i ? 1 : -1) * 1.1 * k; });
    if (instant) { apply(1); return; }
    this.anim.push({ t0, dur: 1.4, step: k => apply(k) });
  }
  openExit(instant = false) {
    this.p.exitOpen = true;
    this.slideDoors(this.world.fixtures.exitDoors || [], 1, instant, this.world.fixtures.exitBox);
    if (!instant) { sfx.alarm(); this.alarmT = 12; this.items.save(); }
  }
  openElevator(instant = false) {
    this.p.elevOpen = true;
    this.slideDoors(this.world.fixtures.elevDoors || [], 1, instant, this.world.fixtures.elevBox);
    if (!instant) { sfx.rumble(); this.items.save(); }
  }

  hatchGate(P, held) {
    if (P.isOpen) return;
    if (P.requires && held !== P.requires) { this.need(this.needText(P.requires)); return; }
    if (P.requires) sfx.install();
    P.open(); if (!this.p.passages.includes(P.id)) this.p.passages.push(P.id);
    this.items.dirty = true; this.items.save();
  }

  // ---------- looking at things ----------
  inView(x, y, z, r) {
    const eye = this.camera.position, d = this.camera.getWorldDirection(this._d);
    const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, dist = Math.hypot(dx, dy, dz);
    if (dist > r) return -1;
    const dot = (dx * d.x + dy * d.y + dz * d.z) / Math.max(dist, 0.001);
    return dot > 0.45 ? dot - dist * 0.08 : -1;
  }
  // "I Need a Exit Key" style messages
  needText(id) {
    const n = ITEMS[id].name, plural = /s$/.test(n) && !/ss$/.test(n);
    return 'I Need ' + (plural ? '' : (/^[AEIOU]/i.test(n) ? 'an ' : 'a ')) + n;
  }
  need(text) { sfx.buzz(); this.ui.need(text); }
  // The station you are looking at. `ready` means the item in your hand is the one it takes.
  stationTarget(heldId, onlyReady = false) {
    let best = null, bs = -1;
    const held = this.items.held;
    for (const s of this.stations) {
      if (s.done()) continue;
      if (Math.abs(Y(s.level) - this.player.pos.y) > 3) continue;
      const ready = !!(heldId && s.accepts.includes(heldId) && (!s.canAccept || s.canAccept(held)));
      if (onlyReady && !ready) continue;
      const sc = this.inView(s.x, s.y, s.z, s.r);
      if (sc > bs) { bs = sc; best = s; }
    }
    return best;
  }
  stationReady(s, heldId) { return !!(heldId && s.accepts.includes(heldId) && (!s.canAccept || s.canAccept(this.items.held))); }
  hatchTarget(heldId) {
    if (!heldId) return null;
    let best = null, bs = -1;
    for (const it of this.world.interactables) {
      if (it.kind !== 'hatch' || !it.passage || it.passage.isOpen || it.passage.requires !== heldId) continue;
      const sc = this.inView(it.x, it.y, it.z, it.radius); if (sc > bs) { bs = sc; best = it; }
    }
    return best;
  }
  zapperTarget() { const t = this.items.target(); return t && t.id === 'zapper' ? t : null; }

  // The USE button shows only when pressing it would do something.
  canUse() {
    const h = this.items.held; if (!h) return false;
    if (SELF.has(h.id)) return true;
    if (h.id === 'battery') return !!this.zapperTarget();
    return !!(this.stationTarget(h.id, true) || this.hatchTarget(h.id));
  }

  // ---------- pressing USE ----------
  useHeld() {
    const h = this.items.held; if (!h) return false;
    const st = this.stationTarget(h.id, true);
    if (st) { st.apply(h); this.items.dirty = true; this.items.save(); return true; }
    const ht = this.hatchTarget(h.id);
    if (ht) { ht.onUse(h.id); return true; }
    if (h.id === 'battery') { const z = this.zapperTarget(); if (z && (z.charges || 0) < 3) { z.charges = (z.charges || 0) + 1; this.items.consume(h); sfx.install(); return true; } sfx.buzz(); return false; }
    switch (h.id) {
      case 'needle': this.popNearby(); return true;
      case 'whistle': sfx.whistle(); this.noise(1.0, 'whistle'); return true;
      case 'plush': sfx.squeak(); this.noise(0.15, 'squeak'); return true;
      case 'confetti_popper': this.confettiPopper(h); return true;
      case 'music_box': this.placeRunning(h, { type: 'box', t: 15, step: -1 }); return true;
      case 'windup_toy': this.placeRunning(h, { type: 'toy', t: 12 }); return true;
      case 'tape_recorder': this.tape(h); return true;
      case 'zapper': return this.fireZapper();
      case 'invitation': case 'passage_diagram': case 'exit_code_note': this.ui.note(READ[h.id]({ exitCode: this.items.exitCode })); return true;
      default: return false;
    }
  }
  // Hand button on a station: use the item in your hand on it.
  useStation(s) {
    const h = this.items.held;
    if (h && this.stationReady(s, h.id)) { s.apply(h); this.items.dirty = true; this.items.save(); return; }
    this.need(s.need || this.needText(s.accepts[0]));
  }

  noise(loud, src, at) { const p = at || this.player.pos; this.world.noises.push({ x: p.x, y: p.y, z: p.z, loud, src, t: this.items.time }); if (this.world.noises.length > 32) this.world.noises.shift(); }

  // ---------- balloon popper ----------
  popNearby() {
    const eye = this.camera.position, d = this.camera.getWorldDirection(this._d);
    let n = 0;
    for (const b of this.world.balloons) {
      if (b.popped) continue;
      const dx = b.x - eye.x, dz = b.z - eye.z, dy = b.y - eye.y, flat = Math.hypot(dx, dz);
      if (flat > 2.3 + b.r || Math.abs(dy) > 2.6) continue;
      if ((dx * d.x + dz * d.z) / Math.max(flat, 0.01) < -0.1 && flat > 0.6) continue;   // not behind you
      this.popBalloon(b); n++;
    }
    if (n) { sfx.pop(); this.noise(Math.min(1, 0.5 + n * 0.15), 'pop'); this.items.dirty = true; this.items.save(); } else sfx.click();
  }
  popBalloon(b, silent = false) {
    b.popped = true; const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const m of b.meshes) { m.setMatrixAt(b.index, z); m.instanceMatrix.needsUpdate = true; }
    if (!silent) this.fx.burst(b.x, b.y, b.z, b.color, 20);
    if (!this.p.popped.includes(b.key)) this.p.popped.push(b.key);
  }
  popKey(key, silent) { const b = this.world.balloons.find(q => q.key === key); if (b && !b.popped) this.popBalloon(b, silent); }

  // ---------- other utility items ----------
  confettiPopper(h) {
    const eye = this.camera.position, d = this.camera.getWorldDirection(this._d);
    this.fx.confetti(eye.x + d.x * 0.7, eye.y + d.y * 0.7 - 0.2, eye.z + d.z * 0.7, d.clone(), 140);
    sfx.bang(); this.noise(0.9, 'bang'); this.items.consume(h);
  }
  placeRunning(h, run) {
    const yaw = this.player.yaw; const it = this.items.release(0.5, 0.3); if (!it) return;
    it.run = { ...run, yaw }; this.items.dirty = true;
    if (run.type === 'toy') sfx.tick();
  }
  tape(h) {
    if (!h.recorded) {
      const recent = [...this.world.noises].reverse().find(n => this.items.time - n.t < 12);
      h.recorded = recent ? recent.src : 'rustle'; sfx.record(); this.items.dirty = true; this.items.save(); return;
    }
    const it = this.items.release(0.5, 0.3); if (!it) return;
    it.run = { type: 'tape', t: 4.5, delay: 1.0, played: 0 };
  }
  playSample(src) { ({ whistle: sfx.whistle, pop: sfx.pop, bang: sfx.bang, squeak: sfx.squeak, throw: sfx.click, drop: sfx.click, zap: sfx.zap, alarm: sfx.alarm }[src] || sfx.click)(); }

  fireZapper() {
    const h = this.items.held; if (!h || h.id !== 'zapper') return false;
    if (!(h.charges > 0)) { sfx.buzz(); return false; }
    h.charges--; sfx.zap(); this.ui.flash();
    const eye = this.camera.position, d = this.camera.getWorldDirection(this._d).clone();
    const from = new THREE.Vector3(eye.x + d.x * 0.5, eye.y - 0.15 + d.y * 0.5, eye.z + d.z * 0.5), to = from.clone().addScaledVector(d, 9);
    this.world.stuns.push({ x: from.x, y: from.y, z: from.z, dx: d.x, dy: d.y, dz: d.z, t: this.items.time });
    this.noise(0.6, 'zap');
    const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12, j = i === 0 || i === 12 ? 0 : 0.12; pts.push(new THREE.Vector3().lerpVectors(from, to, k).add(new THREE.Vector3((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j))); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fe8ff })); line.frustumCulled = false; this.scene.add(line);
    this.zaps.push({ line, t: 0.18 }); this.fx.burst(to.x, to.y, to.z, 0x9fe8ff, 16);
    this.items.dirty = true; this.items.save(); return true;
  }

  // ---------- per-frame ----------
  update(dt) {
    this.time += dt; this.fx.update(dt);
    for (let i = this.anim.length - 1; i >= 0; i--) { const a = this.anim[i], k = Math.min(1, (this.time - a.t0) / a.dur); a.step(k * k * (3 - 2 * k)); if (k >= 1) this.anim.splice(i, 1); }
    for (let i = this.zaps.length - 1; i >= 0; i--) { const z = this.zaps[i]; z.t -= dt; if (z.t <= 0) { this.scene.remove(z.line); z.line.geometry.dispose(); this.zaps.splice(i, 1); } }
    if (this.alarmT > 0) { this.alarmT -= dt; this.alarmNoise = (this.alarmNoise || 0) - dt; if (this.alarmNoise <= 0) { this.alarmNoise = 3; this.noise(1.0, 'alarm', { x: 1, y: Y('1'), z: 17 }); } }
    for (const it of this.items.items) if (it.run && it.state === 'world') this.runItem(it, dt);
    const p = this.player.pos;
    if (!this.ended) {
      if (this.p.exitOpen && p.x < 0.7 && Math.abs(p.z - 17) < 1.6 && Math.abs(p.y - Y('1')) < 1) this.end('exit');
      else if (this.p.elevOpen && p.x > 59.3 && Math.abs(p.z - 11) < 1.3 && Math.abs(p.y - Y('3')) < 1) this.end('elevator');
    }
  }
  runItem(it, dt) {
    const r = it.run; r.t -= dt;
    if (r.type === 'toy') {
      const f = { x: -Math.sin(r.yaw), z: -Math.cos(r.yaw) }, step = 0.45 * dt, nx = it.x + f.x * step, nz = it.z + f.z * step;
      const fl = this.world.floorAt(nx, nz, it.y + 0.15, true);
      if (fl === null || Math.abs(fl - it.y) > 0.12 || this.world.collision.overlaps(nx, nz, 0.1, it.y + 0.05, it.y + 0.3)) r.yaw += Math.PI * (0.6 + Math.random() * 0.5);
      else { it.x = nx; it.z = nz; it.y = fl; }
      it.mesh.position.set(it.x, it.y, it.z); it.mesh.rotation.set(0, r.yaw, Math.sin(this.time * 14) * 0.14);
      r.tick = (r.tick || 0) - dt; if (r.tick <= 0) { r.tick = 0.45; sfx.tick(); }
      r.n = (r.n || 0) - dt; if (r.n <= 0) { r.n = 1.5; this.noise(0.35, 'toy', it); }
    } else if (r.type === 'box') {
      r.bar = (r.bar || 0) - dt;
      if (r.bar <= 0) { r.bar = 2; r.step++; sfx.musicBar(r.step); this.noise(0.5, 'music', it); }
    } else if (r.type === 'tape') {
      r.delay -= dt;
      if (r.delay <= 0 && r.played < 3) { r.delay = 1.2; r.played++; this.playSample(it.recorded); this.noise(0.7, it.recorded, it); }
    }
    if (r.t <= 0) { it.run = null; it.mesh.rotation.z = 0; this.items.dirty = true; this.items.save(); }
  }

  end(kind) { this.ended = true; this.ui.ending(kind); }
}
