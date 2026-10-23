import * as THREE from '../vendor/three.module.min.js';
import { buildItem } from './models.js';

// The item in the player's hand. It lives in its own small scene, drawn on top of the world
// with a cleared depth buffer, so it never clips into walls.

// how each item sits in the hand: scale, offset, yaw/pitch/roll (models point along +x, tip toward -z)
const POSE = {
  key:      { s: 1.5, off: [0.02, 0.0, -0.06], yaw: 0.3, rx: 0.2, rz: 0.9 },
  cutters:  { s: 0.7, off: [-0.02, 0.0, -0.05], yaw: 0.25, rx: 0.5, rz: 0.4 },
  cleaver:  { s: 1.1, off: [0.02, -0.04, -0.05], yaw: 0.2, rx: 0.2, rz: 1.0 },
  peach:    { s: 1.4, off: [0.0, -0.06, -0.02], yaw: 0, rx: 0, rz: 0 },
  shotgun:  { s: 0.85, off: [-0.04, -0.06, -0.2], yaw: 0.16, rx: 0.04, rz: 0 },
  shells:   { s: 1.5, off: [0.01, -0.03, -0.03], yaw: 0.3, rx: 0.2, rz: 0.3 },
  battery:  { s: 0.6, off: [0.0, -0.1, -0.02], yaw: 0.3, rx: 0, rz: 0 },
  gas:      { s: 0.55, off: [0.0, -0.1, -0.02], yaw: 0.3, rx: 0, rz: 0 },
  jar:      { s: 1.0, off: [0.01, -0.08, -0.02], yaw: 0, rx: 0, rz: 0 },
};

export function createHeld() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5);
  scene.add(new THREE.AmbientLight(0xd8d0c0, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
  sun.position.set(0.6, 1, 0.8);
  scene.add(sun);

  const rig = new THREE.Group(); // the hand: this is what moves
  scene.add(rig);
  const models = {};
  for (const [type, pose] of Object.entries(POSE)) {
    const m = buildItem(type);
    const holder = new THREE.Group();
    holder.rotation.order = 'YXZ';
    holder.rotation.set(pose.rx, Math.PI / 2 + pose.yaw, pose.rz);
    holder.position.set(...pose.off);
    holder.scale.setScalar(pose.s);
    holder.add(m);
    holder.visible = false;
    rig.add(holder);
    models[type] = m;
    m.userData.holder = holder;
  }
  const bobbing = models.jar;
  void bobbing;

  const REST = new THREE.Vector3(0.12, -0.075, -0.38);
  let shown = null, raise = 1, walkSmooth = 0, prevWalk = 0, kickT = 99;

  // The hand is a loosely held weight on springs. The view moves it around (a step bounces
  // the camera, a turn drags it), and it lags behind and settles with a little overshoot.
  // state order: x, y, z (metres), pitch, yaw, roll (radians)
  const s = new Float64Array(6), v = new Float64Array(6);
  const K = 170, C = 13; // about 2 Hz, lightly damped
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  return {
    scene, camera, rig,
    visible: false,
    show(type) {
      for (const [name, m] of Object.entries(models)) m.userData.holder.visible = name === type;
      this.visible = !!type && !!models[type];
      if (type && type !== shown) raise = 0; // lift it into view
      shown = type;
    },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
    // the gun goes off: a kick back, a flash at the muzzle
    kick() {
      kickT = 0;
      const f = models.shotgun.userData.flash;
      f.visible = true;
      f.scale.setScalar(0.8 + Math.random() * 0.5);
    },
    // walk: 0..1 how hard the player moves; bobAccel: vertical acceleration of the camera bob;
    // yawRate / pitchRate: how fast the view turns (rad/s)
    update(t, dt, { walk, bobAccel, yawRate, pitchRate }) {
      if (!this.visible) return;
      walkSmooth += (walk - walkSmooth) * Math.min(1, dt * 6);
      raise = Math.min(1, raise + dt * 4);
      const surge = clamp((walkSmooth - prevWalk) / Math.max(dt, 1e-3), -6, 6);
      prevWalk = walkSmooth;

      const step = Math.sin(t * 4 + 0.4) * walkSmooth; // side to side, once per two steps
      const target = [0, 0, 0, clamp(-pitchRate * 0.025, -0.12, 0.12), clamp(-yawRate * 0.03, -0.15, 0.15), 0];
      const drive = [step * 0.6, -bobAccel * 0.28, -surge * 0.04, -bobAccel * 1.8, 0, step * 3];
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 6; j++) {
          const a = K * (target[j] - s[j]) - C * v[j] + drive[j];
          v[j] += a * h;
          s[j] += v[j] * h;
        }
      }
      kickT += dt;
      if (kickT > 0.07) models.shotgun.userData.flash.visible = false;
      const kick = Math.exp(-kickT * 11);
      // a slow breathing drift, so it is never perfectly still
      const idle = 0.0006;
      rig.position.set(
        REST.x + s[0] + Math.sin(t * 0.9) * idle,
        REST.y + s[1] + Math.sin(t * 1.3 + 1) * idle - (1 - raise) * 0.25,
        REST.z + s[2] + kick * 0.09,
      );
      rig.rotation.set(s[3] + kick * 0.2, s[4], s[5] + Math.sin(t * 0.7) * 0.003);
    },
  };
}
