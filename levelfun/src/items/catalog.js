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
  exit_key:        { name: 'Exit Key', main: 1, build: 'key', tint: 0xd94b3a, size: 0.12, where: ['dining', 'reception', 'kitchen', 'prep'], tool: true, loud: 0.2 },
  wire_cutters:    { name: 'Wire Cutters', main: 1, build: 'glb:wire_cutters', size: 0.24, where: ['mstorage', 'electrical', 'supply', 'storage3'], tool: true, loud: 0.3 },
  exit_code_note:  { name: 'Exit Code Note', main: 1, build: 'codeNote', size: 0.18, reward: 'find', hold: { rot: [1.35, 0, 0] }, loud: 0 },
  exit_fuse:       { name: 'Exit Fuse', main: 1, build: 'glb:fuse', tint: 0x66c6ff, size: 0.12, where: ['security', 'bath', 'mstorage', 'storage2'], tool: true, loud: 0.1 },
  screwdriver:     { name: 'Screwdriver', main: 1, build: 'glb:screwdriver', size: 0.25, reward: 'pop', tool: true, loud: 0.2 },
  elevator_motor:  { name: 'Elevator Motor', main: 1, build: 'motor', size: 0.3, where: ['generator', 'boiler', 'mstorage', 'storage3'], hold: { rot: [0, 1.5708, 0] }, loud: 0.8 },
  elevator_circuit:{ name: 'Elevator Circuit', main: 1, build: 'circuit', size: 0.2, reward: 'dash', hold: { rot: [1.0, 0, 0] }, loud: 0.2 },
  elevator_key:    { name: 'Elevator Key', main: 1, build: 'key', tint: 0x4aa3ff, size: 0.12, where: ['staff', 'archives', 'maintoffice', 'birthday'], tool: true, loud: 0.2 },
  generator_handle:{ name: 'Generator Handle', main: 1, build: 'crank', size: 0.35, where: ['electrical', 'boiler', 'mstorage', 'bhall'], hold: { rot: [-1.4, 0, 0] }, loud: 0.6 },
  power_fuse:      { name: 'Power Fuse', main: 1, build: 'glb:fuse', tint: 0xffa43a, size: 0.14, where: ['staff', 'archives', 'storage3', 'service'], tool: true, loud: 0.1 },
  token:           { name: 'Arcade Token', main: 1, build: 'token', size: 0.06, fixed: { level: '2', x: 54.0, z: 1.05, y: 0.96 }, hold: { rot: [1.2, 0, 0] }, loud: 0.05 },
  zap_a:           { name: 'Party Stun Gun Grip', main: 1, build: 'zapGrip', size: 0.12, where: ['reception', 'partya', 'partyb'], hold: { rot: [0.1, 3.1416, 0] }, loud: 0.3 },
  zap_b:           { name: 'Party Stun Gun Body', main: 1, build: 'zapBody', size: 0.146, where: ['kitchen', 'prep', 'supply'], hold: { rot: [0.1, 3.1416, 0] }, loud: 0.3 },
  zap_c:           { name: 'Party Stun Gun Probe Head', main: 1, build: 'zapHead', size: 0.12, where: ['storage3', 'archives', 'celeb'], hold: { rot: [0.1, 3.1416, 0] }, loud: 0.3 },
  zapper:          { name: 'Party Stun Gun', build: 'zapper', size: 0.28, hidden: true, hold: { rot: [0.1, 3.1416, 0] }, loud: 0.3 },
  battery:         { name: 'Battery', build: 'battery', size: 0.09, count: 3, compartment: ['party', 'maint'], where: ['bath', 'security', 'storage2', 'service', 'electrical', 'supply'], hold: { rot: [0.25, 0, 0] }, loud: 0.1 },
  // ---- additional items ----
  needle:          { name: 'Balloon Popper', build: 'glb:needle', size: 0.2, where: ['dining', 'hall', 'partya', 'partyb'], tool: true, loud: 0.1 },
  turning_handle:  { name: 'Turning Handle', build: 'turningHandle', size: 0.22, where: ['prep', 'kitchen', 'reception', 'supply'], hold: { rot: [-1.4, 0, 0] }, loud: 0.4 },
  plush:           { name: 'Partygoer Plushie', build: 'glb:plush', size: 0.34, count: 2, where: ['birthday', 'celeb', 'archives', 'playground', 'landing'], hold: { rot: [0, 0, 0] }, loud: 0.05, },
  music_box:       { name: 'Birthday Music Box', build: 'musicBox', size: 0.16, where: ['partyb', 'partya', 'birthday'], hold: { rot: [0.5, 0.5, 0] }, loud: 0.5 },
  whistle:         { name: 'Party Whistle', build: 'glb:whistle', size: 0.1, where: ['hall', 'dining', 'playground'], tool: true, loud: 0.3 },
  windup_toy:      { name: 'Wind-Up Toy', build: 'glb:windup_robot', size: 0.2, where: ['partyb', 'playground', 'ballpit'], hold: { rot: [0, 0, 0] }, loud: 0.3 },
  invitation:      { name: 'Birthday Invitation', build: 'invitation', size: 0.2, where: ['reception', 'hall', 'prep'], hold: { rot: [1.35, 0, 0] }, loud: 0 },
  confetti_popper: { name: 'Confetti Popper', build: 'popper', size: 0.22, where: ['hall', 'dining', 'partya', 'partyb', 'celeb'], hold: { rot: [-1.1, 0, 0] }, loud: 0.2 },
  party_room_key:  { name: 'Party Room Key', build: 'key', tint: 0x59d36b, size: 0.12, where: ['kitchen', 'prep', 'bath'], tool: true, loud: 0.2 },
  tape_recorder:   { name: 'Portable Tape Recorder', build: 'recorder', size: 0.2, where: ['security', 'staff', 'archives'], hold: { rot: [1.0, 0, 0] }, loud: 0.4 },
  maintenance_key: { name: 'Maintenance Key', build: 'key', tint: 0xf1c40f, size: 0.12, where: ['mstorage', 'storage3', 'maintoffice'], tool: true, loud: 0.2 },
  passage_diagram: { name: 'Secret Passage Diagram', build: 'diagram', size: 0.22, where: ['staff', 'archives', 'electrical'], hold: { rot: [1.35, 0, 0] }, loud: 0 },
  valve_wheel:     { name: 'Valve Wheel', build: 'valve', size: 0.28, where: ['boiler', 'generator', 'mstorage'], hold: { rot: [1.3, 0, 0] }, loud: 0.6 },
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


// The Party Zapper: a stun gun in party colours. Built in parts (grip, body, probe head) so the three pieces found around the
// building fit together on the assembly bench. Everything points along +z; y is up.
const ZC = { pink: 0xff3d9a, purple: 0x7b3fe4, teal: 0x19c5b8, yellow: 0xffd23c, orange: 0xff9a1f, dark: 0x1d1530, steel: 0xdfe4ea };
function emblemTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#19c5b8'; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill(); g.lineWidth = 6; g.strokeStyle = '#7b3fe4'; g.stroke();
  g.fillStyle = '#ffd23c'; g.strokeStyle = '#1d1530'; g.lineWidth = 4; g.beginPath(); [[74, 18], [40, 72], [60, 72], [48, 110], [90, 54], [68, 54], [84, 18]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function zapParts(which) {
  const g = new THREE.Group(), m = (c, o = {}) => mat(c, { roughness: 0.45, metalness: 0.05, ...o });
  const bars = (x, y, z, n, vertical, c) => { for (let i = 0; i < n; i++) { const b = box(vertical ? 0.0025 : 0.0025, vertical ? 0.026 : 0.0035, vertical ? 0.0035 : 0.02, m(c), x, y + (vertical ? 0 : (i - (n - 1) / 2) * 0.012), z + (vertical ? (i - (n - 1) / 2) * 0.014 : 0)); g.add(b); } };
  if (which.includes('body')) {
    g.add(box(0.05, 0.06, 0.1, m(ZC.pink), 0, 0.135, 0.02));
    g.add(box(0.05, 0.06, 0.03, m(ZC.purple), 0, 0.135, -0.045));            // rear cap
    for (const s of [-1, 1]) { g.add(box(0.0015, 0.04, 0.07, m(ZC.yellow), s * 0.0258, 0.135, 0.02)); bars(s * 0.0268, 0.135, 0.02, 4, true, ZC.dark); }
    g.add(box(0.02, 0.006, 0.05, m(ZC.teal), 0, 0.168, 0.02));                // top sight stripe
  }
  if (which.includes('head')) {
    g.add(box(0.054, 0.066, 0.05, m(ZC.purple), 0, 0.135, 0.095));
    for (const s of [-1, 1]) { g.add(box(0.0015, 0.05, 0.035, m(ZC.teal), s * 0.0278, 0.135, 0.095)); bars(s * 0.0288, 0.135, 0.095, 4, false, ZC.dark); }
    for (const y of [-1, 1]) {   // the two probes: steel rods with bright tips
      const rod = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 10), m(ZC.steel, { metalness: 0.7, roughness: 0.3 }), 0, 0.135 + y * 0.017, 0.145); rod.rotation.x = Math.PI / 2; g.add(rod);
      const tip = mesh(new THREE.ConeGeometry(0.0045, 0.014, 10), m(ZC.orange, { emissive: 0x552200 }), 0, 0.135 + y * 0.017, 0.177); tip.rotation.x = Math.PI / 2; g.add(tip);
    }
  }
  if (which.includes('grip')) {
    const grip = box(0.046, 0.11, 0.05, m(ZC.orange), 0, 0.055, -0.03); grip.rotation.x = 0.14; g.add(grip);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 8, 18), m(ZC.dark)); ring.rotation.y = Math.PI / 2; ring.position.set(0, 0.098, 0.028); g.add(ring);
    g.add(box(0.008, 0.026, 0.006, m(ZC.yellow), 0, 0.098, 0.018));            // trigger
    const em = emblemTexture();
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshStandardMaterial({ map: em, roughness: 0.5 })); p.position.set(s * 0.0238, 0.055, -0.028); p.rotation.y = s * Math.PI / 2; g.add(p); }
  }
  return g;
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
  zapGrip: () => zapParts(['grip']),
  zapBody: () => zapParts(['body']),
  zapHead: () => zapParts(['head']),
  zapper: () => zapParts(['grip', 'body', 'head']),
  battery: () => { const g = new THREE.Group(); g.add(cyl(0.025, 0.075, mat(0xf1c40f), 0, 0.0375, 0)); g.add(cyl(0.0262, 0.02, mat(0x222222), 0, 0.066, 0)); g.add(cyl(0.0262, 0.008, mat(0x222222), 0, 0.012, 0)); g.add(cyl(0.011, 0.012, mat(0xcccccc, { metalness: 0.8 }), 0, 0.081, 0)); g.add(box(0.012, 0.03, 0.0015, mat(0x222222), 0, 0.04, 0.0262)); return g; },
  turningHandle: () => { const g = new THREE.Group(); const iron = mat(0x24262b, { metalness: 0.7, roughness: 0.4 }), dark = mat(0x15161a, { metalness: 0.6, roughness: 0.55 }), worn = mat(0x6a5d3c, { metalness: 0.8, roughness: 0.35 });
    g.add(cyl(0.045, 0.012, dark, 0, 0.006, 0, 24));                                              // base flange
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; g.add(cyl(0.0065, 0.008, worn, Math.cos(a) * 0.033, 0.016, Math.sin(a) * 0.033, 8)); }   // bolts
    g.add(cyl(0.017, 0.07, iron, 0, 0.047, 0, 14)); g.add(cyl(0.024, 0.014, dark, 0, 0.088, 0, 14));   // shaft and collar
    const bar = cyl(0.011, 0.2, iron, 0, 0.108, 0, 12); bar.rotation.z = Math.PI / 2; g.add(bar);       // crank bar
    for (const sx of [-1, 1]) { g.add(ball(0.027, dark, sx * 0.1, 0.108, 0)); g.add(cyl(0.012, 0.012, worn, sx * 0.075, 0.108, 0, 10)).rotation.z = Math.PI / 2; }
    g.add(ball(0.014, worn, 0, 0.125, 0)); return g; },
  plush: () => { const g = new THREE.Group(); const fur = mat(0xf0e6d8, { roughness: 0.95, metalness: 0 });
    const body = ball(0.11, fur, 0, 0.12, 0); body.scale.set(1, 1.15, 0.9); g.add(body); const head = ball(0.1, fur, 0, 0.3, 0); g.add(head);
    for (const sx of [-1, 1]) { g.add(ball(0.035, fur, sx * 0.085, 0.38, 0)); g.add(ball(0.012, mat(0x111111), sx * 0.04, 0.32, 0.092)); g.add(ball(0.022, mat(0xff9ab8, { roughness: 1 }), sx * 0.065, 0.285, 0.085)); g.add(cyl(0.03, 0.12, fur, sx * 0.13, 0.12, 0.02)); g.add(cyl(0.03, 0.1, fur, sx * 0.05, 0.03, 0.02)); }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 16, Math.PI), mat(0xc0201c)); smile.position.set(0, 0.28, 0.095); smile.rotation.z = Math.PI; g.add(smile);
    g.add(mesh(new THREE.ConeGeometry(0.035, 0.08, 12), mat(0xff5fa8), 0, 0.42, 0)); return g; },
  musicBox: () => { const g = new THREE.Group(); g.add(box(0.15, 0.08, 0.1, mat(0xe86ba5), 0, 0.04, 0)); g.add(box(0.155, 0.02, 0.105, mat(0xffd23c), 0, 0.09, 0));
    const crank = cyl(0.004, 0.05, mat(0xcccccc, { metalness: 0.8 }), 0.09, 0.05, 0); crank.rotation.z = Math.PI / 2; g.add(crank); g.add(ball(0.012, mat(0xc0392b), 0.12, 0.05, 0)); g.add(box(0.15, 0.01, 0.012, mat(0xffffff), 0, 0.045, 0.051)); return g; },
  popper: () => {   // a party popper: striped paper cone, gold rim, a burst of ribbons and confetti from the wide end, a pull ring at the point
    const g = new THREE.Group(), cols = [0xff3d8b, 0xffd23c, 0x2fc4ff, 0x7be04f, 0xff8a1f], H = 0.2, r0 = 0.012, r1 = 0.052, n = 5;
    for (let i = 0; i < n; i++) {
      const ra = r0 + (r1 - r0) * i / n, rb = r0 + (r1 - r0) * (i + 1) / n;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, H / n + 0.0005, 18, 1, true), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7, side: THREE.DoubleSide }));
      seg.position.y = H / n * (i + 0.5); g.add(seg);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.0045, 8, 22), mat(0xf2c230, { metalness: 0.7, roughness: 0.35 })); rim.rotation.x = Math.PI / 2; rim.position.y = H; g.add(rim);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 14), mat(0xe8e8ee, { metalness: 0.8, roughness: 0.3 })); ring.position.set(0, -0.012, 0); g.add(ring);
    for (let i = 0; i < 7; i++) {   // ribbons curling out of the opening
      const a = i / 7 * Math.PI * 2, rb = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07 + (i % 3) * 0.015, 0.0015), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.6, side: THREE.DoubleSide }));
      rb.position.set(Math.cos(a) * 0.03, H + 0.04, Math.sin(a) * 0.03); rb.rotation.set(Math.sin(a) * 0.55, a, -Math.cos(a) * 0.5 + 0.3 * (i % 2)); g.add(rb);
    }
    for (let i = 0; i < 9; i++) {   // loose confetti
      const a = i * 2.4, c = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.0015, 0.008), new THREE.MeshStandardMaterial({ color: cols[(i + 2) % cols.length], roughness: 0.6 }));
      c.position.set(Math.cos(a) * (0.02 + 0.012 * (i % 4)), H + 0.05 + 0.02 * (i % 5), Math.sin(a) * (0.02 + 0.012 * (i % 3))); c.rotation.set(a, a * 1.7, a * 0.6); g.add(c);
    }
    return g; },
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
