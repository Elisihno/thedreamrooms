import * as THREE from 'three';
import { SPAWN, ly, groundY, KEYS } from './layout.js';

const R = 0.3;
const WALK = 2.7;
const CROUCH = 1.35;
const EYE = 1.6;
const EYE_CROUCH = 0.95;

export class Player {
  constructor(camera, world, sound, ui) {
    this.camera = camera;
    this.world = world;
    this.sound = sound;
    this.ui = ui;
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.6;
    this.camera.rotation.order = 'YXZ';
    this.reset();
  }

  reset() {
    this.x = SPAWN.x;
    this.z = SPAWN.z;
    this.y = ly(SPAWN.level);
    this.yaw = SPAWN.yaw;
    this.pitch = 0;
    this.crouch = false;
    this.eye = EYE;
    this.hp = 3;
    this.inv = new Set();
    this.vases = 0;
    this.hidden = null;
    this.stepT = 0;
    this.bob = 0;
    this.target = null;
    this.hurtT = 0;
    this.moving = false;
  }

  get speedNoise() { return this.crouch ? 2 : 6.5; }

  toggleCrouch() {
    if (this.hidden) return;
    this.crouch = !this.crouch;
    this.ui.setStance(this.crouch);
  }

  hurt() {
    this.hp -= 1;
    this.hurtT = 0.6;
    this.sound.hit();
    this.ui.setHp(this.hp);
    this.ui.flashHurt();
    if (this.hidden) this.leaveHide();
  }

  update(dt, input) {
    // look
    this.yaw -= input.lookX;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - input.lookY));
    input.lookX = input.lookY = 0;

    if (this.hidden) {
      this.moving = false;
    } else {
      // move
      const f = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0) + -input.joy.y;
      const s = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0) + input.joy.x;
      let fl = Math.max(-1, Math.min(1, f)), sl = Math.max(-1, Math.min(1, s));
      const len = Math.hypot(fl, sl);
      if (len > 1) { fl /= len; sl /= len; }
      const speed = this.crouch ? CROUCH : WALK;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const mx = (fx * fl + rx * sl) * speed * dt;
      const mz = (fz * fl + rz * sl) * speed * dt;
      this.moving = Math.hypot(mx, mz) > 1e-4;
      if (this.moving) {
        let nx = this.x + mx, nz = this.z;
        [nx, nz] = this.world.collide(nx, nz, this.y, R);
        let px = nx, pz = nz + mz;
        [px, pz] = this.world.collide(px, pz, this.y, R);
        this.x = px;
        this.z = pz;
        this.y = groundY(this.x, this.z, this.y);
        this.bob += dt * (this.crouch ? 6 : 9);
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = this.crouch ? 0.8 : 0.5;
          this.sound.step(this.crouch ? 0.12 : 0.4);
          this.world.noise(this.x, this.y, this.z, this.speedNoise);
        }
      }
    }

    const tgtEye = this.hidden ? 1.25 : this.crouch ? EYE_CROUCH : EYE;
    this.eye += (tgtEye - this.eye) * Math.min(1, dt * 10);
    const bobY = this.moving ? Math.sin(this.bob) * 0.035 : 0;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.camera.position.set(this.x, this.y + this.eye + bobY, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, this.hurtT * 0.25);

    this.updateTarget();
  }

  updateTarget() {
    this.target = null;
    if (this.hidden) { this.ui.setPrompt('[E] Leave ' + (this.hidden.label ?? 'hiding spot')); return; }
    this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.ray.intersectObjects([...this.world.interactables, ...this.world.blockers], false);
    for (const h of hits) {
      const ref = h.object.userData.ref;
      if (ref) {
        if (ref.type === 'pickup' && ref.taken) continue;
        this.target = ref;
      }
      break; // the first thing hit decides; walls block
    }
    this.ui.setPrompt(this.promptFor(this.target));
  }

  promptFor(t) {
    if (!t) return '';
    if (t.type === 'door') {
      const d = t.door;
      if (!d.unlocked) return `[E] Locked - needs ${KEYS[d.key].label}`;
      return d.open ? '[E] Close door' : '[E] Open door';
    }
    if (t.type === 'pickup') return `[E] Take ${t.group.userData.label}`;
    if (t.type === 'hide') return `[E] Hide in ${t.label}`;
    return '';
  }

  interact() {
    if (this.hidden) { this.leaveHide(); return; }
    const t = this.target;
    if (!t) return;
    const w = this.world;
    this.ui.pressHand();
    if (t.type === 'door') {
      const d = t.door;
      if (!d.unlocked) {
        if (this.inv.has(d.key)) {
          d.unlocked = true;
          this.ui.toast(`Unlocked the ${d.name.toLowerCase()}`);
          this.sound.pickup();
        } else {
          this.sound.locked();
          this.ui.toast(`${d.name} is locked. You need the ${KEYS[d.key].label}.`);
          w.noise(d.cx, d.level * 3, d.cz, 3);
          return;
        }
      }
      w.setDoor(d, !d.open);
      this.sound.door(0.5);
      w.noise(d.cx, d.level * 3, d.cz, 9);
    } else if (t.type === 'pickup') {
      t.taken = true;
      t.group.visible = false;
      this.sound.pickup();
      if (t.item.kind === 'key') {
        this.inv.add(t.item.id);
        this.ui.toast(`Picked up the ${KEYS[t.item.id].label}`);
      } else {
        this.vases += 1;
        this.ui.toast('Picked up a vase. Throw it [F] to lure Granny away.');
      }
      this.ui.setInv(this.inv, this.vases);
    } else if (t.type === 'hide') {
      this.enterHide(t);
    }
  }

  enterHide(h) {
    this.hidden = h;
    this.stash = { x: this.x, z: this.z };
    this.x = h.x;
    this.z = h.z;
    this.yaw = Math.atan2(h.exit[0], h.exit[1]) + Math.PI; // face the way out
    this.pitch = 0;
    this.ui.setHidden(true);
    this.sound.door(0.3);
  }

  leaveHide() {
    const h = this.hidden;
    this.hidden = null;
    this.x = h.x + h.exit[0] * (h.w / 2 + 0.5);
    this.z = h.z + h.exit[1] * (h.d / 2 + 0.5);
    this.ui.setHidden(false);
    this.sound.door(0.3);
  }

  throwVase(onLand) {
    if (this.hidden || this.vases <= 0) return;
    this.vases -= 1;
    this.ui.setInv(this.inv, this.vases);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x7aa0b8 }),
    );
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    mesh.position.copy(this.camera.position).addScaledVector(dir, 0.4);
    this.world.scene.add(mesh);
    this.world.projectiles.push({ mesh, vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 1.5, 0)), onLand });
    this.sound.swing();
  }
}
