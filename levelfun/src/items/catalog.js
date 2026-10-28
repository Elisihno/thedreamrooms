import * as THREE from '../three.js';
import { cloneModel, hasModel } from '../assets/models.js';

// Text shown when a note is read (USE while holding it).
export const READ = {
  exit_code_note: ctx => ({ title: 'EXIT CODE', body: ctx.exitCode, big: true }),
  invitation: () => ({ title: 'YOU ARE INVITED', body: 'THE REAL PARTY IS\nUNDER THE BALL PIT\n\nCOME ALONE' }),
  passage_diagram: () => ({ title: 'PASSAGE DIAGRAM', body: 'INDOOR PLAYGROUND\nSOUTH-EAST CORNER\nSTRIPED FLOOR PANEL\n\nCRAWL EAST UNDER THE FLOOR\nTO THE SUPPLY CLOSET' }),
};

// Every item in the game. Items are built at real-world scale with their origin at the bottom centre.
//  main: one of the 12 main escape-puzzle categories (the rest are utility/access items)
//  where: rooms (area ids) the random placement may use; reward: won at an arcade game instead of being scattered
//  count: how many physical copies exist; loud: how much noise a throw makes (0..1)
export const ITEMS = {
  // ---- main puzzle items ----
  exit_key:        { name: 'Exit Key', main: 1, build: 'key', tint: 0xd94b3a, size: 0.12, where: ['dining', 'reception', 'kitchen', 'prep'], loud: 0.2 },
  wire_cutters:    { name: 'Wire Cutters', main: 1, build: 'glb:wire_cutters', size: 0.24, where: ['mstorage', 'electrical', 'supply', 'storage3'], loud: 0.3 },
  exit_code_note:  { name: 'Exit Code Note', main: 1, build: 'codeNote', size: 0.18, reward: 'find', loud: 0 },
  exit_fuse:       { name: 'Exit Fuse', main: 1, build: 'glb:fuse', tint: 0x66c6ff, size: 0.12, where: ['security', 'bath', 'mstorage', 'storage2'], loud: 0.1 },
  screwdriver:     { name: 'Screwdriver', main: 1, build: 'glb:screwdriver', size: 0.25, reward: 'pop', loud: 0.2 },
  elevator_motor:  { name: 'Elevator Motor', main: 1, build: 'motor', size: 0.3, where: ['generator', 'boiler', 'mstorage', 'storage3'], loud: 0.8 },
  elevator_circuit:{ name: 'Elevator Circuit', main: 1, build: 'circuit', size: 0.2, reward: 'dash', loud: 0.2 },
  elevator_key:    { name: 'Elevator Key', main: 1, build: 'key', tint: 0x4aa3ff, size: 0.12, where: ['staff', 'archives', 'maintoffice', 'birthday'], loud: 0.2 },
  generator_handle:{ name: 'Generator Handle', main: 1, build: 'crank', size: 0.35, where: ['electrical', 'boiler', 'mstorage', 'bhall'], loud: 0.6 },
  power_fuse:      { name: 'Power Fuse', main: 1, build: 'glb:fuse', tint: 0xffa43a, size: 0.14, where: ['staff', 'archives', 'storage3', 'service'], loud: 0.1 },
  token:           { name: 'Arcade Token', main: 1, build: 'token', size: 0.06, fixed: { level: '2', x: 54.0, z: 1.05, y: 0.96 }, loud: 0.05 },
  zap_a:           { name: 'Party Zapper Grip', main: 1, build: 'zapGrip', size: 0.2, where: ['reception', 'partya', 'partyb'], loud: 0.3 },
  zap_b:           { name: 'Party Zapper Coil', main: 1, build: 'zapCoil', size: 0.16, where: ['kitchen', 'prep', 'supply'], loud: 0.3 },
  zap_c:           { name: 'Party Zapper Emitter', main: 1, build: 'zapEmitter', size: 0.2, where: ['storage3', 'archives', 'celeb'], loud: 0.3 },
  zapper:          { name: 'Party Zapper', build: 'zapper', size: 0.3, hidden: true, loud: 0.3 },
  battery:         { name: 'Battery', build: 'battery', size: 0.09, count: 3, compartment: ['party', 'maint'], where: ['bath', 'security', 'storage2', 'service', 'electrical', 'supply'], loud: 0.1 },
  // ---- additional items ----
  needle:          { name: 'Balloon Popper', build: 'glb:needle', size: 0.2, where: ['dining', 'hall', 'partya', 'partyb'], loud: 0.1 },
  turning_handle:  { name: 'Turning Handle', build: 'turningHandle', size: 0.22, where: ['prep', 'kitchen', 'reception', 'supply'], loud: 0.4 },
  plush:           { name: 'Partygoer Plushie', build: 'glb:plush', size: 0.34, count: 2, where: ['birthday', 'celeb', 'archives', 'playground', 'landing'], loud: 0.05, hold: { pos: [0.2, -0.3, -0.5] } },
  music_box:       { name: 'Birthday Music Box', build: 'musicBox', size: 0.16, where: ['partyb', 'partya', 'birthday'], loud: 0.5 },
  whistle:         { name: 'Party Whistle', build: 'glb:whistle', size: 0.1, where: ['hall', 'dining', 'playground'], loud: 0.3 },
  windup_toy:      { name: 'Wind-Up Toy', build: 'glb:windup_robot', size: 0.2, where: ['partyb', 'playground', 'ballpit'], loud: 0.3 },
  invitation:      { name: 'Birthday Invitation', build: 'invitation', size: 0.2, where: ['reception', 'hall', 'prep'], loud: 0 },
  confetti_popper: { name: 'Confetti Popper', build: 'popper', size: 0.22, where: ['hall', 'dining', 'partya', 'partyb', 'celeb'], loud: 0.2 },
  party_room_key:  { name: 'Party Room Key', build: 'key', tint: 0x59d36b, size: 0.12, where: ['kitchen', 'prep', 'bath'], loud: 0.2 },
  tape_recorder:   { name: 'Portable Tape Recorder', build: 'recorder', size: 0.2, where: ['security', 'staff', 'archives'], loud: 0.4 },
  maintenance_key: { name: 'Maintenance Key', build: 'key', tint: 0xf1c40f, size: 0.12, where: ['mstorage', 'storage3', 'maintoffice'], loud: 0.2 },
  passage_diagram: { name: 'Secret Passage Diagram', build: 'diagram', size: 0.22, where: ['staff', 'archives', 'electrical'], loud: 0 },
  valve_wheel:     { name: 'Valve Wheel', build: 'valve', size: 0.28, where: ['boiler', 'generator', 'mstorage'], loud: 0.6 },
};

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const cyl = (r, h, m, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(r, r, h, seg), m, x, y, z);
const ball = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 14, 10), m, x, y, z);

function paper(lines, w = 256, h = 192, bg = '#efe6c8', fg = '#2b2118') {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,90,50,.35)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg; g.textAlign = 'center';
  lines.forEach(([t, size, y]) => { g.font = `bold ${size}px monospace`; g.fillText(t, w / 2, y); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

const BUILDERS = {
  key: o => glb('key', o),
  codeNote: (o, ctx) => sheet(paper([['EXIT CODE', 22, 58], [String(ctx.exitCode), 70, 142]], 192, 192, '#ffe66b', '#2a2a2a'), 0.12, 0.12),   // a yellow sticky note
  invitation: () => { const g = sheet(paper([['YOU ARE INVITED', 22, 52], ['THE REAL PARTY IS', 17, 100], ['UNDER THE BALL PIT', 20, 130], ['COME ALONE', 17, 170]], 256, 192, '#ffd3e6', '#7a1f4d'), 0.18, 0.135); return g; },
  diagram: () => sheet(paper([['PASSAGE', 22, 40], ['PLAYGROUND SE CORNER', 14, 82], ['STRIPED FLOOR PANEL', 14, 112], ['CRAWL EAST', 18, 150]], 256, 192, '#cfe1ef', '#16324a'), 0.2, 0.15),
  token: () => { const g = new THREE.Group(); const gold = mat(0xf2c230, { metalness: 0.7, roughness: 0.3 }); g.add(cyl(0.03, 0.008, gold, 0, 0.004, 0, 24)); g.add(cyl(0.02, 0.01, mat(0xc99a1a, { metalness: 0.7, roughness: 0.4 }), 0, 0.005, 0, 24)); return g; },
  motor: () => { const g = new THREE.Group(); const grey = mat(0x6b7078, { metalness: 0.5, roughness: 0.5 }), cu = mat(0xb06a3a, { metalness: 0.6, roughness: 0.4 });
    const body = cyl(0.07, 0.2, grey, 0, 0.09, 0); body.rotation.z = Math.PI / 2; g.add(body);
    const cap = cyl(0.075, 0.03, cu, 0.11, 0.09, 0); cap.rotation.z = Math.PI / 2; g.add(cap);
    const shaft = cyl(0.012, 0.1, mat(0xcfd2d6, { metalness: 0.8 }), -0.15, 0.09, 0); shaft.rotation.z = Math.PI / 2; g.add(shaft);
    g.add(box(0.26, 0.02, 0.15, mat(0x34373c), 0, 0.01, 0)); for (let i = -2; i <= 2; i++) g.add(box(0.012, 0.1, 0.16, grey, i * 0.035, 0.1, 0)); return g; },
  circuit: () => { const g = new THREE.Group(); g.add(box(0.2, 0.012, 0.14, mat(0x1d6b3a), 0, 0.006, 0));
    for (const [x, z, s] of [[-0.05, -0.02, 0.05], [0.04, 0.02, 0.035], [0.06, -0.04, 0.03]]) g.add(box(s, 0.012, s, mat(0x111111), x, 0.018, z));
    for (let i = 0; i < 6; i++) g.add(box(0.008, 0.004, 0.02, mat(0xd8b24a, { metalness: 0.7 }), -0.08 + i * 0.03, 0.014, 0.06));
    g.add(cyl(0.012, 0.03, mat(0x2a63c8), -0.07, 0.02, 0.01)); return g; },
  crank: () => { const g = new THREE.Group(); const steel = mat(0x8a8e94, { metalness: 0.6, roughness: 0.4 });
    g.add(cyl(0.012, 0.3, steel, 0, 0.15, 0)); const arm = cyl(0.012, 0.18, steel, 0.09, 0.3, 0); arm.rotation.z = Math.PI / 2; g.add(arm);
    const grip = cyl(0.022, 0.12, mat(0xc0392b), 0.18, 0.36, 0); g.add(grip); g.children[0].position.y = 0.15; return g; },
  zapGrip: () => { const g = new THREE.Group(); const pink = mat(0xff5fa8); g.add(box(0.05, 0.14, 0.07, pink, 0, 0.07, 0)); g.add(box(0.04, 0.03, 0.16, mat(0xffffff), 0, 0.15, 0.03)); g.add(box(0.012, 0.04, 0.02, mat(0xffd23c), 0, 0.1, 0.045)); return g; },
  zapCoil: () => { const g = new THREE.Group(); const cu = mat(0xc27a3c, { metalness: 0.7, roughness: 0.35 }); g.add(cyl(0.02, 0.14, mat(0x444a52), 0, 0.07, 0));
    for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 18), cu); t.rotation.x = Math.PI / 2; t.position.y = 0.02 + i * 0.02; g.add(t); } return g; },
  zapEmitter: () => { const g = new THREE.Group(); g.add(cyl(0.025, 0.1, mat(0x3b7ddd), 0, 0.05, 0)); const cone = mesh(new THREE.ConeGeometry(0.05, 0.1, 14), mat(0xffd23c, { emissive: 0x553300 }), 0, 0.15, 0); g.add(cone);
    g.add(ball(0.022, mat(0xff4fd8, { emissive: 0x802070 }), 0, 0.21, 0)); return g; },
  zapper: () => { const g = new THREE.Group(); const pink = mat(0xff5fa8), blue = mat(0x3b7ddd), cu = mat(0xc27a3c, { metalness: 0.7, roughness: 0.35 });
    g.add(box(0.05, 0.14, 0.07, pink, 0, 0.07, 0)); g.add(box(0.04, 0.05, 0.2, mat(0xffffff), 0, 0.165, 0.03));
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 16), cu); t.position.set(0, 0.165, 0.14 + i * 0.025); g.add(t); }
    const cone = mesh(new THREE.ConeGeometry(0.045, 0.09, 14), mat(0xffd23c, { emissive: 0x553300 }), 0, 0.165, 0.27); cone.rotation.x = Math.PI / 2; g.add(cone);
    g.add(ball(0.02, mat(0xff4fd8, { emissive: 0x802070 }), 0, 0.165, 0.33)); g.add(cyl(0.015, 0.05, blue, 0, 0.19, -0.04)); return g; },
  battery: () => { const g = new THREE.Group(); g.add(cyl(0.025, 0.09, mat(0xf1c40f), 0, 0.045, 0)); g.add(cyl(0.025, 0.03, mat(0x222222), 0, 0.075, 0)); g.add(cyl(0.01, 0.01, mat(0xcccccc, { metalness: 0.8 }), 0, 0.095, 0)); return g; },
  turningHandle: () => { const g = new THREE.Group(); const brass = mat(0xb59a4a, { metalness: 0.6, roughness: 0.4 });
    g.add(cyl(0.015, 0.1, brass, 0, 0.05, 0)); const bar = cyl(0.013, 0.2, brass, 0, 0.11, 0); bar.rotation.z = Math.PI / 2; g.add(bar);
    for (const sx of [-1, 1]) g.add(ball(0.025, mat(0x9c2f2f), sx * 0.1, 0.11, 0)); g.add(cyl(0.035, 0.012, brass, 0, 0.006, 0)); return g; },
  plush: () => { const g = new THREE.Group(); const fur = mat(0xf0e6d8, { roughness: 0.95, metalness: 0 });
    const body = ball(0.11, fur, 0, 0.12, 0); body.scale.set(1, 1.15, 0.9); g.add(body); const head = ball(0.1, fur, 0, 0.3, 0); g.add(head);
    for (const sx of [-1, 1]) { g.add(ball(0.035, fur, sx * 0.085, 0.38, 0)); g.add(ball(0.012, mat(0x111111), sx * 0.04, 0.32, 0.092)); g.add(ball(0.022, mat(0xff9ab8, { roughness: 1 }), sx * 0.065, 0.285, 0.085)); g.add(cyl(0.03, 0.12, fur, sx * 0.13, 0.12, 0.02)); g.add(cyl(0.03, 0.1, fur, sx * 0.05, 0.03, 0.02)); }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 16, Math.PI), mat(0xc0201c)); smile.position.set(0, 0.28, 0.095); smile.rotation.z = Math.PI; g.add(smile);
    g.add(mesh(new THREE.ConeGeometry(0.035, 0.08, 12), mat(0xff5fa8), 0, 0.42, 0)); return g; },
  musicBox: () => { const g = new THREE.Group(); g.add(box(0.15, 0.08, 0.1, mat(0xe86ba5), 0, 0.04, 0)); g.add(box(0.155, 0.02, 0.105, mat(0xffd23c), 0, 0.09, 0));
    const crank = cyl(0.004, 0.05, mat(0xcccccc, { metalness: 0.8 }), 0.09, 0.05, 0); crank.rotation.z = Math.PI / 2; g.add(crank); g.add(ball(0.012, mat(0xc0392b), 0.12, 0.05, 0)); g.add(box(0.15, 0.01, 0.012, mat(0xffffff), 0, 0.045, 0.051)); return g; },
  popper: () => { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 16), mat(0xe74c3c), 0, 0.08, 0)); g.add(cyl(0.02, 0.07, mat(0xf1c40f), 0, 0.19, 0));
    for (const [c, a] of [[0x3498db, 0.2], [0x2ecc71, 2.2], [0x9b59b6, 4.2]]) { const s = box(0.004, 0.06, 0.012, mat(c), Math.cos(a) * 0.02, 0.24, Math.sin(a) * 0.02); s.rotation.z = Math.cos(a) * 0.4; g.add(s); } return g; },
  recorder: () => { const g = new THREE.Group(); g.add(box(0.2, 0.05, 0.12, mat(0x303338), 0, 0.025, 0)); g.add(box(0.12, 0.004, 0.07, mat(0x8a8f96), -0.02, 0.052, 0));
    for (const sx of [-1, 1]) { const r = cyl(0.018, 0.006, mat(0xe8e8e8), sx * 0.04 - 0.02, 0.057, 0); g.add(r); }
    for (let i = 0; i < 4; i++) g.add(box(0.016, 0.008, 0.02, mat(i === 0 ? 0xd32f2f : 0xbbbbbb), 0.06 + (i % 2) * 0.02, 0.054, -0.03 + Math.floor(i / 2) * 0.03)); return g; },
  valve: () => { const g = new THREE.Group(); const red = mat(0xb02a24, { metalness: 0.5, roughness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 10, 28), red); ring.rotation.x = Math.PI / 2; ring.position.y = 0.014; g.add(ring);
    g.add(cyl(0.025, 0.03, red, 0, 0.015, 0)); for (let i = 0; i < 3; i++) { const s = box(0.24, 0.012, 0.014, red, 0, 0.014, 0); s.rotation.y = i * Math.PI / 3; g.add(s); } return g; },
};

function sheet(tex, w, h) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.rotation.x = -Math.PI / 2; p.position.y = 0.004; g.add(p);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(0xd9cfae)); back.rotation.x = Math.PI / 2; back.position.y = 0.002; g.add(back);
  return g;
}
function glb(name, o) {
  if (!hasModel(name)) return box(0.1, 0.03, 0.05, mat(0x888888), 0, 0.015, 0);
  const g = cloneModel(name);
  g.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); if (o.tint) { m.material.color.multiply(new THREE.Color(o.tint)); } } });
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}

// Builds the mesh for an item definition: normalised so the longest side equals def.size, resting on y = 0 at the centre.
export function buildItem(id, ctx) {
  const d = ITEMS[id];
  let obj;
  if (d.build.startsWith('glb:')) obj = glb(d.build.slice(4), d);
  else obj = BUILDERS[d.build](d, ctx);
  const root = new THREE.Group(); root.add(obj);
  const bb = new THREE.Box3().setFromObject(root), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  const k = d.size / Math.max(size.x, size.y, size.z);
  obj.scale.multiplyScalar(k); obj.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
  root.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return root;
}

// Small things are scaled up a little so they can be found on dark floors.
for (const d of Object.values(ITEMS)) if (d.size < 0.25) d.size *= 1.5;
