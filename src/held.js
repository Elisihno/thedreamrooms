import * as THREE from 'three';
import { makeItemModel } from './models.js';
import { KEYS } from './layout.js';

// What you hold in your hand: drawn in its own pass on top of the world, at the bottom right of the view.
export class HeldItem {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(60, 1, 0.02, 10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-1.2, 1.6, 1);
    this.scene.add(sun);
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.model = null;
    this.pickup = null;
    this.appear = 1;
    this.bob = 0;
  }

  get active() { return !!this.model && this.rig.visible; }

  resize(aspect) {
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
  }

  set(pickup) {
    if (pickup === this.pickup) return;
    this.pickup = pickup;
    if (this.model) this.rig.remove(this.model);
    this.model = null;
    if (!pickup) return;
    this.model = makeItemModel(pickup.item, KEYS);
    if (pickup.item.kind === 'key') {
      // the bit points up and away to the left, the bow is in your hand below the edge of the screen
      this.model.rotation.set(-0.35, 0.5, -2.45);
      this.model.scale.setScalar(0.95);
      this.rig.position.set(0.19, -0.25, -0.5);
    } else {
      this.model.rotation.set(0.1, 0.5, -0.15);
      this.model.scale.setScalar(1.2);
      this.rig.position.set(0.24, -0.42, -0.55);
    }
    this.rig.add(this.model);
    this.restY = this.rig.position.y;
    this.restX = this.rig.position.x;
    this.appear = 0; // slide up into view
  }

  update(dt, moving, bobPhase, hidden) {
    this.rig.visible = !hidden;
    if (!this.model) return;
    this.appear = Math.min(1, this.appear + dt * 4);
    const slide = (1 - this.appear) ** 2 * -0.35;
    const sway = moving ? Math.sin(bobPhase) * 0.012 : 0;
    this.rig.position.y = this.restY + slide + sway;
    this.rig.position.x = this.restX + (moving ? Math.cos(bobPhase * 0.5) * 0.008 : 0);
  }
}
