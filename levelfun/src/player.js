import * as THREE from './three.js';
import { CFG } from './config.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

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
    camera.rotation.order = 'YXZ';
  }

  teleport({ x, z, yaw = 0, crouched = false }) {
    this.pos.set(x, this.world.floorAt(x, z), z);
    this.yaw = yaw; this.pitch = 0;
    this.crouched = crouched; this.input.crouch = crouched;
    this.eye = crouched ? CFG.player.eyeCrouch : CFG.player.eyeStand;
    this.vx = this.vz = 0; this.lean = 0;
  }

  update(dt) {
    const P = CFG.player, inp = this.input, col = this.world.collision;
    const look = inp.consumeLook();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch - look.y, -CFG.look.pitchLimit, CFG.look.pitchLimit);

    // Crouch / stand (cannot stand up under a low ceiling or table).
    if (inp.crouch) this.crouched = true;
    else if (this.crouched && !col.overlaps(this.pos.x, this.pos.z, P.radius, this.pos.y + P.stepUp, this.pos.y + P.hStand)) this.crouched = false;
    this.eye += ((this.crouched ? P.eyeCrouch : P.eyeStand) - this.eye) * Math.min(1, dt * 10);

    // Movement
    const m = inp.move, sp = this.crouched ? P.crouch : P.walk;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const tx = (-s * m.y + c * m.x) * sp, tz = (-c * m.y - s * m.x) * sp;
    const k = Math.min(1, dt * P.accel);
    this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k;
    const h = this.crouched ? P.hCrouch : P.hStand;
    col.move(this.pos, this.vx * dt, this.vz * dt, P.radius, this.pos.y + P.stepUp, this.pos.y + h);
    this.speed = Math.hypot(this.vx, this.vz);

    // Smooth floor height (ramps/stairs).
    const fy = this.world.floorAt(this.pos.x, this.pos.z);
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
    this.camera.rotation.set(this.pitch, this.yaw, -this.lean * P.leanRoll);
  }
}
