import * as THREE from '../vendor/three.module.min.js';
import { makeApple } from './apple.js';

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

// The yellow handle of the key: rough, matte wood with a visible grain and a bumpy surface.
let keyWood = null;
function keyWoodMaterial() {
  if (keyWood) return keyWood;
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const S = 256, mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cc = mk(), c = cc.getContext('2d');
  const base = c.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0, '#d9a85f'); base.addColorStop(0.5, '#c9964f'); base.addColorStop(1, '#b8843f');
  c.fillStyle = base; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { // grain
    const y = rnd() * S, x0 = rnd() * S, len = 60 + rnd() * 180, amp = 1 + rnd() * 3, ph = rnd() * 6;
    c.strokeStyle = rnd() < 0.6 ? `rgba(110,64,20,${0.12 + rnd() * 0.25})` : `rgba(240,200,130,${0.1 + rnd() * 0.18})`;
    c.lineWidth = 0.6 + rnd() * 1.8;
    c.beginPath();
    for (let x = 0; x <= len; x += 8) { const yy = y + Math.sin(x * 0.06 + ph) * amp; x === 0 ? c.moveTo(x0, yy) : c.lineTo(x0 + x, yy); }
    c.stroke();
  }
  for (let i = 0; i < 3; i++) { // knots
    const x = rnd() * S, y = rnd() * S, r = 5 + rnd() * 8, kg = c.createRadialGradient(x, y, 1, x, y, r);
    kg.addColorStop(0, 'rgba(70,35,10,.85)'); kg.addColorStop(1, 'rgba(70,35,10,0)');
    c.fillStyle = kg; c.beginPath(); c.ellipse(x, y, r * 1.8, r, 0, 0, 7); c.fill();
  }
  for (let i = 0; i < 80; i++) { // dents and scratches
    const x = rnd() * S, y = rnd() * S, len = 4 + rnd() * 22, a = (rnd() - 0.5) * 1.5;
    c.strokeStyle = `rgba(80,45,15,${0.2 + rnd() * 0.3})`; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  const bc = mk(), b = bc.getContext('2d');
  b.fillStyle = '#8c8c8c'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) {
    const y = rnd() * S, x0 = rnd() * S, len = 30 + rnd() * 140;
    b.strokeStyle = `rgba(${rnd() < 0.5 ? '20,20,20' : '210,210,210'},${0.25 + rnd() * 0.4})`; b.lineWidth = 0.8 + rnd() * 1.8;
    b.beginPath(); b.moveTo(x0, y); b.lineTo(x0 + len, y + (rnd() - 0.5) * 5); b.stroke();
  }
  for (let i = 0; i < 1500; i++) { const v = 100 + rnd() * 80; b.fillStyle = `rgb(${v},${v},${v})`; b.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); return t; };
  const map = tex(cc); map.colorSpace = THREE.SRGBColorSpace;
  keyWood = new THREE.MeshPhongMaterial({ map, bumpMap: tex(bc), bumpScale: 3, specular: 0x000000, shininess: 1 });
  return keyWood;
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
  g.add(extrude(bow, .012, keyWoodMaterial()));
  g.rotation.x = 1.3; // roll so the flat face shows; the tip stays straight ahead
  g.userData.yaw = Math.PI / 2; // turned a quarter turn: tip to the left
  g.userData.offset = [-0.1, 0.02, 0];
  g.userData.scale = 1.7;
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
  // jaws pointing straight ahead: the drawing leans 25 degrees, so turn it back in its own plane
  g.userData.pose = [-Math.PI / 2 + 0.08, Math.PI / 2, 0.44]; // y = 90 degrees: tip to the left // x, y, z of an 'YXZ' euler
  g.userData.offset = [-0.1, 0.02, 0];
  g.userData.scale = 1.1;
  return g;
}

// Apple: the old, lopsided one, held up by its stem.
export function buildApple() {
  const g = new THREE.Group();
  g.add(makeApple(0.05));
  g.userData.scale = 0.9;
  return g;
}

// Kitchen knife: along +x (tip toward +x), like the key.
export function buildKnife() {
  const g = new THREE.Group();
  const blade = extrude(polygon([[0, .016], [.15, .016], [.215, .002], [.19, -.011], [.11, -.019], [0, -.019]]), .004,
    new THREE.MeshPhongMaterial({ color: 0xc4c9ce, specular: 0xffffff, shininess: 100 }));
  const wood = new THREE.MeshPhongMaterial({ color: 0x3a2416, specular: 0x221108, shininess: 20 });
  const handle = extrude(polygon([[-.115, .015], [0, .015], [0, -.016], [-.115, -.013]]), .02, wood);
  const bolster = extrude(polygon([[-.004, .017], [.012, .017], [.012, -.02], [-.004, -.02]]), .022, steel());
  g.add(blade, handle, bolster);
  for (const x of [-.09, -.05]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(.0028, .0028, .024, 8), new THREE.MeshPhongMaterial({ color: 0xc9b377 }));
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(x, 0, 0);
    g.add(rivet);
  }
  g.rotation.x = 1.0; // roll so the flat of the blade shows
  g.userData.yaw = 0.2;
  g.userData.scale = 1.0;
  return g;
}

// ---- shotgun surfaces ----------------------------------------------------------------
// Rough, worn wood and smooth blued steel, painted on canvases so the gun reads as old and used.
let gunSkins = null;
function gunTextures() {
  if (gunSkins) return gunSkins;
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const S = 256;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };

  // wood: grain runs along u (the length of the stock)
  const wc = mk(), w = wc.getContext('2d');
  const wg = w.createLinearGradient(0, 0, 0, S);
  wg.addColorStop(0, '#5b3a22'); wg.addColorStop(0.5, '#6f4628'); wg.addColorStop(1, '#4e311c');
  w.fillStyle = wg; w.fillRect(0, 0, S, S);
  for (let i = 0; i < 200; i++) {
    const y = rnd() * S, amp = 1 + rnd() * 4, ph = rnd() * 6, len = 80 + rnd() * 176, x0 = rnd() * S;
    w.strokeStyle = rnd() < 0.55 ? `rgba(30,16,8,${0.12 + rnd() * 0.25})` : `rgba(150,100,60,${0.08 + rnd() * 0.16})`;
    w.lineWidth = 0.6 + rnd() * 1.8;
    w.beginPath();
    for (let x = 0; x <= len; x += 8) { const yy = y + Math.sin(x * 0.05 + ph) * amp; x === 0 ? w.moveTo(x0, yy) : w.lineTo(x0 + x, yy); }
    w.stroke();
  }
  for (let i = 0; i < 4; i++) { // knots
    const x = rnd() * S, y = rnd() * S, r = 5 + rnd() * 9;
    const kg = w.createRadialGradient(x, y, 1, x, y, r);
    kg.addColorStop(0, 'rgba(25,12,6,.9)'); kg.addColorStop(1, 'rgba(25,12,6,0)');
    w.fillStyle = kg; w.beginPath(); w.ellipse(x, y, r * 1.8, r, 0, 0, 7); w.fill();
  }
  for (let i = 0; i < 60; i++) { // scratches and dings
    const x = rnd() * S, y = rnd() * S, len = 6 + rnd() * 30, a = (rnd() - 0.5) * 1.2;
    w.strokeStyle = `rgba(210,170,120,${0.15 + rnd() * 0.3})`; w.lineWidth = 0.7;
    w.beginPath(); w.moveTo(x, y); w.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); w.stroke();
  }
  for (let i = 0; i < 40; i++) { // worn, pale patches where hands have rubbed the varnish
    const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 20;
    w.fillStyle = 'rgba(190,140,90,.07)'; w.beginPath(); w.ellipse(x, y, r * 2, r, 0, 0, 7); w.fill();
  }
  const wb = mk(), b = wb.getContext('2d');
  b.fillStyle = '#8a8a8a'; b.fillRect(0, 0, S, S);
  seed = 17;
  for (let i = 0; i < 260; i++) {
    const y = rnd() * S, x0 = rnd() * S, len = 40 + rnd() * 160;
    b.strokeStyle = `rgba(${rnd() < 0.5 ? '25,25,25' : '200,200,200'},${0.25 + rnd() * 0.4})`; b.lineWidth = 0.8 + rnd() * 1.6;
    b.beginPath(); b.moveTo(x0, y); b.lineTo(x0 + len, y + (rnd() - 0.5) * 4); b.stroke();
  }
  // rough steel: fine speckle (a parkerized finish)
  const mc = mk(), m = mc.getContext('2d');
  m.fillStyle = '#808080'; m.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { const v = 90 + rnd() * 90; m.fillStyle = `rgb(${v},${v},${v})`; m.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }

  const tex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const color = tex(wc); color.colorSpace = THREE.SRGBColorSpace;
  gunSkins = { woodColor: color, woodBump: tex(wb), steelBump: tex(mc) };
  return gunSkins;
}

function roundedBox(w, h, d, bevel) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  return geo;
}

// Shotgun: along +x (muzzle toward +x). Smooth blued barrel and tube, a rough parkerized
// receiver, and a worn wooden stock and pump. The flash sits at the muzzle and is shown for a
// moment when it fires.
export function buildShotgun() {
  const g = new THREE.Group();
  const skin = gunTextures();
  const wood = new THREE.MeshPhongMaterial({
    map: skin.woodColor, bumpMap: skin.woodBump, bumpScale: 2.2, specular: 0x2a1a10, shininess: 10,
  });
  const smooth = new THREE.MeshPhongMaterial({ color: 0x1c2227, specular: 0xd0e2f4, shininess: 150 }); // polished bluing
  const rough = new THREE.MeshPhongMaterial({ color: 0x30363b, specular: 0x445566, shininess: 14, bumpMap: skin.steelBump, bumpScale: 1.2 });
  const bright = new THREE.MeshPhongMaterial({ color: 0x9aa4ad, specular: 0xffffff, shininess: 110 });

  const cyl = (r, len, mat, x, y, seg = 24) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.rotation.z = Math.PI / 2; m.position.set(x, y, 0);
    return m;
  };
  g.add(cyl(.0125, .62, smooth, .28, .022));            // barrel
  g.add(cyl(.0138, .022, smooth, .585, .022));          // muzzle ring
  g.add(cyl(.0105, .46, smooth, .2, -.008));            // magazine tube
  g.add(cyl(.0128, .016, bright, .43, -.008));          // tube cap
  const rib = new THREE.Mesh(new THREE.BoxGeometry(.6, .004, .011), smooth); rib.position.set(.28, .0368, 0); g.add(rib);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(.0042, 10, 8), bright); bead.position.set(.585, .04, 0); g.add(bead);

  const recv = new THREE.Mesh(roundedBox(.2, .056, .044, .006), rough); recv.position.set(-.05, .004, 0); g.add(recv);
  const port = new THREE.Mesh(new THREE.BoxGeometry(.06, .02, .004), new THREE.MeshPhongMaterial({ color: 0x050607 }));
  port.position.set(-.035, .012, .0225); g.add(port);
  const port2 = port.clone(); port2.position.z = -.0225; g.add(port2);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(.05, .004, .03), bright); gate.position.set(-.06, -.026, 0); g.add(gate);

  // pump: a smooth rounded grip with grooves
  const pump = cyl(.0235, .17, wood, .2, -.03, 28); pump.scale.set(1, 1, 1.12); g.add(pump);
  for (let k = 0; k < 6; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.0238, .0016, 6, 20), new THREE.MeshPhongMaterial({ color: 0x2a1a10, shininess: 5 }));
    ring.rotation.y = Math.PI / 2; ring.position.set(.135 + k * .026, -.03, 0); g.add(ring);
  }

  // stock: a curved profile with rounded edges
  const st = new THREE.Shape();
  st.moveTo(-.145, .032);
  st.bezierCurveTo(-.3, .03, -.42, .018, -.505, -.004);
  st.lineTo(-.52, -.095);
  st.bezierCurveTo(-.4, -.075, -.28, -.055, -.145, -.032);
  st.closePath();
  const stockGeo = new THREE.ExtrudeGeometry(st, { depth: .03, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 4, curveSegments: 16 });
  stockGeo.translate(0, 0, -.015);
  g.add(new THREE.Mesh(stockGeo, wood));
  const pad = new THREE.Mesh(roundedBox(.016, .1, .046, .004), new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 8 }));
  pad.position.set(-.526, -.047, 0); g.add(pad);

  // trigger guard and trigger
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.018, .0028, 8, 16, Math.PI), smooth);
  guard.rotation.z = Math.PI; guard.position.set(-.085, -.026, 0); g.add(guard);
  const trig = new THREE.Mesh(new THREE.BoxGeometry(.004, .016, .004), bright); trig.position.set(-.085, -.034, 0); trig.rotation.z = 0.3; g.add(trig);
  const swivel = new THREE.Mesh(new THREE.TorusGeometry(.005, .0012, 6, 10), bright); swivel.position.set(-.37, -.05, .02); g.add(swivel);

  // muzzle flash: a hot core and a longer cone, additive and always drawn on top
  const glow = { color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide };
  const flash = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), new THREE.MeshBasicMaterial({ ...glow, color: 0xfff0b8, opacity: 0.95 }));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.07, .3, 14, 1, true), new THREE.MeshBasicMaterial({ ...glow, opacity: 0.75 }));
  cone.rotation.z = -Math.PI / 2; cone.position.x = .13;
  core.renderOrder = cone.renderOrder = 10;
  flash.add(core, cone);
  flash.position.set(.64, .02, 0);
  flash.visible = false;
  g.add(flash);
  g.userData.flash = flash;
  g.userData.pose = [0.04, Math.PI / 2 + 0.16, 0.0];
  g.userData.offset = [-0.02, 0.0, -0.3];
  g.userData.scale = 0.7;
  return g;
}

// Three shotgun shells held together: red hulls with brass bases, along +x.
export function buildShells() {
  const g = new THREE.Group();
  const red = new THREE.MeshPhongMaterial({ color: 0xc8321f, specular: 0xffaaaa, shininess: 50 });
  const brass = new THREE.MeshPhongMaterial({ color: 0xb89a32, specular: 0xffeeaa, shininess: 70 });
  for (const z of [-0.024, 0, 0.024]) {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 14), red);
    hull.rotation.z = Math.PI / 2; hull.position.set(0.035, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.02, 14), brass);
    base.rotation.z = Math.PI / 2; base.position.set(-0.01, 0, z);
    g.add(hull, base);
  }
  g.userData.yaw = 0.3;
  g.userData.scale = 1.6;
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
  const models = { key: buildKey(), pliers: buildPliers(), apple: buildApple(), knife: buildKnife(), shotgun: buildShotgun(), shells: buildShells() };
  for (const m of Object.values(models)) {
    const holder = new THREE.Group();
    holder.rotation.order = 'YXZ';
    if (m.userData.pose) {
      const [x, y, z] = m.userData.pose;
      holder.rotation.set(x, y, z);
    } else {
      holder.rotation.y = Math.PI / 2 + (m.userData.yaw ?? 0); // tip toward -z
    }
    if (m.userData.offset) holder.position.set(...m.userData.offset);
    holder.scale.setScalar(m.userData.scale ?? 1.25);
    holder.add(m);
    holder.visible = false;
    rig.add(holder);
    m.userData.holder = holder;
  }

  const REST = new THREE.Vector3(0.12, -0.075, -0.38);
  let shown = null, raise = 1, walkSmooth = 0, prevWalk = 0, kickT = 99;

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
    // the gun goes off: a kick back, a flash at the muzzle
    kick() {
      kickT = 0;
      const f = models.shotgun.userData.flash;
      f.visible = true;
      f.scale.setScalar(0.8 + Math.random() * 0.5);
    },
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
      kickT += dt;
      if (kickT > 0.07) models.shotgun.userData.flash.visible = false;
      const kick = Math.exp(-kickT * 11);
      // a slow breathing drift, so it is never perfectly still
      const idle = 0.0006;
      rig.position.set(
        REST.x + s[0] + Math.sin(t * 0.9) * idle,
        REST.y + s[1] + Math.sin(t * 1.3 + 1) * idle - (1 - raise) * 0.25,
        REST.z + s[2] + kick * 0.09,
      );
      rig.rotation.set(s[3] + kick * 0.2, s[4], s[5] + Math.sin(t * 0.7) * 0.003);
    },
  };
}
