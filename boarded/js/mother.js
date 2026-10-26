import * as THREE from '../../vendor/three.module.min.js';
import { W, D, roomAt, ROOM_CENTER, findPath, resolveCircle, lineClear } from './world.js';

// Mother Marrow. She circles the house, picks the weakest way in, breaks it open
// plank by plank, then hunts you inside by sight and by sound.

const RING = 1.7;
const LX = W + 2 * RING, LZ = D + 2 * RING, P = 2 * (LX + LZ);

function ringPos(s) {
  s = ((s % P) + P) % P;
  if (s < LX) return [-RING + s, -RING];
  s -= LX; if (s < LZ) return [W + RING, -RING + s];
  s -= LZ; if (s < LX) return [W + RING - s, D + RING];
  s -= LX; return [-RING, D + RING - s];
}
function entryS(e) {
  if (e.axis === 'x') return e.out < 0 ? e.a + RING : LX + LZ + (W + RING - e.a);
  return e.out > 0 ? LX + e.a + RING : 2 * LX + LZ + (D + RING - e.a);
}
const wrapDelta = (d) => ((d + P / 2) % P + P) % P - P / 2;

function buildMesh() {
  const g = new THREE.Group();
  const dress = new THREE.MeshLambertMaterial({ color: 0x1a1618 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xbfb8aa });
  const hair = new THREE.MeshLambertMaterial({ color: 0x7d7d80 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const body = new THREE.Group();
  g.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 1.25, 10), dress); skirt.position.y = 0.62; body.add(skirt);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.55, 8), dress); torso.position.y = 1.5; body.add(torso);
  body.rotation.x = 0.22;
  const head = new THREE.Group(); head.position.set(0, 1.92, 0.16); body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin));
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10), hair); hairM.position.set(0, 0.03, -0.05); hairM.scale.set(1, 1.05, 1); head.add(hairM);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), black); eye.position.set(sx * 0.06, 0.02, 0.15); head.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), black); mouth.position.set(0, -0.07, 0.165); head.add(mouth);
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.22, 1.68, 0.05);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.85, 6), skin); up.position.y = -0.42; a.add(up);
    const hand = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5), skin); hand.position.y = -0.92; hand.rotation.x = Math.PI; a.add(hand);
    a.rotation.x = -0.7; body.add(a); arms.push(a);
  }
  // hair bun and a rusty claw hammer in her right hand
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), hair); bun.position.set(0, 0.17, -0.12); head.add(bun);
  const hammer = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0x4a3426 })); handle.position.y = 0.2;
  const headM = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.07), new THREE.MeshLambertMaterial({ color: 0x3b3b3d })); headM.position.y = 0.46;
  hammer.add(handle, headM); hammer.position.y = -0.95; hammer.rotation.x = 0.2;
  arms[1].add(hammer);
  const light = new THREE.PointLight(0xff9a4a, 1.1, 7, 1.6);
  light.position.set(0.3, 0.9, 0.5);
  g.add(light);
  g.userData = { body, arms, head, light };
  return g;
}

export function createMother(world, audio, hooks) {
  const mesh = buildMesh();
  mesh.visible = false;
  world.group.add(mesh);

  const m = {
    mesh, state: 'off', sub: '', x: 0, z: 0, yaw: 0,
    s: 0, target: null, t: 0, hitT: 0, scoreT: 0,
    path: [], seen: false, lostT: 0, lastSeen: null, stepT: 0, smellT: 0, checkSpot: null,
    stuckT: 0, lastX: 0, lastZ: 0, night: 1,
  };

  function pan(px, pz, yaw, x, z) {
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz) || 1;
    return (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d;
  }
  function vol(px, pz, x, z, base = 1) { return base * Math.max(0.12, 1 - Math.hypot(x - px, z - pz) / 22); }

  function place(x, z, yaw) {
    m.x = x; m.z = z;
    if (yaw !== undefined) m.yaw = yaw;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = m.yaw;
  }

  function score(e) {
    return e.planks * 1.5 + (e.open ? -6 : 0) - e.heat + (e.jitter || 0);
  }
  function pickTarget(world, avoid) {
    world.entries.forEach(e => { e.jitter = Math.random() * 1.2; });
    let best = null;
    for (const e of world.entries) if (e !== avoid && (!best || score(e) < score(best))) best = e;
    return best || avoid;
  }

  m.start = (night, px, pz) => {
    m.night = night;
    m.state = 'circle'; m.sub = '';
    const e = pickTarget(world);
    // start on the far side of the house
    m.s = entryS(e) + P / 2 + (Math.random() - 0.5) * 6;
    const [x, z] = ringPos(m.s);
    place(x, z);
    m.target = e;
    mesh.visible = true;
    mesh.userData.light.visible = true;
  };
  m.stop = () => { m.state = 'off'; mesh.visible = false; };
  m.isInside = () => m.state === 'hunt';
  m.isActive = () => m.state !== 'off';

  // she heard something at (x, z) with the given loudness radius
  m.hear = (x, z, r) => {
    if (m.state !== 'hunt' || m.sub === 'chase') return;
    if (Math.hypot(m.x - x, m.z - z) > r) return;
    m.sub = 'search'; m.checkSpot = null;
    m.path = findPath({ x: m.x, z: m.z }, { x, z });
    m.t = 0;
  };

  m.tellHidden = (spot, sawEnter) => {
    if (m.state === 'hunt' && sawEnter) {
      m.sub = 'checkHide'; m.checkSpot = spot;
      m.path = findPath({ x: m.x, z: m.z }, spot.front);
    }
  };

  function walk(dt, speed, rects, noClip) {
    const t = m.path[0];
    if (!t) return true;
    const dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { m.path.shift(); return m.path.length === 0; }
    const step = Math.min(d, speed * dt);
    const pos = { x: m.x + dx / d * step, z: m.z + dz / d * step };
    if (!noClip) resolveCircle(pos, 0.34, rects);
    // stuck detection: skip the waypoint if she is not getting anywhere
    m.stuckT = Math.hypot(pos.x - m.lastX, pos.z - m.lastZ) < speed * dt * 0.25 ? m.stuckT + dt : 0;
    m.lastX = m.x; m.lastZ = m.z;
    m.x = pos.x; m.z = pos.z;
    m.yaw = Math.atan2(dx, dz);
    if (m.stuckT > 1.2) { m.path.shift(); m.stuckT = 0; }
    return false;
  }

  function startKnock() {
    m.state = 'knock'; m.t = 0; m.hitT = 0; m.hits = 0;
  }

  function breakTime() { return Math.max(2.1, 5.6 - 0.55 * (m.night - 1)); }

  m.update = (dt, player, rects, G) => {
    if (m.state === 'off') return;
    const u = mesh.userData;
    const px = player.x, pz = player.z, pyaw = player.yaw;
    world.entries.forEach(e => { e.heat = Math.max(0, e.heat - 0.4 * dt); });

    if (m.state === 'circle') {
      const e = m.target;
      const delta = wrapDelta(entryS(e) - m.s);
      const speed = 2.3 + 0.25 * m.night;
      const step = Math.min(Math.abs(delta), speed * dt);
      m.s += Math.sign(delta) * step;
      const [x, z] = ringPos(m.s);
      m.yaw = Math.atan2(x - m.x, z - m.z) || m.yaw;
      place(x, z);
      m.stepT -= dt;
      if (m.stepT <= 0) { m.stepT = 0.6; audio.step(pan(px, pz, pyaw, m.x, m.z), vol(px, pz, m.x, m.z, 0.5)); }
      if (Math.abs(delta) < 0.05) startKnock();
    }
    else if (m.state === 'knock') {
      const e = m.target;
      m.yaw = Math.atan2(-e.nx, -e.nz); // face the house
      m.t += dt;
      const knocks = [0.3, 0.75, 1.2];
      while (m.hits < 3 && m.t >= knocks[m.hits]) {
        audio.knock(pan(px, pz, pyaw, e.cx, e.cz), vol(px, pz, e.cx, e.cz));
        m.hits++;
        if (m.hits === 1) hooks.subtitle(`Knock… knock… — ${e.name}`);
      }
      if (m.t > 2.2) { m.state = 'break'; m.t = 0; m.hitT = 0; m.scoreT = 0; }
    }
    else if (m.state === 'break') {
      const e = m.target;
      m.t += dt; m.hitT -= dt; m.scoreT += dt;
      // she shakes the planks
      u.arms.forEach((a, i) => { a.rotation.x = -1.2 + Math.sin(m.t * 14 + i * 2) * 0.35; });
      if (m.hitT <= 0) {
        m.hitT = 0.75;
        const p = pan(px, pz, pyaw, e.cx, e.cz), v = vol(px, pz, e.cx, e.cz);
        if (Math.random() < 0.55) audio.pound(p, v); else audio.scratch(p, v);
        hooks.shake(e.cx, e.cz);
      }
      // the player making noise at another entry pulls her away
      if (m.scoreT > 3) {
        m.scoreT = 0;
        let best = null;
        for (const x of world.entries) { x.jitter = 0; if (x !== e && (!best || score(x) < score(best))) best = x; }
        if (best && score(e) - score(best) > 3) { m.target = best; m.state = 'circle'; return; }
      }
      const need = e.planks > 0 ? breakTime() : breakTime() * 0.5;
      if (m.t >= need) {
        m.t = 0;
        const p = pan(px, pz, pyaw, e.cx, e.cz), v = vol(px, pz, e.cx, e.cz);
        if (e.planks > 0) {
          e.planks--; e.refresh();
          audio.crack(p, v);
          hooks.subtitle(`A plank gives way — ${e.name}`);
        }
        if (e.planks === 0) {
          e.openUp();
          audio.smash(p, v);
          hooks.subtitle(`${e.name} — she's coming in!`);
          hooks.opened(e);
          m.state = 'enter'; m.t = 0;
          m.path = [{ x: e.cx + e.nx * 0.9, z: e.cz + e.nz * 0.9 }, { x: e.cx - e.nx * 0.9, z: e.cz - e.nz * 0.9 }, e.inside];
        }
      }
    }
    else if (m.state === 'enter') {
      u.arms.forEach(a => { a.rotation.x = -0.7; });
      const done = walk(dt, 1.7, rects, true);
      m.stepT -= dt;
      if (m.stepT <= 0) { m.stepT = 0.55; audio.step(pan(px, pz, pyaw, m.x, m.z), vol(px, pz, m.x, m.z)); }
      if (done) {
        m.state = 'hunt'; m.sub = 'search'; m.t = 0; m.smellT = 0;
        const target = G.noise || { x: px, z: pz };
        m.path = findPath({ x: m.x, z: m.z }, { x: target.x + (Math.random() - 0.5) * 3, z: target.z + (Math.random() - 0.5) * 3 });
      }
    }
    else if (m.state === 'hunt') {
      const dist = Math.hypot(px - m.x, pz - m.z);
      const canSee = !player.hidden && dist < 14 && lineClear(m.x, m.z, px, pz, rects);
      m.smellT += dt;

      if (canSee) {
        if (m.sub !== 'chase') { audio.creak(pan(px, pz, pyaw, m.x, m.z), 1); hooks.subtitle('She sees you!'); }
        m.sub = 'chase'; m.lostT = 0; m.lastSeen = { x: px, z: pz };
        m.path = [{ x: px, z: pz }];
      } else if (m.sub === 'chase') {
        m.lostT += dt;
        if (m.lostT > 0.7) { m.sub = 'search'; m.path = findPath({ x: m.x, z: m.z }, m.lastSeen); }
      }

      const speed = m.sub === 'chase' ? Math.min(3.9, 3.1 + 0.15 * m.night) : 1.55 + 0.1 * m.night;
      if (m.sub === 'look') {
        m.t -= dt;
        m.yaw += Math.sin(m.t * 3) * dt * 1.6;
        if (m.t <= 0) nextSearch();
      } else {
        // chasing around a corner: re-path to where she last saw you
        if (m.sub === 'chase' && !lineClear(m.x, m.z, px, pz, rects)) m.path = findPath({ x: m.x, z: m.z }, { x: px, z: pz });
        const done = walk(dt, speed, rects, false);
        if (done) {
          if (m.sub === 'checkHide') {
            if (m.checkSpot && m.checkSpot.occupied) { hooks.caught(m.checkSpot); return; }
            m.sub = 'look'; m.t = 1.5; hooks.subtitle('She searches… nobody there');
          } else if (m.sub !== 'chase') { m.sub = 'look'; m.t = 1.6 + Math.random(); }
        }
      }

      // she knows roughly where you are every so often
      if (m.smellT > 22 && m.sub !== 'chase' && m.sub !== 'checkHide') {
        m.smellT = 0; m.sub = 'search';
        const c = ROOM_CENTER[roomAt(px, pz)];
        m.path = findPath({ x: m.x, z: m.z }, { x: c[0], z: c[1] });
      }

      m.stepT -= dt;
      if (m.stepT <= 0 && m.sub !== 'look') {
        m.stepT = m.sub === 'chase' ? 0.34 : 0.62;
        audio.step(pan(px, pz, pyaw, m.x, m.z), vol(px, pz, m.x, m.z, 1.2));
      }
      if (!player.hidden && dist < 0.95) { hooks.caught(null); return; }
    }

    function nextSearch() {
      // maybe check a hiding place that is close, otherwise move on to another room
      const spots = world.hides.filter(h => Math.hypot(h.x - m.x, h.z - m.z) < 3.2);
      if (spots.length && Math.random() < 0.5) {
        const s = spots[Math.floor(Math.random() * spots.length)];
        m.sub = 'checkHide'; m.checkSpot = s;
        m.path = findPath({ x: m.x, z: m.z }, s.front);
        return;
      }
      const rooms = Object.keys(ROOM_CENTER).filter(r => r !== roomAt(m.x, m.z));
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      m.sub = 'search';
      m.path = findPath({ x: m.x, z: m.z }, { x: ROOM_CENTER[r][0], z: ROOM_CENTER[r][1] });
    }

    // visuals
    mesh.position.set(m.x, 0, m.z);
    let dyaw = m.yaw - mesh.rotation.y;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    mesh.rotation.y += dyaw * Math.min(1, dt * 8);
    const moving = m.state === 'circle' || m.state === 'enter' || (m.state === 'hunt' && m.sub !== 'look');
    const tt = performance.now() / 1000;
    u.body.position.y = moving ? Math.abs(Math.sin(tt * 6)) * 0.04 : 0;
    u.body.rotation.z = moving ? Math.sin(tt * 3) * 0.05 : 0;
    if (m.state === 'hunt' || m.state === 'circle') {
      const reach = m.sub === 'chase' ? -1.45 : -0.7;
      u.arms.forEach((a, i) => { a.rotation.x += (reach + Math.sin(tt * 2 + i) * 0.08 - a.rotation.x) * Math.min(1, dt * 6); });
    }
    u.light.intensity = 1 + Math.sin(tt * 17) * 0.12 + Math.sin(tt * 5.3) * 0.1;
  };

  return m;
}
