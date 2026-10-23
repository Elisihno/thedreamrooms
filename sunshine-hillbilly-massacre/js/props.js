// Furniture is built from boxes (and a few cylinders) so it can be merged into the house batches.
// Wall items: local x across the item (centred), z from the wall (0) into the room, y up.
// Centre items (center: true): the origin is the middle of the cell.
//
//   b(w, h, d, x, y0, zc, material)     static box: w wide, h tall, d deep, centred at (x, zc), bottom at y0
//   b.cyl(r, h, x, y0, zc, material)    static cylinder
//   item.hide = {x, z, w, d, h, eye}    a spot to hide in: box (item-local) the player looks at, camera height under it
//                                       (closet: true = hide inside, looking out through the slats)
//   mv.drawer(boxes, dist)              part that slides out along +z when used
//   mv.door(boxes, hx, hz, side, {lootPos, tag})   part hinged on a vertical axis at (hx, hz); side +1: hinge on the left
//   mv.flap(boxes, hy, hz, angle, loot) part hinged on a horizontal axis at (y=hy, z=hz); loot: item-local
//                                       spot where something can lie under the lid
//   mv.lock(x, y0, z)                   a padlock on the part built just before it
//   mv.target(kind, w, h, d, x, y0, zc) an invisible box to look at and use
//   mv.wire(color, x, y0, h, z)         a wire that can be cut with the pliers
//
//   item.model / item.models          real 3D models (see assets.js) placed with the item; build() gets ctx.has(name)
//                                       so it can draw boxes instead when a model is missing
//
// `boxes` is a list of [w, h, d, x, y0, zc, material]. p is the palette:
// body, dark2, light, cloth, paper, hay, rust, copper (textured or tinted) and dark, steel, red (plain).

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
    b(1.42, .05, 1.1, 0, .72, 1.35, p.cloth);                    // a patchwork quilt
    b(.3, .052, .3, -.4, .722, 1.1, p.light); b(.3, .052, .3, .3, .722, 1.6, p.paper);
    b(1.5, .95, .08, 0, .1, .04, p.body);
  } },
  nightstand: { w: .45, d: .4, tall: false, build(b, p, mv) {
    b(.45, .5, .4, 0, 0, .2, p.body);
    mv.drawer([[.38, .18, .31, 0, .25, .255, p.dark2], [.38, .18, .02, 0, .25, .41, p.dark2], handle(p, 0, .33, .44, .1)], .26);
  } },
  drawers: { w: 1.2, d: .5, tall: false, build(b, p, mv) {
    b(1.2, .85, .5, 0, 0, .25, p.body);
    b(1.26, .05, .55, 0, .85, .275, p.dark2);
    b(.12, .12, .1, -.4, .9, .3, p.paper);                       // a doily and a tin
    for (let i = 0; i < 3; i++) {
      const y = .08 + i * .26;
      mv.drawer([[1.04, .2, .42, 0, y + .01, .3, p.dark2], [1.08, .22, .02, 0, y, .51, p.dark2], handle(p, 0, y + .08, .54)], .34);
    }
  } },
  // a long dining table with six chairs pulled up round it
  tablechairs: { w: 2.7, d: 2.1, tall: false, center: true, model: 'dining_set', hide: { x: 0, z: 0, w: 1.16, d: 2.1, h: .75, eye: .5 },
    colliders: ctx => (ctx.has('dining_set') ? [[2.6, 2.05, 0, 0]] : [[1.4, .85, 0, 0], [.5, .5, -.35, -.55], [.5, .5, .35, -.55], [.5, .5, -.35, .55], [.5, .5, .35, .55]]),
    build(b, p, mv, ctx) {
      if (ctx.has('dining_set')) return;
      b(1.4, .06, .85, 0, .72, 0, p.body);
      b(.5, .01, .4, 0, .78, 0, p.light);                           // a runner down the table
      for (const dx of [-.62, .62]) for (const dz of [-.35, .35]) b(.07, .72, .07, dx, 0, dz, p.dark2);
      for (const x of [-.35, .35]) {
        chairAt(b, p, x, -.55, 0, 1);
        chairAt(b, p, x, .55, 0, -1);
      }
    } },
  // the start bedroom's table; the spiral vase stands on it
  roundtable: { w: .97, d: 2.0, tall: false, center: true, model: 'trestle_table', jarSpot: { x: 0, z: 0, y: .735 }, hide: { x: 0, z: 0, w: .97, d: 1.9, h: .72, eye: .45 },
    colliders: ctx => (ctx.has('trestle_table') ? [[.97, 1.9, 0, 0]] : [[1.1, 1.1, 0, 0], [.5, .5, 0, -.85], [.5, .5, 0, .85]]),
    build(b, p, mv, ctx) {
      if (!ctx.has('trestle_table')) {
        b.cyl(.55, .05, 0, .72, 0, p.body);
        b.cyl(.09, .72, 0, 0, 0, p.dark2);
        b.cyl(.3, .05, 0, 0, 0, p.dark2);
        chairAt(b, p, 0, -.85, 0, 1);
        chairAt(b, p, 0, .85, 0, -1);
      }
    } },
  desk: { w: 1.3, d: 1.2, tall: false, build(b, p, mv) {
    b(1.3, .05, .6, 0, .72, .3, p.body);
    b(.05, .72, .55, -.62, 0, .3, p.dark2);
    b(.4, .55, .5, .4, .17, .3, p.dark2);
    b(.3, .02, .22, -.3, .77, .3, p.paper);
    mv.drawer([[.34, .16, .4, .4, .5, .27, p.body], [.34, .16, .02, .4, .5, .56, p.body], handle(p, .4, .58, .59, .1)], .3);
    chairAt(b, p, -.2, .85, 0, -1);
  } },
  // an old icebox with a freezer on top and the main door below; the apple lies on the middle shelf
  fridge: { w: .7, d: .7, tall: true, build(b, p, mv) {
    b(.7, 1.8, .03, 0, 0, .015, p.light);
    for (const s of [-1, 1]) b(.03, 1.8, .7, s * .335, 0, .35, p.light);
    b(.7, .03, .7, 0, 1.77, .35, p.light);
    b(.7, .05, .7, 0, 0, .35, p.light);
    b(.64, .04, .66, 0, 1.13, .35, p.light);
    for (const y of [.5, .8]) b(.64, .02, .62, 0, y, .36, p.dark2);
    b(.64, .02, .62, 0, 1.45, .36, p.dark2);
    b(.09, .22, .09, -.2, .52, .3, p.light);
    b(.08, .11, .08, .12, .82, .42, p.paper);
    b(.2, .09, .14, .0, .06, .3, p.cloth);
    b(.2, .12, .16, -.1, 1.17, .35, p.light);
    mv.door([[.68, .58, .03, 0, 1.17, .715, p.light], [.03, .3, .04, .27, 1.3, .745, p.steel]], -.34, .715, 1);
    mv.door([[.68, 1.07, .03, 0, .05, .715, p.light], [.03, .5, .04, .27, .5, .745, p.steel]], -.34, .715, 1,
      { lootPos: [0, .545, .36], tag: 'fridge' });
  } },
  // the chest freezer in the back room: a key can lie under the lid
  freezer: { w: 1.5, d: .8, tall: false, build(b, p, mv) {
    b(1.5, .8, .74, 0, 0, .4, p.light);
    b(.04, .5, .04, -.6, .25, .78, p.steel);
    b(.12, .05, .03, 0, .62, .79, p.steel);
    mv.flap([[1.54, .08, .78, 0, .8, .4, p.light], [.3, .05, .04, 0, .83, .78, p.steel]], .8, .02, -1.9, [0, .62, .4]);
  } },
  // furniture made of bones, as in the room behind the sliding door
  bonechair: { w: .8, d: .8, tall: false, hide: null, build(b, p) {
    const bone = p.light;
    for (const dx of [-.3, .3]) for (const dz of [.2, .6]) b(.07, .42, .07, dx, 0, dz, bone);   // femur legs
    b(.7, .06, .6, 0, .42, .4, bone);
    for (const dx of [-.25, -.08, .08, .25]) b(.05, .62, .05, dx, .48, .12, bone);               // rib back
    b(.7, .05, .06, 0, 1.08, .12, bone);
    for (const dx of [-.34, .34]) { b(.05, .3, .05, dx, .48, .4, bone); b(.1, .05, .5, dx, .76, .4, bone); }
    b(.2, .17, .18, 0, 1.1, .12, bone); b(.04, .05, .02, -.05, 1.17, .22, p.dark); b(.04, .05, .02, .05, 1.17, .22, p.dark);   // a skull on top
  } },
  bonetable: { w: 1.5, d: 1.0, tall: false, center: true, colliders: [[1.5, 1.0, 0, 0]], build(b, p) {
    const bone = p.light;
    b(1.5, .07, 1.0, 0, .72, 0, p.dark2);
    for (const dx of [-.62, .62]) for (const dz of [-.38, .38]) { b(.09, .72, .09, dx, 0, dz, bone); b(.14, .07, .14, dx, .0, dz, bone); }
    b(.16, .12, .14, .2, .79, .1, bone); b(.04, .04, .02, .16, .85, .18, p.dark); b(.04, .04, .02, .24, .85, .18, p.dark);
    b(.5, .04, .06, -.3, .79, -.1, bone); b(.4, .04, .06, -.35, .79, .15, bone);
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
  // counter with a deep farmhouse sink and a pump handle
  sinkcounter: { w: 1.1, d: .6, tall: false, build(b, p, mv) {
    b(1.1, .86, .6, 0, 0, .3, p.body);
    b(1.14, .05, .64, 0, .86, .32, p.dark2);
    b(.5, .02, .38, -.18, .915, .33, p.steel);                    // the basin
    b(.04, .3, .04, .2, .91, .12, p.steel); b(.04, .04, .18, .2, 1.17, .2, p.steel);   // pump spout
    b(.2, .04, .03, .2, 1.22, .06, p.dark);
    for (const dx of [-.26, .26]) {
      mv.drawer([[.46, .18, .5, dx, .63, .35, p.dark2], [.48, .2, .02, dx, .62, .61, p.dark2], handle(p, dx, .7, .64, .14)], .32);
      const side = dx < 0 ? 1 : -1;
      mv.door([[.48, .5, .02, dx, .05, .61, p.dark2], handle(p, dx - side * .15, .45, .64, .03)], dx - side * .24, .61, side);
    }
  } },
  kitchendrawers: { w: 1.0, d: .6, tall: false, build(b, p, mv) {
    b(1.0, .86, .6, 0, 0, .3, p.body);
    b(1.04, .05, .64, 0, .86, .32, p.dark2);
    for (let i = 0; i < 4; i++) {
      const y = .04 + i * .2;
      mv.drawer([[.88, .16, .5, 0, y + .01, .3, p.dark2], [.92, .18, .02, 0, y, .61, p.dark2], handle(p, 0, y + .1, .64, .16)], .36);
    }
  } },
  // a black iron wood stove with a pipe up through the ceiling
  stove: { w: 1.0, d: .7, tall: true, build(b, p, mv) {
    b(.9, .85, .62, 0, 0, .35, p.dark);
    b(.96, .04, .66, 0, .85, .35, p.steel);
    b(.9, .1, .62, 0, .89, .35, p.dark);
    for (const dx of [-.28, .28]) b(.2, .02, .2, dx, .93, .3, p.steel);
    b(.12, 2.1, .12, .0, .9, .62, p.dark);
    mv.flap([[.5, .4, .02, 0, .1, .66, p.dark], handle(p, 0, .5, .68, .3)], .1, .66, 1.55);
  } },
  // you can hide inside it: the doors are shut, and you watch through the slats
  wardrobe: { w: 1.2, d: .6, tall: true, hide: { x: 0, z: .3, w: 1.2, d: .6, h: 2.0, eye: 1.5, closet: true }, build(b, p) {
    b(1.2, 2.0, .6, 0, 0, .3, p.body);
    b(1.24, .06, .64, 0, 2.0, .32, p.dark2);
    for (const s of [-1, 1]) {
      b(.56, 1.9, .02, s * .29, .05, .61, p.dark2);
      b(.03, .22, .03, s * .08, .95, .635, p.dark);
      for (let k = 0; k < 4; k++) b(.4, .03, .01, s * .29, .35 + k * .4, .625, p.body);
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
    b(.4, .3, .1, -.7, .55, .3, p.paper);
  } },
  shelves: { w: 1.2, d: .4, tall: true, build(b, p) {
    for (const dx of [-.58, .58]) for (const dz of [.04, .36]) b(.05, 1.8, .05, dx, 0, dz, p.dark2);
    for (let i = 0; i < 4; i++) {
      b(1.2, .04, .4, 0, .15 + i * .5, .2, p.dark2);
      b(.3 + (i % 2) * .1, .25, .3, -.3, .19 + i * .5, .2, p.paper);
      for (let k = 0; k < 4; k++) b.cyl(.05, .17, .05 + k * .12, .19 + i * .5, .2, p.copper);   // jars of preserves
    }
  } },
  crates: { w: 1.3, d: .8, tall: false, build(b, p) {
    b(.6, .6, .6, -.3, 0, .4, p.paper);
    b(.55, .5, .55, .35, 0, .35, p.body);
    b(.45, .45, .45, -.25, .6, .35, p.paper);
  } },
  barrels: { w: 1.3, d: .8, tall: false, build(b, p) {
    for (const [x, z] of [[-.38, .4], [.32, .4], [-.02, .52]]) {
      b.cyl(.3, .86, x, 0, z, p.body);
      for (const y of [.12, .45, .72]) b.cyl(.315, .04, x, y, z, p.steel);
    }
  }, colliders: [[1.3, .8, 0, .4]] },
  // a copper moonshine still on a brick stand
  still: { w: 1.1, d: 1.0, tall: false, build(b, p) {
    b(1.0, .4, .9, 0, 0, .5, p.dark2);
    b.cyl(.34, .55, 0, .4, .5, p.copper);
    b.cyl(.2, .35, 0, .95, .5, p.copper);
    b.cyl(.07, .25, 0, 1.3, .5, p.copper);
    b(.07, .07, .8, .0, 1.4, .1, p.copper);
    b.cyl(.14, .5, -.34, .0, .9, p.copper);
    b.cyl(.06, .2, .4, .4, .9, p.paper);
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
  rocker: { w: .7, d: .8, tall: false, build(b, p) {
    for (const dx of [-.3, .3]) b(.04, .05, .8, dx, 0, .4, p.dark2);   // the curved runners, straightened
    for (const dx of [-.28, .28]) for (const dz of [.2, .6]) b(.04, .4, .04, dx, .05, dz, p.dark2);
    b(.6, .05, .5, 0, .45, .5, p.body);
    b(.6, .7, .04, 0, .45, .22, p.body);
    b(.64, .04, .04, 0, 1.12, .22, p.dark2);
  } },
  // an old radio cabinet with a speaker cloth and big dials
  radio: { w: 1.0, d: .45, tall: true, build(b, p) {
    b(1.0, .9, .45, 0, 0, .225, p.body);
    b(.6, .5, .02, -.1, .3, .46, p.paper);
    b(.12, .12, .04, .33, .55, .46, p.dark); b(.12, .12, .04, .33, .35, .46, p.dark);
    b(.3, .1, .02, -.1, .93, .22, p.dark2);
    b(.5, .16, .3, 0, .9, .22, p.dark2);
  } },
  fireplace: { w: 1.4, d: .5, tall: true, build(b, p) {
    b(1.4, 1.2, .5, 0, 0, .25, p.dark2);
    b(.7, .7, .02, 0, .05, .51, p.dark);
    b(1.6, .08, .6, 0, 1.2, .3, p.body);
    b(.2, .3, .1, -.5, 1.28, .3, p.paper); b(.12, .24, .1, .45, 1.28, .3, p.copper);
  } },
  // a rug and a coffee table, free-standing
  livingset: { w: 1.7, d: 1.3, tall: false, center: true, build(b, p) {
    b(1.7, .015, 1.3, 0, .005, 0, p.cloth);
    b(.9, .05, .5, 0, .38, 0, p.body);
    for (const dx of [-.4, .4]) for (const dz of [-.2, .2]) b(.05, .38, .05, dx, 0, dz, p.dark2);
  }, colliders: [[.9, .5, 0, 0]] },
  // an old pickup, nose toward +z (the barn door). Look at the hood, the fuel tank or the door.
  truck: { w: 1.9, d: 4.2, tall: false, center: true, colliders: [[1.9, 4.2, 0, 0]], build(b, p, mv) {
    const body = p.red, glass = p.dark, trim = p.steel, rust = p.rust;
    b(1.8, .35, 4.2, 0, .33, 0, rust);                           // chassis
    b(1.7, .5, 1.25, 0, .62, 1.47, body);                        // hood
    b(1.75, .12, 1.0, 0, 1.12, 1.55, body);
    b(1.75, 1.0, 1.4, 0, .62, .2, body);                         // cab
    b(1.8, .08, 1.5, 0, 1.62, .2, rust);                         // roof
    for (const s of [-1, 1]) b(.03, .4, 1.0, s * .88, 1.08, .2, glass);   // side windows
    b(1.45, .4, .03, 0, 1.08, .92, glass);                       // windscreen
    b(1.45, .35, .03, 0, 1.08, -.5, glass);                      // rear window
    b(1.8, .3, 1.7, 0, .6, -1.25, body);                         // truck bed
    for (const s of [-1, 1]) b(.08, .42, 1.7, s * .86, .9, -1.25, body);
    b(1.8, .42, .08, 0, .9, -2.06, body);                        // tailgate
    b(1.8, .42, .08, 0, .9, -.4, body);
    b(1.5, .08, 1.5, 0, .92, -1.25, rust);
    for (const sx of [-1, 1]) for (const sz of [-1.35, 1.4]) b(.3, .72, .72, sx * .88, 0, sz, p.dark);   // wheels
    b(1.9, .16, .1, 0, .3, 2.12, trim);                          // bumpers
    b(1.9, .16, .1, 0, .3, -2.12, trim);
    b(1.2, .35, .06, 0, .55, 2.1, trim);                         // grille
    for (const s of [-1, 1]) b(.3, .16, .04, s * .6, .8, 2.1, p.light);   // headlights
    for (const s of [-1, 1]) b(.2, .14, .04, s * .75, .8, -2.1, p.red);
    b(1.2, .04, .4, 0, .9, .2, p.cloth);                         // bench seat shows through the glass
    mv.target('carhood', 1.5, .4, 1.1, 0, .85, 1.5);
    mv.target('carfuel', .5, .5, .6, .95, .6, -.3);
    mv.target('cardoor', .3, .9, 1.0, .9, .5, .2);
  } },
  // a rusty metal box with a padlock on its lid; the lid only opens once the lock is cut
  lockbox: { w: 1.2, d: .5, tall: false, build(b, p, mv) {
    b(1.2, .04, .5, 0, 0, .25, p.steel);
    b(1.2, .3, .03, 0, 0, .015, p.steel);
    b(1.2, .3, .03, 0, 0, .485, p.steel);
    for (const s of [-1, 1]) b(.03, .3, .5, s * .585, 0, .25, p.steel);
    for (const s of [-1, 1]) b(.06, .31, .52, s * .4, 0, .25, p.dark2);
    mv.flap([[1.2, .04, .5, 0, .3, .25, p.steel], [.06, .045, .52, -.4, .3, .25, p.dark2], [.06, .045, .52, .4, .3, .25, p.dark2]],
      .3, .015, -1.9, [0, .062, .25], { tag: 'gunbox' });
    mv.lock(0, .22, .5);
  } },
  // a chunky butcher block, deeply scored; hold a knife and use it to chop something on it
  butcherblock: { w: .9, d: .7, tall: false, build(b, p, mv) {
    b(.9, .86, .7, 0, 0, .4, p.body);
    b(.96, .08, .76, 0, .86, .4, p.paper);
    b(.3, .004, .02, -.1, .945, .4, p.dark2); b(.02, .004, .3, .15, .945, .45, p.dark2); b(.4, .004, .02, .0, .945, .55, p.dark2);
    b(.5, .004, .1, .1, .944, .3, p.red);                         // an old stain, going dark
    mv.target('board', .6, .1, .5, 0, .94, .4);
  } },
  // the fuse box: open the lid, then cut the red, blue and yellow wires with the pliers
  fusebox: { w: .5, d: .2, tall: true, build(b, p, mv) {
    b(.5, .66, .1, 0, .95, .05, p.dark2);
    b(.44, .6, .01, 0, .98, .105, p.dark);
    mv.door([[.48, .64, .02, 0, .96, .16, p.light], [.03, .1, .03, .17, 1.22, .18, p.dark]], -.24, .16, 1);
    mv.wire(0xd23a2e, -.14, .99, .56, .125);
    mv.wire(0x2f72dd, 0, .99, .56, .125);
    mv.wire(0xe0c030, .14, .99, .56, .125);
  } },
  workbench: { w: 1.6, d: .8, tall: true, build(b, p, mv) {
    b(1.6, .07, .7, 0, .86, .4, p.body);
    for (const dx of [-.74, .74]) b(.08, .86, .64, dx, 0, .4, p.dark2);
    b(1.5, .05, .6, 0, .25, .4, p.dark2);
    b(.12, .14, .14, .55, .93, .3, p.steel);                      // a vise
    b(1.5, .9, .03, 0, 1.2, .015, p.dark2);                       // pegboard
    for (let k = 0; k < 6; k++) b(.04 + (k % 3) * .02, .22 + (k % 2) * .1, .03, -.6 + k * .24, 1.45 - (k % 2) * .1, .05, k % 2 ? p.steel : p.dark);   // tools
    b(.4, .06, .18, -.3, .93, .4, p.steel);                       // a rusty saw blade
    mv.drawer([[.5, .12, .5, 0, .72, .38, p.dark2], [.52, .14, .02, 0, .7, .66, p.dark2], handle(p, 0, .76, .69, .14)], .3);
  } },
  haybale: { w: 1.5, d: 1.0, tall: false, build(b, p) {
    b(1.2, .45, .6, -.1, 0, .4, p.hay);
    b(1.2, .45, .6, -.1, .45, .4, p.hay);
    b(.6, .45, .5, .45, 0, .8, p.hay);
    b(1.2, .45, .6, .0, .9, .38, p.hay);
  }, colliders: [[1.4, 1.0, 0, .5]] },
  // a deer's head on a board, hung high on the wall
  antlers: { w: .9, d: .4, tall: true, colliders: [], build(b, p) {
    b(.34, .4, .06, 0, 1.55, .03, p.dark2);
    b(.2, .26, .24, 0, 1.6, .15, p.body);
    for (const s of [-1, 1]) {
      b(.04, .5, .04, s * .12, 1.8, .15, p.light);
      b(.18, .04, .04, s * .22, 2.05, .15, p.light);
      b(.04, .24, .04, s * .3, 2.05, .15, p.light);
      b(.14, .04, .04, s * .2, 1.9, .15, p.light);
    }
  } },
  // a rail on the ceiling and four long hooks, with burlap bundles hung either side
  meathooks: { w: 2.0, d: .6, tall: true, colliders: [[1.8, .45, 0, .3]], models: [{ name: 'butcher_hooks', x: 0, y: .4, z: .3, ry: Math.PI / 2 }], build(b, p, mv, ctx) {
    b(2.0, .06, .06, 0, 2.7, .3, p.steel);
    if (!ctx.has('butcher_hooks')) for (const x of [-.6, -.05, .55]) b(.02, .5, .02, x, 2.2, .3, p.steel);
    for (const x of [-.88, .88]) {
      b(.02, .5, .02, x, 2.2, .3, p.steel);
      b(.28, .78, .26, x, 1.42, .3, p.paper);
      b(.1, .28, .08, x + .2 * (x > 0 ? 1 : -1), 1.55, .3, p.cloth);
    }
    b(.6, .004, .5, -.05, .004, .3, p.red);                       // what has dripped down
    b(.18, .004, .6, .55, .004, .3, p.red);
  } },
  // one long run of kitchen cabinets: sink, counter, wall cabinets (a 3D model; plain boxes if it is missing)
  kitchenrun: { w: 4.46, d: .65, tall: true, model: 'kitchen_run', colliders: [[4.4, .62, 0, .31]], build(b, p, mv, ctx) {
    if (ctx.has('kitchen_run')) return;
    b(4.4, .86, .6, 0, 0, .3, p.dark2);
    b(4.46, .05, .64, 0, .86, .32, p.dark);
    b(4.4, .9, .32, 0, 1.4, .16, p.dark2);
  } },
  chair: { w: .5, d: .55, tall: false, model: 'chair', modelZ: .3, build(b, p, mv, ctx) { if (!ctx.has('chair')) chairAt(b, p, 0, .33, 0, 1); } },
};

export const ROLE_ITEMS = {
  living: ['sofa', 'radio', 'bookshelf', 'armchair', 'drawers', 'fireplace', 'rocker', 'antlers'],
  dining: ['tablechairs', 'drawers', 'chair', 'antlers'],
  kitchen: [],   // laid out by hand in world.js
  study: ['desk', 'bookshelf', 'antlers', 'drawers', 'shelves'],
  hall: ['drawers', 'chair', 'antlers'],
  freezer: [],   // laid out by hand in world.js
  bone: [],
  pantry: ['shelves', 'shelves', 'crates', 'barrels'],
  bedroom: ['bed', 'nightstand', 'wardrobe', 'drawers', 'chair', 'roundtable', 'bookshelf', 'rocker'],
  storage: ['shelves', 'crates', 'still', 'chest', 'drawers', 'barrels', 'workbench'],
  meat: ['meathooks', 'meathooks', 'barrels', 'chest', 'crates'],
  attic: ['haybale', 'chest', 'crates', 'wardrobe', 'drawers', 'chair', 'covered', 'haybale'],
  barn: ['workbench', 'haybale', 'barrels', 'crates', 'haybale', 'drawers'],
};
