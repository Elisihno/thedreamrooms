import * as THREE from '../vendor/three.module.min.js';
import { leatherTexture } from './hillbilly.js';

// Things that decorate the house and are built in code: the trophy wall of face masks, Grandpa and Grandma
// (long dead, in their rocking chairs) and the mannequin from Dread. Each is a group whose origin is on the
// floor at the middle of the back (against the wall), facing +z into the room, like every other piece of furniture.

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
const caps = (r, len, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat, parent, x, y, z); m.rotation.set(rx, ry, rz); return m; };
const ball = (r, mat, parent, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat, parent, x, y, z); m.scale.set(sx, sy, sz); return m; };

// ---- Dread's mannequin: a standing figure that topples when you walk up to it -----------------------------------
export function buildMannequin() {
  const m = lam(0xd0c8bc);
  const g = new THREE.Group();
  const add = (geo, x, y, z, rz = 0) => { const mm = mesh(geo, m, g, x, y, z); mm.rotation.z = rz; return mm; };
  add(new THREE.CylinderGeometry(.26, .28, .03, 14), 0, .015, 0);                      // stand
  for (const x of [-.1, .1]) add(new THREE.CylinderGeometry(.065, .05, .9, 10), x, .48, 0);   // legs
  add(new THREE.BoxGeometry(.36, .22, .2), 0, 1.0, 0);                                  // hips
  add(new THREE.CylinderGeometry(.18, .14, .6, 12), 0, 1.4, 0);                         // torso
  add(new THREE.CylinderGeometry(.045, .05, .12, 8), 0, 1.76, 0);                       // neck
  add(new THREE.SphereGeometry(.105, 14, 10), 0, 1.9, 0).scale.set(.9, 1.15, 1);        // head
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.04, .035, .7, 8), s * .27, 1.38, 0, s * .12);   // arms
  return g;
}

// ---- the trophy wall: a board hung with masks made of skin and leather -------------------------------------------
let maskTextures = null;
function trophyTextures() {
  if (maskTextures) return maskTextures;
  const eyes = [{ x: 1024 * 0.25 - 64, y: 248 }, { x: 1024 * 0.25 + 64, y: 248 }];
  const skin = ['#c9a58a', '#bf9a7e', '#d2b095', '#b98f75', '#cdb39b'];
  maskTextures = [
    leatherTexture(eyes, { seed: 5 }),
    leatherTexture(eyes, { seed: 9, base: '#3e2a1c', palette: ['#4a3322', '#3a281b', '#543b28'] }),
    leatherTexture(eyes, { seed: 13, base: '#c4a083', palette: skin }),
    leatherTexture(eyes, { seed: 17, base: '#b98f75', palette: skin }),
  ];
  return maskTextures;
}

export function buildTrophyWall() {
  const g = new THREE.Group();
  const wood = lam(0x2e2018), nail = lam(0x777777);
  mesh(new THREE.BoxGeometry(2.4, 1.5, 0.06), wood, g, 0, 1.3, 0.03);
  const tex = trophyTextures();
  let n = 0;
  for (const [y, xs] of [[1.78, [-0.85, 0, 0.85]], [1.2, [-1.0, -0.33, 0.33, 1.0]], [0.78, [-0.55, 0.55]]]) {
    for (const x of xs) {
      const t = tex[n++ % tex.length];
      const mat = new THREE.MeshLambertMaterial({ map: t.map, alphaTest: 0.5, side: THREE.DoubleSide });
      const m = mesh(new THREE.SphereGeometry(1, 36, 26), mat, g, x, y, 0.12);
      m.scale.set(0.12, 0.16, 0.075);
      m.rotation.z = ((n * 37) % 11 - 5) * 0.025;
      mesh(new THREE.SphereGeometry(0.014, 6, 5), nail, g, x, y + 0.18, 0.07);
      mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), lam(0x20140c), g, x, y + 0.16, 0.1);
    }
  }
  // a sheet of dried blood down the board
  mesh(new THREE.PlaneGeometry(2.3, 0.04), lam(0x5a0b0b), g, 0, 0.58, 0.062);
  return g;
}

// ---- Grandpa and Grandma: dried out, seated in rocking chairs ---------------------------------------------------
export function buildCorpse(who) {
  const g = new THREE.Group();
  const wood = lam(0x5a4028), bone = lam(0xd8cdb0), dry = lam(0x8a7458), dark = new THREE.MeshBasicMaterial({ color: 0x0a0705 });
  const grandpa = who === 'grandpa';
  const shirt = lam(grandpa ? 0x6a7684 : 0x6c6278), pants = lam(grandpa ? 0x3d5170 : 0x5a4f66), hair = lam(0xe8e4dc);
  // the rocking chair
  mesh(new THREE.BoxGeometry(0.56, 0.06, 0.52), wood, g, 0, 0.46, 0.34);
  mesh(new THREE.BoxGeometry(0.56, 0.78, 0.05), wood, g, 0, 0.9, 0.1).rotation.x = -0.12;
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.05, 0.05, 0.62), wood, g, s * 0.3, 0.66, 0.34);                  // arm rests
    mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), wood, g, s * 0.3, 0.55, 0.52);
    const rocker = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.8), wood, g, s * 0.3, 0.05, 0.34); rocker.rotation.x = 0;
    for (const z of [0.12, 0.56]) mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), wood, g, s * 0.3, 0.26, z);
  }
  // the body
  caps(0.15, 0.32, shirt, g, 0, 0.82, 0.2, -0.12);                                                // torso
  ball(0.17, grandpa ? pants : shirt, g, 0, 0.55, 0.3, 1.1, 0.7, 1);                              // hips
  for (const s of [-1, 1]) {
    caps(0.07, 0.34, pants, g, s * 0.11, 0.6, 0.52, Math.PI / 2);                                 // thighs
    caps(0.055, 0.34, pants, g, s * 0.11, 0.38, 0.72, 0.1);                                       // shins
    mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), lam(0x2a1c12), g, s * 0.11, 0.2, 0.78);           // shoes
    caps(0.05, 0.3, shirt, g, s * 0.2, 0.72, 0.32, 0.9, 0, s * -0.12);                            // arms resting forward
    ball(0.045, dry, g, s * 0.2, 0.62, 0.5);                                                       // hands
  }
  if (!grandpa) {   // a long skirt over the lap
    const skirt = mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.5, 14, 1, true), shirt, g, 0, 0.45, 0.58);
    skirt.rotation.x = Math.PI / 2 - 0.2; skirt.material = new THREE.MeshLambertMaterial({ color: 0x6c6278, side: THREE.DoubleSide });
  }
  caps(0.035, 0.05, dry, g, 0, 1.0, 0.18, -0.1);                                                  // the neck
  // the head: a skull with a little leathery skin left on it
  const head = new THREE.Group(); head.position.set(0, 1.12, 0.2); head.rotation.set(0.25, 0.1, 0.08); g.add(head);
  ball(0.1, bone, head, 0, 0, 0, 0.9, 1.05, 1);
  mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), bone, head, 0, -0.1, 0.03);                         // the jaw, a little open
  mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), dark, head, 0, -0.095, 0.045);
  for (const s of [-1, 1]) ball(0.026, dark, head, s * 0.04, 0.015, 0.085, 1, 1.2, 0.5);        // eye sockets
  mesh(new THREE.BoxGeometry(0.025, 0.04, 0.02), dark, head, 0, -0.03, 0.095);                    // the nose
  ball(0.055, dry, head, -0.05, 0.05, 0.02, 0.8, 1.1, 0.9);                                       // a patch of dried skin
  if (grandpa) {   // a feed cap
    const cap = mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.06, 14), lam(0x6a5a32), head, 0, 0.1, 0.0);
    mesh(new THREE.BoxGeometry(0.16, 0.012, 0.09), lam(0x6a5a32), head, 0, 0.085, 0.1);
    void cap;
  } else {          // thin white hair and a bun
    for (let i = 0; i < 9; i++) caps(0.005, 0.1, hair, head, Math.cos(i) * 0.085, 0.01 - (i % 3) * 0.03, Math.sin(i) * 0.06 - 0.03, 0, 0, (i - 4) * 0.12);
    ball(0.05, hair, head, 0, 0.1, -0.07);
  }
  return g;
}
