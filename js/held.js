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

function buildKey() {
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

function buildPliers() {
  const g = new THREE.Group();
  const green = new THREE.MeshPhongMaterial({ color: 0x3f8f6a, specular: 0x224433, shininess: 30 });
  for (const s of [-1, 1]) {
    const jaw = extrude(polygon([[0, 0], [.075, s * .004], [.084, s * .014], [.02, s * .017], [0, s * .01]]), .008, steel());
    jaw.rotation.z = s * .14; // a little open, like the picture
    g.add(jaw);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.005, s * .01, 0), new THREE.Vector3(-.04, s * .04, 0), new THREE.Vector3(-.095, s * .062, 0),
      new THREE.Vector3(-.15, s * .05, 0), new THREE.Vector3(-.185, s * .02, 0),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, .0075, 8), green));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.0085, 10, 8), green);
    cap.position.copy(curve.getPoint(1));
    g.add(cap);
  }
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .014, 16), steel());
  pivot.rotation.x = Math.PI / 2;
  g.add(pivot);
  g.position.x = .1; // keep the handles away from the camera
  g.rotation.x = 1.2;
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
    holder.rotation.y = Math.PI / 2; // tip toward -z
    holder.scale.setScalar(1.25);
    holder.add(m);
    holder.visible = false;
    rig.add(holder);
    m.userData.holder = holder;
  }

  const REST = new THREE.Vector3(0.12, -0.075, -0.38);
  let shown = null, raise = 1, lookX = 0, lookY = 0, walkSmooth = 0;

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
    // walk: 0..1 how hard the player is moving; yawRate/pitchRate: camera turn speed in rad/s
    update(t, dt, walk, yawRate, pitchRate) {
      if (!this.visible) return;
      const k = Math.min(1, dt * 8);
      walkSmooth += (walk - walkSmooth) * Math.min(1, dt * 6);
      raise = Math.min(1, raise + dt * 4);
      // the hand trails the view a little when turning
      lookY += (Math.max(-0.3, Math.min(0.3, -yawRate * 0.05)) - lookY) * k;
      lookX += (Math.max(-0.3, Math.min(0.3, -pitchRate * 0.05)) - lookX) * k;

      const w = walkSmooth, idle = 1 - 0.6 * w;
      const tremor = (f, a) => Math.sin(t * f) * a;
      rig.position.set(
        REST.x + Math.sin(t * 4) * 0.012 * w + tremor(1.7, 0.0015) * idle,
        REST.y + Math.sin(t * 8) * 0.014 * w + tremor(1.3, 0.0015) * idle - (1 - raise) * 0.25,
        REST.z + Math.sin(t * 8 + 1) * 0.01 * w,
      );
      rig.rotation.set(
        lookX + Math.sin(t * 8 + 1) * 0.05 * w + tremor(7.1, 0.006) * (0.4 + w) + tremor(1.1, 0.004),
        lookY + Math.sin(t * 4.3) * 0.035 * w,
        Math.sin(t * 4 + 0.5) * 0.07 * w + tremor(11, 0.02) * w + tremor(1.9, 0.005),
      );
    },
  };
}
