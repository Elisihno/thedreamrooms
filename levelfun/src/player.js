import * as THREE from './three.js';
import { CFG } from './config.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const WAKE = 4.2; // seconds
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export class Player {
  constructor(camera, world, input) {
    this.camera = camera; this.world = world; this.input = input;
    this.pos = new THREE.Vector3();   // feet
    this.yaw = 0; this.pitch = 0;
    this.crouched = false;
    this.eye = CFG.player.eyeStand;
    this.lean = 0;
    this.vx = 0; this.vz = 0;
    this.bob = 0; this.speed = 0;
    this.wakeT = WAKE;
    this.hide = null; this.stuckT = 0;   // hiding place {spot,...} / seconds left stuck in a party trap
    camera.rotation.order = 'YXZ';
  }

  teleport({ x, z, y = 0, yaw = 0, crouched = false }) {
    this.pos.set(x, this.world.floorAt(x, z, y + 0.2), z);
    this.yaw = yaw; this.pitch = 0;
    this.crouched = crouched; this.input.crouch = crouched;
    this.eye = crouched ? CFG.player.eyeCrouch : CFG.player.eyeStand;
    this.vx = this.vz = 0; this.lean = 0;
  }

  // Wake-up: starts lying on the floor looking up at the table underside, then rises to a crouch.
  wake() { this.wakeT = 0; }
  get waking() { return this.wakeT < WAKE; }

  update(dt) {
    const P = CFG.player, inp = this.input, col = this.world.collision;
    const look = inp.consumeLook();
    const waking = this.waking;
    if (waking) this.wakeT += dt;
    const wk = waking ? this.wakeT / WAKE : 1;
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch - look.y, -CFG.look.pitchLimit, CFG.look.pitchLimit);

    // Crouch / stand (cannot stand up under a low ceiling or table).
    if (inp.crouch) this.crouched = true;
    else if (this.crouched && !col.overlaps(this.pos.x, this.pos.z, P.radius, this.pos.y + P.stepUp, this.pos.y + P.hStand)) this.crouched = false;
    if (waking) this.eye = 0.22 + (P.eyeCrouch - 0.22) * ease((wk - 0.25) / 0.75);
    else this.eye += ((this.crouched ? P.eyeCrouch : P.eyeStand) - this.eye) * Math.min(1, dt * 10);

    // Hiding: stay put inside the spot, only looking around
    if (this.hide) {
      const h = this.hide; this.pos.set(h.spot.x, h.spot.y, h.spot.z); this.vx = this.vz = this.speed = 0; this.lean = 0;
      this.crouched = true; this.eye += (h.eye - this.eye) * Math.min(1, dt * 8);
      this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z); this.camera.rotation.set(this.pitch, this.yaw, 0);
      return;
    }
    if (this.stuckT > 0) this.stuckT -= dt;
    // Movement
    const m = wk < 0.6 || this.stuckT > 0 ? { x: 0, y: 0 } : inp.move, sp = this.crouched ? P.crouch : P.walk;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const tx = (-s * m.y + c * m.x) * sp, tz = (-c * m.y - s * m.x) * sp;
    const k = Math.min(1, dt * P.accel);
    this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k;
    const h = this.crouched ? P.hCrouch : P.hStand;
    const px = this.pos.x, pz = this.pos.z;
    col.move(this.pos, this.vx * dt, this.vz * dt, P.radius, this.pos.y + P.stepUp, this.pos.y + h);
    if (this.world.floorAt(this.pos.x, this.pos.z, this.pos.y, true) === null) {   // stepped over an opening: slide or stop
      const nx = this.pos.x, nz = this.pos.z;
      if (this.world.floorAt(nx, pz, this.pos.y, true) !== null) this.pos.set(nx, this.pos.y, pz);
      else if (this.world.floorAt(px, nz, this.pos.y, true) !== null) this.pos.set(px, this.pos.y, nz);
      else this.pos.set(px, this.pos.y, pz);
    }
    this.speed = Math.hypot(this.vx, this.vz);

    // Smooth floor height (ramps/stairs).
    const fy = this.world.floorAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 14);

    // Lean (reduced when a wall is in the way).
    const want = (inp.leanR ? 1 : 0) - (inp.leanL ? 1 : 0);
    const rx = c, rz = -s, camY = this.pos.y + this.eye;
    let allowed = want;
    for (const f of [1, 0.66, 0.33, 0]) {
      allowed = want * f;
      if (!col.overlaps(this.pos.x + rx * P.leanOffset * allowed, this.pos.z + rz * P.leanOffset * allowed, 0.12, camY - 0.08, camY + 0.08)) break;
    }
    this.lean += (allowed - this.lean) * Math.min(1, dt * 9);

    // Camera
    this.bob += this.speed * dt * 4.2;
    const bobY = Math.sin(this.bob) * 0.018 * Math.min(1, this.speed / P.walk) * (this.crouched ? 0.5 : 1);
    this.camera.position.set(
      this.pos.x + rx * P.leanOffset * this.lean,
      camY + bobY,
      this.pos.z + rz * P.leanOffset * this.lean);
    const drowsy = 1 - ease((wk - 0.2) / 0.8);
    this.camera.rotation.set(this.pitch + drowsy * 0.75, this.yaw + Math.sin(this.wakeT * 2.1) * 0.08 * drowsy, -this.lean * P.leanRoll + drowsy * 0.25 * Math.sin(this.wakeT * 1.3));
  }
}
