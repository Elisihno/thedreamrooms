import * as THREE from 'three';

// A flat, low-poly key like the one in Granny: a rectangular bow with a slot cut out, a flat blade with a few teeth,
// plain unshiny colours. Long axis is Y: bow at the top (+y), teeth at the bottom. Lies flat in the XY plane.
export function makeKey(color) {
  const g = new THREE.Group();
  const flat = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.28) });
  const blade = new THREE.Color(color).lerp(new THREE.Color(0xd9d6cc), 0.6); // the metal part is paler than the bow
  const depth = 0.014;

  const bow = new THREE.Shape();
  bow.moveTo(-0.062, 0.05); bow.lineTo(0.062, 0.05); bow.lineTo(0.062, 0.15); bow.lineTo(-0.062, 0.15); bow.closePath();
  const slot = new THREE.Path();
  slot.moveTo(-0.024, 0.078); slot.lineTo(-0.024, 0.122); slot.lineTo(0.024, 0.122); slot.lineTo(0.024, 0.078); slot.closePath();
  bow.holes.push(slot);
  const bowMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(bow, { depth, bevelEnabled: false }), flat(color));
  bowMesh.position.z = -depth / 2;

  const shaft = new THREE.Shape();
  [[-0.015, 0.055], [0.015, 0.055], [0.015, -0.085], [0.058, -0.085], [0.058, -0.115], [0.015, -0.115], [0.015, -0.14],
    [0.07, -0.14], [0.07, -0.19], [-0.015, -0.19]].forEach(([x, y], i) => (i ? shaft.lineTo(x, y) : shaft.moveTo(x, y)));
  shaft.closePath();
  const shaftMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shaft, { depth, bevelEnabled: false }), flat(blade));
  shaftMesh.position.z = -depth / 2;
  g.add(bowMesh, shaftMesh);
  return g;
}

// A porcelain vase turned on a lathe. Base sits at y = 0.
export function makeVase(color = 0x86a3b8) {
  const pts = [[0, 0], [0.07, 0], [0.085, 0.03], [0.1, 0.1], [0.11, 0.17], [0.09, 0.24], [0.05, 0.29], [0.045, 0.33], [0.065, 0.36], [0.06, 0.365]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 20),
    new THREE.MeshPhongMaterial({ color, specular: 0xffffff, shininess: 60, side: THREE.DoubleSide }),
  );
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// Scissors, flat like the key. The blades point down (-y) and the two ring handles are at the top (+y).
export function makeScissors(handleColor = 0xd24b3a) {
  const g = new THREE.Group();
  const flat = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.25) });
  const steel = flat(0xd4d6da), grip = flat(handleColor);
  const depth = 0.012;
  const bladeShape = (dir) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.02); s.lineTo(dir * 0.026, 0.0); s.lineTo(dir * 0.012, -0.19); s.lineTo(0, 0.0); s.closePath();
    return s;
  };
  for (const dir of [1, -1]) {
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape(dir), { depth, bevelEnabled: false }), steel);
    blade.position.z = dir * 0.006 - depth / 2;
    g.add(blade);
    // the handle: a rectangular loop, like the key's bow
    const loop = new THREE.Shape();
    loop.moveTo(0, 0.02); loop.lineTo(dir * 0.075, 0.07); loop.lineTo(dir * 0.075, 0.15); loop.lineTo(dir * 0.025, 0.15); loop.lineTo(dir * 0.0, 0.09); loop.closePath();
    const hole = new THREE.Path();
    hole.moveTo(dir * 0.03, 0.085); hole.lineTo(dir * 0.058, 0.1); hole.lineTo(dir * 0.058, 0.13); hole.lineTo(dir * 0.04, 0.13); hole.closePath();
    loop.holes.push(hole);
    const h = new THREE.Mesh(new THREE.ExtrudeGeometry(loop, { depth, bevelEnabled: false }), grip);
    h.position.z = dir * 0.006 - depth / 2;
    g.add(h);
  }
  return g;
}

// A lockpick: a thin steel pick with a small hook on a short wooden grip. The pick points down (-y).
export function makeLockpick() {
  const g = new THREE.Group();
  const flat = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.25) });
  const steel = flat(0xc9ccd1), wood = flat(0x6d5a48);
  const depth = 0.01;
  const grip = new THREE.Shape();
  grip.moveTo(-0.018, 0.2); grip.lineTo(0.018, 0.2); grip.lineTo(0.014, 0.04); grip.lineTo(-0.014, 0.04); grip.closePath();
  const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(grip, { depth, bevelEnabled: false }), wood);
  gm.position.z = -depth / 2;
  const pick = new THREE.Shape();
  [[-0.005, 0.045], [0.005, 0.045], [0.005, -0.12], [0.03, -0.14], [0.03, -0.115], [0.014, -0.1], [0.014, -0.125], [-0.005, -0.125]]
    .forEach(([x, y], i) => (i ? pick.lineTo(x, y) : pick.moveTo(x, y)));
  pick.closePath();
  const pm = new THREE.Mesh(new THREE.ExtrudeGeometry(pick, { depth, bevelEnabled: false }), steel);
  pm.position.z = -depth / 2;
  g.add(gm, pm);
  return g;
}

export function makeItemModel(item, KEYS) {
  if (item.kind === 'vase') return makeVase();
  if (item.kind === 'tool') return item.id === 'scissors' ? makeScissors() : makeLockpick();
  return makeKey(KEYS[item.id].color);
}
