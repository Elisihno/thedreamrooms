import * as THREE from '../vendor/three.module.min.js';
import { levelY } from './world.js';

export const ENTITY_NAME = 'The Hillbilly';

// ---- the body ---------------------------------------------------------------------------
// A huge man in sweat-stained bib overalls and a bloody butcher's apron, a straw hat on top of a
// burlap sack stitched into a grin, and a chainsaw in his right hand. Local forward is +z.
function apronTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#cfc7b0'; g.fillRect(0, 0, 128, 192);
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(80,60,30,${rnd() * 0.18})`; g.fillRect(rnd() * 128, rnd() * 192, 2 + rnd() * 10, 1 + rnd() * 6); }
  for (let i = 0; i < 14; i++) {   // old blood, going brown, and some fresh
    const x = rnd() * 128, y = 30 + rnd() * 160, r = 6 + rnd() * 22, fresh = rnd() < 0.35;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, fresh ? 'rgba(140,6,6,.95)' : 'rgba(92,24,14,.85)'); grd.addColorStop(1, 'rgba(92,24,14,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(120,8,8,.8)'; g.lineWidth = 2 + rnd() * 3; const x = rnd() * 128, y = 120 + rnd() * 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + 15 + rnd() * 30); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const FACE_RAD = { x: 0.115, y: 0.17, z: 0.13 };   // the mask is an egg this big around the head

// Stitched, patched, filthy leather, with holes cut out for the eyes and a zipper mouth.
// The front of the face is at u = 0.25 of the picture. eyes: [{x, y}] in pixels.
export function leatherTexture(eyes, opts = {}) {
  const W = 1024, H = 512, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  let s = opts.seed ?? 21; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.fillStyle = opts.base ?? '#5a3c27'; g.fillRect(0, 0, W, H);
  const browns = opts.palette ?? ['#5e3f29', '#6b4a31', '#523524', '#74533a', '#4a2f1f'];
  // patches of different hides, sewn together
  const cols = 10, rows = 5, cw = W / cols, ch = H / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const jx = () => (rnd() - 0.5) * cw * 0.35, jy = () => (rnd() - 0.5) * ch * 0.35;
    const x0 = c * cw, y0 = r * ch, pts = [[x0 + jx(), y0 + jy()], [x0 + cw + jx(), y0 + jy()], [x0 + cw + jx(), y0 + ch + jy()], [x0 + jx(), y0 + ch + jy()]];
    g.fillStyle = browns[Math.floor(rnd() * browns.length)];
    g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,10,4,.85)'; g.lineWidth = 2.5; g.stroke();
    // stitches along each edge
    g.strokeStyle = 'rgba(210,190,150,.75)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4], n = Math.max(4, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9));
      for (let k = 0; k < n; k++) {
        const t0 = (k + 0.15) / n, t1 = (k + 0.65) / n;
        const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1, off = 4;
        g.beginPath();
        g.moveTo(a[0] + (b[0] - a[0]) * t0 + nx / nl * off, a[1] + (b[1] - a[1]) * t0 + ny / nl * off);
        g.lineTo(a[0] + (b[0] - a[0]) * t1 - nx / nl * off, a[1] + (b[1] - a[1]) * t1 - ny / nl * off);
        g.stroke();
      }
    }
  }
  // grain, creases, grime and blood
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,230,190'},${rnd() * 0.07})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(20,10,4,${0.15 + rnd() * 0.25})`; g.lineWidth = 1 + rnd() * 1.5; const x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 30, x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 50); g.stroke(); }
  for (let i = 0; i < 16; i++) {
    const x = 120 + rnd() * 340, y = rnd() * H, r = 8 + rnd() * 30, fresh = rnd() < 0.4;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, fresh ? 'rgba(130,8,8,.85)' : 'rgba(70,14,8,.75)'); grd.addColorStop(1, 'rgba(70,14,8,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (fresh) { g.strokeStyle = 'rgba(120,6,6,.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y + 30 + rnd() * 60); g.stroke(); }
  }
  const bump = document.createElement('canvas'); bump.width = W; bump.height = H;
  bump.getContext('2d').drawImage(cv, 0, 0);
  // the face: eye holes, and a ragged mouth held shut by a zipper
  const fx = W * 0.25, my = H * (Math.acos(-0.5) / (Math.PI * 0.9));
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (const e of eyes) { g.beginPath(); g.ellipse(e.x, e.y, 26, 19, e.x < fx ? 0.15 : -0.15, 0, 7); g.fill(); }
  g.beginPath(); g.moveTo(fx - 56, my - 6); g.lineTo(fx - 30, my - 18); g.lineTo(fx - 8, my - 8); g.lineTo(fx + 20, my - 20); g.lineTo(fx + 56, my - 6);
  g.lineTo(fx + 48, my + 14); g.lineTo(fx + 18, my + 24); g.lineTo(fx - 10, my + 16); g.lineTo(fx - 36, my + 24); g.lineTo(fx - 52, my + 12); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(25,12,6,.95)'; g.lineWidth = 5;                          // the cut edges
  for (const e of eyes) { g.beginPath(); g.ellipse(e.x, e.y, 28, 21, e.x < fx ? 0.15 : -0.15, 0, 7); g.stroke(); }
  g.fillStyle = '#b9b3a6';                                                        // zipper teeth round the mouth
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; g.fillRect(fx + Math.cos(a) * 62 - 2.5, my + 4 + Math.sin(a) * 28 - 2.5, 5, 5); }
  g.strokeStyle = 'rgba(25,12,6,.95)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(fx - 56, my - 6); g.lineTo(fx - 30, my - 18); g.lineTo(fx - 8, my - 8); g.lineTo(fx + 20, my - 20); g.lineTo(fx + 56, my - 6); g.lineTo(fx + 48, my + 14); g.lineTo(fx + 18, my + 24); g.lineTo(fx - 10, my + 16); g.lineTo(fx - 36, my + 24); g.lineTo(fx - 52, my + 12); g.closePath(); g.stroke();
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}

// Everything is placed in "rest pose world metres" (feet on the floor, facing +z) and then parented
// to a bone, so it follows the animation without caring how big the bone's own units are.
function attach(bone, obj, worldPos, worldQuat) {
  bone.updateWorldMatrix(true, false);
  const ws = new THREE.Vector3(), wq = new THREE.Quaternion();
  bone.getWorldScale(ws); bone.getWorldQuaternion(wq);
  obj.position.copy(bone.worldToLocal(worldPos.clone()));
  obj.quaternion.copy(wq.clone().invert());
  if (worldQuat) obj.quaternion.multiply(worldQuat);
  obj.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  bone.add(obj);
  return obj;
}

export const CLIPS = { idle: 'idle', walk: 'walk', search: 'search', attack: 'attack', stun: 'Stunned' };
export const HEIGHT = 2.05;   // taller than the grandpa he started as

// Pull the keyframes of the hip and spine rotations part of the way back toward the first frame (0 = no motion, 1 = as animated).
function easeTorso(clip, amount) {
  const q = new THREE.Quaternion(), base = new THREE.Quaternion();
  for (const tr of clip.tracks) {
    if (!/^(Bone_01|Spine1_02|Spine2_03)\.quaternion$/.test(tr.name)) continue;
    base.fromArray(tr.values, 0);
    for (let i = 0; i < tr.values.length; i += 4) {
      q.fromArray(tr.values, i);
      if (q.dot(base) < 0) q.set(-q.x, -q.y, -q.z, -q.w);   // the short way round
      q.copy(base).slerp(q, amount).toArray(tr.values, i);
    }
  }
  return clip;
}

export function buildHillbilly(assets) {
  const gltf = assets.grandpa;
  const model = gltf.scene;
  const holder = new THREE.Group();
  holder.add(model);
  let skinned = null;
  const bones = {};
  let redEyes = null;
  model.traverse(o => {
    if (o.isSkinnedMesh) skinned = o;
    if (o.isBone) {
      if (/^granpaHead_05/.test(o.name)) bones.head = o;
      else if (/^handR/.test(o.name)) bones.handR = o;
      else if (/^lowArmR/.test(o.name)) bones.lowArmR = o;
      else if (/^upArmR/.test(o.name)) bones.upArmR = o;
      else if (/^Bone_01/.test(o.name)) bones.hips = o;
      else if (/^Spine1/.test(o.name)) bones.spine1 = o;
      else if (/^Spine2/.test(o.name)) bones.spine2 = o;
    }
    if (o.isMesh) {
      const mn = o.material?.name ?? '';
      if (/ThugLifeGlasses|OldWoodBloody|^Shotgun$/.test(mn)) o.visible = false;   // no glasses, no walking stick, no gun
      if (/GrandpaWhiteEyes/.test(o.name)) o.visible = false;
      if (/GrandpaRedEyes/.test(o.name)) { o.visible = false; redEyes = o; }
    }
  });
  if (skinned) { skinned.frustumCulled = false; }

  // clothes a little dirtier and darker than they came
  const atlas = skinned.material;
  atlas.color = new THREE.Color(0xc2b2a2);
  atlas.emissive = new THREE.Color(0x14100c); atlas.roughness = 1; atlas.metalness = 0;   // lit like the rest of the sunlit house

  // play the idle pose once so everything can be measured
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [key, name] of Object.entries(CLIPS)) {
    let clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) continue;
    // Grandpa's swing twists his hips and spine through 60-100 degrees, which with a chainsaw in the hand reads as his whole
    // body spinning round. Ease the torso toward its starting pose so the swing stays a lunge, not a pirouette.
    if (key === 'attack') clip = easeTorso(clip.clone(), 0.38);
    // keep the body in place: only bones turn and bend, nothing walks away from the spot
    actions[key] = mixer.clipAction(clip);
  }
  actions.idle.play(); mixer.setTime(0);
  const bbox = () => { model.updateMatrixWorld(true); skinned.skeleton.update(); skinned.computeBoundingBox(); return skinned.boundingBox.clone().applyMatrix4(skinned.matrixWorld); };
  let b = bbox();
  const k = HEIGHT / (b.max.y - b.min.y);
  model.scale.multiplyScalar(k);
  b = bbox();
  model.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  b = bbox();
  const top = b.max.y;

  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const wp = bone => bone.getWorldPosition(new THREE.Vector3());
  const headPos = wp(bones.head);

  // ---- the leather mask --------------------------------------------------------------------------
  // fitted to the head's real shape: the skinned vertices that belong to the head bone
  const headIdx = skinned.skeleton.bones.indexOf(bones.head);
  const geo = skinned.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const hb = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    let best = 0, bw = 0;
    for (let k2 = 0; k2 < 4; k2++) if (sw.getComponent(i, k2) > bw) { bw = sw.getComponent(i, k2); best = si.getComponent(i, k2); }
    if (best !== headIdx || bw < 0.6) continue;
    skinned.getVertexPosition(i, v).applyMatrix4(skinned.matrixWorld);
    hb.expandByPoint(v);
  }
  const hc = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
  // the head runs from the chin (a hand's breadth under the head bone) to the crown
  const chinY = headPos.y - 0.09;
  FACE_RAD.x = hs.x / 2 * 1.1; FACE_RAD.y = (top - chinY) / 2 * 1.12; FACE_RAD.z = hs.z / 2 * 1.42;
  const cy = (chinY + top) / 2 + 0.012, cz = hc.z + 0.02;
  // eye holes, a little above the middle of the face and a thumb's width either side of the nose
  const yPx = yn => 512 * Math.acos(yn) / (Math.PI * 0.9);
  const eyeCols = [{ x: 1024 * 0.25 - 64, y: yPx(0.2) }, { x: 1024 * 0.25 + 64, y: yPx(0.2) }];
  const leather = leatherTexture(eyeCols);
  const maskMat = new THREE.MeshStandardMaterial({ map: leather.map, bumpMap: leather.bumpMap, bumpScale: 2.5, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide, alphaTest: 0.5 });
  const mask = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54, 0, Math.PI * 2, 0, Math.PI * 0.9), maskMat);
  shell.scale.set(FACE_RAD.x, FACE_RAD.y, FACE_RAD.z);
  const jaw = geo => {   // a face is not an egg: the jaw narrows and the brow is a little heavier
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yn = pos.getY(i), t = Math.max(0, Math.min(1, (0.15 - yn) / 1.0)), taper = 1 - 0.3 * t * t * (3 - 2 * t);
      pos.setX(i, pos.getX(i) * taper); pos.setZ(i, pos.getZ(i) * (taper + (pos.getZ(i) > 0 ? 0.04 * Math.max(0, yn) : 0)));
    }
    geo.computeVertexNormals();
  };
  jaw(shell.geometry);
  mask.add(shell);
  const leatherPlain = new THREE.MeshStandardMaterial({ color: 0x2e1d12, roughness: 0.7, side: THREE.DoubleSide });
  // a dark lining, so the holes show blackness and not the face behind them
  const liningGeo = new THREE.SphereGeometry(1, 40, 30); jaw(liningGeo);
  const lining = new THREE.Mesh(liningGeo, new THREE.MeshBasicMaterial({ color: 0x020101 }));
  lining.scale.set(FACE_RAD.x * 0.93, FACE_RAD.y * 0.95, FACE_RAD.z * 0.93);
  mask.add(lining);
  for (const sx of [-1, 1]) {   // eyes that glow
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff2410 }));
    eye.position.set(sx * 0.0425 * (FACE_RAD.x / 0.115), FACE_RAD.y * 0.2, FACE_RAD.z * 0.82);
    mask.add(eye);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ color: 0xff3a10, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(eye.position.x, eye.position.y, eye.position.z + 0.012);
    mask.add(halo);
  }
  // buckled leather straps: bands of the shell's own shape, a hair outside it
  const band = (yn, h) => {
    const f = Math.sqrt(1 - yn * yn) + 0.03;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h, 64, 1, true), leatherPlain);
    m.scale.set(FACE_RAD.x * f, 1, FACE_RAD.z * f);
    m.position.y = FACE_RAD.y * yn;
    return m;
  };
  const strapHead = band(0.58, 0.028), strapJaw = band(-0.84, 0.024);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.012), new THREE.MeshStandardMaterial({ color: 0xb8b09a, metalness: 0.8, roughness: 0.35 }));
  buckle.position.set(FACE_RAD.x * (Math.sqrt(1 - 0.58 ** 2) + 0.035), FACE_RAD.y * 0.58, FACE_RAD.z * 0.25); buckle.rotation.y = Math.PI / 2 - 0.2;
  mask.add(strapHead, strapJaw, buckle);
  const neckRope = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }));
  neckRope.rotation.x = Math.PI / 2; neckRope.position.y = -FACE_RAD.y * 0.93;
  mask.add(neckRope);
  attach(bones.head, mask, P(hc.x, cy, cz));

  // ---- the butcher's apron, hanging from his chest to his groin -----------------------------------
  // Built from the measured shape of his front (chest about 12 cm forward of the spine, belly drawing back, a gap
  // between the legs), a hand's width off the body so it never sinks into it. It is two pieces: the chest half
  // follows the spine and the lower half the hips, so it keeps clear when he leans and when his legs swing.
  const chest = wp(bones.spine2), hipP = wp(bones.hips);
  const apronMat = new THREE.MeshLambertMaterial({ map: apronTexture(), side: THREE.DoubleSide, emissive: 0x1a1612 });
  const FRONT = [[1.5, 0.150], [1.4, 0.165], [1.3, 0.175], [1.2, 0.175], [1.1, 0.155], [1.0, 0.135], [0.9, 0.125], [0.8, 0.12]];   // [height, how far forward]
  const frontAt = y => {
    for (let i = 1; i < FRONT.length; i++) if (y >= FRONT[i][0]) { const [y0, z0] = FRONT[i - 1], [y1, z1] = FRONT[i], k = (y0 - y) / (y0 - y1); return z0 + (z1 - z0) * k; }
    return FRONT[FRONT.length - 1][1];
  };
  const apronPiece = (yTop, yBottom, bone) => {
    const cols = 8, rows = Math.max(2, Math.round((yTop - yBottom) / 0.07)), pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const y = yTop + (yBottom - yTop) * r / rows, halfW = 0.19 + (yTop - y) * 0.03;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols, x = (u - 0.5) * 2 * halfW;
        pos.push(x, y, frontAt(y) - 0.06 * Math.pow(Math.abs(u - 0.5) * 2, 2));   // the edges curve back round the body
        uv.push(u, (yTop - y) / (1.5 - 0.8) * 0.9 + (1.5 - yTop) / (1.5 - 0.8) * 0.9);
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * (cols + 1) + c; idx.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.map((v, i) => (i % 2 ? 1 - v : v)), 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, apronMat);
    m.frustumCulled = false;
    attach(bone, m, P(0, 0, 0));
    return m;
  };
  apronPiece(1.5, 1.14, bones.spine2);
  apronPiece(1.15, 0.8, bones.hips);

  // ---- the chainsaw in his right hand --------------------------------------------------------------
  const saw = assets.saw.scene;
  const sawBox = new THREE.Box3().setFromObject(saw), sawLen = sawBox.max.x - sawBox.min.x;
  const sawScale = 0.95 / sawLen;
  const sawHolder = new THREE.Group();
  saw.scale.setScalar(sawScale);
  saw.position.set(-sawBox.min.x * sawScale - 0.1, -0.075, 0);          // the rear handle sits in the hand
  sawHolder.add(saw);
  const handPos = wp(bones.handR);
  const sawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, -Math.PI / 2, 0, 'YXZ'));
  attach(bones.handR, sawHolder, P(handPos.x, handPos.y - 0.02, handPos.z), sawQuat);

  const f2 = v3 => v3.toArray().map(n => +n.toFixed(3)).join(',');
  const dims = `body ${f2(b.min)} .. ${f2(b.max)} | headBox ${f2(hs)} @ ${f2(hc)} | headBone ${f2(headPos)} | chest ${f2(chest)} | hips ${f2(hipP)}`;
  return { dims, root: holder, model, mixer, actions, bones, saw: sawHolder, sawBase: sawHolder.position.clone(), mask, height: top };
}

// ---- finding the way ------------------------------------------------------------------------
class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const K = this.k, P = this.p;
    let i = K.length;
    K.push(key); P.push(pri);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (P[j] <= pri) break;
      K[i] = K[j]; P[i] = P[j]; i = j;
    }
    K[i] = key; P[i] = pri;
  }
  pop() {
    const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop(), n = K.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= lp) break;
        K[i] = K[c]; P[i] = P[c]; i = c;
      }
      K[i] = lk; P[i] = lp;
    }
    return top;
  }
}

const RES = 0.3, PAD = 0.3;   // grid cell size, and how far his big body keeps from walls

// A grid per storey (walls and furniture blocked, doors open for it), joined by the stairs.
function buildNav(house) {
  const GW = Math.ceil(house.size.w / RES), GD = Math.ceil(house.size.d / RES), G = GW * GD;
  const L = house.levels.length;
  const blocked = new Uint8Array(L * G);
  const skip = new Set([...house.roomDoors.map(d => d.col), ...house.scarecrows.map(m => m.col)]);
  const mark = (lv, x0, x1, z0, z1) => {
    const a = Math.max(0, Math.ceil(x0 / RES - 0.5)), b = Math.min(GW - 1, Math.floor(x1 / RES - 0.5));
    const c = Math.max(0, Math.ceil(z0 / RES - 0.5)), d = Math.min(GD - 1, Math.floor(z1 / RES - 0.5));
    for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) blocked[lv * G + gz * GW + gx] = 1;
  };
  for (const c of house.colliders) {
    if (skip.has(c)) continue;
    mark(c.level, c.minX - PAD, c.maxX + PAD, c.minZ - PAD, c.maxZ + PAD);
  }
  for (const st of house.stairs) for (const lv of [st.from, st.from + 1]) mark(lv, st.x0, st.x1, st.z0, st.z1);

  const cellOf = (lv, x, z) => lv * G + Math.min(GD - 1, Math.max(0, Math.floor(z / RES))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(x / RES)));
  const parts = i => { const lv = Math.floor(i / G), r = i % G; return [lv, r % GW, Math.floor(r / GW)]; };
  const centre = i => { const [lv, gx, gz] = parts(i); return { x: (gx + 0.5) * RES, z: (gz + 0.5) * RES, level: lv, y: levelY(lv) }; };
  // the nearest open cell to a spot
  function free(lv, x, z) {
    const base = cellOf(lv, x, z), [, bx, bz] = parts(base);
    for (let r = 0; r <= 10; r++) {
      let best = -1, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const gx = bx + dx, gz = bz + dz;
        if (gx < 0 || gz < 0 || gx >= GW || gz >= GD) continue;
        const i = lv * G + gz * GW + gx;
        if (!blocked[i] && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = i; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // each stair joins a spot outside its north door to a spot past its top end
  const links = new Map();
  for (const st of house.stairs) {
    const xm = (st.x0 + st.x1) / 2;
    const a = free(st.from, xm, st.z0 - 0.45), b = free(st.from + 1, xm, st.z1 + 0.45);
    if (a < 0 || b < 0) continue;
    links.set(a, { to: b, st, up: true });
    links.set(b, { to: a, st, up: false });
  }

  const gScore = new Float32Array(L * G), from = new Int32Array(L * G), closed = new Uint8Array(L * G);
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [-1, -1, 1.4142]];

  function find(sl, sx, sz, tl, tx, tz) {
    const s = free(sl, sx, sz), t = free(tl, tx, tz);
    if (s < 0 || t < 0) return null;
    const [, tgx, tgz] = parts(t);
    gScore.fill(Infinity); closed.fill(0);
    const open = new Heap();
    gScore[s] = 0; from[s] = -1;
    open.push(s, 0);
    while (open.size) {
      const n = open.pop();
      if (closed[n]) continue;
      closed[n] = 1;
      if (n === t) break;
      const [lv, gx, gz] = parts(n);
      const relax = (m, cost) => {
        const g = gScore[n] + cost;
        if (g < gScore[m]) {
          gScore[m] = g; from[m] = n;
          const [, mx, mz] = parts(m);
          open.push(m, g + Math.hypot(mx - tgx, mz - tgz) * RES);
        }
      };
      for (const [dx, dz, c] of NB) {
        const nx = gx + dx, nz = gz + dz;
        if (nx < 0 || nz < 0 || nx >= GW || nz >= GD) continue;
        if (blocked[lv * G + nz * GW + nx]) continue;
        if (dx && dz && (blocked[lv * G + gz * GW + nx] || blocked[lv * G + nz * GW + gx])) continue;
        relax(lv * G + nz * GW + nx, c * RES);
      }
      const lk = links.get(n);
      if (lk) relax(lk.to, 10);
    }
    if (!closed[t]) return null;
    const nodes = [];
    for (let n = t; n >= 0; n = from[n]) nodes.push(n);
    nodes.reverse();
    // turn the cells into waypoints, keeping only the bends; a stair becomes its ramp
    const wps = [];
    let lastDir = null;
    for (let k = 0; k < nodes.length; k++) {
      const c = centre(nodes[k]);
      if (k > 0) {
        const pc = centre(nodes[k - 1]);
        if (pc.level !== c.level) {
          const lk = links.get(nodes[k - 1]), st = lk.st, xm = (st.x0 + st.x1) / 2;
          const bot = { x: xm, z: st.z0, level: st.from, y: levelY(st.from) }, top = { x: xm, z: st.z1, level: st.from + 1, y: levelY(st.from + 1) };
          wps.push({ ...pc }, ...(lk.up ? [bot, top] : [top, bot]));
          lastDir = null;
          if (k === nodes.length - 1) wps.push(c);
          continue;
        }
        const dir = `${Math.sign(c.x - pc.x)},${Math.sign(c.z - pc.z)}`;
        if (lastDir !== null && dir !== lastDir) wps.push(pc);
        lastDir = dir;
      }
      if (k === nodes.length - 1) wps.push(c);
    }
    return wps;
  }

  // a random open spot on a storey
  function randomOn(lv, near, radius) {
    for (let i = 0; i < 60; i++) {
      const x = near ? near.x + (Math.random() * 2 - 1) * radius : Math.random() * house.size.w;
      const z = near ? near.z + (Math.random() * 2 - 1) * radius : Math.random() * house.size.d;
      if (x < 0 || z < 0 || x > house.size.w || z > house.size.d) continue;
      const g = cellOf(lv, x, z);
      if (!blocked[g]) return centre(g);
    }
    return null;
  }

  // how many cells on each storey can be walked to from a spot (for testing)
  function reach(lv, x, z) {
    const s = free(lv, x, z);
    const seen = new Uint8Array(L * G), q = [s], counts = new Array(L).fill(0);
    seen[s] = 1;
    while (q.length) {
      const n = q.pop();
      const [l, gx, gz] = parts(n);
      counts[l]++;
      const go = m => { if (!seen[m]) { seen[m] = 1; q.push(m); } };
      for (const [dx, dz] of NB) {
        const nx = gx + dx, nz = gz + dz;
        if (nx < 0 || nz < 0 || nx >= GW || nz >= GD || blocked[l * G + nz * GW + nx]) continue;
        if (dx && dz && (blocked[l * G + gz * GW + nx] || blocked[l * G + nz * GW + gx])) continue;
        go(l * G + nz * GW + nx);
      }
      const lk = links.get(n);
      if (lk) go(lk.to);
    }
    return counts;
  }
  return { find, randomOn, reach, free, centre, blocked, links };
}

// is there an unbroken line between two spots on a storey (walls and shut doors block it)?
function lineClear(colliders, level, ax, az, bx, bz) {
  for (const c of colliders) {
    if (c.level !== level) continue;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    for (const [p, d, lo, hi] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return false;
  }
  return true;
}

// ---- the Hillbilly ------------------------------------------------------------------------------
// He wanders the house with the chainsaw idling, and you can hear him from rooms away. What he
// follows is your fear: the more afraid you are, the farther he smells you, the longer he keeps
// hunting and the faster he runs. Darkness, the sight of him, loud noises and falling scarecrows
// raise the fear. Sunshine, a lit flashlight, calm and hiding lower it.
export function createHillbilly(house, assets, opts = {}) {
  const nav = buildNav(house);
  const model = buildHillbilly(assets);
  const group = model.root;
  const me = {
    group, nav,
    name: ENTITY_NAME,
    x: 0, z: 0, y: 0, level: 0, yaw: 0,
    state: 'roam',          // roam | hunt | search | stun | kill
    fear: 0,
    rpm: 0.25,              // how hard the saw is running: 0 stalled, 0.25 idle, 1 flat out (the sound follows this)
    onCaught: null, onSound: null,
  };
  let path = null, idx = 0, prev = null, segLen = 1, turning = false;
  let pause = 0, stunT = 0, searchT = 0, lose = 0, seenAgo = 99, foundT = 0, stepT = 0, losT = 0;
  let huntT = 0, sees = false, graceT = opts.grace ?? 25, walkPhase = 0, killT = 0, lean = 0, revKick = 0;
  const last = { x: 0, z: 0, level: 0 };

  function place(c) { me.x = c.x; me.z = c.z; me.level = c.level; me.y = levelY(c.level); path = null; }
  // Of a few random places to go, take one that does not make him turn right round: wherever he wanders, he should not pivot on the spot.
  function ahead(sample) {
    let best = null, bestTurn = 99;
    for (let i = 0; i < 6; i++) {
      const c = sample();
      if (!c) continue;
      const turn = c.level === me.level && Math.hypot(c.x - me.x, c.z - me.z) > 1.2 ? Math.abs(angleTo(me.yaw, Math.atan2(c.x - me.x, c.z - me.z))) : 0.5;
      if (turn < bestTurn) { best = c; bestTurn = turn; }
      if (bestTurn < 0.9) break;
    }
    return best;
  }
  function goTo(level, x, z) {
    const wps = nav.find(me.level, me.x, me.z, level, x, z);
    path = wps; idx = 0;
    prev = { x: me.x, z: me.z, y: me.y, level: me.level };
    if (wps && wps.length) segLen = Math.max(0.01, Math.hypot(wps[0].x - me.x, wps[0].z - me.z));
    return !!wps;
  }
  me.model = model; me.goTo = goTo;
  me.speedMul = 1; me.senseMul = 1;
  me.setGrace = n => { graceT = n; };
  // stand in view of the player for the title screen; returns the yaw that looks at him
  me.placeForTitle = player => {
    for (const dist of [3.4, 3.0, 2.6]) for (let a = 0; a < 24; a++) {
      const ang = a / 24 * Math.PI * 2;
      const x = player.pos.x + Math.sin(ang) * dist, z = player.pos.z + Math.cos(ang) * dist;
      const c = nav.centre(nav.free(player.level, x, z));
      if (Math.hypot(c.x - x, c.z - z) > 0.2) continue;
      if (!lineClear(house.colliders, player.level, player.pos.x, player.pos.z, c.x, c.z)) continue;
      place({ x: c.x, z: c.z, level: player.level, y: player.y });
      me._heading = me.yaw = Math.atan2(player.pos.x - c.x, player.pos.z - c.z);
      return Math.atan2(-(c.x - player.pos.x), -(c.z - player.pos.z));
    }
    return null;
  };
  me.place = place;
  me.goTo = goTo;

  // start far from the player, unless asked to start close (for testing)
  me.spawn = player => {
    let c = null;
    if (opts.near) {
      c = nav.randomOn(player.level, player.pos, opts.near);
    } else {
      for (let i = 0; i < 80 && !c; i++) {
        const lv = Math.floor(Math.random() * house.levels.length);
        const cand = nav.randomOn(lv);
        if (cand && (lv !== player.level || Math.hypot(cand.x - player.pos.x, cand.z - player.pos.z) > 14)) c = cand;
      }
    }
    if (c) place(c);
  };

  // what the player hears of the saw: how loud, from which side, and how muffled by walls and floors
  me.soundInfo = (p, yaw) => {
    const dx = me.x - p.pos.x, dz = me.z - p.pos.z, flat = Math.hypot(dx, dz);
    const same = me.level === p.level, d = flat + Math.abs(me.level - p.level) * 5;
    const clear = same && lineClear(house.colliders, me.level, me.x, me.z, p.pos.x, p.pos.z);
    const right = flat > 0.01 ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / flat : 0;
    return { vol: Math.pow(Math.max(0, 1 - d / 34), 1.4), pan: right, muffle: clear ? 0 : same ? 0.55 : 0.9 };
  };

  me.addFear = n => { me.fear = Math.max(0, Math.min(100, me.fear + n)); };
  me.investigate = (x, z, level) => {
    if (me.state === 'stun' || me.state === 'kill') return;
    last.x = x; last.z = z; last.level = level;
    me.addFear(8);
    me.state = 'hunt'; lose = 0;
    revKick = 1.2;
    goTo(level, x, z);
  };

  me.stun = () => {
    if (me.state === 'stun' || me.state === 'kill') return;
    me.state = 'stun'; stunT = 9; path = null;
    me.addFear(-30);
    me.onSound?.('hurt', 1);
  };

  // the shot: does the ray from the camera pass through him?
  me.tryShoot = (camera, player) => {
    if (me.level !== player.level || me.state === 'stun' || me.state === 'kill') return false;
    const o = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (!lineClear(house.colliders, me.level, o.x, o.z, me.x, me.z)) return false;
    const p = new THREE.Vector3();
    for (const h of [0.3, 0.8, 1.3, 1.8, 2.2]) {
      p.set(me.x, me.y + h, me.z);
      const t = p.clone().sub(o).dot(dir);
      if (t < 0 || t > 18) continue;
      if (p.distanceTo(o.clone().addScaledVector(dir, t)) < (h > 1.7 ? 0.32 : 0.5)) { me.stun(); return true; }
    }
    return false;
  };

  const speedOf = () => (me.speedMul ?? 1) * (me.state === 'hunt' ? 2.2 * (0.92 + 0.16 * me.fear / 100)   // 1x is the player's own walking speed
    : me.state === 'search' ? 1.4 : 1.0);

  function follow(dt) {
    if (!path || idx >= path.length) return false;
    let step = speedOf() * dt;
    turning = false;
    while (path && idx < path.length && step > 0) {
      const w = path[idx], dx = w.x - me.x, dz = w.z - me.z, d = Math.hypot(dx, dz);
      // he does not walk sideways or backwards: if the way on lies well off the way he faces, he turns on the spot first
      if (d > 0.3 && Math.abs(angleTo(me.yaw, Math.atan2(dx, dz))) > (me.state === 'hunt' ? 1.1 : 0.8)) {
        if (d < 1.1 && idx + 1 < path.length) {   // a bend he has already walked past: skip it instead of turning back for it
          idx++;
          if (idx < path.length) segLen = Math.max(0.01, Math.hypot(path[idx].x - me.x, path[idx].z - me.z));
          continue;
        }
        me._heading = Math.atan2(dx, dz);
        turning = true;
        return true;
      }
      if (d <= step) {
        me.x = w.x; me.z = w.z; me.y = w.y; me.level = w.level;
        prev = { x: w.x, z: w.z, y: w.y, level: w.level };
        step -= d; idx++;
        if (idx < path.length) segLen = Math.max(0.01, Math.hypot(path[idx].x - me.x, path[idx].z - me.z));
        continue;
      }
      me.x += dx / d * step; me.z += dz / d * step;
      const f = 1 - (d - step) / segLen;
      me.y = prev.y + (w.y - prev.y) * Math.min(1, Math.max(0, f));
      me.level = f > 0.5 ? w.level : prev.level;
      me._heading = Math.atan2(dx, dz);
      step = 0;
    }
    return idx < path.length;
  }

  // swing shut doors open as he gets to them
  function doors(player) {
    for (const d of house.roomDoors) {
      if (d.open || d.level !== me.level) continue;
      const cx = d.axis === 'x' ? d.mid : d.f, cz = d.axis === 'x' ? d.f : d.mid;
      if (Math.hypot(cx - me.x, cz - me.z) < 1.5) {
        house.openDoorFor(d, me, Math.hypot(me.x - player.pos.x, me.z - player.pos.z) > 14);
        pause = 0.5;
        revKick = 0.8;
      }
    }
  }

  const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

  me.update = (dt, t, ctx) => {
    const p = ctx.player;
    graceT = Math.max(0, graceT - (ctx.frozen ? 0 : dt));
    const same = me.level === p.level;
    const dx = p.pos.x - me.x, dz = p.pos.z - me.z, d = same ? Math.hypot(dx, dz) : 99;
    losT -= dt;
    if (losT <= 0) {
      losT = 0.15;
      sees = same && !ctx.hidden && d < 11 && lineClear(house.colliders, me.level, me.x, me.z, p.pos.x, p.pos.z);
    }

    // ---- fear ----
    if (!ctx.frozen) {
      let rate = 0;
      const rest = ctx.rest ?? 6;
      if (me.fear < rest) rate += 3; else rate -= ctx.hidden ? 4 : 2.2;
      if (ctx.calm) rate -= 3;   // standing in the sunshine
      if (me.state === 'stun') rate -= 12;
      else if (sees) rate += (12 - d) * 1.4 + (me.state === 'hunt' ? 4 : 0);
      else if (d < 5) rate += (5 - d) * 1.5;
      if (ctx.hidden && d < 3.5 && me.state !== 'stun') rate += 8;
      me.fear = Math.max(0, Math.min(100, me.fear + rate * dt));
    }
    seenAgo = sees ? 0 : seenAgo + dt;

    if (ctx.frozen && me.state !== 'kill') { animate(dt, t, 0); return; }

    if (me.state === 'kill') {
      killT += dt;
      me._heading = Math.atan2(dx, dz);
      if (d < 6 && d > 0.01) {   // settle at the saw's reach: step back if too close, in if too far
        const want = 2.1 - 0.8 * ease(0.4, 0.72, killT) + 0.55 * ease(0.95, 1.3, killT) - 0.55 * ease(1.35, 1.55, killT);   // winds up from a distance, steps in to strike
        const move = Math.sign(d - want) * Math.min(Math.abs(d - want), 5 * dt);
        me.x += dx / d * move; me.z += dz / d * move;
      }
    } else if (me.state === 'stun') {
      stunT -= dt;
      if (stunT <= 0) { me.state = 'search'; searchT = 7; revKick = 1.6; last.x = p.pos.x; last.z = p.pos.z; last.level = p.level; goTo(last.level, last.x, last.z); me.onSound?.('growl', 0.8); me.onSound?.('pull', 1); }
    } else {
      // ---- senses ----
      const smell = (4 + me.fear * 0.16) * (me.senseMul ?? 1) * (ctx.hidden ? 0.35 : 1);
      const sensed = graceT === 0 && !ctx.noSense && (sees || (same && d < smell) || (!same && Math.abs(me.level - p.level) === 1 && Math.hypot(dx, dz) < smell * 0.5));
      if (sensed) {
        if (me.state !== 'hunt') {
          me.state = 'hunt'; huntT = 0; pause = 0.5; revKick = 1.5;   // a beat to notice you, and the saw roars
          me.onSound?.('growl', same ? Math.max(0.3, 1 - d / 16) : 0.4);
          if (seenAgo > 5 && sees) { me.addFear(22); me.onSound?.('sting', 1); }
        }
        lose = 0; last.x = p.pos.x; last.z = p.pos.z; last.level = p.level;
        if (!me._replan || me._replan <= 0) {
          if (sees && same && d < 12) {   // in plain sight: straight at you, so he does not weave about
            path = [{ x: p.pos.x, z: p.pos.z, y: p.y, level: p.level }]; idx = 0;
            prev = { x: me.x, z: me.z, y: me.y, level: me.level };
            segLen = Math.max(0.01, d);
            me._replan = 0.15;
          } else { goTo(last.level, last.x, last.z); me._replan = 0.45; }
        }
      } else if (me.state === 'hunt') {
        lose += dt;
        if (lose > 2.5 + me.fear * 0.04) { me.state = 'search'; searchT = 6 + me.fear * 0.08; }
      }
      me._replan = (me._replan ?? 0) - dt;

      // ---- moving ----
      if (pause > 0) pause -= dt;
      else {
        const moving = follow(dt);
        if (moving) doors(p);
        else if (me.state === 'hunt' && !sensed) { me.state = 'search'; searchT = 6 + me.fear * 0.08; }
        else if (me.state === 'search') {
          searchT -= dt;
          if (searchT <= 0) me.state = 'roam';
          else if ((me._lookT = (me._lookT ?? 0) - dt) <= 0) {   // stands and looks about for a while, then shuffles on
            me._lookT = 2.6 + Math.random() * 2.4;
            const c = ahead(() => nav.randomOn(last.level, last, 4));
            if (c) goTo(c.level, c.x, c.z);
          }
        } else if (me.state === 'roam' && graceT === 0 && (me._idle = (me._idle ?? 0) - dt) <= 0) {
          me._idle = 1.5 + Math.random() * 3;
          const nearFear = Math.random() < 0.05 + me.fear / 100 * 0.9;
          let c = null;
          if (nearFear) c = ahead(() => nav.randomOn(p.level, p.pos, 7));
          else c = ahead(() => nav.randomOn(Math.random() < 0.45 ? me.level : Math.floor(Math.random() * house.levels.length)));
          if (c) goTo(c.level, c.x, c.z);
        } else if (me.state === 'roam' && graceT > 0 && !path && (me._idle = (me._idle ?? 0) - dt) <= 0) {
          me._idle = 2 + Math.random() * 3;
          const c = ahead(() => nav.randomOn(me.level));
          if (c) goTo(c.level, c.x, c.z);
        }
      }

      huntT = me.state === 'hunt' ? huntT + dt : 0;
      // ---- catching ----
      if (graceT === 0 && same && !ctx.dead) {
        if (!ctx.hidden && d < 1.0 && huntT > 0.5 && Math.abs(me.y - p.y) < 1.4) caught();
        if (ctx.hidden && d < 1.9) {
          foundT += dt * (0.6 + me.fear / 60);
          if (foundT > 3.2) caught();
        } else foundT = Math.max(0, foundT - dt);
      }
    }

    // footsteps, heard by distance
    const moving = path && idx < path.length && pause <= 0 && !turning && me.state !== 'stun' && me.state !== 'kill';
    if (moving) {
      stepT -= dt * speedOf();
      if (stepT <= 0) {
        stepT = 0.85;
        const dist = Math.hypot(me.x - p.pos.x, me.z - p.pos.z) + Math.abs(me.level - p.level) * 6;
        if (dist < 18) me.onSound?.('step', Math.max(0, 1 - dist / 18));
      }
    }
    animate(dt, t, moving ? speedOf() : 0);
  };

  const ease = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  me.debugKillT = v => { killT = v; };   // for testing the animation frame by frame

  function caught() {
    if (me.state === 'kill') return;
    me.state = 'kill'; killT = 0; path = null;
    me.onCaught?.();
  }

  // ---- posing ----
  // The body is Grandpa's own skeleton with his own animations: walk, idle, search, a swing and a stagger.
  let clip = null, sway = 0;
  function play(name, timeScale = 1, once = false) {
    const next = model.actions[name];
    if (!next) return;
    if (clip === name) { next.setEffectiveTimeScale(timeScale); return; }
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.25).play();
    if (clip) model.actions[clip].fadeOut(0.25);
    clip = name;
  }
  function animate(dt, t, speed) {
    // turn toward where he is heading
    if (me._heading !== undefined) {
      // eased, and never faster than a heavy man can turn: a snap through 180 degrees looks like a spin
      const turn = angleTo(me.yaw, me._heading) * Math.min(1, dt * (me.state === 'hunt' ? 7 : 3.2));
      const most = (me.state === 'hunt' || me.state === 'kill' ? 4.2 : 2.4) * dt;
      me.yaw += Math.max(-most, Math.min(most, turn));
    }
    group.position.set(me.x, me.y, me.z);
    group.rotation.y = me.yaw;
    const hunt = me.state === 'hunt' || me.state === 'kill';
    if (me.state === 'kill') play('attack', 1.5);
    else if (me.state === 'stun') play('stun', 1, true);
    else if (speed > 0.05) play('walk', Math.max(0.5, speed / 1.15) * (me.limp ? 0.8 : 1));
    else play(me.state === 'search' ? 'search' : 'idle', 1);
    model.mixer.update(dt);

    // posture: a hunch, deeper when he hunts, and a heavy sway when he lumbers
    const b = model.bones;
    const stooped = me.state === 'stun' ? 0 : hunt ? 0.2 : 0.1;
    lean += (stooped - lean) * Math.min(1, dt * 4);
    if (b.spine2) b.spine2.rotation.x += lean;   // spine2 is driven by every clip, so this never builds up
    sway += ((speed > 0 && me.state !== 'stun' ? Math.sin(t * speed * 2.2) * (me.limp ? 0.07 : 0.025) : 0) - sway) * Math.min(1, dt * 8);
    model.model.rotation.z = sway;

    // the saw: a rough idle, a roar when he notices you, flat out in the hunt, dead when he is hurt
    revKick = Math.max(0, revKick - dt);
    const target = me.state === 'stun' ? 0 : (me.state === 'hunt' || me.state === 'kill') ? 1 : me.state === 'search' ? 0.5 : 0.25;
    me.rpm += (Math.max(target, revKick > 0 ? 1 : 0) - me.rpm) * Math.min(1, dt * 5);
    const shake = me.rpm * 0.003;
    model.saw.position.set(model.sawBase.x + Math.sin(t * 61) * shake, model.sawBase.y + Math.sin(t * 53) * shake, model.sawBase.z + Math.sin(t * 47) * shake);
  }

  return me;
}
