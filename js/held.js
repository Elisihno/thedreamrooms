import * as THREE from '../vendor/three.module.min.js';

// The item in the player's hand. It lives in its own small scene, drawn on top of the world
// with a cleared depth buffer, so it never clips into walls.

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

// Key: built along +x (tip toward +x), then turned to point forward (-z) by createHeld.
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

// outline of assets/textures/item_pliers.png in pixels (216x224), y down
const PLIERS_PX = [184,3,171,2,160,8,148,21,142,34,142,56,139,59,135,59,130,56,99,56,73,65,41,87,18,115,3,148,2,160,20,160,25,157,26,144,38,119,57,98,76,85,95,78,117,78,121,81,124,90,128,94,142,101,144,112,144,125,137,147,124,167,107,183,84,196,72,198,70,200,71,220,73,222,85,219,112,204,140,177,158,149,167,117,165,90,162,85,163,77,166,75,185,73,197,67,208,55,213,44,213,33,210,28,204,23,158,64,154,60,190,12,190,8];
const PLIERS_W = 216, PLIERS_H = 224;

// Cutting pliers: the picture's own outline (green horseshoe grip, round pivot, two jaws),
// extruded into a thick slab with rounded edges. The picture is the texture on both faces.
export function buildPliers() {
  const k = 0.2 / PLIERS_W; // metres per pixel: the picture is 20 cm wide
  const cx = PLIERS_W / 2, cy = PLIERS_H / 2;
  const shape = new THREE.Shape();
  for (let i = 0; i < PLIERS_PX.length; i += 2) {
    const X = (PLIERS_PX[i] - cx) * k, Y = (cy - PLIERS_PX[i + 1]) * k;
    if (i) shape.lineTo(X, Y); else shape.moveTo(X, Y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.008, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 1,
  });
  geo.translate(0, 0, -0.004);
  // planar projection of the picture onto the faces
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) / k + cx) / PLIERS_W, 1 - (cy - pos.getY(i) / k) / PLIERS_H);
  }
  const tex = new THREE.TextureLoader().load(globalThis.__DR_TEX?.item_pliers ?? 'assets/textures/item_pliers.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const faces = new THREE.MeshPhongMaterial({ map: tex, specular: 0x444444, shininess: 30, alphaTest: 0.3 });
  const edges = new THREE.MeshPhongMaterial({ color: 0x3a5c4e, specular: 0x222222, shininess: 20 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, [faces, edges]));
  // held like a card tilted toward you: jaws point forward and up, handles curve back toward you
  g.userData.pose = [-Math.PI / 2 + 0.55, 0.3, 0]; // x, y, z of an 'YXZ' euler
  g.userData.scale = 1.1;
  return g;
}

export function createHeld() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5);
  scene.add(new THREE.AmbientLight(0xc8c4d4, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(0.6, 1, 0.8);
  scene.add(sun);

  const rig = new THREE.Group(); // the hand: this is what moves
  scene.add(rig);
  const models = { key: buildKey(), pliers: buildPliers() };
  for (const m of Object.values(models)) {
    const holder = new THREE.Group();
    holder.rotation.order = 'YXZ';
    if (m.userData.pose) {
      const [x, y, z] = m.userData.pose;
      holder.rotation.set(x, y, z);
    } else {
      holder.rotation.y = Math.PI / 2; // tip toward -z
    }
    holder.scale.setScalar(m.userData.scale ?? 1.25);
    holder.add(m);
    holder.visible = false;
    rig.add(holder);
    m.userData.holder = holder;
  }

  const REST = new THREE.Vector3(0.12, -0.075, -0.38);
  let shown = null, raise = 1, walkSmooth = 0, prevWalk = 0;

  // The hand is a loosely held weight on springs. The view moves it around (a step bounces
  // the camera, a turn drags it), and it lags behind and settles with a little overshoot.
  // state order: x, y, z (metres), pitch, yaw, roll (radians)
  const s = new Float64Array(6), v = new Float64Array(6);
  const K = 170, C = 13; // about 2 Hz, lightly damped
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  return {
    scene, camera, rig,
    visible: false,
    show(type) {
      for (const [name, m] of Object.entries(models)) m.userData.holder.visible = name === type;
      this.visible = !!type;
      if (type && type !== shown) raise = 0; // lift it into view
      shown = type;
    },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
    // walk: 0..1 how hard the player moves; bobAccel: vertical acceleration of the camera bob;
    // yawRate / pitchRate: how fast the view turns (rad/s)
    update(t, dt, { walk, bobAccel, yawRate, pitchRate }) {
      if (!this.visible) return;
      walkSmooth += (walk - walkSmooth) * Math.min(1, dt * 6);
      raise = Math.min(1, raise + dt * 4);
      const surge = clamp((walkSmooth - prevWalk) / Math.max(dt, 1e-3), -6, 6);
      prevWalk = walkSmooth;

      const step = Math.sin(t * 4 + 0.4) * walkSmooth; // side to side, once per two steps
      const target = [0, 0, 0, clamp(-pitchRate * 0.025, -0.12, 0.12), clamp(-yawRate * 0.03, -0.15, 0.15), 0];
      const drive = [step * 0.6, -bobAccel * 0.28, -surge * 0.04, -bobAccel * 1.8, 0, step * 3];
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 6; j++) {
          const a = K * (target[j] - s[j]) - C * v[j] + drive[j];
          v[j] += a * h;
          s[j] += v[j] * h;
        }
      }
      // a slow breathing drift, so it is never perfectly still
      const idle = 0.0006;
      rig.position.set(
        REST.x + s[0] + Math.sin(t * 0.9) * idle,
        REST.y + s[1] + Math.sin(t * 1.3 + 1) * idle - (1 - raise) * 0.25,
        REST.z + s[2],
      );
      rig.rotation.set(s[3], s[4], s[5] + Math.sin(t * 0.7) * 0.003);
    },
  };
}
