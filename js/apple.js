import * as THREE from '../vendor/three.module.min.js';

// The old apple: a lumpy, lopsided shape with a sunken stem pit and a withered skin. The skin
// is painted procedurally: dark red gone brown, wrinkles, rot patches and a little mould.

const S = 256;
let skin = null;

function canvas() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  return cv;
}

// Draws at x and again one texture width either side, so the picture wraps around the sphere.
const wrapped = (fn) => { for (const dx of [-S, 0, S]) fn(dx); };

export function appleSkinCanvas() {
  if (skin) return skin;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const cv = canvas(), g = cv.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0, '#5a1210'); base.addColorStop(0.45, '#861b17'); base.addColorStop(0.8, '#5c1c12'); base.addColorStop(1, '#3a1810');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // mottled colour
  for (let i = 0; i < 320; i++) {
    const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * 16;
    const c = rnd() < 0.5 ? '30,8,6' : rnd() < 0.5 ? '170,50,36' : '120,100,30';
    g.fillStyle = `rgba(${c},${0.05 + rnd() * 0.13})`;
    wrapped(dx => { g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill(); });
  }
  // yellowed streaks where the red has faded
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S * 0.8, len = 20 + rnd() * 50;
    g.strokeStyle = `rgba(190,150,50,${0.08 + rnd() * 0.1})`; g.lineWidth = 2 + rnd() * 4;
    wrapped(dx => { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + 8, y + len / 2, x + dx - 4, y + len); g.stroke(); });
  }
  // brown rot patches with a dark rim
  for (let i = 0; i < 7; i++) {
    const x = rnd() * S, y = 30 + rnd() * (S - 60), r = 9 + rnd() * 20;
    wrapped(dx => {
      const rg = g.createRadialGradient(x + dx, y, r * 0.15, x + dx, y, r);
      rg.addColorStop(0, 'rgba(25,14,8,.95)'); rg.addColorStop(0.6, 'rgba(60,34,14,.8)'); rg.addColorStop(1, 'rgba(60,34,14,0)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(x + dx, y, r * 1.2, r, rnd() * 3, 0, 7); g.fill();
    });
  }
  // wrinkles
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, len = 14 + rnd() * 40, bend = (rnd() - 0.5) * 16;
    g.strokeStyle = `rgba(15,4,3,${0.25 + rnd() * 0.3})`; g.lineWidth = 0.8 + rnd() * 1.6;
    wrapped(dx => { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + bend, y + len / 2, x + dx, y + len); g.stroke(); });
  }
  // pale mould spots
  for (let i = 0; i < 90; i++) {
    const x = rnd() * S, y = rnd() * S, r = 0.8 + rnd() * 2.4;
    g.fillStyle = `rgba(${rnd() < 0.6 ? '190,200,185' : '110,150,100'},${0.2 + rnd() * 0.4})`;
    wrapped(dx => { g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill(); });
  }
  // a glossy streak, because it still shines a little
  g.fillStyle = 'rgba(255,200,190,.10)';
  wrapped(dx => { g.beginPath(); g.ellipse(70 + dx, 100, 12, 46, -0.2, 0, 7); g.fill(); });

  // bump map: wrinkles and rot as dents on mid grey
  const bc = canvas(), b = bc.getContext('2d');
  b.fillStyle = '#9a9a9a'; b.fillRect(0, 0, S, S);
  seed = 29;
  for (let i = 0; i < 110; i++) {
    const x = rnd() * S, y = rnd() * S, len = 12 + rnd() * 44, bend = (rnd() - 0.5) * 18;
    b.strokeStyle = `rgba(20,20,20,${0.4 + rnd() * 0.4})`; b.lineWidth = 1 + rnd() * 2;
    wrapped(dx => { b.beginPath(); b.moveTo(x + dx, y); b.quadraticCurveTo(x + dx + bend, y + len / 2, x + dx, y + len); b.stroke(); });
  }
  for (let i = 0; i < 160; i++) {
    const x = rnd() * S, y = rnd() * S, r = 2 + rnd() * 9;
    b.fillStyle = `rgba(${rnd() < 0.5 ? 60 : 200},${rnd() < 0.5 ? 60 : 200},${rnd() < 0.5 ? 60 : 200},.25)`;
    wrapped(dx => { b.beginPath(); b.arc(x + dx, y, r, 0, 7); b.fill(); });
  }
  skin = { color: cv, bump: bc };
  return skin;
}

let material = null;
function appleMaterial() {
  if (material) return material;
  const { color, bump } = appleSkinCanvas();
  const map = new THREE.CanvasTexture(color), bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = bumpMap.wrapS = THREE.RepeatWrapping;
  material = new THREE.MeshPhongMaterial({ map, bumpMap, bumpScale: 2.2, specular: 0x4a2a28, shininess: 28 });
  return material;
}

// A sphere pushed out of shape: lumps, a lean, wide shoulders, sunken stem pit and base.
export function makeAppleGeometry(radius) {
  const geo = new THREE.SphereGeometry(1, 40, 30);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const th = Math.atan2(z, x);
    let r = 1 + 0.085 * Math.sin(3 * th + 2 * y) + 0.05 * Math.sin(5 * th - 3 * y + 1) + 0.025 * Math.sin(9 * th + 7 * y);
    r *= 1 + 0.1 * y;                       // wider shoulders than base
    const top = Math.max(0, y - 0.5) / 0.5, bot = Math.max(0, -y - 0.6) / 0.4;
    x *= r * 1.08; z *= r * 0.92; y *= r * 0.88;
    y -= 0.3 * top * top;                   // stem pit
    y += 0.1 * bot * bot;                   // base dimple
    x += 0.04 * y;                          // leans to one side
    p.setXYZ(i, x * radius, y * radius, z * radius);
  }
  geo.computeVertexNormals();
  return geo;
}

// The apple as one mesh, with a bent dry stem and a shrivelled leaf attached.
export function makeApple(radius = 0.05) {
  const body = new THREE.Mesh(makeAppleGeometry(radius), appleMaterial());
  const brown = new THREE.MeshPhongMaterial({ color: 0x3e2a1a, shininess: 8 });
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.35, 0.03), new THREE.Vector3(0.35, 0.6, -0.05),
  ].map(v => v.multiplyScalar(radius * 0.9))), 8, radius * 0.07, 6), brown);
  stem.position.set(0.04 * radius, 0.6 * radius, 0);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.32, 8, 6), new THREE.MeshPhongMaterial({ color: 0x5b4a22, shininess: 6 }));
  leaf.scale.set(1.5, 0.12, 0.7);
  leaf.position.set(radius * 0.45, radius * 0.72, 0);
  leaf.rotation.z = 0.5;
  body.add(stem, leaf);
  return body;
}
