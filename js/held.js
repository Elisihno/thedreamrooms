import * as THREE from '../vendor/three.module.min.js';

// The item in the player's hand. It lives in its own small scene, drawn on top of the world
// with a cleared depth buffer, so it never clips into walls. Models are built along +x
// (tip toward +x) and turned to point forward (-z) in the camera's view.

const steel = () => new THREE.MeshPhongMaterial({ color: 0xb4b8bc, specular: 0xffffff, shininess: 90 });

function extrude(shape, depth, material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

function polygon(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

export function buildKey() {
  const g = new THREE.Group();
  // blade with a sloped tip and teeth along the lower edge
  g.add(extrude(polygon([
    [0, .014], [.15, .014], [.175, .005], [.175, -.006], [.15, -.01], [.14, -.004], [.125, -.012],
    [.11, -.004], [.095, -.011], [.08, -.004], [.07, -.011], [0, -.011],
  ]), .006, steel()));
  // wooden bow, pointed at the far end, with a rectangular hole
  const bow = polygon([[0, .032], [-.045, .032], [-.072, 0], [-.045, -.032], [0, -.032]]);
  const hole = new THREE.Path();
  hole.moveTo(-.056, .017); hole.lineTo(-.02, .017); hole.lineTo(-.02, -.017); hole.lineTo(-.056, -.017); hole.closePath();
  bow.holes.push(hole);
  g.add(extrude(bow, .012, new THREE.MeshPhongMaterial({ color: 0xc9965a, specular: 0x332211, shininess: 14 })));
  g.rotation.x = 1.05; // roll so the flat face shows
  return g;
}

export function buildPliers() {
  const g = new THREE.Group();
  const green = new THREE.MeshPhongMaterial({ color: 0x3f8f6a, specular: 0x335544, shininess: 40 });
  const tube = (pts, r, mat) => new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0))), 28, r, 10), mat);
  for (const s of [-1, 1]) {
    // one half of the head: jaw with a cutting edge, rounded body around the pivot
    const half = polygon([[-.035, 0], [-.035, s * .02], [-.005, s * .027], [.03, s * .026], [.07, s * .016], [.098, s * .004], [.098, 0]]);
    const jaw = extrude(half, .009, steel());
    jaw.position.z = -s * .005;
    const open = new THREE.Group();   // each half swings a little open about the pivot
    open.rotation.z = s * .2;
    open.add(jaw);
    g.add(open);
    // steel arm, then a thick green rubber grip that curves outward and back in
    const arm = [[-.03, s * .01], [-.045, s * .02], [-.06, s * .028]];
    const grip = [[-.06, s * .028], [-.1, s * .05], [-.14, s * .063], [-.18, s * .06], [-.205, s * .043]];
    const armMesh = tube(arm, .0055, steel());
    const gripMesh = tube(grip, .0105, green);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.0105, 12, 10), green);
    cap.position.set(...grip[grip.length - 1], 0);
    for (const m of [armMesh, gripMesh, cap]) { m.rotation.z = 0; open.add(m); }
  }
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .02, 16), steel());
  bolt.rotation.x = Math.PI / 2;
  g.add(bolt);
  g.position.x = .16; // keep the handles away from the camera
  g.rotation.x = 0.2; // a slight roll, so the top handle shows
  g.userData.scale = 0.8;
  g.userData.yaw = 0.42; // held pointing forward and a little toward the middle, so the side shows
  return g;
}

export function createHeld() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5);
  scene.add(new THREE.AmbientLight(0xb8b4c8, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(0.6, 1, 0.8);
  scene.add(sun);

  const rig = new THREE.Group(); // the hand: this is what sways
  scene.add(rig);
  const models = { key: buildKey(), pliers: buildPliers() };
  for (const m of Object.values(models)) {
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2 + (m.userData.yaw ?? 0); // tip toward -z
    holder.scale.setScalar(m.userData.scale ?? 1.25);
    holder.add(m);
    holder.visible = false;
    rig.add(holder);
    m.userData.holder = holder;
  }

  const REST = new THREE.Vector3(0.12, -0.075, -0.38);
  let shown = null, raise = 1, walkSmooth = 0;
  // smooth pseudo-random wobble: three sines at unrelated speeds, roughly -1..1
  const wobble = (t, f1, f2, f3, seed) =>
    (Math.sin(t * f1 + seed) + 0.6 * Math.sin(t * f2 + 2 * seed) + 0.4 * Math.sin(t * f3 + 3 * seed)) / 2;

  return {
    scene, camera,
    visible: false,
    show(type) {
      for (const [name, m] of Object.entries(models)) m.userData.holder.visible = name === type;
      this.visible = !!type;
      if (type && type !== shown) raise = 0; // lift it into view
      shown = type;
    },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
    // walk: 0..1 how hard the player is moving. The hand is nearly still when standing and
    // shakes a little while walking, like holding a key in real life.
    update(t, dt, walk) {
      if (!this.visible) return;
      walkSmooth += (walk - walkSmooth) * Math.min(1, dt * 6);
      raise = Math.min(1, raise + dt * 4);
      const a = 0.12 + 0.88 * walkSmooth;
      rig.position.set(
        REST.x + wobble(t, 13.1, 7.3, 19.7, 0) * 0.0035 * a,
        REST.y + wobble(t, 11.7, 6.1, 17.3, 1) * 0.0035 * a - (1 - raise) * 0.25,
        REST.z + wobble(t, 9.3, 5.2, 15.1, 2) * 0.0025 * a,
      );
      rig.rotation.set(
        wobble(t, 12.3, 6.7, 18.9, 3) * 0.02 * a,
        wobble(t, 10.9, 5.7, 16.1, 4) * 0.02 * a,
        wobble(t, 14.1, 8.3, 21.3, 5) * 0.03 * a,
      );
    },
  };
}
