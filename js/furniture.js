import * as THREE from '../vendor/three.module.min.js';

// Furniture is built from boxes (and a few cylinders) so it can be merged into the house batches.
// Wall items: local x across the item (centred), z from the wall (0) into the room, y up.
// Centre items (center: true): the origin is the middle of the cell.
//
//   b(w, h, d, x, y0, zc, material)     static box: w wide, h tall, d deep, centred at (x, zc), bottom at y0
//   b.cyl(r, h, x, y0, zc, material)    static cylinder
//   item.hide = {x, z, w, d, h, eye}   a spot to hide in: box (item-local) the player looks at, camera height under it
//   mv.wire(color, x, y0, h, z)         a wire that can be cut with pliers; usable once the last part (the lid) is open
//   mv.door(boxes, hx, hz, hinge, {lootPos, tag})   (lootPos: item-local spot where something can lie behind it)
//   mv.drawer(boxes, dist)              part that slides out along +z when used
//   mv.door(boxes, hx, hz, side)        part hinged on a vertical axis at (hx, hz); side +1: hinge on the left
//   mv.flap(boxes, hy, hz, angle, loot) part hinged on a horizontal axis at (y=hy, z=hz); loot: item-local
//                                       spot where something can lie under the lid
//
// `boxes` is a list of [w, h, d, x, y0, zc, material]. p is the palette:
// body, dark2, light, cloth, paper (textured) and dark (plain).

// A chair at (cx, cz) facing the direction (dx, dz).
const chairAt = (b, p, cx, cz, dx, dz) => {
  const alongX = dx !== 0;
  b(.5, .05, .5, cx, .46, cz, p.body);
  b(alongX ? .05 : .5, .55, alongX ? .5 : .05, cx - dx * .23, .5, cz - dz * .23, p.body);
  for (const lx of [-.2, .2]) for (const lz of [-.2, .2]) b(.06, .46, .06, cx + lx, 0, cz + lz, p.dark2);
};

const handle = (p, x, y, z, w = .16) => [w, .03, .03, x, y, z, p.dark];

export const ITEMS = {
  // the frame stands on legs, leaving 40 cm underneath to hide in
  bed: { w: 1.5, d: 1.95, tall: false, hide: { x: 0, z: .975, w: 1.5, d: 1.95, h: .85, eye: .26 }, build(b, p) {
    for (const dx of [-.7, .7]) for (const dz of [.06, 1.89]) b(.07, .4, .07, dx, 0, dz, p.dark2);
    b(1.5, .14, 1.95, 0, .4, .975, p.body);
    b(1.4, .18, 1.85, 0, .54, 1.0, p.light);
    b(.5, .12, .35, -.35, .72, .3, p.light);
    b(.5, .12, .35, .35, .72, .3, p.light);
    b(1.42, .05, 1.1, 0, .72, 1.35, p.cloth);
    b(1.5, .95, .08, 0, .1, .04, p.body);
  } },
  nightstand: { w: .45, d: .4, tall: false, build(b, p, mv) {
    b(.45, .5, .4, 0, 0, .2, p.body);
    mv.drawer([[.38, .18, .31, 0, .25, .255, p.dark2], [.38, .18, .02, 0, .25, .41, p.dark2], handle(p, 0, .33, .44, .1)], .26);
  } },
  drawers: { w: 1.2, d: .5, tall: false, build(b, p, mv) {
    b(1.2, .85, .5, 0, 0, .25, p.body);
    b(1.26, .05, .55, 0, .85, .275, p.dark2);
    for (let i = 0; i < 3; i++) {
      const y = .08 + i * .26;
      mv.drawer([[1.04, .2, .42, 0, y + .01, .3, p.dark2], [1.08, .22, .02, 0, y, .51, p.dark2], handle(p, 0, y + .08, .54)], .34);
    }
  } },
  tablechairs: { w: 1.4, d: 1.6, tall: false, center: true, hide: { x: 0, z: 0, w: 1.4, d: .85, h: .8, eye: .5 }, build(b, p) {
    b(1.4, .06, .85, 0, .72, 0, p.body);
    for (const dx of [-.62, .62]) for (const dz of [-.35, .35]) b(.07, .72, .07, dx, 0, dz, p.dark2);
    for (const x of [-.35, .35]) {
      chairAt(b, p, x, -.55, 0, 1);
      chairAt(b, p, x, .55, 0, -1);
    }
  }, colliders: [[1.4, .85, 0, 0], [.5, .5, -.35, -.55], [.5, .5, .35, -.55], [.5, .5, -.35, .55], [.5, .5, .35, .55]] },
  roundtable: { w: 1.1, d: 2.2, tall: false, center: true, hide: { x: 0, z: 0, w: 1.1, d: 1.1, h: .8, eye: .5 }, build(b, p) {
    b.cyl(.55, .05, 0, .72, 0, p.body);
    b.cyl(.09, .72, 0, 0, 0, p.dark2);
    b.cyl(.3, .05, 0, 0, 0, p.dark2);
    chairAt(b, p, 0, -.85, 0, 1);
    chairAt(b, p, 0, .85, 0, -1);
  }, colliders: [[1.1, 1.1, 0, 0], [.5, .5, 0, -.85], [.5, .5, 0, .85]] },
  desk: { w: 1.3, d: 1.2, tall: false, build(b, p, mv) {
    b(1.3, .05, .6, 0, .72, .3, p.body);
    b(.05, .72, .55, -.62, 0, .3, p.dark2);
    b(.4, .55, .5, .4, .17, .3, p.dark2);
    mv.drawer([[.34, .16, .4, .4, .5, .27, p.body], [.34, .16, .02, .4, .5, .56, p.body], handle(p, .4, .58, .59, .1)], .3);
    chairAt(b, p, -.2, .85, 0, -1);
  } },
  // hollow, with a freezer on top and the fridge below; both doors open. The apple lies on the
  // middle shelf (tag 'fridge' marks the door that opens onto it).
  fridge: { w: .7, d: .7, tall: true, build(b, p, mv) {
    b(.7, 1.8, .03, 0, 0, .015, p.light);                       // back
    for (const s of [-1, 1]) b(.03, 1.8, .7, s * .335, 0, .35, p.light); // sides
    b(.7, .03, .7, 0, 1.77, .35, p.light);                      // top
    b(.7, .05, .7, 0, 0, .35, p.light);                         // bottom
    b(.64, .04, .66, 0, 1.13, .35, p.light);                    // divider
    for (const y of [.5, .8]) b(.64, .02, .62, 0, y, .36, p.dark2);   // fridge shelves
    b(.64, .02, .62, 0, 1.45, .36, p.dark2);                    // freezer shelf
    b(.09, .22, .09, -.2, .52, .3, p.light);                    // milk
    b(.08, .11, .08, .12, .82, .42, p.paper);                   // jar
    b(.2, .09, .14, .0, .06, .3, p.cloth);                      // box in the bottom drawer
    b(.2, .12, .16, -.1, 1.17, .35, p.light);                   // frozen box
    b(.18, .1, .14, .15, 1.47, .3, p.cloth);
    // freezer door (top) and fridge door (below), hinged on the left
    mv.door([[.68, .58, .03, 0, 1.17, .715, p.light], [.03, .3, .04, .27, 1.3, .745, p.dark]], -.34, .715, 1);
    mv.door([[.68, 1.07, .03, 0, .05, .715, p.light], [.03, .5, .04, .27, .5, .745, p.dark]], -.34, .715, 1,
      { lootPos: [0, .545, .36], tag: 'fridge' });
  } },
  counter: { w: 1.1, d: .6, tall: false, build(b, p, mv) {
    b(1.1, .86, .6, 0, 0, .3, p.body);
    b(1.14, .05, .64, 0, .86, .32, p.dark2);
    for (const dx of [-.26, .26]) {
      mv.drawer([[.46, .18, .5, dx, .63, .35, p.dark2], [.48, .2, .02, dx, .62, .61, p.dark2], handle(p, dx, .7, .64, .14)], .32);
      const side = dx < 0 ? 1 : -1;
      mv.door([[.48, .5, .02, dx, .05, .61, p.dark2], handle(p, dx - side * .15, .45, .64, .03)], dx - side * .24, .61, side);
    }
  } },
  // counter with a microwave on top; the microwave door swings open to the left
  microcounter: { w: 1.1, d: .6, tall: false, build(b, p, mv) {
    b(1.1, .86, .6, 0, 0, .3, p.body);
    b(1.14, .05, .64, 0, .86, .32, p.dark2);
    for (const dx of [-.26, .26]) {
      mv.drawer([[.46, .18, .5, dx, .63, .35, p.dark2], [.48, .2, .02, dx, .62, .61, p.dark2], handle(p, dx, .7, .64, .14)], .32);
      const side = dx < 0 ? 1 : -1;
      mv.door([[.48, .5, .02, dx, .05, .61, p.dark2], handle(p, dx - side * .15, .45, .64, .03)], dx - side * .24, .61, side);
    }
    const xm = -.12, y = .91;                                    // microwave
    b(.52, .02, .38, xm, y + .27, .33, p.light);                 // top
    b(.52, .02, .38, xm, y, .33, p.light);                       // bottom
    b(.52, .27, .02, xm, y, .15, p.light);                       // back
    b(.02, .27, .38, xm - .25, y, .33, p.light);                 // left side
    b(.15, .27, .38, xm + .185, y, .33, p.light);                // control panel
    b(.1, .03, .01, xm + .185, y + .2, .525, p.dark);            // display
    for (let k = 0; k < 3; k++) b(.04, .03, .01, xm + .15 + (k % 2) * .06, y + .11 - Math.floor(k / 2) * .05, .525, p.dark2);
    b.cyl(.13, .015, xm - .06, y + .02, .33, p.dark2);           // turntable
    mv.door([[.36, .26, .02, xm - .07, y + .005, .525, p.dark2], [.26, .16, .01, xm - .07, y + .05, .54, p.dark], [.02, .16, .03, xm + .08, y + .05, .54, p.dark]],
      xm - .25, .525, 1);
  } },
  // a tall bank of four drawers
  kitchendrawers: { w: 1.0, d: .6, tall: false, build(b, p, mv) {
    b(1.0, .86, .6, 0, 0, .3, p.body);
    b(1.04, .05, .64, 0, .86, .32, p.dark2);
    for (let i = 0; i < 4; i++) {
      const y = .04 + i * .2;
      mv.drawer([[.88, .16, .5, 0, y + .01, .3, p.dark2], [.92, .18, .02, 0, y, .61, p.dark2], handle(p, 0, y + .1, .64, .16)], .36);
    }
  } },
  stove: { w: 1.0, d: .6, tall: false, build(b, p, mv) {
    b(1.0, .86, .6, 0, 0, .3, p.light);
    b(1.02, .04, .62, 0, .86, .31, p.dark);
    for (const dx of [-.22, .22]) for (const dz of [.2, .42]) b(.22, .02, .22, dx, .9, dz, p.dark);
    mv.flap([[.8, .5, .02, 0, .1, .61, p.dark], handle(p, 0, .56, .64, .6)], .1, .61, 1.55);
  } },
  wardrobe: { w: 1.2, d: .6, tall: true, build(b, p, mv) {
    b(1.2, 2.0, .6, 0, 0, .3, p.body);
    b(1.24, .06, .64, 0, 2.0, .32, p.dark2);
    for (const s of [-1, 1]) {
      mv.door([[.58, 1.9, .02, s * .3, .05, .61, p.body], [.03, .22, .03, s * .08, .95, .635, p.dark]], s * .6, .61, -s);
    }
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
  chest: { w: .9, d: .55, tall: false, build(b, p, mv) {
    b(.9, .45, .5, 0, 0, .3, p.body);
    b(.1, .1, .02, 0, .36, .56, p.dark);
    mv.flap([[.92, .1, .52, 0, .45, .3, p.dark2]], .45, .05, -1.9, [0, .462, .3]);
  } },
  covered: { w: 1.2, d: .9, tall: false, build(b, p) {
    b(1.2, .6, .8, 0, 0, .45, p.light);
    b(.9, .5, .7, 0, .6, .45, p.light);
  } },
  armchair: { w: .9, d: .85, tall: false, build(b, p) {
    b(.9, .4, .85, 0, 0, .425, p.cloth);
    b(.9, .5, .2, 0, .4, .1, p.cloth);
    for (const dx of [-.375, .375]) b(.15, .3, .6, dx, .4, .55, p.cloth);
    b(.6, .12, .55, 0, .4, .55, p.light);
  } },
  tvunit: { w: 1.3, d: .45, tall: true, build(b, p) {
    b(1.3, .5, .45, 0, 0, .225, p.body);
    b(1.26, .02, .02, 0, .26, .46, p.dark);
    b(1.0, .6, .06, 0, .55, .22, p.dark);
    b(.92, .52, .01, 0, .59, .255, p.dark2);
    b(.3, .05, .2, 0, .5, .22, p.dark);
  } },
  fireplace: { w: 1.4, d: .5, tall: true, build(b, p) {
    b(1.4, 1.2, .5, 0, 0, .25, p.dark2);
    b(.7, .7, .02, 0, .05, .51, p.dark);
    b(1.6, .08, .6, 0, 1.2, .3, p.body);
  } },
  // rug and coffee table, free-standing
  livingset: { w: 1.7, d: 1.3, tall: false, center: true, build(b, p) {
    b(1.7, .015, 1.3, 0, .005, 0, p.cloth);
    b(.9, .05, .5, 0, .38, 0, p.body);
    for (const dx of [-.4, .4]) for (const dz of [-.2, .2]) b(.05, .38, .05, dx, 0, dz, p.dark2);
  }, colliders: [[.9, .5, 0, 0]] },
  // a metal bin; hold a piece of paper and use it to throw the paper away
  trashcan: { w: .5, d: .5, tall: false, colliders: [[.5, .5, 0, .3]], build(b, p, mv) {
    b.cyl(.22, .56, 0, 0, .3, p.steel);
    b.cyl(.235, .04, 0, .54, .3, p.dark2);
    b.cyl(.19, .02, 0, .58, .3, p.dark);          // the dark opening
    mv.target('trash', .46, .6, .46, 0, 0, .3);
  } },
  // an old car, nose toward +z (the garage door). Look at the hood, the fuel tank or the door.
  car: { w: 1.9, d: 4.2, tall: false, center: true, colliders: [[1.9, 4.2, 0, 0]], build(b, p, mv) {
    const body = p.light, glass = p.dark, trim = p.dark2;
    b(1.8, .5, 4.2, 0, .3, 0, body);                 // lower body
    b(1.7, .1, 1.1, 0, .8, 1.5, body);               // hood
    b(1.55, .5, 1.8, 0, .8, -.2, body);              // cabin
    b(1.6, .08, 1.9, 0, 1.3, -.2, trim);             // roof
    for (const s of [-1, 1]) b(.03, .42, 1.7, s * .79, .84, -.2, glass); // side windows
    b(1.5, .42, .03, 0, .84, .72, glass);            // windscreen
    b(1.5, .42, .03, 0, .84, -1.12, glass);          // rear window
    for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) b(.28, .62, .62, sx * .88, 0, sz, p.dark);   // wheels
    b(1.8, .16, .1, 0, .22, 2.12, trim);             // front bumper
    b(1.8, .16, .1, 0, .22, -2.12, trim);            // rear bumper
    for (const s of [-1, 1]) b(.3, .14, .04, s * .55, .62, 2.12, p.light);   // headlights (they light up later)
    for (const s of [-1, 1]) b(.24, .12, .04, s * .62, .62, -2.11, p.cloth);  // tail lights
    b(1.0, .04, .4, 0, .7, .05, p.cloth);           // seats show through the glass
    mv.target('carhood', 1.5, .4, 1.1, 0, .72, 1.55);
    mv.target('carfuel', .5, .5, .6, .9, .6, -1.25);
    mv.target('cardoor', .3, .9, 1.0, .9, .4, .25);
  } },
  // a rusty metal box with a padlock on its lid; the lid only opens once the lock is cut
  lockbox: { w: 1.2, d: .5, tall: false, build(b, p, mv) {
    b(1.2, .04, .5, 0, 0, .25, p.steel);
    b(1.2, .3, .03, 0, 0, .015, p.steel);
    b(1.2, .3, .03, 0, 0, .485, p.steel);
    for (const s of [-1, 1]) b(.03, .3, .5, s * .585, 0, .25, p.steel);
    for (const s of [-1, 1]) b(.06, .31, .52, s * .4, 0, .25, p.dark2);          // iron bands
    mv.flap([[1.2, .04, .5, 0, .3, .25, p.steel], [.06, .045, .52, -.4, .3, .25, p.dark2], [.06, .045, .52, .4, .3, .25, p.dark2]],
      .3, .015, -1.9, [0, .062, .25], { tag: 'gunbox' });
    mv.lock(0, .22, .5);
  } },
  // cutting board lying on a counter; hold a knife and use it to cut something
  cuttingboard: { w: .5, d: .34, tall: false, colliders: [], build(b, p, mv) {
    b(.46, .03, .3, 0, .91, .3, p.body);
    b(.34, .004, .012, 0, .94, .3, p.dark2);
    b(.12, .004, .1, .12, .94, .26, p.dark2);
    mv.target('board', .46, .06, .3, 0, .91, .3);
  } },
  // basement power box: open the lid, then cut the red, blue and yellow wires with the pliers
  circuitbox: { w: .5, d: .2, tall: true, build(b, p, mv) {
    b(.5, .66, .1, 0, .95, .05, p.dark2);
    b(.44, .6, .01, 0, .98, .105, p.dark);
    mv.door([[.48, .64, .02, 0, .96, .16, p.light], [.03, .1, .03, .17, 1.22, .18, p.dark]], -.24, .16, 1);
    mv.wire(0xd23a2e, -.14, .99, .56, .125);
    mv.wire(0x2f72dd, 0, .99, .56, .125);
    mv.wire(0xe0c030, .14, .99, .56, .125);
  } },
  chair: { w: .5, d: .55, tall: false, build(b, p) { chairAt(b, p, 0, .33, 0, 1); } },
};

export const ROLE_ITEMS = {
  living: ['sofa', 'tvunit', 'bookshelf', 'armchair', 'drawers', 'fireplace', 'armchair'],
  dining: ['tablechairs', 'drawers', 'chair'],
  kitchen: [], // laid out by hand in house.js
  study: ['desk', 'bookshelf', 'bookshelf', 'drawers'],
  hall: ['drawers', 'chair'],
  pantry: ['shelves', 'shelves', 'crates', 'counter'],
  bedroom: ['bed', 'nightstand', 'wardrobe', 'drawers', 'chair', 'roundtable', 'bookshelf'],
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
  return g;
}
