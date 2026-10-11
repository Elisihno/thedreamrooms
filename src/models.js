import * as THREE from 'three';

// An ornate skeleton key. Long axis is Y: the clover-shaped bow is at the top (+y) and the bit at the bottom.
// `bowColor` lets a key carry a coloured enamel bow (the Master Key).
export function makeKey(color, bowColor = color) {
  const g = new THREE.Group();
  const metal = (c) => new THREE.MeshPhongMaterial({
    color: c, specular: 0xffffff, shininess: 90, emissive: new THREE.Color(c).multiplyScalar(0.22),
  });
  const body = metal(color);
  const bowMat = metal(bowColor);
  const add = (geo, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    g.add(m);
    return m;
  };
  // bow: a ring with three lobes, like a clover
  add(new THREE.TorusGeometry(0.05, 0.015, 12, 28), bowMat, 0, 0.17, 0);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
    add(new THREE.TorusGeometry(0.026, 0.011, 10, 20), bowMat, Math.cos(a) * 0.075, 0.17 + Math.sin(a) * 0.075, 0);
  }
  // collars where the bow meets the shaft
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 14), body, 0, 0.098, 0);
  add(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 14), body, 0, 0.072, 0);
  add(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 14), body, 0, 0.05, 0);
  // shaft
  add(new THREE.CylinderGeometry(0.0115, 0.0115, 0.25, 12), body, 0, -0.08, 0);
  // bit with teeth
  add(new THREE.BoxGeometry(0.07, 0.05, 0.012), body, 0.036, -0.15, 0);
  add(new THREE.BoxGeometry(0.03, 0.018, 0.012), body, 0.056, -0.112, 0);
  add(new THREE.BoxGeometry(0.03, 0.018, 0.012), body, 0.056, -0.186, 0);
  add(new THREE.SphereGeometry(0.0125, 10, 8), body, 0, -0.205, 0);
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
  const k = KEYS[item.id];
  return makeKey(item.id === 'red' ? 0xc9a24d : k.color, k.color);
}
