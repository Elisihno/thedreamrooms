import * as THREE from '../vendor/three.module.min.js';

// Furniture is built from axis-aligned boxes so it can be merged into the house batches.
// Local frame of an item: x across it (centred), z from the wall (0) into the room, y up.
// b(w, h, d, x, y0, zc, material): box w wide, h tall, d deep, centred at (x, zc), bottom at y0.
// p = palette: body, dark2, light, cloth, paper (textured) and dark (plain).

const chair = (b, p, x, z, facing = 1) => {
  b(.42, .05, .42, x, .45, z, p.body);
  b(.42, .45, .05, x, .5, z + .2 * facing, p.body);
  for (const dx of [-.17, .17]) for (const dz of [-.17, .17]) b(.05, .45, .05, x + dx, 0, z + dz, p.body);
};

const handle = (b, p, x, y, z, w = .16) => b(w, .03, .03, x, y, z, p.dark);

export const ITEMS = {
  bed: { w: 1.5, d: 1.95, tall: false, build(b, p) {
    b(1.5, .3, 1.95, 0, .1, .975, p.body);
    b(1.4, .18, 1.85, 0, .4, 1.0, p.light);
    b(.5, .12, .35, -.35, .58, .3, p.light);
    b(.5, .12, .35, .35, .58, .3, p.light);
    b(1.42, .05, 1.1, 0, .58, 1.35, p.cloth);
    b(1.5, .95, .08, 0, .1, .04, p.body);
  } },
  nightstand: { w: .45, d: .4, tall: false, build(b, p) {
    b(.45, .5, .4, 0, 0, .2, p.body);
    b(.38, .18, .02, 0, .25, .405, p.dark2);
    handle(b, p, 0, .33, .43, .1);
  } },
  drawers: { w: 1.2, d: .5, tall: false, build(b, p) {
    b(1.2, .85, .5, 0, 0, .25, p.body);
    b(1.26, .05, .55, 0, .85, .275, p.dark2);
    for (let i = 0; i < 3; i++) {
      b(1.08, .22, .02, 0, .08 + i * .26, .51, p.dark2);
      handle(b, p, 0, .16 + i * .26, .54);
    }
  } },
  tablechairs: { w: 1.4, d: 1.4, tall: false, build(b, p) {
    b(1.4, .06, .8, 0, .72, .45, p.body);
    for (const dx of [-.62, .62]) for (const dz of [.1, .8]) b(.07, .72, .07, dx, 0, dz, p.dark2);
    chair(b, p, -.35, 1.1, 1);
    chair(b, p, .35, 1.1, 1);
  } },
  desk: { w: 1.3, d: 1.2, tall: false, build(b, p) {
    b(1.3, .05, .6, 0, .72, .3, p.body);
    b(.05, .72, .55, -.62, 0, .3, p.dark2);
    b(.4, .55, .5, .4, .17, .3, p.dark2);
    b(.34, .16, .02, .4, .5, .56, p.body);
    handle(b, p, .4, .58, .59, .1);
    chair(b, p, -.2, .95, 1);
  } },
  fridge: { w: .7, d: .7, tall: true, build(b, p) {
    b(.7, 1.8, .7, 0, 0, .35, p.light);
    b(.68, .02, .02, 0, 1.15, .71, p.dark);
    b(.03, .45, .04, .27, 1.25, .73, p.dark);
    b(.03, .55, .04, .27, .45, .73, p.dark);
  } },
  counter: { w: 1.1, d: .6, tall: false, build(b, p) {
    b(1.1, .86, .6, 0, 0, .3, p.body);
    b(1.14, .05, .64, 0, .86, .32, p.dark2);
    for (const dx of [-.26, .26]) {
      b(.48, .2, .02, dx, .62, .61, p.dark2);
      handle(b, p, dx, .7, .64, .14);
      b(.48, .5, .02, dx, .05, .61, p.dark2);
      handle(b, p, dx, .45, .64, .14);
    }
  } },
  stove: { w: 1.0, d: .6, tall: false, build(b, p) {
    b(1.0, .86, .6, 0, 0, .3, p.light);
    b(1.02, .04, .62, 0, .86, .31, p.dark);
    for (const dx of [-.22, .22]) for (const dz of [.2, .42]) b(.22, .02, .22, dx, .9, dz, p.dark);
    b(.8, .5, .02, 0, .1, .61, p.dark);
    handle(b, p, 0, .66, .64, .6);
  } },
  wardrobe: { w: 1.2, d: .6, tall: true, build(b, p) {
    b(1.2, 2.0, .6, 0, 0, .3, p.body);
    b(1.24, .06, .64, 0, 2.0, .32, p.dark2);
    b(.02, 1.9, .02, 0, .05, .61, p.dark);
    for (const dx of [-.1, .1]) b(.03, .2, .03, dx, 1.0, .63, p.dark);
  } },
  bookshelf: { w: 1.1, d: .35, tall: true, build(b, p) {
    for (const dx of [-.525, .525]) b(.05, 1.9, .35, dx, 0, .175, p.dark2);
    b(1.1, 1.9, .03, 0, 0, .015, p.dark2);
    const books = [p.dark, p.dark2, p.cloth, p.paper];
    for (let i = 0; i < 5; i++) {
      const y = .05 + i * .4;
      b(1.0, .04, .33, 0, y, .175, p.body);
      if (i === 4) continue;
      let x = -.45;
      for (let k = 0; k < 9 && x < .42; k++) {
        const w = .04 + ((k * 7 + i * 3) % 4) * .015, h = .22 + ((k * 5 + i) % 4) * .03;
        b(w, h, .22, x + w / 2, y + .04, .17, books[(k + i) % 4]);
        x += w + .015;
      }
    }
  } },
  sofa: { w: 1.9, d: .9, tall: false, build(b, p) {
    b(1.9, .4, .9, 0, 0, .45, p.cloth);
    b(1.9, .5, .2, 0, .4, .1, p.cloth);
    for (const dx of [-.85, .85]) b(.2, .3, .7, dx, .4, .55, p.cloth);
    for (const dx of [-.4, .4]) b(.8, .15, .65, dx, .4, .58, p.light);
  } },
  shelves: { w: 1.2, d: .4, tall: true, build(b, p) {
    for (const dx of [-.58, .58]) for (const dz of [.04, .36]) b(.05, 1.8, .05, dx, 0, dz, p.dark2);
    for (let i = 0; i < 4; i++) {
      b(1.2, .04, .4, 0, .15 + i * .5, .2, p.dark2);
      b(.3 + (i % 2) * .1, .25, .3, -.3, .19 + i * .5, .2, p.paper);
      b(.35, .2, .28, .25, .19 + i * .5, .2, p.cloth);
    }
  } },
  crates: { w: 1.3, d: .8, tall: false, build(b, p) {
    b(.6, .6, .6, -.3, 0, .4, p.paper);
    b(.55, .5, .55, .35, 0, .35, p.body);
    b(.45, .45, .45, -.25, .6, .35, p.paper);
  } },
  boiler: { w: .9, d: .9, tall: true, build(b, p) {
    b(.8, 1.3, .8, 0, 0, .45, p.dark2);
    b(.1, .6, .1, .2, 1.3, .3, p.dark);
    b(.1, .1, .5, .2, 1.8, .35, p.dark);
    b(.3, .2, .02, -.1, .6, .86, p.dark);
  } },
  chest: { w: .9, d: .55, tall: false, build(b, p) {
    b(.9, .45, .5, 0, 0, .3, p.body);
    b(.92, .1, .52, 0, .45, .3, p.dark2);
    b(.1, .1, .02, 0, .38, .56, p.dark);
  } },
  covered: { w: 1.2, d: .9, tall: false, build(b, p) {
    b(1.2, .6, .8, 0, 0, .45, p.light);
    b(.9, .5, .7, 0, .6, .45, p.light);
  } },
  chair: { w: .5, d: .5, tall: false, build(b, p) { chair(b, p, 0, .3, 1); } },
};

export const ROLE_ITEMS = {
  living: ['sofa', 'bookshelf', 'drawers', 'tablechairs', 'chair'],
  dining: ['tablechairs', 'drawers', 'chair'],
  kitchen: ['fridge', 'stove', 'counter', 'counter', 'counter', 'tablechairs'],
  study: ['desk', 'bookshelf', 'bookshelf', 'drawers'],
  hall: ['drawers', 'chair'],
  pantry: ['shelves', 'shelves', 'crates', 'counter'],
  bedroom: ['bed', 'nightstand', 'wardrobe', 'drawers', 'chair', 'bookshelf'],
  storage: ['shelves', 'crates', 'crates', 'boiler', 'chest', 'drawers'],
  attic: ['covered', 'chest', 'crates', 'wardrobe', 'drawers', 'chair', 'covered'],
};

// A standing mannequin, feet at y=0. `m` is the (textured) material.
export function buildMannequin(m) {
  const g = new THREE.Group();
  const add = (geo, x, y, z, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    g.add(mesh);
    return mesh;
  };
  add(new THREE.CylinderGeometry(.26, .28, .03, 14), 0, .015, 0);                  // stand
  for (const x of [-.1, .1]) add(new THREE.CylinderGeometry(.065, .05, .9, 10), x, .48, 0); // legs
  add(new THREE.BoxGeometry(.36, .22, .2), 0, 1.0, 0);                              // hips
  add(new THREE.CylinderGeometry(.18, .14, .6, 12), 0, 1.4, 0);                     // torso
  add(new THREE.CylinderGeometry(.045, .05, .12, 8), 0, 1.76, 0);                   // neck
  add(new THREE.SphereGeometry(.105, 14, 10), 0, 1.9, 0).scale.set(.9, 1.15, 1);    // head
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(.04, .035, .7, 8), s * .27, 1.38, 0, s * .12);   // arms
  }
  g.rotation.order = 'YXZ';
  return g;
}
