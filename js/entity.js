import * as THREE from '../vendor/three.module.min.js';
import { levelY } from './house.js';

export const ENTITY_NAME = 'Dread';

// ---- the body ---------------------------------------------------------------------------
// A tall, thin, ashen figure in a torn gown. Its arms hang to its knees, its face is two
// black hollows and a mouth that never closes. Local forward is +z.
export function buildHollow() {
  const root = new THREE.Group();
  const body = new THREE.Group();       // everything that leans, falls over and sways
  root.add(body);
  const skin = new THREE.MeshLambertMaterial({ color: 0xa4a29e, emissive: 0x16161a });
  const gownMat = new THREE.MeshLambertMaterial({ color: 0x2a2830, emissive: 0x08080a, side: THREE.DoubleSide });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xe8f2ff });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x0b0b0d });

  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // a limb piece that hangs down from its pivot
  const limb = (parent, r0, r1, len, x, y, z) => {
    const piv = new THREE.Group();
    piv.position.set(x, y, z);
    parent.add(piv);
    mesh(new THREE.CylinderGeometry(r0, r1, len, 8), skin, piv, 0, -len / 2, 0);
    return piv;
  };

  // legs: thigh, knee, shin, long flat foot
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = limb(body, 0.075, 0.055, 0.55, s * 0.12, 1.1, 0);
    const knee = limb(hip, 0.055, 0.04, 0.55, 0, -0.55, 0);
    mesh(new THREE.BoxGeometry(0.09, 0.04, 0.3), skin, knee, 0, -0.56, 0.08);
    legs.push({ hip, knee, s });
  }

  // torso, stooped
  const torso = new THREE.Group();
  torso.position.set(0, 1.1, 0);
  body.add(torso);
  const chest = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.85, 14), gownMat, torso, 0, 0.42, 0);
  chest.scale.z = 0.62;
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.085, 8, 6), skin, torso, s * 0.24, 0.8, 0);

  // arms: very long, with long fingers
  const arms = [];
  let batGroup = null;
  for (const s of [-1, 1]) {
    const sh = limb(torso, 0.06, 0.045, 0.76, s * 0.26, 0.8, 0);
    const el = limb(sh, 0.045, 0.032, 0.76, 0, -0.76, 0);
    mesh(new THREE.BoxGeometry(0.075, 0.12, 0.025), skin, el, 0, -0.82, 0);
    for (let i = 0; i < 4; i++) {
      const f = mesh(new THREE.ConeGeometry(0.011, 0.26, 5), skin, el, (i - 1.5) * 0.02, -1.0, 0);
      f.rotation.x = Math.PI + (i % 2 ? 0.15 : -0.1);
    }
    if (s === 1) {   // a nail-studded bat in the right hand
      const bat = new THREE.Group();
      bat.position.set(0, -0.86, 0.02);
      bat.rotation.x = Math.PI - 1.2;          // points down and forward; local +y is along the bat
      batGroup = bat;
      const wood = new THREE.MeshLambertMaterial({ color: 0x9a7650, emissive: 0x2a1c10 });
      const iron = new THREE.MeshLambertMaterial({ color: 0xd0d0d8, emissive: 0x34343c });
      const blood = new THREE.MeshLambertMaterial({ color: 0x8a1010, emissive: 0x3a0606 });
      mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.3, 8), wood, bat, 0, 0.05, 0);          // handle
      mesh(new THREE.CylinderGeometry(0.065, 0.025, 0.75, 10), wood, bat, 0, 0.5, 0);        // barrel
      mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.12, 10), blood, bat, 0, 0.82, 0);      // stained end
      for (let r = 0; r < 4; r++) for (let a = 0; a < 6; a++) {                                // spikes
        const y = 0.3 + r * 0.16, ang = a * Math.PI / 3 + r * 0.5, rad = 0.025 + (y - 0.2) * 0.07;
        const spike = mesh(new THREE.ConeGeometry(0.014, 0.1, 5), iron, bat, Math.cos(ang) * (rad + 0.03), y, Math.sin(ang) * (rad + 0.03));
        spike.rotation.set(Math.sin(ang) * 1.45, 0, -Math.cos(ang) * 1.45);
      }
      el.add(bat);
    }
    arms.push({ sh, el, s });
  }

  // neck and head
  const neck = new THREE.Group();
  neck.position.set(0, 0.86, 0.02);
  torso.add(neck);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), skin, neck, 0, 0.15, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.46, 0.02);
  neck.add(head);
  mesh(new THREE.SphereGeometry(0.125, 16, 12), skin, head).scale.set(0.82, 1.55, 0.95);
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.05, 10, 8), black, head, s * 0.05, 0.06, 0.1).scale.set(0.9, 1.5, 0.45);
    mesh(new THREE.SphereGeometry(0.007, 6, 5), glint, head, s * 0.05, 0.05, 0.128);
  }
  mesh(new THREE.SphereGeometry(0.04, 10, 8), black, head, 0, -0.13, 0.1).scale.set(0.8, 2.1, 0.5);   // the mouth
  // long black hair, hanging over the shoulders and back
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, len = 0.5 + ((i * 37) % 10) * 0.05;
    const strand = mesh(new THREE.BoxGeometry(0.014, len, 0.014), hairMat, head, Math.cos(a) * 0.1, 0.12 - len / 2 + 0.05, Math.sin(a) * 0.09 - 0.03);
    strand.rotation.x = Math.sin(a) * 0.12; strand.rotation.z = -Math.cos(a) * 0.1;
  }
  head.rotation.z = 0.16;

  // the torn gown
  const gg = new THREE.CylinderGeometry(0.21, 0.4, 1.0, 28, 3, true);
  const pos = gg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -0.45) pos.setY(i, pos.getY(i) - (0.04 + ((i * 53) % 7) / 7 * 0.4));   // ragged hem
  }
  gg.computeVertexNormals();
  mesh(gg, gownMat, body, 0, 1.0, 0);

  return { root, body, torso, legs, arms, neck, head, bat: batGroup };
}

// ---- finding the way ------------------------------------------------------------------------
class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const K = this.k, P = this.p;
    let i = K.length;
    K.push(key); P.push(pri);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (P[j] <= pri) break;
      K[i] = K[j]; P[i] = P[j]; i = j;
    }
    K[i] = key; P[i] = pri;
  }
  pop() {
    const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop(), n = K.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= lp) break;
        K[i] = K[c]; P[i] = P[c]; i = c;
      }
      K[i] = lk; P[i] = lp;
    }
    return top;
  }
}

const RES = 0.3, PAD = 0.27;   // grid cell size, and how far the body keeps from walls

// A grid per storey (walls and furniture blocked, doors open for it), joined by the stairs.
function buildNav(house) {
  const GW = Math.ceil(house.size.w / RES), GD = Math.ceil(house.size.d / RES), G = GW * GD;
  const L = house.levels.length;
  const blocked = new Uint8Array(L * G);
  const skip = new Set([...house.roomDoors.map(d => d.col), ...house.mannequins.map(m => m.col)]);
  const mark = (lv, x0, x1, z0, z1) => {
    const a = Math.max(0, Math.ceil(x0 / RES - 0.5)), b = Math.min(GW - 1, Math.floor(x1 / RES - 0.5));
    const c = Math.max(0, Math.ceil(z0 / RES - 0.5)), d = Math.min(GD - 1, Math.floor(z1 / RES - 0.5));
    for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) blocked[lv * G + gz * GW + gx] = 1;
  };
  for (const c of house.colliders) {
    if (skip.has(c)) continue;
    mark(c.level, c.minX - PAD, c.maxX + PAD, c.minZ - PAD, c.maxZ + PAD);
  }
  for (const st of house.stairs) for (const lv of [st.from, st.from + 1]) mark(lv, st.x0, st.x1, st.z0, st.z1);

  const cellOf = (lv, x, z) => lv * G + Math.min(GD - 1, Math.max(0, Math.floor(z / RES))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(x / RES)));
  const parts = i => { const lv = Math.floor(i / G), r = i % G; return [lv, r % GW, Math.floor(r / GW)]; };
  const centre = i => { const [lv, gx, gz] = parts(i); return { x: (gx + 0.5) * RES, z: (gz + 0.5) * RES, level: lv, y: levelY(lv) }; };
  // the nearest open cell to a spot
  function free(lv, x, z) {
    const base = cellOf(lv, x, z), [, bx, bz] = parts(base);
    for (let r = 0; r <= 10; r++) {
      let best = -1, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const gx = bx + dx, gz = bz + dz;
        if (gx < 0 || gz < 0 || gx >= GW || gz >= GD) continue;
        const i = lv * G + gz * GW + gx;
        if (!blocked[i] && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = i; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // each stair joins a spot outside its north door to a spot past its top end
  const links = new Map();
  for (const st of house.stairs) {
    const xm = (st.x0 + st.x1) / 2;
    const a = free(st.from, xm, st.z0 - 0.45), b = free(st.from + 1, xm, st.z1 + 0.45);
    if (a < 0 || b < 0) continue;
    links.set(a, { to: b, st, up: true });
    links.set(b, { to: a, st, up: false });
  }

  const gScore = new Float32Array(L * G), from = new Int32Array(L * G), closed = new Uint8Array(L * G);
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [-1, -1, 1.4142]];

  function find(sl, sx, sz, tl, tx, tz) {
    const s = free(sl, sx, sz), t = free(tl, tx, tz);
    if (s < 0 || t < 0) return null;
    const [, tgx, tgz] = parts(t);
    gScore.fill(Infinity); closed.fill(0);
    const open = new Heap();
    gScore[s] = 0; from[s] = -1;
    open.push(s, 0);
    while (open.size) {
      const n = open.pop();
      if (closed[n]) continue;
      closed[n] = 1;
      if (n === t) break;
      const [lv, gx, gz] = parts(n);
      const relax = (m, cost) => {
        const g = gScore[n] + cost;
        if (g < gScore[m]) {
          gScore[m] = g; from[m] = n;
          const [, mx, mz] = parts(m);
          open.push(m, g + Math.hypot(mx - tgx, mz - tgz) * RES);
        }
      };
      for (const [dx, dz, c] of NB) {
        const nx = gx + dx, nz = gz + dz;
        if (nx < 0 || nz < 0 || nx >= GW || nz >= GD) continue;
        if (blocked[lv * G + nz * GW + nx]) continue;
        if (dx && dz && (blocked[lv * G + gz * GW + nx] || blocked[lv * G + nz * GW + gx])) continue;
        relax(lv * G + nz * GW + nx, c * RES);
      }
      const lk = links.get(n);
      if (lk) relax(lk.to, 10);
    }
    if (!closed[t]) return null;
    const nodes = [];
    for (let n = t; n >= 0; n = from[n]) nodes.push(n);
    nodes.reverse();
    // turn the cells into waypoints, keeping only the bends; a stair becomes its ramp
    const wps = [];
    let lastDir = null;
    for (let k = 0; k < nodes.length; k++) {
      const c = centre(nodes[k]);
      if (k > 0) {
        const pc = centre(nodes[k - 1]);
        if (pc.level !== c.level) {
          const lk = links.get(nodes[k - 1]), st = lk.st, xm = (st.x0 + st.x1) / 2;
          const bot = { x: xm, z: st.z0, level: st.from, y: levelY(st.from) }, top = { x: xm, z: st.z1, level: st.from + 1, y: levelY(st.from + 1) };
          wps.push({ ...pc }, ...(lk.up ? [bot, top] : [top, bot]));
          lastDir = null;
          if (k === nodes.length - 1) wps.push(c);
          continue;
        }
        const dir = `${Math.sign(c.x - pc.x)},${Math.sign(c.z - pc.z)}`;
        if (lastDir !== null && dir !== lastDir) wps.push(pc);
        lastDir = dir;
      }
      if (k === nodes.length - 1) wps.push(c);
    }
    return wps;
  }

  // a random open spot on a storey
  function randomOn(lv, near, radius) {
    for (let i = 0; i < 60; i++) {
      const x = near ? near.x + (Math.random() * 2 - 1) * radius : Math.random() * house.size.w;
      const z = near ? near.z + (Math.random() * 2 - 1) * radius : Math.random() * house.size.d;
      if (x < 0 || z < 0 || x > house.size.w || z > house.size.d) continue;
      const g = cellOf(lv, x, z);
      if (!blocked[g]) return centre(g);
    }
    return null;
  }

  // how many cells on each storey can be walked to from a spot (for testing)
  function reach(lv, x, z) {
    const s = free(lv, x, z);
    const seen = new Uint8Array(L * G), q = [s], counts = new Array(L).fill(0);
    seen[s] = 1;
    while (q.length) {
      const n = q.pop();
      const [l, gx, gz] = parts(n);
      counts[l]++;
      const go = m => { if (!seen[m]) { seen[m] = 1; q.push(m); } };
      for (const [dx, dz] of NB) {
        const nx = gx + dx, nz = gz + dz;
        if (nx < 0 || nz < 0 || nx >= GW || nz >= GD || blocked[l * G + nz * GW + nx]) continue;
        if (dx && dz && (blocked[l * G + gz * GW + nx] || blocked[l * G + nz * GW + gx])) continue;
        go(l * G + nz * GW + nx);
      }
      const lk = links.get(n);
      if (lk) go(lk.to);
    }
    return counts;
  }
  return { find, randomOn, reach, free, centre, blocked, links };
}

// is there an unbroken line between two spots on a storey (walls and shut doors block it)?
function lineClear(colliders, level, ax, az, bx, bz) {
  for (const c of colliders) {
    if (c.level !== level) continue;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    for (const [p, d, lo, hi] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return false;
  }
  return true;
}

// ---- the creature ------------------------------------------------------------------------------
// It wanders the house. What it follows is the player's fear: the more afraid you are, the farther
// it smells you, the longer it keeps hunting and the faster it runs. Darkness, the sight of it,
// loud noises and falling mannequins raise the fear. A lit flashlight, calm and hiding lower it.
export function createHollow(house, opts = {}) {
  const nav = buildNav(house);
  const model = buildHollow();
  const group = model.root;
  const me = {
    group, nav,
    name: ENTITY_NAME,
    x: 0, z: 0, y: 0, level: 0, yaw: 0,
    state: 'roam',          // roam | hunt | search | stun | kill
    fear: 0,
    onCaught: null, onSound: null,
  };
  let path = null, idx = 0, prev = null, segLen = 1;
  let pause = 0, stunT = 0, searchT = 0, lose = 0, seenAgo = 99, foundT = 0, stepT = 0, losT = 0;
  let huntT = 0, sees = false, graceT = opts.grace ?? 25, walkPhase = 0, killT = 0, lean = 0;
  const last = { x: 0, z: 0, level: 0 };

  function place(c) { me.x = c.x; me.z = c.z; me.level = c.level; me.y = levelY(c.level); path = null; }
  function goTo(level, x, z) {
    const wps = nav.find(me.level, me.x, me.z, level, x, z);
    path = wps; idx = 0;
    prev = { x: me.x, z: me.z, y: me.y, level: me.level };
    if (wps && wps.length) segLen = Math.max(0.01, Math.hypot(wps[0].x - me.x, wps[0].z - me.z));
    return !!wps;
  }
  me.model = model;
  me.speedMul = 1; me.senseMul = 1;
  me.setGrace = n => { graceT = n; };
  // stand in view of the player for the title screen; returns the yaw that looks at her
  me.placeForTitle = player => {
    for (const dist of [3.4, 3.0, 2.6]) for (let a = 0; a < 24; a++) {
      const ang = a / 24 * Math.PI * 2;
      const x = player.pos.x + Math.sin(ang) * dist, z = player.pos.z + Math.cos(ang) * dist;
      const c = nav.centre(nav.free(player.level, x, z));
      if (Math.hypot(c.x - x, c.z - z) > 0.2) continue;
      if (!lineClear(house.colliders, player.level, player.pos.x, player.pos.z, c.x, c.z)) continue;
      place({ x: c.x, z: c.z, level: player.level, y: player.y });
      me._heading = me.yaw = Math.atan2(player.pos.x - c.x, player.pos.z - c.z);
      return Math.atan2(-(c.x - player.pos.x), -(c.z - player.pos.z));
    }
    return null;
  };
  me.place = place;
  me.goTo = goTo;

  // start far from the player, unless asked to start close (for testing)
  me.spawn = player => {
    let c = null;
    if (opts.near) {
      c = nav.randomOn(player.level, player.pos, opts.near);
    } else {
      for (let i = 0; i < 80 && !c; i++) {
        const lv = Math.floor(Math.random() * house.levels.length);
        const cand = nav.randomOn(lv);
        if (cand && (lv !== player.level || Math.hypot(cand.x - player.pos.x, cand.z - player.pos.z) > 14)) c = cand;
      }
    }
    if (c) place(c);
  };

  me.addFear = n => { me.fear = Math.max(0, Math.min(100, me.fear + n)); };
  me.investigate = (x, z, level) => {
    if (me.state === 'stun' || me.state === 'kill') return;
    last.x = x; last.z = z; last.level = level;
    me.addFear(8);
    me.state = 'hunt'; lose = 0;
    goTo(level, x, z);
  };

  me.stun = () => {
    if (me.state === 'stun' || me.state === 'kill') return;
    me.state = 'stun'; stunT = 9; path = null;
    me.addFear(-30);
    me.onSound?.('hurt', 1);
  };

  // the shot: does the ray from the camera pass through the creature?
  me.tryShoot = (camera, player) => {
    if (me.level !== player.level || me.state === 'stun' || me.state === 'kill') return false;
    const o = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (!lineClear(house.colliders, me.level, o.x, o.z, me.x, me.z)) return false;
    const p = new THREE.Vector3();
    for (const h of [0.3, 0.8, 1.3, 1.8, 2.2]) {
      p.set(me.x, me.y + h, me.z);
      const t = p.clone().sub(o).dot(dir);
      if (t < 0 || t > 18) continue;
      if (p.distanceTo(o.clone().addScaledVector(dir, t)) < (h > 1.7 ? 0.3 : 0.4)) { me.stun(); return true; }
    }
    return false;
  };

  const speedOf = () => (me.speedMul ?? 1) * (me.state === 'hunt' ? 1.9 + 0.55 * me.fear / 100
    : me.state === 'search' ? 1.3 : 0.95);

  function follow(dt) {
    if (!path || idx >= path.length) return false;
    let step = speedOf() * dt;
    while (path && idx < path.length && step > 0) {
      const w = path[idx], dx = w.x - me.x, dz = w.z - me.z, d = Math.hypot(dx, dz);
      if (d <= step) {
        me.x = w.x; me.z = w.z; me.y = w.y; me.level = w.level;
        prev = { x: w.x, z: w.z, y: w.y, level: w.level };
        step -= d; idx++;
        if (idx < path.length) segLen = Math.max(0.01, Math.hypot(path[idx].x - me.x, path[idx].z - me.z));
        continue;
      }
      me.x += dx / d * step; me.z += dz / d * step;
      const f = 1 - (d - step) / segLen;
      me.y = prev.y + (w.y - prev.y) * Math.min(1, Math.max(0, f));
      me.level = f > 0.5 ? w.level : prev.level;
      me._heading = Math.atan2(dx, dz);
      step = 0;
    }
    return idx < path.length;
  }

  // swing shut doors open as it gets to them
  function doors(player) {
    for (const d of house.roomDoors) {
      if (d.open || d.level !== me.level) continue;
      const cx = d.axis === 'x' ? d.mid : d.f, cz = d.axis === 'x' ? d.f : d.mid;
      if (Math.hypot(cx - me.x, cz - me.z) < 1.5) {
        house.openDoorFor(d, me, Math.hypot(me.x - player.pos.x, me.z - player.pos.z) > 14);
        pause = 0.5;
      }
    }
  }

  const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

  me.update = (dt, t, ctx) => {
    const p = ctx.player;
    graceT = Math.max(0, graceT - (ctx.frozen ? 0 : dt));
    const same = me.level === p.level;
    const dx = p.pos.x - me.x, dz = p.pos.z - me.z, d = same ? Math.hypot(dx, dz) : 99;
    losT -= dt;
    if (losT <= 0) {
      losT = 0.15;
      sees = same && !ctx.hidden && d < 11 && lineClear(house.colliders, me.level, me.x, me.z, p.pos.x, p.pos.z);
    }

    // ---- fear ----
    if (!ctx.frozen) {
      let rate = 0;
      const rest = ctx.flash ? 0 : p.level === 0 ? 26 : p.level === 3 ? 18 : 6;
      if (me.fear < rest) rate += 3; else rate -= ctx.hidden ? 4 : 2.2;
      if (me.state === 'stun') rate -= 12;
      else if (sees) rate += (12 - d) * 1.4 + (me.state === 'hunt' ? 4 : 0);
      else if (d < 5) rate += (5 - d) * 1.5;
      if (ctx.hidden && d < 3.5 && me.state !== 'stun') rate += 8;
      me.fear = Math.max(0, Math.min(100, me.fear + rate * dt));
    }
    seenAgo = sees ? 0 : seenAgo + dt;

    if (ctx.frozen && me.state !== 'kill') { animate(dt, t, 0); return; }

    if (me.state === 'kill') {
      killT += dt;
      me._heading = Math.atan2(dx, dz);
      if (d < 6 && d > 0.01) {   // settle at bat's reach: step back if too close, in if too far
        const want = 2.1 - 0.8 * ease(0.4, 0.72, killT) + 0.55 * ease(0.95, 1.3, killT) - 0.55 * ease(1.35, 1.55, killT);   // winds up from a distance, steps in to strike
        const move = Math.sign(d - want) * Math.min(Math.abs(d - want), 5 * dt);
        me.x += dx / d * move; me.z += dz / d * move;
      }
    } else if (me.state === 'stun') {
      stunT -= dt;
      if (stunT <= 0) { me.state = 'search'; searchT = 7; last.x = p.pos.x; last.z = p.pos.z; last.level = p.level; goTo(last.level, last.x, last.z); me.onSound?.('growl', 0.8); }
    } else {
      // ---- senses ----
      const smell = (4 + me.fear * 0.16) * (me.senseMul ?? 1) * (ctx.hidden ? 0.35 : 1);
      const sensed = graceT === 0 && !ctx.noSense && (sees || (same && d < smell) || (!same && Math.abs(me.level - p.level) === 1 && Math.hypot(dx, dz) < smell * 0.5));
      if (sensed) {
        if (me.state !== 'hunt') {
          me.state = 'hunt'; huntT = 0; pause = 0.5;   // a beat to notice you before she moves
          me.onSound?.('growl', same ? Math.max(0.3, 1 - d / 16) : 0.4);
          if (seenAgo > 5 && sees) { me.addFear(22); me.onSound?.('sting', 1); }
        }
        lose = 0; last.x = p.pos.x; last.z = p.pos.z; last.level = p.level;
        if (!me._replan || me._replan <= 0) { goTo(last.level, last.x, last.z); me._replan = 0.45; }
      } else if (me.state === 'hunt') {
        lose += dt;
        if (lose > 2.5 + me.fear * 0.04) { me.state = 'search'; searchT = 6 + me.fear * 0.08; }
      }
      me._replan = (me._replan ?? 0) - dt;

      // ---- moving ----
      if (pause > 0) pause -= dt;
      else {
        const moving = follow(dt);
        if (moving) doors(p);
        else if (me.state === 'hunt' && !sensed) { me.state = 'search'; searchT = 6 + me.fear * 0.08; }
        else if (me.state === 'search') {
          searchT -= dt;
          if (searchT <= 0) me.state = 'roam';
          else if (Math.random() < dt * 0.8) {
            const c = nav.randomOn(last.level, last, 4);
            if (c) goTo(c.level, c.x, c.z);
          }
        } else if (me.state === 'roam' && graceT === 0 && (me._idle = (me._idle ?? 0) - dt) <= 0) {
          me._idle = 1.5 + Math.random() * 3;
          const nearFear = Math.random() < 0.05 + me.fear / 100 * 0.9;
          let c = null;
          if (nearFear) c = nav.randomOn(p.level, p.pos, 7);
          else c = nav.randomOn(Math.random() < 0.45 ? me.level : Math.floor(Math.random() * house.levels.length));
          if (c) goTo(c.level, c.x, c.z);
        } else if (me.state === 'roam' && graceT > 0 && !path && (me._idle = (me._idle ?? 0) - dt) <= 0) {
          me._idle = 2 + Math.random() * 3;
          const c = nav.randomOn(me.level);
          if (c) goTo(c.level, c.x, c.z);
        }
      }

      huntT = me.state === 'hunt' ? huntT + dt : 0;
      // ---- catching ----
      if (graceT === 0 && same && !ctx.dead) {
        if (!ctx.hidden && d < 0.9 && huntT > 0.5 && Math.abs(me.y - p.y) < 1.4) caught();
        if (ctx.hidden && d < 1.9) {
          foundT += dt * (0.6 + me.fear / 60);
          if (foundT > 3.2) caught();
        } else foundT = Math.max(0, foundT - dt);
      }
    }

    // footsteps, heard by distance
    const moving = path && idx < path.length && pause <= 0 && me.state !== 'stun' && me.state !== 'kill';
    if (moving) {
      stepT -= dt * speedOf();
      if (stepT <= 0) {
        stepT = 0.85;
        const dist = Math.hypot(me.x - p.pos.x, me.z - p.pos.z) + Math.abs(me.level - p.level) * 6;
        if (dist < 18) me.onSound?.('step', Math.max(0, 1 - dist / 18));
      }
    }
    animate(dt, t, moving ? speedOf() : 0);
  };

  // the arm with the bat: raised overhead, brought down hard, twice
  const ease = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  function batAngle(k) {
    const up = -2.0, down = -1.0;
    if (k < 1.0) return -0.9 + (up + 0.9) * ease(0.1, 0.55, k) + (down - up) * ease(0.55, 0.72, k);
    return down + (up - down) * ease(1.0, 1.4, k) + (down - up) * ease(1.4, 1.55, k);
  }

  me.debugKillT = v => { killT = v; };   // for testing the animation frame by frame

  function caught() {
    if (me.state === 'kill') return;
    me.state = 'kill'; killT = 0; path = null;
    me.onCaught?.();
  }

  // ---- posing ----
  function animate(dt, t, speed) {
    // turn toward where it is heading
    if (me._heading !== undefined) {
      me.yaw += angleTo(me.yaw, me._heading) * Math.min(1, dt * (me.state === 'hunt' ? 9 : 4));
    }
    group.position.set(me.x, me.y, me.z);
    group.rotation.y = me.yaw;
    walkPhase += dt * speed * 3.1;
    const m = model, w = Math.sin(walkPhase), amp = Math.min(1, speed / 1.5);
    const hunt = me.state === 'hunt' || me.state === 'kill';
    lean += ((me.state === 'kill' ? 0.3 + 0.35 * (ease(0.55, 0.72, killT) * (1 - ease(1.0, 1.4, killT)) + ease(1.4, 1.55, killT)) : hunt ? 0.38 : 0.12) - lean) * Math.min(1, dt * (me.state === 'kill' ? 14 : 4));
    const fallA = me.state === 'stun' ? Math.min(1, (9 - stunT) / 0.55) : 0;
    m.body.rotation.x = -fallA * 1.5;
    group.position.y = me.y + fallA * 0.12;
    m.torso.rotation.x = lean + Math.sin(t * 1.3) * 0.02;
    m.body.rotation.z = me.limp && speed > 0 && me.state !== 'stun' ? Math.sin(walkPhase) * 0.09 : 0;   // she drags one leg
    for (const l of m.legs) {
      const ph = Math.sin(walkPhase + (l.s > 0 ? 0 : Math.PI));
      l.hip.rotation.x = ph * 0.55 * amp;
      l.knee.rotation.x = Math.max(0, -Math.sin(walkPhase + (l.s > 0 ? 0 : Math.PI) + 0.6)) * 0.9 * amp;
    }
    for (const a of m.arms) {
      const ph = Math.sin(walkPhase + (a.s > 0 ? Math.PI : 0));
      let reach = me.state === 'kill' ? -0.9 : hunt ? -0.7 : 0;
      if (me.state === 'kill' && a.s === 1) reach = batAngle(killT);
      a.sh.rotation.x = reach + ph * 0.3 * amp + (me.state === 'stun' ? 0 : Math.sin(t * 1.1 + a.s) * 0.04);
      a.sh.rotation.z = a.s * (0.06 + (hunt ? 0.12 : 0));
      a.el.rotation.x = me.state === 'kill' && a.s === 1 ? -0.25 - 1.65 * Math.max(0, Math.min(1, (reach - -1.0) / -1.0)) : hunt ? -0.5 : -0.12 - Math.sin(t * 0.9 + a.s) * 0.04;
    }
    m.bat.rotation.x = Math.PI - (me.state === 'kill' ? 0.1 : hunt ? 0.9 : 1.2);   // the bat follows the arm in the kill
    // the head cocks and twitches
    const tw = Math.sin(t * 2.3) * Math.sin(t * 0.7);
    m.head.rotation.z = 0.16 + tw * 0.09 + (hunt ? 0.1 : 0);
    m.head.rotation.x = 0.1 + Math.max(0, Math.sin(t * 5.1)) * Math.max(0, Math.sin(t * 0.37)) * 0.08;
    m.neck.rotation.x = 0.18;
  }

  return me;
}
