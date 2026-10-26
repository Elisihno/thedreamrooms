import * as THREE from '../../vendor/three.module.min.js';
import { W, D, floorY, roomAt, roomCenter, roomIds, findPath, resolveCircle, lineClear } from './world.js';

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
  const light = new THREE.PointLight(0xff9a4a, 12, 8, 1.6);
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
    mesh, state: 'off', sub: '', x: 0, z: 0, y: 0, floor: 1, yaw: 0,
    s: 0, target: null, t: 0, hitT: 0, scoreT: 0,
    path: [], lostT: 0, lastSeen: null, stepT: 0, smellT: 0, checkSpot: null,
    stuckT: 0, lastX: 0, lastZ: 0, night: 1, climb: null,
  };
  const rectsOf = () => world.floors[m.floor].rects;

  function pan(px, pz, yaw, x, z) {
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz) || 1;
    return (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d;
  }
  // distance and floors both make her quieter
  function vol(player, x, z, floor, base = 1) {
    return base * Math.max(0.1, 1 - Math.hypot(x - player.x, z - player.z) / 22) / (1 + 1.6 * Math.abs(floor - player.floor));
  }

  function place(x, z, yaw) {
    m.x = x; m.z = z;
    if (yaw !== undefined) m.yaw = yaw;
    mesh.position.set(x, m.y, z);
    mesh.rotation.y = m.yaw;
  }

  const score = (e) => e.planks * 1.5 + (e.open ? -6 : 0) - e.heat + (e.floor > 1 ? 1.2 : 0) + (e.jitter || 0);
  function pickTarget(avoid) {
    world.entries.forEach(e => { e.jitter = Math.random() * 1.2; });
    let best = null;
    for (const e of world.entries) if (e !== avoid && (!best || score(e) < score(best))) best = e;
    return best || avoid;
  }

  m.start = (night) => {
    m.night = night;
    m.state = 'circle'; m.sub = ''; m.climb = null;
    const e = pickTarget();
    m.s = entryS(e) + P / 2 + (Math.random() - 0.5) * 6;
    m.y = 0; m.floor = 1;
    const [x, z] = ringPos(m.s);
    place(x, z);
    m.target = e;
    mesh.visible = true;
  };
  m.stop = () => { m.state = 'off'; mesh.visible = false; m.climb = null; };
  m.isInside = () => m.state === 'hunt';

  // she heard something on `floor` at (x, z); sound carries a little through one ceiling
  m.hear = (floor, x, z, r) => {
    if (m.state !== 'hunt' || m.sub === 'chase' || m.sub === 'climb') return;
    const df = Math.abs(floor - m.floor);
    if (df > 1) return;
    if (Math.hypot(m.x - x, m.z - z) > r * (df ? 0.6 : 1)) return;
    m.sub = 'search'; m.checkSpot = null;
    m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f: floor, x, z });
    m.t = 0;
  };

  m.tellHidden = (spot, sawEnter) => {
    if (m.state === 'hunt' && sawEnter && m.sub !== 'climb') {
      m.sub = 'checkHide'; m.checkSpot = spot;
      m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f: spot.floor, x: spot.front.x, z: spot.front.z });
    }
  };
  // the player took the stairs in front of her: she follows
  m.tellStairs = (dest) => {
    if (m.state === 'hunt' && m.sub !== 'climb') {
      m.sub = 'chase'; m.lostT = 0; m.lastSeen = dest;
      m.path = findPath({ f: m.floor, x: m.x, z: m.z }, dest);
    }
  };

  function startClimb(st) {
    const q = st.flight, up = st.dir === 'up';
    const from = up ? q.bottom : q.top, to = up ? q.top : q.bottom;
    m.climb = { from, to, t: 0, f0: m.floor, f1: up ? q.f + 1 : q.f, prevSub: m.sub };
    m.sub = 'climb';
  }

  function walk(dt, speed, rects, noClip) {
    const t = m.path[0];
    if (!t) return true;
    const dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz);
    if (d < 0.25) {
      m.path.shift();
      if (t.stair) { startClimb(t.stair); return false; }
      return m.path.length === 0;
    }
    const step = Math.min(d, speed * dt);
    const pos = { x: m.x + dx / d * step, z: m.z + dz / d * step };
    if (!noClip) resolveCircle(pos, 0.34, rects);
    m.stuckT = Math.hypot(pos.x - m.lastX, pos.z - m.lastZ) < speed * dt * 0.25 ? m.stuckT + dt : 0;
    m.lastX = m.x; m.lastZ = m.z;
    m.x = pos.x; m.z = pos.z;
    m.yaw = Math.atan2(dx, dz);
    if (m.stuckT > 1.2) { m.path.shift(); m.stuckT = 0; }
    return false;
  }

  const breakTime = () => Math.max(2.1, 5.6 - 0.55 * (m.night - 1));

  m.update = (dt, player, G) => {
    if (m.state === 'off') return;
    const u = mesh.userData;
    const px = player.x, pz = player.z, pyaw = player.yaw;
    world.entries.forEach(e => { e.heat = Math.max(0, e.heat - 0.4 * dt); });

    if (m.state === 'circle') {
      const e = m.target;
      const delta = wrapDelta(entryS(e) - m.s);
      const speed = 2.3 + 0.25 * m.night;
      m.s += Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
      m.y += (0 - m.y) * Math.min(1, dt * 4);
      const [x, z] = ringPos(m.s);
      m.yaw = Math.atan2(x - m.x, z - m.z) || m.yaw;
      place(x, z);
      m.stepT -= dt;
      if (m.stepT <= 0) { m.stepT = 0.6; audio.step(pan(px, pz, pyaw, m.x, m.z), vol(player, m.x, m.z, 1, 0.5)); }
      if (Math.abs(delta) < 0.05) { m.state = 'knock'; m.t = 0; m.hits = 0; }
    }
    else if (m.state === 'knock') {
      const e = m.target;
      m.yaw = Math.atan2(-e.nx, -e.nz);
      m.y += (e.base - m.y) * Math.min(1, dt * 3);   // she climbs the wall to upstairs windows
      m.t += dt;
      const knocks = [0.5, 0.95, 1.4];
      while (m.hits < 3 && m.t >= knocks[m.hits]) {
        audio.knock(pan(px, pz, pyaw, e.cx, e.cz), vol(player, e.cx, e.cz, e.floor));
        m.hits++;
        if (m.hits === 1) hooks.subtitle(`Knock… knock… — ${e.name}`);
      }
      if (m.t > 2.4) { m.state = 'break'; m.t = 0; m.hitT = 0; m.scoreT = 0; }
    }
    else if (m.state === 'break') {
      const e = m.target;
      m.y += (e.base - m.y) * Math.min(1, dt * 3);
      m.t += dt; m.hitT -= dt; m.scoreT += dt;
      u.arms.forEach((a, i) => { a.rotation.x = -1.2 + Math.sin(m.t * 14 + i * 2) * 0.35; });
      if (m.hitT <= 0) {
        m.hitT = 0.75;
        const p = pan(px, pz, pyaw, e.cx, e.cz), v = vol(player, e.cx, e.cz, e.floor);
        if (Math.random() < 0.55) audio.pound(p, v); else audio.scratch(p, v);
        hooks.shake(e);
      }
      if (m.scoreT > 3) {
        m.scoreT = 0;
        let best = null;
        for (const x of world.entries) { x.jitter = 0; if (x !== e && (!best || score(x) < score(best))) best = x; }
        if (best && score(e) - score(best) > 3) { m.target = best; m.state = 'circle'; return; }
      }
      const need = e.planks > 0 ? breakTime() : breakTime() * 0.5;
      if (m.t >= need) {
        m.t = 0;
        const p = pan(px, pz, pyaw, e.cx, e.cz), v = vol(player, e.cx, e.cz, e.floor);
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
          m.floor = e.floor;
        }
      }
    }
    else if (m.state === 'enter') {
      u.arms.forEach(a => { a.rotation.x = -0.7; });
      const done = walk(dt, 1.7, rectsOf(), true);
      m.stepT -= dt;
      if (m.stepT <= 0) { m.stepT = 0.55; audio.step(pan(px, pz, pyaw, m.x, m.z), vol(player, m.x, m.z, m.floor)); }
      if (done) {
        m.state = 'hunt'; m.sub = 'search'; m.t = 0; m.smellT = 0;
        const target = G.noise || { f: player.floor, x: px, z: pz };
        m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f: target.f, x: target.x + (Math.random() - 0.5) * 3, z: target.z + (Math.random() - 0.5) * 3 });
      }
    }
    else if (m.state === 'hunt') {
      const rects = rectsOf();
      const sameFloor = player.floor === m.floor;
      const dist = Math.hypot(px - m.x, pz - m.z);
      const canSee = sameFloor && !player.hidden && dist < 14 && lineClear(m.x, m.z, px, pz, rects);
      m.smellT += dt;

      if (m.sub === 'climb') {
        const c = m.climb;
        c.t += dt / 1.5;
        const k = Math.min(1, c.t);
        m.x = c.from.x + (c.to.x - c.from.x) * k;
        m.z = c.from.z + (c.to.z - c.from.z) * k;
        m.y = floorY(c.f0) + (floorY(c.f1) - floorY(c.f0)) * k;
        m.yaw = Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z);
        m.stepT -= dt;
        if (m.stepT <= 0) { m.stepT = 0.28; audio.step(pan(px, pz, pyaw, m.x, m.z), vol(player, m.x, m.z, k > 0.5 ? c.f1 : c.f0, 1.2)); }
        if (k >= 1) { m.floor = c.f1; m.sub = c.prevSub === 'climb' ? 'search' : c.prevSub; m.climb = null; m.stuckT = 0; }
      } else {
        if (canSee) {
          if (m.sub !== 'chase') { audio.creak(pan(px, pz, pyaw, m.x, m.z), 1); hooks.subtitle('She sees you!'); }
          m.sub = 'chase'; m.lostT = 0; m.lastSeen = { f: player.floor, x: px, z: pz };
          m.path = [{ x: px, z: pz, floor: m.floor }];
        } else if (m.sub === 'chase') {
          m.lostT += dt;
          if (m.lostT > 0.7 && !m.path.some(p => p.stair)) { m.sub = 'search'; m.path = findPath({ f: m.floor, x: m.x, z: m.z }, m.lastSeen); }
        }

        const speed = m.sub === 'chase' ? Math.min(3.9, 3.1 + 0.15 * m.night) : 1.55 + 0.1 * m.night;
        if (m.sub === 'look') {
          m.t -= dt;
          m.yaw += Math.sin(m.t * 3) * dt * 1.6;
          if (m.t <= 0) nextSearch();
        } else {
          if (m.sub === 'chase' && sameFloor && !lineClear(m.x, m.z, px, pz, rects)) m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f: player.floor, x: px, z: pz });
          const done = walk(dt, speed, rects, false);
          if (done && m.sub !== 'climb') {
            if (m.sub === 'checkHide') {
              if (m.checkSpot && m.checkSpot.occupied) { hooks.caught(m.checkSpot); return; }
              m.sub = 'look'; m.t = 1.5; hooks.subtitle('She searches… nobody there');
            } else if (m.sub === 'chase') { m.sub = 'look'; m.t = 1.2; }
            else { m.sub = 'look'; m.t = 1.6 + Math.random(); }
          }
        }

        // every so often she knows roughly where you are
        if (m.smellT > 22 && m.sub !== 'chase' && m.sub !== 'checkHide' && m.sub !== 'climb') {
          m.smellT = 0; m.sub = 'search';
          const c = roomCenter(player.floor, roomAt(player.floor, px, pz));
          m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f: player.floor, x: c.x, z: c.z });
        }

        m.stepT -= dt;
        if (m.stepT <= 0 && m.sub !== 'look') {
          m.stepT = m.sub === 'chase' ? 0.34 : 0.62;
          audio.step(pan(px, pz, pyaw, m.x, m.z), vol(player, m.x, m.z, m.floor, 1.2));
        }
        if (sameFloor && !player.hidden && !player.climb && dist < 0.95) { hooks.caught(null); return; }
      }
    }

    function nextSearch() {
      // maybe check a hiding place that is close, otherwise move on to another room, sometimes another floor
      const spots = world.hides.filter(h => h.floor === m.floor && Math.hypot(h.x - m.x, h.z - m.z) < 3.2);
      if (spots.length && Math.random() < 0.5) {
        const sp = spots[Math.floor(Math.random() * spots.length)];
        m.sub = 'checkHide'; m.checkSpot = sp;
        m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f: m.floor, x: sp.front.x, z: sp.front.z });
        return;
      }
      let f = m.floor;
      if (Math.random() < 0.35) f = Math.max(0, Math.min(3, f + (Math.random() < 0.5 ? -1 : 1)));
      const here = roomAt(m.floor, m.x, m.z);
      const rooms = roomIds(f).filter(r => !(f === m.floor && r === here));
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      const c = roomCenter(f, r);
      m.sub = 'search';
      m.path = findPath({ f: m.floor, x: m.x, z: m.z }, { f, x: c.x, z: c.z });
    }

    // visuals
    mesh.position.set(m.x, m.y, m.z);
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
    u.light.intensity = 12 + Math.sin(tt * 17) * 1.4 + Math.sin(tt * 5.3) * 1.2;
  };

  return m;
}
