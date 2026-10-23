import * as THREE from '../vendor/three.module.min.js';
import { makeApple } from './apple.js';
import { makeVase } from './vase.js';

// The pick-up items as they lie on a shelf, in a drawer or on the floor. They are Dread's own items,
// copied across: the key and the pliers are flat pictures, the rest are built from boxes or (the apple
// and the vase) from Dread's generators. In this game the pliers cut wires and padlocks, the knife
// chops the apple, the fuel can fills the truck and the spiral vase smashes when it is dropped.
//
// Every model rests on y = 0 and is centred on x and z; the hand-held versions are in held.js.

const matCache = new Map();
const lambert = color => {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
};
const steel = 0xb9bec3, darkSteel = 0x2a3035, wood = 0x5a3a22, brass = 0xb89a32, red = 0xc8321f;

// a list of [w, h, d, x, y0, z, colour]: boxes whose bottom is at y0
function boxes(list) {
  const g = new THREE.Group();
  for (const [w, h, d, x, y0, z, color] of list) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
    m.position.set(x, y0 + h / 2, z);
    g.add(m);
  }
  return g;
}

// the key and the pliers are pictures with a cut-out outline, lying flat
const textures = {};
function picture(name, w, h) {
  if (!textures[name]) {
    textures[name] = new THREE.TextureLoader().load(`assets/textures/item_${name}.png`);
    textures[name].colorSpace = THREE.SRGBColorSpace;
  }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textures[name], transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xd8d8d8 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  g.add(m);
  return g;
}

const builders = {
  key: () => picture('key', 0.34, 0.19),
  cutters: () => picture('pliers', 0.27, 0.28),

  cleaver() {   // Dread's kitchen knife
    return boxes([[.09, .016, .024, -.07, 0, 0, wood], [.012, .02, .026, -.015, 0, 0, steel], [.15, .004, .03, .06, .004, 0, steel]]);
  },

  peach() {     // Dread's withered apple
    const g = new THREE.Group();
    const a = makeApple(0.05);
    a.position.y = 0.045;
    g.add(a);
    return g;
  },

  shotgun() {
    const g = boxes([
      [.55, .026, .026, .22, .03, 0, darkSteel], [.44, .02, .02, .15, .005, 0, steel], [.18, .05, .04, -.1, 0, 0, darkSteel],
      [.15, .04, .044, .12, -.012, 0, wood], [.34, .06, .034, -.37, -.012, 0, wood], [.05, .1, .036, -.55, -.034, 0, wood],
    ]);
    g.position.y = 0.05;
    const w = new THREE.Group(); w.add(g);
    return w;
  },

  shells() {
    return boxes([-1, 0, 1].flatMap(k => [[.07, .022, .022, 0, 0, k * .026, red], [.022, .024, .024, -.044, 0, k * .026, brass]]));
  },

  battery() {
    return boxes([[.26, .18, .16, 0, 0, 0, darkSteel], [.264, .03, .164, 0, .12, 0, 0x3a5aa0], [.045, .035, .045, -.07, .18, 0, brass], [.045, .035, .045, .07, .18, 0, brass]]);
  },

  gas() {       // Dread's fuel can
    return boxes([[.3, .36, .13, 0, 0, 0, red], [.14, .04, .1, .06, .36, 0, red], [.05, .06, .05, -.09, .36, 0, steel], [.1, .02, .136, 0, .22, 0, 0x8a1c10], [.02, .12, .1, .17, .24, 0, darkSteel]]);
  },

  jar() {       // Dread's spiral vase: it smashes when it is dropped
    const g = new THREE.Group();
    g.add(makeVase(1.3));
    return g;
  },

  flashlight() {
    return boxes([[.16, .04, .04, -.02, 0, 0, 0x3a3f45], [.05, .065, .065, .085, -.012, 0, steel], [.01, .055, .055, .115, -.008, 0, 0xfff0b0],
      [.02, .012, .02, -.03, .04, 0, red], [.012, .042, .042, -.07, 0, 0, 0x23272b], [.012, .042, .042, -.04, 0, 0, 0x23272b]]);
  },

  postcard(extra = {}) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ map: extra.texture ?? null, color: 0xdddddd, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.103), m);
    p.rotation.x = -Math.PI / 2;
    p.position.y = 0.003;
    g.add(p);
    return g;
  },
};

export function buildItem(type, extra) {
  return builders[type](extra);
}

export const ITEM_NAMES = {
  key: 'key', cutters: 'cutting pliers', cleaver: 'kitchen knife', peach: 'apple', shotgun: 'shotgun', shells: 'shotgun shells',
  battery: 'car battery', gas: 'fuel can', jar: 'spiral vase', flashlight: 'flashlight', postcard: 'postcard',
};
