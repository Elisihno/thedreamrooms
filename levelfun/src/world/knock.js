import * as THREE from '../three.js';
import { cloneModel, hasModel } from '../assets/models.js';
import { getMaterial } from '../assets/registry.js';
import { sfx } from '../audio/sfx.js';

// Props that can be knocked over: trash cans, floor lamps and office chairs. Walk into one, throw something at it
// or let Smiley barge past and it tips over with a crash (a loud noise for the AI). Items stored in a bin spill out.
const KINDS = {
  bin:   { model: 'trash_can', r: 0.38, h: 0.75, loud: 0.55, rest: { len: 0.75, wid: 0.76, hgt: 0.76 } },
  lamp:  { model: 'floor_lamp', r: 0.2, h: 1.6, loud: 0.6, rest: { len: 1.6, wid: 0.3, hgt: 0.22 } },
  chair: { model: 'chair_office', r: 0.28, h: 0.9, loud: 0.4, rest: { len: 0.9, wid: 0.56, hgt: 0.5 } },
};

export class Knockables {
  constructor(world) { this.world = world; this.list = []; this.falling = []; }

  add(kind, level, x, y, z, ry = 0) {
    const K = KINDS[kind]; if (!hasModel(K.model)) return null;
    const pivot = new THREE.Group(), inner = new THREE.Group(), m = cloneModel(K.model);
    m.traverse(o => { if (o.isMesh) { if (o.userData.matKey) o.material = getMaterial(o.userData.matKey); o.castShadow = false; o.receiveShadow = true; } });
    m.updateMatrixWorld(true);
    inner.add(m); inner.rotation.y = ry; pivot.add(inner); pivot.position.set(x, y, z); this.world.group(level).add(pivot);
    const box = this.world.collision.add(x - K.r, z - K.r, x + K.r, z + K.r, y, y + K.h);
    const k = { kind, K, level, x, y, z, pivot, inner, box, state: 'up', t: 0, dx: 0, dz: 1, lying: null };
    this.list.push(k); return k;
  }

  // Is a point (with some radius) touching a standing prop? Returns it.
  touching(x, y, z, r) {
    for (const k of this.list) {
      if (k.state !== 'up' || Math.abs(y - k.y) > 1.2) continue;
      const cx = Math.min(Math.max(x, k.x - k.K.r), k.x + k.K.r), cz = Math.min(Math.max(z, k.z - k.K.r), k.z + k.K.r);
      if (Math.hypot(x - cx, z - cz) < r) return k;
    }
    return null;
  }

  // Knock a prop over, away from (dx, dz).
  knock(k, dx, dz, who = 'player') {
    if (k.state !== 'up') return;
    const d = Math.hypot(dx, dz) || 1; k.dx = dx / d; k.dz = dz / d; k.state = 'falling'; k.t = 0; k.who = who;
    k.box.enabled = false;
    // pivot at the foot edge on the side it falls toward, so it tips rather than spins
    k.pivot.position.set(k.x + k.dx * k.K.r, k.y, k.z + k.dz * k.K.r); k.inner.position.set(-k.dx * k.K.r, 0, -k.dz * k.K.r);
    this.falling.push(k);
    const N = this.world.noises; if (N) { N.push({ x: k.x, y: k.y, z: k.z, loud: k.K.loud, src: who === 'smiley' ? 'smiley' : 'knock', t: -99 }); if (N.length > 32) N.shift(); }
    if (this.onKnock) this.onKnock(k);
  }

  land(k) {
    const R = k.K.rest, ax = Math.abs(k.dx) > Math.abs(k.dz), cx = k.x + k.dx * (R.len / 2 + k.K.r * 0.2), cz = k.z + k.dz * (R.len / 2 + k.K.r * 0.2);
    const hx = ax ? R.len / 2 : R.wid / 2, hz = ax ? R.wid / 2 : R.len / 2;
    k.lying = this.world.collision.add(cx - hx, cz - hz, cx + hx, cz + hz, k.y, k.y + R.hgt);
    sfx.clatter && sfx.clatter(k.kind);
  }

  update(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const k = this.falling[i]; k.t += dt;
      const T = 0.55, u = Math.min(1, k.t / T), ang = (Math.PI / 2) * (u * u);   // gravity: slow start, fast finish
      k.pivot.quaternion.setFromAxisAngle(new THREE.Vector3(k.dz, 0, -k.dx), ang);
      // a small rebound once it hits the floor
      if (u >= 1) { const b = k.t - T; if (b < 0.18) k.pivot.quaternion.setFromAxisAngle(new THREE.Vector3(k.dz, 0, -k.dx), Math.PI / 2 - Math.sin(b / 0.18 * Math.PI) * 0.12); else { k.state = 'down'; this.falling.splice(i, 1); } }
      if (u >= 1 && !k.landed) { k.landed = true; this.land(k); }
    }
  }
}
