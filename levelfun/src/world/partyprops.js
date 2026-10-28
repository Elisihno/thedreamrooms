import * as THREE from '../three.js';

// Party dressing for the Dining Room (also a stand-in for later rooms): white-clothed long tables,
// chairs, place settings, cake, balloons (stationary), confetti, bunting. Everything repeated is
// instanced so the whole room costs only a handful of draw calls.
const PARTY = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xff7eb6, 0xff8c1a, 0x1abc9c];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function instanced(scene, geo, mat, items, { cast = true, receive = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z);
    o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    o.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (it.color !== undefined) m.setColorAt(i, c.set(it.color));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = cast; m.receiveShadow = receive;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

function bannerTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#d8d2c4'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 6); x.quadraticCurveTo(512, 40, 1024, 6); x.stroke();
  const n = text.length, w = 1024 / n;
  for (let i = 0; i < n; i++) {
    const cx = i * w + w / 2, sag = 6 + 34 * Math.sin(Math.PI * (i + 0.5) / n);
    x.fillStyle = '#' + PARTY[i % PARTY.length].toString(16).padStart(6, '0');
    x.beginPath(); x.moveTo(cx - w * 0.42, sag); x.lineTo(cx + w * 0.42, sag); x.lineTo(cx, sag + 84); x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center';
    x.fillText(text[i], cx, sag + 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Adds a long tablecloth table (collider = top slab at 0.85-0.95 m so a crouched player fits under).
export function addTable(world, x, z, len = 3.2, wid = 1.0) {
  world.box({ x, y: 0.9, z, w: len, h: 0.1, d: wid, mat: 'tablecloth', tile: 1, y0: 0.85, y1: 0.95 });
  for (const s of [-1, 1]) world.box({ x, y: 0.84, z: z + s * (wid / 2 + 0.01), w: len, h: 0.22, d: 0.02, mat: 'tablecloth', tile: 1, collide: false });
  for (const lx of [-len / 2 + 0.15, len / 2 - 0.15]) for (const lz of [-wid / 2 + 0.1, wid / 2 - 0.1])
    world.box({ x: x + lx, y: 0.4, z: z + lz, w: 0.07, h: 0.8, d: 0.07, mat: 'wood', collide: false, cast: false });
}

export function addDiningDecor(world, scene, { tables, bounds }) {
  const r = rng(7);
  const seats = [], backs = [], legs = [], plates = [], cups = [], hats = [];
  for (const t of tables) {
    addTable(world, t.x, t.z);
    for (const dx of [-1, 0, 1]) for (const s of [-1, 1]) {
      const cx = t.x + dx, cz = t.z + s * 0.95, col = PARTY[Math.floor(r() * PARTY.length)];
      seats.push({ x: cx, y: 0.45, z: cz, sx: 0.46, sy: 0.05, sz: 0.46, color: col });
      backs.push({ x: cx, y: 0.72, z: cz + s * 0.21, sx: 0.46, sy: 0.5, sz: 0.04, color: col });
      for (const [lx, lz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) legs.push({ x: cx + lx, y: 0.21, z: cz + lz, sx: 0.04, sy: 0.42, sz: 0.04, color: 0x6b6258 });
      world.collision.add(cx - 0.25, cz - 0.25, cx + 0.25, cz + 0.25, 0, 0.95);
      plates.push({ x: cx, y: 0.953, z: t.z + s * 0.28 });
      cups.push({ x: cx + 0.22, y: 1.0, z: t.z + s * 0.2, color: PARTY[Math.floor(r() * PARTY.length)] });
      hats.push({ x: cx - 0.2, y: 1.03, z: t.z + s * 0.32, color: PARTY[Math.floor(r() * PARTY.length)] });
    }
  }
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  instanced(scene, new THREE.BoxGeometry(1, 1, 1), white, seats);
  instanced(scene, new THREE.BoxGeometry(1, 1, 1), white, backs);
  instanced(scene, new THREE.BoxGeometry(1, 1, 1), white, legs, { receive: false });
  instanced(scene, new THREE.CylinderGeometry(0.13, 0.11, 0.015, 16), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.3 }), plates);
  instanced(scene, new THREE.CylinderGeometry(0.04, 0.03, 0.1, 10), white, cups);
  instanced(scene, new THREE.ConeGeometry(0.06, 0.17, 10), white, hats);

  // Cake on the middle table.
  const mid = tables[Math.floor(tables.length / 2)];
  const cake = new THREE.Group();
  const tier = (rad, h, y, col) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 24), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })); m.position.y = y; m.castShadow = true; cake.add(m); };
  tier(0.24, 0.12, 0.06, 0xfff1d6); tier(0.17, 0.1, 0.17, 0xff9fc4);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, can = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), new THREE.MeshStandardMaterial({ color: PARTY[i] }));
    can.position.set(Math.cos(a) * 0.09, 0.27, Math.sin(a) * 0.09); cake.add(can);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
    fl.position.set(Math.cos(a) * 0.09, 0.32, Math.sin(a) * 0.09); cake.add(fl);
  }
  cake.position.set(mid.x, 0.95, mid.z);
  scene.add(cake);

  // Balloons: stationary. Ceiling layer + bunches tied to table ends and room corners.
  const bal = [], strings = [];
  const bunch = (bx, bz, n) => {
    strings.push(bx, 0.06, bz, bx, 1.2, bz);
    for (let i = 0; i < n; i++) {
      const x = bx + (r() - 0.5) * 0.7, y = 1.6 + r() * 0.8, z = bz + (r() - 0.5) * 0.7;
      bal.push({ x, y, z, sy: 1.18, color: PARTY[Math.floor(r() * PARTY.length)] });
      strings.push(x, y - 0.27, z, bx, 1.2, bz);
    }
    world.box({ x: bx, y: 0.04, z: bz, w: 0.16, h: 0.08, d: 0.16, mat: 'concrete_floor', collide: false });
  };
  for (const t of tables) { bunch(t.x - 1.75, t.z, 6); bunch(t.x + 1.75, t.z, 6); }
  const { x0, x1, z0, z1 } = bounds;
  for (const [bx, bz] of [[x0 + 0.6, z0 + 0.6], [x0 + 0.6, z1 - 0.6], [x1 - 0.6, z0 + 0.6], [x1 - 0.6, z1 - 0.6]]) bunch(bx, bz, 8);
  for (let i = 0; i < 40; i++) bal.push({ x: x0 + 0.5 + r() * (x1 - x0 - 1), y: 2.6 + r() * 0.25, z: z0 + 0.5 + r() * (z1 - z0 - 1), sy: 1.18, color: PARTY[Math.floor(r() * PARTY.length)] });
  instanced(scene, new THREE.SphereGeometry(0.25, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.05 }), bal);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
  scene.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xe6e0d2 })));

  // Confetti on the floor and tables.
  const conf = [];
  for (let i = 0; i < 700; i++) {
    const onTable = i < 160, t = tables[Math.floor(r() * tables.length)];
    conf.push(onTable
      ? { x: t.x + (r() - 0.5) * 3.1, y: 0.958, z: t.z + (r() - 0.5) * 0.9, ry: r() * 6.28, color: PARTY[Math.floor(r() * PARTY.length)] }
      : { x: x0 + 0.3 + r() * (x1 - x0 - 0.6), y: 0.008, z: z0 + 0.3 + r() * (z1 - z0 - 0.6), ry: r() * 6.28, color: PARTY[Math.floor(r() * PARTY.length)] });
  }
  const cg = new THREE.PlaneGeometry(0.05, 0.03); cg.rotateX(-Math.PI / 2);
  instanced(scene, cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide }), conf, { cast: false });

  // Bunting on two walls.
  const tex = bannerTexture('HAPPYBIRTHDAY');
  const bm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const north = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.875), bm);
  north.position.set((x0 + x1) / 2, 2.4, z0 + 0.12); scene.add(north);
  const west = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.875), bm);
  west.position.set(x0 + 0.12, 2.4, (z0 + z1) / 2); west.rotation.y = Math.PI / 2; scene.add(west);
}
