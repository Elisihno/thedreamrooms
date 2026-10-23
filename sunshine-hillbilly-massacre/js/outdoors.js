import * as THREE from '../vendor/three.module.min.js';

// Everything outside the farmhouse. The player never goes out there, but sees it through every
// window: a sky with a hard white sun, a dirt road, a windmill, dry corn and circling vultures.

export const SUN = new THREE.Vector3(0.55, 0.62, -0.56).normalize();   // the direction toward the sun
export const HAZE = 0xe8dab4;                                          // the colour the world fades into

function cloudTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  let s = 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 176, y = 36 + rnd() * 28 - Math.abs(x - 128) * 0.1, r = 12 + rnd() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function vultureTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.strokeStyle = '#15110d'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(4, 30); g.quadraticCurveTo(20, 18, 32, 36); g.quadraticCurveTo(44, 18, 60, 30); g.stroke();
  g.fillStyle = '#15110d'; g.beginPath(); g.ellipse(32, 38, 5, 9, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#d9cfae'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#7a1c12'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center';
  g.fillText('SUNSHINE', 128, 52); g.fillStyle = '#3a2a1a'; g.font = 'bold 22px Georgia, serif'; g.fillText('MEAT & FEED', 128, 80);
  g.font = 'italic 17px Georgia, serif'; g.fillText('No trespassing. Kinfolk only.', 128, 108);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildOutdoors(tex, houseSize) {
  const group = new THREE.Group();
  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const cx = houseSize.w / 2, cz = houseSize.d / 2;
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // ---- the sky: a dome that follows the camera, fading from deep blue to the haze at the horizon
  const skyGeo = new THREE.SphereGeometry(40, 24, 16);
  const col = new Float32Array(skyGeo.attributes.position.count * 3), c = new THREE.Color();
  const zen = new THREE.Color(0x3f86d6), mid = new THREE.Color(0x9cc8ec), hor = new THREE.Color(HAZE);
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = Math.max(0, skyGeo.attributes.position.getY(i) / 40);
    if (y < 0.25) c.copy(hor).lerp(mid, y / 0.25); else c.copy(mid).lerp(zen, Math.min(1, (y - 0.25) / 0.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.sun, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(26);
  sunSprite.position.copy(SUN).multiplyScalar(36);
  sunSprite.renderOrder = -9;
  const clouds = [];
  const cloudTex = cloudTexture();
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
    const a = rnd() * Math.PI * 2, el = 0.25 + rnd() * 0.55;
    s.position.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(36);
    s.scale.set(20 + rnd() * 14, 7 + rnd() * 4, 1);
    s.renderOrder = -8;
    clouds.push(s);
  }
  const vultures = [];
  const vtex = vultureTexture();
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Sprite(new THREE.SpriteMaterial({ map: vtex, transparent: true, fog: false, depthWrite: false }));
    v.scale.setScalar(3.2 - i * 0.5);
    vultures.push({ s: v, a: rnd() * 6, r: 24 + i * 5, h: 0.5 + i * 0.12, w: 0.07 + rnd() * 0.05 });
    v.renderOrder = -7;
  }
  const dome = new THREE.Group();
  dome.add(sky, sunSprite, ...clouds, ...vultures.map(v => v.s));
  group.add(dome);

  // ---- the ground: dry earth to the horizon, and the road that leads away from the front door
  tex.dirt.repeat.set(70, 70);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), lam(0xffffff, { map: tex.dirt }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.04, cz);
  group.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 400), lam(0xa88a5c));
  road.rotation.x = -Math.PI / 2;
  road.position.set(13.5, -0.03, cz + 200);
  group.add(road);
  const rut = lam(0x6e5535);
  for (const dx of [-1.4, 1.4]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 400), rut);
    r.rotation.x = -Math.PI / 2; r.position.set(13.5 + dx, -0.025, cz + 200); group.add(r);
  }

  // ---- a foundation of stones so the house sits on the ground
  const stone = lam(0x8a8272);
  for (const [w, d, x, z] of [[houseSize.w + 0.7, 0.3, cx, -0.27], [houseSize.w + 0.7, 0.3, cx, houseSize.d + 0.27], [0.3, houseSize.d, -0.27, cz], [0.3, houseSize.d, houseSize.w + 0.27, cz]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), stone);
    m.position.set(x, 0.2, z); group.add(m);
  }

  // ---- the front porch of the old farmhouse: boards, posts, a porch swing and a screen door
  const porchX = 13.5, porchZ = houseSize.d;
  const board = lam(0x9a8466), post = lam(0xcfc6b0), chain = lam(0x2b2b2b);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 2.6), board);
  deck.position.set(porchX, 0.05, porchZ + 1.55);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.6), board);
  step.position.set(porchX, -0.08, porchZ + 3.1);
  const roofP = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.14, 3.0), lam(0x5a4a3a));
  roofP.position.set(porchX, 2.8, porchZ + 1.6);
  group.add(deck, step, roofP);
  for (const dx of [-3.1, 3.1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.16), post);
    p.position.set(porchX + dx, 1.45, porchZ + 2.7); group.add(p);
  }
  const swing = new THREE.Group();
  const wood = lam(0x8a7658);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.5), wood);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.05), wood); back.position.set(0, 0.3, -0.22); back.rotation.x = -0.15;
  swing.add(seat, back);
  for (const dx of [-0.72, 0.72]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.7, 0.02), chain); c.position.set(dx, 0.85, 0); swing.add(c); }
  swing.position.set(porchX - 2.0, 0.85, porchZ + 1.2);
  group.add(swing);
  const swingPhase = rnd() * 6;

  // ---- the fence around the yard
  const postGeo = new THREE.BoxGeometry(0.14, 1.2, 0.14), railGeo = new THREE.BoxGeometry(1, 0.08, 0.05);
  const posts = [], rails = [];
  const X0 = -14, X1 = houseSize.w + 14, Z0 = -14, Z1 = houseSize.d + 16;
  const addRun = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 3), ang = Math.atan2(bz - az, bx - ax);
    for (let i = 0; i <= n; i++) posts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n, 0]);
    for (const y of [0.5, 0.95]) rails.push([(ax + bx) / 2, y, (az + bz) / 2, len, -ang]);
  };
  addRun(X0, Z0, X1, Z0); addRun(X0, Z1, X1, Z1); addRun(X0, Z0, X0, Z1); addRun(X1, Z0, X1, Z1);
  const fp = new THREE.InstancedMesh(postGeo, wood, posts.length), fr = new THREE.InstancedMesh(railGeo, wood, rails.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  posts.forEach(([x, z], i) => { fp.setMatrixAt(i, mtx.makeTranslation(x, 0.55, z + (Math.abs(x - 13.5) < 3.2 && Math.abs(z - Z1) < 1 ? 999 : 0))); });
  rails.forEach(([x, y, z, len, ang], i) => { q.setFromEuler(e.set(0, ang, 0)); fr.setMatrixAt(i, mtx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(len, 1, 1))); });
  group.add(fp, fr);

  // ---- the windmill, turning slowly in the heat
  const windmill = new THREE.Group();
  const steel = lam(0x7a7e80);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.7, 11, 4, 1, true), new THREE.MeshLambertMaterial({ color: 0x6d7173, wireframe: true }));
  tower.position.y = 5.5; tower.rotation.y = Math.PI / 4;
  windmill.add(tower);
  const wheel = new THREE.Group();
  wheel.position.set(0, 11.2, 0.6);
  for (let i = 0; i < 12; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.03), steel);
    blade.position.y = 1.7; const arm = new THREE.Group(); arm.rotation.z = i / 12 * Math.PI * 2; arm.add(blade); wheel.add(arm);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 2.2), steel);
  tail.position.set(0, 11.2, -1.4);
  windmill.add(wheel, tail);
  windmill.position.set(-13, 0, 8);
  windmill.rotation.y = 0.6;
  group.add(windmill);

  // ---- a dead tree or two, a water tower and hay rolls
  const bark = lam(0x4f4030);
  for (const [x, z, s] of [[-9, -10, 1.2], [38, 22, 1], [-18, 26, 1.4], [44, -8, 1.1], [8, 40, 1.3], [-30, -2, 1]]) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 4.2, 6), bark); trunk.position.y = 2.1; t.add(trunk);
    for (let i = 0; i < 5; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 2.2, 5), bark);
      br.position.set(0, 3.2 + i * 0.25, 0); const piv = new THREE.Group(); piv.position.y = 0; piv.rotation.set((rnd() - 0.5) * 1.4, rnd() * 6, 0.6 + rnd() * 0.5); br.position.set(0, 1.1, 0); piv.position.y = 3 + i * 0.3; piv.add(br); t.add(piv);
    }
    t.position.set(x, 0, z); t.scale.setScalar(s); group.add(t);
  }
  const tank = new THREE.Group();
  for (const [lx, lz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 12, 5), steel); l.position.set(lx, 6, lz); tank.add(l); }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 3.6, 14), lam(0xc9c2ae)); drum.position.y = 13.4; tank.add(drum);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 14), lam(0x8a3a28)); cap.position.y = 15.9; tank.add(cap);
  tank.position.set(-34, 0, -16); group.add(tank);
  const hayMat = lam(0xc9a95a);
  for (const [x, z] of [[-6, 34], [-3, 36], [30, 40], [-22, 14], [50, 10]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 12), hayMat); r.rotation.z = Math.PI / 2; r.rotation.y = rnd() * 3; r.position.set(x, 1, z); group.add(r);
  }

  // ---- a distant red barn
  const farBarn = new THREE.Group();
  const bw = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 10), lam(0x8a2f22)); bw.position.y = 3.5; farBarn.add(bw);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.4, 4, 4, 1), lam(0x4a4036)); roof.rotation.y = Math.PI / 4; roof.scale.set(1.45, 1, 1); roof.position.y = 9; farBarn.add(roof);
  farBarn.position.set(52, 0, -28); farBarn.rotation.y = -0.4; group.add(farBarn);

  // ---- rows of dry corn, to the east and the west
  const stalk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), lam(0xb7a24a), 1100);
  let n = 0;
  const field = (x0, x1, z0, z1) => { for (let x = x0; x < x1 && n < 1100; x += 1.1) for (let z = z0; z < z1 && n < 1100; z += 0.9) { mtx.makeTranslation(x + (rnd() - 0.5) * 0.4, 1.1, z + (rnd() - 0.5) * 0.3); stalk.setMatrixAt(n++, mtx); } };
  field(houseSize.w + 18, houseSize.w + 36, -6, 28); field(-40, -22, 14, 30);
  stalk.count = n;
  group.add(stalk);

  // ---- the sign at the end of the road, and a mailbox
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshLambertMaterial({ map: signTexture(), side: THREE.DoubleSide }));
  sign.position.set(16.8, 1.9, houseSize.d + 20); sign.rotation.y = Math.PI + 0.3;
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), wood); signPost.position.set(16.8, 1.3, houseSize.d + 20.05);
  group.add(sign, signPost);

  return {
    group,
    update(dt, t, camPos) {
      dome.position.copy(camPos);
      wheel.rotation.z += dt * 0.7;
      swing.rotation.x = Math.sin(t * 0.9 + swingPhase) * 0.08;
      for (const v of vultures) {
        v.a += dt * v.w;
        v.s.position.set(Math.cos(v.a) * v.r, v.h * 36 + Math.sin(t * 0.7 + v.r) * 0.4, Math.sin(v.a) * v.r);
      }
    },
  };
}
