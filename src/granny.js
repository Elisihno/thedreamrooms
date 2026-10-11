import * as THREE from 'three';
import { nodes, stairEdges, groundY, GRANNY_SPAWN } from './layout.js';

const S = { PATROL: 0, INVESTIGATE: 1, CHASE: 2, SEARCH: 3 };
const SPEED = { patrol: 1.3, investigate: 1.9, chase: 2.5 };

// ---------- path graph ----------
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const adj = new Map(nodes.map((n) => [n.id, []]));
let graphBuilt = false;

function buildGraph(world) {
  if (graphBuilt) return;
  graphBuilt = true;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.level !== b.level) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 12) continue;
      if (world.blocked(a.x, a.z, b.x, b.z, a.y, true)) continue;
      adj.get(a.id).push({ id: b.id, d });
      adj.get(b.id).push({ id: a.id, d });
    }
  }
  for (const [p, q] of stairEdges) {
    const a = byId[p], b = byId[q];
    const d = Math.hypot(a.x - b.x, a.z - b.z) + 3;
    adj.get(p).push({ id: q, d });
    adj.get(q).push({ id: p, d });
  }
}

function findPath(from, to) {
  if (from === to) return [byId[from]];
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const open = new Set([from]);
  while (open.size) {
    let cur = null, best = Infinity;
    for (const id of open) if (dist.get(id) < best) { best = dist.get(id); cur = id; }
    if (cur === to) break;
    open.delete(cur);
    for (const e of adj.get(cur)) {
      const nd = best + e.d;
      if (nd < (dist.get(e.id) ?? Infinity)) {
        dist.set(e.id, nd);
        prev.set(e.id, cur);
        open.add(e.id);
      }
    }
  }
  if (!prev.has(to)) return [];
  const path = [byId[to]];
  for (let c = to; prev.has(c);) { c = prev.get(c); path.unshift(byId[c]); }
  return path;
}

// ---------- model ----------
function makeModel() {
  const g = new THREE.Group();
  const lam = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const skin = lam(0xc9b3a0), dress = lam(0x5b4a63), cardi = lam(0x7a5a4a), hair = lam(0xe2e0dc);
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.26, 0.5, 1.0, 10), dress, 0, 0.5, 0);
  const torso = add(new THREE.CylinderGeometry(0.22, 0.27, 0.6, 10), cardi, 0, 1.28, 0);
  torso.rotation.x = 0.12; // slight hunch
  const head = new THREE.Group();
  head.position.set(0, 1.74, 0.05);
  g.add(head);
  add(new THREE.SphereGeometry(0.19, 12, 10), skin, 0, 0, 0, head);
  const hairM = add(new THREE.SphereGeometry(0.2, 12, 8), hair, 0, 0.05, -0.04, head);
  hairM.scale.set(1.05, 0.9, 1.0);
  add(new THREE.SphereGeometry(0.1, 8, 6), hair, 0, 0.2, -0.08, head); // bun
  add(new THREE.BoxGeometry(0.04, 0.07, 0.05), skin, 0, -0.02, 0.19, head); // nose
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x120808 });
  add(new THREE.BoxGeometry(0.05, 0.03, 0.03), eyeMat, -0.07, 0.04, 0.17, head);
  add(new THREE.BoxGeometry(0.05, 0.03, 0.03), eyeMat, 0.07, 0.04, 0.17, head);
  add(new THREE.BoxGeometry(0.09, 0.015, 0.02), eyeMat, 0, -0.09, 0.17, head); // mouth
  // arms
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.28, 1.5, 0);
  armR.position.set(0.28, 1.5, 0);
  g.add(armL, armR);
  for (const a of [armL, armR]) {
    const m = add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), cardi, 0, -0.27, 0, a);
    m.rotation.x = 0;
    add(new THREE.SphereGeometry(0.06, 6, 6), skin, 0, -0.56, 0, a);
  }
  armR.rotation.x = -0.9;
  const bat = add(new THREE.BoxGeometry(0.07, 0.8, 0.07), lam(0x5b3b24), 0, -0.75, 0.05, armR);
  bat.rotation.x = 0.4;
  g.userData = { armR, armL, eyeMat, head };
  return g;
}

export class Granny {
  constructor(scene, world, sound) {
    this.world = world;
    this.sound = sound;
    buildGraph(world);
    this.mesh = makeModel();
    scene.add(this.mesh);
    this.reset();
  }

  reset() {
    const n = byId[GRANNY_SPAWN];
    this.x = n.x; this.z = n.z; this.y = n.y;
    this.dir = 0;
    this.state = S.PATROL;
    this.path = [];
    this.wait = 1;
    this.attackCd = 0;
    this.swingT = 0;
    this.stepT = 0;
    this.lastSeen = null;
    this.lostT = 0;
    this.hideCheck = 0;
    this.lastNode = n.id;
    this.walkT = 0;
    this.sync();
  }

  get chasing() { return this.state === S.CHASE; }

  nearestNode(x, z, y) {
    let best = null, bd = Infinity, bestVis = null, bvd = Infinity;
    for (const n of nodes) {
      if (Math.abs(n.y - y) > 1.6) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) { bd = d; best = n; }
      if (d < bvd && !this.world.blocked(x, z, n.x, n.z, n.y, true)) { bvd = d; bestVis = n; }
    }
    return bestVis ?? best;
  }

  goTo(x, z, y) {
    const from = this.nearestNode(this.x, this.z, this.y);
    const to = this.nearestNode(x, z, y);
    if (!from || !to) { this.path = []; return; }
    this.path = findPath(from.id, to.id);
  }

  canSee(p) {
    if (p.hidden) return false;
    const dy = Math.abs(p.y - this.y);
    if (dy > 1.4) return false;
    const dx = p.x - this.x, dz = p.z - this.z;
    const dist = Math.hypot(dx, dz);
    const range = p.crouch ? 6.5 : 13;
    if (dist > range) return false;
    if (dist > 2.5) {
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - this.dir) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.0) return false; // ~115 degree field of view
    }
    return !this.world.blocked(this.x, this.z, p.x, p.z, this.y);
  }

  hear(n, player) {
    if (this.state === S.CHASE) return;
    const d = Math.hypot(n.x - this.x, n.z - this.z) + Math.abs(n.y - this.y) * 1.5;
    if (d > n.radius) return;
    this.state = S.INVESTIGATE;
    this.target = { x: n.x, z: n.z, y: n.y };
    this.goTo(n.x, n.z, n.y);
    this.wait = 0;
  }

  moveTo(tx, tz, speed, dt) {
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    const want = Math.atan2(dx, dz);
    let diff = want - this.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.dir += diff * Math.min(1, dt * 7);
    this.y = groundY(this.x, this.z, this.y);
    this.walkT += dt * speed * 3.2;
    this.stepT -= dt;
    if (this.stepT <= 0) {
      this.stepT = 2.6 / (speed + 0.5) * 0.45;
      this.footstep = true;
    }
    return false;
  }

  followPath(speed, dt) {
    if (!this.path.length) return true;
    const n = this.path[0];
    if (this.moveTo(n.x, n.z, speed, dt)) {
      this.lastNode = n.id;
      this.path.shift();
    }
    return !this.path.length;
  }

  openDoors() {
    for (const d of this.world.doors) {
      if (d.open) continue;
      if (Math.abs(d.level * 3 - this.y) > 1.6) continue;
      if (Math.hypot(d.cx - this.x, d.cz - this.z) < 1.5) {
        this.world.setDoor(d, true);
        d.unlocked = true;
        this.sound.door(0.35);
      }
    }
  }

  update(dt, player) {
    this.footstep = false;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.openDoors();

    const sees = this.canSee(player);
    const dxp = player.x - this.x, dzp = player.z - this.z;
    const dist = Math.hypot(dxp, dzp);

    // noises (drain the shared queue)
    for (const n of this.world.noises) this.hear(n, player);
    this.world.noises.length = 0;

    if (sees) {
      if (this.state !== S.CHASE) this.sound.stinger();
      this.state = S.CHASE;
      this.lastSeen = { x: player.x, z: player.z, y: player.y };
      this.lostT = 0;
    }

    switch (this.state) {
      case S.PATROL: {
        if (!this.path.length) {
          this.wait -= dt;
          if (this.wait <= 0) {
            const options = nodes.filter((n) => n.id !== this.lastNode);
            const n = options[Math.floor(Math.random() * options.length)];
            this.goTo(n.x, n.z, n.y);
            this.wait = 1 + Math.random() * 3;
          }
        } else this.followPath(SPEED.patrol, dt);
        break;
      }
      case S.INVESTIGATE: {
        if (this.followPath(SPEED.investigate, dt)) {
          if (this.target && this.moveTo(this.target.x, this.target.z, SPEED.investigate, dt)) {
            this.state = S.SEARCH;
            this.wait = 3 + Math.random() * 2;
          }
        }
        break;
      }
      case S.SEARCH: {
        this.dir += dt * 1.2; // looks around
        // she may check a hiding spot the player used
        if (player.hidden && Math.hypot(player.x - this.x, player.z - this.z) < 2.6 && Math.abs(player.y - this.y) < 1.4) {
          this.hideCheck += dt;
          if (this.hideCheck > 2.2) {
            this.hideCheck = 0;
            if (Math.random() < 0.45) {
              player.leaveHide();
              this.state = S.CHASE;
              this.sound.stinger();
              break;
            }
          }
        }
        this.wait -= dt;
        if (this.wait <= 0) { this.state = S.PATROL; this.path = []; this.wait = 0.5; }
        break;
      }
      case S.CHASE: {
        if (sees) {
          if (dist > 1.25) this.moveTo(player.x, player.z, SPEED.chase, dt);
          else {
            const want = Math.atan2(dxp, dzp);
            this.dir += (want - this.dir) * Math.min(1, dt * 10);
          }
          this.path = [];
          if (dist < 1.6 && this.attackCd <= 0) {
            this.attackCd = 2.6;
            this.swingT = 0.45;
            this.sound.swing();
            setTimeout(() => {
              if (this.chasing && Math.hypot(player.x - this.x, player.z - this.z) < 2.1 && Math.abs(player.y - this.y) < 1.4) player.hurt();
            }, 220);
          }
        } else {
          this.lostT += dt;
          if (this.lastSeen && !this.path.length && this.lostT < 0.1) this.goTo(this.lastSeen.x, this.lastSeen.z, this.lastSeen.y);
          if (this.lastSeen && !this.path.length && this.lostT >= 0.1) {
            if (this.moveTo(this.lastSeen.x, this.lastSeen.z, SPEED.chase * 0.9, dt) || this.lostT > 8) {
              this.state = S.SEARCH;
              this.wait = 4;
              this.hideCheck = 0;
            }
          } else this.followPath(SPEED.chase * 0.9, dt);
        }
        break;
      }
    }

    if (this.footstep) {
      const dp = Math.hypot(player.x - this.x, player.z - this.z) + Math.abs(player.y - this.y);
      this.sound.step(Math.max(0, 0.5 - dp * 0.04));
    }
    this.sync();
  }

  sync() {
    const m = this.mesh;
    m.position.set(this.x, this.y + Math.abs(Math.sin(this.walkT)) * 0.025, this.z);
    m.rotation.y = this.dir;
    const u = m.userData;
    u.armL.rotation.x = Math.sin(this.walkT) * 0.25;
    const swing = this.swingT > 0 ? Math.sin((1 - this.swingT / 0.45) * Math.PI) : 0;
    u.armR.rotation.x = -0.9 - swing * 1.4;
    u.eyeMat.color.set(this.state === S.CHASE ? 0xff2a1a : 0x120808);
    u.head.rotation.z = Math.sin(this.walkT * 0.5) * 0.05;
  }
}
