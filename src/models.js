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

export function makeItemModel(item, KEYS) {
  if (item.kind === 'vase') return makeVase();
  return makeKey(KEYS[item.id].color);
}
