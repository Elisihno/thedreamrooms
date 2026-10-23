import * as THREE from '../vendor/three.module.min.js';

// Every pick-up item is built here once and used twice: lying on a shelf or floor in the house,
// and held in the player's hand. Each model points along +x (a tool's business end toward +x),
// rests on y = 0, and is centred on x and z.

const matCache = new Map();
const phong = (color, shininess = 30, extra = {}) => {
  const key = color + ':' + shininess + ':' + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshPhongMaterial({ color, shininess, specular: 0x555555, ...extra }));
  return matCache.get(key);
};

const brass = () => phong(0xc9a54a, 80);
const steel = () => phong(0xaeb4b9, 100);
const darkSteel = () => phong(0x23292e, 60);
const wood = () => phong(0x6b4426, 12);
const red = () => phong(0xc0321f, 50);

function part(group, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylX = (r, len, seg = 14) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return g; };

const builders = {
  key() {
    const g = new THREE.Group();
    part(g, new THREE.TorusGeometry(0.03, 0.008, 8, 18), brass(), -0.085, 0.008, 0, Math.PI / 2);   // the bow
    part(g, cylX(0.006, 0.15), brass(), 0.03, 0.008, 0);                                              // the shaft
    part(g, box(0.02, 0.006, 0.026), brass(), 0.095, 0.008, 0.012);                                   // the bit
    part(g, box(0.012, 0.006, 0.02), brass(), 0.075, 0.008, 0.012);
    part(g, box(0.05, 0.003, 0.03), red(), -0.085, 0.003, 0.0, 0, 0.3);                              // a red paper tag, so it can be seen
    return g;
  },

  cutters() {   // long-handled bolt cutters, jaws toward +x
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      part(g, cylX(0.011, 0.5), red(), -0.04, 0.02, s * 0.034, 0, s * 0.05);                         // handles, closing toward the head
      part(g, cylX(0.014, 0.16), darkSteel(), -0.24, 0.02, s * 0.044, 0, s * 0.05);                  // rubber grips
      part(g, box(0.1, 0.03, 0.014), steel(), 0.27, 0.02, s * 0.018, 0, -s * 0.12);                  // jaws
    }
    part(g, box(0.07, 0.045, 0.07), darkSteel(), 0.2, 0.02, 0);                                       // the head
    return g;
  },

  cleaver() {
    const g = new THREE.Group();
    part(g, box(0.2, 0.005, 0.115), phong(0xa9afb3, 90), 0.1, 0.012, 0);                              // the blade
    part(g, box(0.2, 0.006, 0.014), phong(0xd6dadd, 120), 0.1, 0.012, -0.05);                         // bright edge
    part(g, box(0.014, 0.012, 0.115), steel(), 0.0, 0.012, 0);
    part(g, box(0.12, 0.022, 0.03), phong(0x3a2416, 15), -0.07, 0.013, 0);                            // the handle
    for (const x of [-0.1, -0.06, -0.03]) part(g, new THREE.SphereGeometry(0.005, 6, 5), brass(), x, 0.025, 0);
    part(g, new THREE.CircleGeometry(0.012, 10), darkSteel(), 0.17, 0.0151, 0.03, -Math.PI / 2);      // hanging hole
    for (let i = 0; i < 4; i++) part(g, new THREE.CircleGeometry(0.008 + i * 0.002, 8), phong(0x6d1410, 5), 0.06 + i * 0.03, 0.0152, -0.02 + (i % 2) * 0.04, -Math.PI / 2);   // dried blood
    return g;
  },

  peach() {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.045, 18, 14);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {   // yellow on top, blushing red toward one side
      const y = pos.getY(i) / 0.045, x = pos.getX(i) / 0.045;
      c.setRGB(0.96, 0.62 - 0.22 * Math.max(0, x) - 0.1 * (1 - y), 0.28 - 0.1 * Math.max(0, x));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = part(g, geo, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 8 }), 0, 0.042, 0);
    m.scale.set(1, 0.94, 1);
    part(g, box(0.004, 0.012, 0.004), phong(0x4a3a1c), 0.0, 0.088, 0);                                // stem
    part(g, new THREE.CircleGeometry(0.02, 8), phong(0x5e8a2e, 5, { side: THREE.DoubleSide }), 0.02, 0.09, 0.0, -Math.PI / 2.6);   // leaf
    return g;
  },

  shotgun() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 0.036;
    g.add(inner);
    part(inner, cylX(0.0125, 0.62), darkSteel(), 0.3, 0.025, 0);                                      // barrel
    part(inner, cylX(0.0105, 0.46), darkSteel(), 0.22, -0.006, 0);                                    // magazine tube
    part(inner, cylX(0.0135, 0.02), steel(), 0.46, -0.006, 0);                                        // tube cap
    part(inner, box(0.22, 0.06, 0.042), phong(0x2d3338, 30), -0.04, 0.008, 0);                        // receiver
    part(inner, cylX(0.024, 0.17), wood(), 0.22, -0.026, 0);                                          // pump
    for (let k = 0; k < 5; k++) part(inner, cylX(0.0255, 0.006), phong(0x2a1a10), 0.165 + k * 0.026, -0.026, 0);
    part(inner, box(0.34, 0.06, 0.034), wood(), -0.3, -0.004, 0, 0, 0, -0.07);                        // stock
    part(inner, box(0.16, 0.075, 0.034), wood(), -0.5, -0.02, 0, 0, 0, -0.16);
    part(inner, box(0.014, 0.1, 0.04), phong(0x151515), -0.585, -0.03, 0, 0, 0, -0.16);              // butt pad
    const guard = part(inner, new THREE.TorusGeometry(0.02, 0.003, 6, 14, Math.PI), darkSteel(), -0.08, -0.03, 0, 0, 0, Math.PI);
    guard.name = 'guard';
    // the muzzle flash, shown only in the hand when it fires
    const glow = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide };
    const flash = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ ...glow, color: 0xfff0b8, opacity: 0.95 }));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 14, 1, true), new THREE.MeshBasicMaterial({ ...glow, color: 0xffd27a, opacity: 0.75 }));
    cone.rotation.z = -Math.PI / 2; cone.position.x = 0.13;
    core.renderOrder = cone.renderOrder = 10;
    flash.add(core, cone);
    flash.position.set(0.64, 0.025, 0);
    flash.visible = false;
    inner.add(flash);
    g.userData.flash = flash;
    return g;
  },

  shells() {
    const g = new THREE.Group();
    for (const z of [-0.026, 0, 0.026]) {
      part(g, cylX(0.011, 0.07), red(), 0.012, 0.011, z);
      part(g, cylX(0.0115, 0.022), brass(), -0.036, 0.011, z);
    }
    return g;
  },

  battery() {
    const g = new THREE.Group();
    part(g, box(0.26, 0.17, 0.15), darkSteel(), 0, 0.085, 0);
    part(g, box(0.264, 0.03, 0.154), phong(0x3a5aa0, 40), 0, 0.17, 0);
    part(g, box(0.045, 0.035, 0.045), brass(), -0.07, 0.2, 0);
    part(g, box(0.045, 0.035, 0.045), brass(), 0.07, 0.2, 0);
    part(g, box(0.08, 0.002, 0.05), phong(0xe9e2c4), 0, 0.1, 0.0755);
    return g;
  },

  gas() {
    const g = new THREE.Group();
    part(g, box(0.28, 0.32, 0.12), red(), 0, 0.16, 0);
    part(g, box(0.284, 0.03, 0.124), phong(0x8a1c10), 0, 0.2, 0);
    part(g, box(0.1, 0.04, 0.02), red(), 0.05, 0.34, 0);                                              // handle
    part(g, new THREE.CylinderGeometry(0.014, 0.018, 0.07, 10), darkSteel(), -0.09, 0.355, 0, 0, 0, 0.5);   // spout
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), phong(0xd9c23a), -0.115, 0.39, 0, 0, 0, 0.5);
    return g;
  },

  jar() {   // a jar of preserves; drop it and it smashes
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.048, 0.048, 0.14, 16), phong(0xd69a2a, 100, { transparent: true, opacity: 0.62 }), 0, 0.07, 0);
    part(g, new THREE.CylinderGeometry(0.043, 0.043, 0.11, 14), phong(0xb44a1a, 30), 0, 0.058, 0);     // the fruit inside
    part(g, new THREE.CylinderGeometry(0.0505, 0.0505, 0.018, 16), steel(), 0, 0.149, 0);
    part(g, box(0.001, 0.05, 0.05), phong(0xe9dfc4), 0.0485, 0.07, 0);                                 // label
    return g;
  },

  flashlight() {
    const g = new THREE.Group();
    part(g, cylX(0.02, 0.15), phong(0x3a4047, 40), -0.02, 0.02, 0);
    part(g, cylX(0.03, 0.05), steel(), 0.085, 0.02, 0);
    part(g, cylX(0.026, 0.006), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }), 0.112, 0.02, 0);
    part(g, box(0.02, 0.008, 0.016), red(), -0.03, 0.043, 0);
    return g;
  },

  postcard(extra = {}) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ map: extra.texture ?? null, color: 0xdddddd, side: THREE.DoubleSide });
    const p = part(g, new THREE.PlaneGeometry(0.15, 0.103), m, 0, 0.003, 0, -Math.PI / 2);
    p.rotation.z = 0;
    return g;
  },
};

export function buildItem(type, extra) {
  return builders[type](extra);
}

export const ITEM_NAMES = {
  key: 'key', cutters: 'bolt cutters', cleaver: 'meat cleaver', peach: 'peach', shotgun: 'shotgun', shells: 'shotgun shells',
  battery: 'truck battery', gas: 'gas can', jar: 'jar of preserves', flashlight: 'flashlight', postcard: 'postcard',
};
