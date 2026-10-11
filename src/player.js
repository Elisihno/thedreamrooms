import * as THREE from 'three';
import { SPAWN, ly, groundY, KEYS, itemInfo } from './layout.js';
import { WAKE, wakeState } from './wake.js';

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
    this.hp = 1; // no lives: one hit from Granny ends the run
    this.items = []; // pickups you are carrying (keys and vases); the selected one is shown in your hand
    this.sel = 0;
    this.hidden = null;
    this.stepT = 0;
    this.bob = 0;
    this.target = null;
    this.hurtT = 0;
    this.moving = false;
    this.introT = WAKE; // finished unless startIntro() is called
    this.hintT = 0;
  }

  startIntro() { this.introT = 0; }
  get intro() { return this.introT < WAKE; }

  get inv() { return new Set(this.items.filter((p) => p.item.kind === 'key').map((p) => p.item.id)); }
  get held() { return this.items[this.sel] ?? null; }

  get speedNoise() { return this.crouch ? 2 : 6.5; }

  toggleCrouch() {
    if (this.hidden || this.intro) return;
    if (this.crouch && this.world.inCrawl(this.x, this.z, Math.round(this.y / 3))) {
      this.ui.toast('There is not enough room to stand up in here.');
      return;
    }
    this.crouch = !this.crouch;
    this.ui.setStance(this.crouch);
  }

  hurt() {
    this.hp -= 1;
    this.hurtT = 0.6;
    this.sound.hit();
    this.ui.flashHurt();
    if (this.hidden) this.leaveHide();
  }

  update(dt, input) {
    if (this.intro) {
      // waking up: no control yet, the camera does the work
      input.lookX = input.lookY = 0;
      this.introT += dt;
      const w = wakeState(this.introT);
      this.eye = w.eye;
      this.camera.position.set(this.x, this.y + w.eye, this.z);
      this.camera.rotation.set(this.pitch + w.pitch, this.yaw, w.roll);
      this.moving = false;
      this.target = null;
      this.ui.setPrompt('');
      return;
    }
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
        const head = this.crouch ? 1.0 : 1.5;
        let nx = this.x + mx, nz = this.z;
        [nx, nz] = this.world.collide(nx, nz, this.y, R, head);
        let px = nx, pz = nz + mz;
        [px, pz] = this.world.collide(px, pz, this.y, R, head);
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

    const tgtEye = this.hidden ? (this.hidden.under ? 0.5 : 1.25) : this.crouch ? EYE_CROUCH : EYE;
    this.eye += (tgtEye - this.eye) * Math.min(1, dt * 10);
    const bobY = this.moving ? Math.sin(this.bob) * 0.035 : 0;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.camera.position.set(this.x, this.y + this.eye + bobY, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, this.hurtT * 0.25);

    // a hint at the crawlspace openings
    this.hintT -= dt;
    if (!this.crouch && this.hintT <= 0 && this.world.crawlHint(this.x, this.z, Math.round(this.y / 3))) {
      this.ui.toast('A low crawlspace. Crouch [C] to crawl through.');
      this.hintT = 10;
    }
    this.updateTarget();
  }

  updateTarget() {
    this.target = null;
    if (this.hidden) { this.ui.setPrompt(this.hidden.under ? '[E] Come out' : '[E] Leave ' + (this.hidden.label ?? 'hiding spot')); return; }
    this.camera.updateMatrixWorld(true); // aim with this frame's camera, not last frame's
    this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.ray.intersectObjects([...this.world.interactables, ...this.world.blockers], false);
    for (const h of hits) {
      const ref = h.object.userData.ref;
      if (ref) {
        if (ref.type === 'pickup' && (ref.taken || ref.hidden)) continue;
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
      if (!d.unlocked) {
        const missing = d.keys.filter((k) => !d.filled.has(k));
        return this.inv.size && missing.some((k) => this.inv.has(k)) ? '[E] Unlock' : `[E] Locked - needs ${missing.map((k) => KEYS[k].label).join(' and ')}`;
      }
      return d.open ? '[E] Close door' : '[E] Open door';
    }
    if (t.type === 'pickup') return `[E] Take ${t.group.userData.label}`;
    if (t.type === 'hide') return t.under ? `[E] Hide under the ${t.label}` : `[E] Hide in the ${t.label}`;
    if (t.type === 'container') {
      if (t.oneWay && t.opened) return '';
      const name = { box: 'box', drawer: 'drawer', safe: 'safe', sealed: 'sealed box', locker: 'locker' }[t.kind];
      return t.opened ? `[E] Close the ${name}` : `[E] Open the ${name}`;
    }
    if (t.type === 'bin') return this.items.some((p) => p.item.kind === 'vase') ? '[E] Drop a vase in the trash can' : '[E] Look in the trash can';
    return '';
  }

  // Using a tool on something. Scissors snap after two uses.
  useTool(p) {
    this.sound.swing();
    if (p.uses == null) return;
    p.uses -= 1;
    if (p.uses <= 0) {
      this.items.splice(this.items.indexOf(p), 1);
      this.sel = Math.max(0, Math.min(this.sel, this.items.length - 1));
      this.ui.toast(`The ${itemInfo(p.item).label.toLowerCase()} snapped. They are no use now.`);
    }
    this.ui.setInv(this.items, this.sel);
  }

  interact() {
    if (this.intro) return;
    if (this.hidden) { this.leaveHide(); return; }
    const t = this.target;
    if (!t) return;
    const w = this.world;
    this.ui.pressHand();
    if (t.type === 'door') {
      const d = t.door;
      if (!d.unlocked) {
        // every key you carry that fits goes into its lock, and is used up
        const fits = d.keys.filter((k) => !d.filled.has(k) && this.inv.has(k));
        for (const k of fits) {
          d.filled.add(k);
          d.lockMeshes.filter((l) => l.key === k).forEach((l) => { l.mesh.visible = false; });
          const idx = this.items.findIndex((p) => p.item.kind === 'key' && p.item.id === k);
          this.items.splice(idx, 1);
        }
        if (fits.length) {
          this.sel = Math.max(0, Math.min(this.sel, this.items.length - 1));
          this.ui.setInv(this.items, this.sel);
          this.sound.pickup();
        }
        const missing = d.keys.filter((k) => !d.filled.has(k));
        if (missing.length) {
          this.sound.locked();
          const done = d.filled.size;
          this.ui.toast(
            (fits.length ? `The ${fits.map((k) => KEYS[k].label).join(' and the ')} turn${fits.length > 1 ? '' : 's'} in the lock and ${fits.length > 1 ? 'crumble' : 'crumbles'} away. ` : '') +
            `${d.name} is locked. You still need the ${missing.map((k) => KEYS[k].label).join(' and the ')}.` +
            (d.keys.length > 1 && done ? ` (${done} of ${d.keys.length} locks open)` : ''));
          w.noise(d.cx, d.level * 3, d.cz, 3);
          return;
        }
        d.unlocked = true;
        this.ui.toast(d.id === 'front'
          ? 'Both locks click open. This is not the way out. It leads to the kitchen and the living room.'
          : d.id === 'vault' ? 'The three locks fall away.' : `Unlocked the ${d.name.toLowerCase()}. The key crumbles away.`);
      }
      w.setDoor(d, !d.open);
      this.sound.door(0.5);
      w.noise(d.cx, d.level * 3, d.cz, 9);
    } else if (t.type === 'pickup') {
      t.taken = true;
      t.group.visible = false;
      this.sound.pickup();
      this.items.push(t);
      this.sel = this.items.length - 1; // pick it up into your hand
      this.ui.toast(t.item.kind === 'vase'
        ? 'You are holding a vase. Throw it with [F] or right click.'
        : `You are holding the ${itemInfo(t.item).label}`);
      this.ui.setInv(this.items, this.sel);
    } else if (t.type === 'hide') {
      this.enterHide(t);
    } else if (t.type === 'container') {
      if (t.requires) {
        const tool = this.items.find((p) => p.item.id === t.requires);
        if (!tool) { this.sound.locked(); this.ui.toast(t.hint); return; }
        this.useTool(tool);
        w.unseal(t);
        if (t.done) this.ui.toast(t.done);
      }
      if (t.oneWay && t.opened) return; // once opened it stays open
      const opening = t.target === 0;
      w.setContainer(t, opening);
      this.sound.door(0.2);
      if (opening && t.kind === 'box' && !this.hasContents(t)) this.ui.toast(t.junk ?? 'Empty.');
      if (opening && t.id === 'redbox') this.ui.toast('The red box. There is a key inside!');
    } else if (t.type === 'bin') {
      const vase = this.items.find((p) => p.item.kind === 'vase');
      if (!vase) { this.ui.toast('An old trash can. Something could be thrown in here.'); return; }
      if (!w.throwInBin()) { this.ui.toast('The sauna is already heating up.'); return; }
      this.items.splice(this.items.indexOf(vase), 1);
      this.sel = Math.max(0, Math.min(this.sel, this.items.length - 1));
      this.ui.setInv(this.items, this.sel);
      this.sound.crash(0.4);
    }
  }

  hasContents(c) { return this.world.pickups.some((p) => p.item.inside === c.id); }

  // Cycle the item in your hand (Q, mouse wheel, number keys).
  cycle(dir) {
    if (this.intro) return;
    if (this.items.length < 2) return;
    this.sel = (this.sel + dir + this.items.length) % this.items.length;
    this.ui.setInv(this.items, this.sel);
  }

  select(i) {
    if (i < 0 || i >= this.items.length || i === this.sel) return;
    this.sel = i;
    this.ui.setInv(this.items, this.sel);
  }

  // Put the item in your hand down on the floor in front of you.
  drop() {
    if (this.intro || this.hidden || !this.held) return;
    const p = this.items.splice(this.sel, 1)[0];
    this.sel = Math.max(0, Math.min(this.sel, this.items.length - 1));
    let x = this.x - Math.sin(this.yaw) * 0.8, z = this.z - Math.cos(this.yaw) * 0.8;
    [x, z] = this.world.collide(x, z, this.y, 0.15);
    const fy = groundY(x, z, this.y);
    p.baseY = fy + (p.item.kind === 'key' ? 0.022 : 0);
    p.group.position.set(x, p.baseY, z);
    p.hit.position.set(x, p.baseY + 0.12, z);
    p.item.x = x; p.item.z = z; p.item.level = Math.round(fy / 3);
    p.group.visible = true;
    p.taken = false;
    this.sound.step(0.3);
    this.world.noise(x, fy, z, 4);
    this.ui.setInv(this.items, this.sel);
  }

  enterHide(h) {
    if (h.under) {
      // step out the way you came in: toward the side of the table you are standing on
      const dx = this.x - h.x, dz = this.z - h.z;
      h.exit = Math.abs(dx) / h.w > Math.abs(dz) / h.d ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
    }
    this.hidden = h;
    this.stash = { x: this.x, z: this.z };
    this.x = h.x;
    this.z = h.z;
    this.yaw = Math.atan2(h.exit[0], h.exit[1]) + Math.PI; // face the way out
    this.pitch = 0;
    this.ui.setHidden(true, h.under);
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
    if (this.intro || this.hidden) return;
    let i = this.items.findIndex((p, k) => k === this.sel && p.item.kind === 'vase');
    if (i < 0) i = this.items.findIndex((p) => p.item.kind === 'vase');
    if (i < 0) { this.ui.toast('You have no vase to throw.'); return; }
    this.items.splice(i, 1);
    this.sel = Math.max(0, Math.min(this.sel, this.items.length - 1));
    this.ui.setInv(this.items, this.sel);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshPhongMaterial({ color: 0x86a3b8, shininess: 60 }),
    );
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    mesh.position.copy(this.camera.position).addScaledVector(dir, 0.4);
    this.world.scene.add(mesh);
    this.world.projectiles.push({ mesh, refY: this.y, vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 1.5, 0)), onLand });
    this.sound.swing();
  }
}
