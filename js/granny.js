import * as THREE from '../vendor/three.module.min.js';
import data from './granny_data.js';

// The creature's body: the Granny model "Granny Animated FBX" by Mysis The Cat (CC BY 4.0,
// https://sketchfab.com/3d-models/granny-animated-fbx-894ee61618ef44fdb5fd6c9278433a8e).
// Its own skeleton does not fit its mesh, so the body is skinned to a small rig of our own
// (torso, head and three bones per arm) and posed from code. Everything is in the mesh's own units
// (centimetres, +x forward, +y up, arms along z) and scaled down at the end.

const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const f32 = s => new Float32Array(bytes(s).buffer);
const u16 = s => new Uint16Array(bytes(s).buffer);

function geometry(p, skinned) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f32(p.pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(f32(p.uv), 2));
  g.setIndex(new THREE.BufferAttribute(u16(p.idx), 1));
  if (p.nor) g.setAttribute('normal', new THREE.BufferAttribute(f32(p.nor), 3)); else g.computeVertexNormals();
  if (skinned) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(bytes(p.joints)), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(f32(p.weights), 4));
  }
  return g;
}

// the pictures, recoloured: a darker gown and black hair instead of grey and white
function texture(b64, recolor) {
  const t = new THREE.Texture();
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const img = new Image();
  img.onload = () => {
    if (recolor) {
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) recolor(a, i);
      g.putImageData(d, 0, 0);
      t.image = cv;
    } else t.image = img;
    t.needsUpdate = true;
  };
  img.src = 'data:image/png;base64,' + b64;
  return t;
}
// the grey of the nightgown becomes a dark wine red; the brown skin goes paler and greyer
const gownAndSkin = (a, i) => {
  const r = a[i], g = a[i + 1], b = a[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
  if (sat < 0.16) { const l = (r + g + b) / 3; a[i] = l * 0.42; a[i + 1] = l * 0.06; a[i + 2] = l * 0.09; }          // gown
  else { const l = (r + g + b) / 3; a[i] = r * 0.55 + l * 0.55; a[i + 1] = g * 0.55 + l * 0.5; a[i + 2] = b * 0.5 + l * 0.6; }         // skin
};
const darkHair = (a, i) => { const l = (a[i] + a[i + 1] + a[i + 2]) / 3; a[i] = l * 0.18; a[i + 1] = l * 0.17; a[i + 2] = l * 0.2; };

const PIVOT = {   // rest positions of the rig's joints, in mesh units
  torso: [-300, -10, -32], head: [-300, 60, -32],
  uL: [-300, 56, -52], fL: [-299, 55, -110], hL: [-296, 53, -160],
  uR: [-300, 56, -12], fR: [-299, 55, 46], hR: [-296, 53, 96],
};

export function buildGranny() {
  const SCALE = 0.0094, FOOT = -114;
  const root = new THREE.Group();            // origin at the feet, +z forward
  const tilt = new THREE.Group();            // falls over, rolls when she limps
  root.add(tilt);
  const holder = new THREE.Group();          // mesh units
  holder.scale.setScalar(SCALE);
  holder.rotation.y = -Math.PI / 2;          // the mesh faces +x; the creature faces +z
  const content = new THREE.Group();         // shifts the mesh so its feet-centre sits at the origin
  content.position.set(300, -FOOT, 32);
  holder.add(content);
  tilt.add(holder);

  const bone = (name, parent) => {
    const b = new THREE.Bone(); b.name = name;
    const p = PIVOT[name], pp = parent ? PIVOT[parent] : [0, 0, 0];
    b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    return b;
  };
  const torso = bone('torso'), head = bone('head', 'torso');
  const uL = bone('uL', 'torso'), fL = bone('fL', 'uL'), hL = bone('hL', 'fL');
  const uR = bone('uR', 'torso'), fR = bone('fR', 'uR'), hR = bone('hR', 'fR');
  torso.add(head, uL, uR); uL.add(fL); fL.add(hL); uR.add(fR); fR.add(hR);
  const bones = [torso, head, uL, fL, hL, uR, fR, hR];   // the order the exported weights use
  for (const b of bones) b.rotation.order = 'ZXY';

  const body = new THREE.SkinnedMesh(geometry(data.body, true), new THREE.MeshLambertMaterial({ map: texture(data.tex.body, gownAndSkin), side: THREE.DoubleSide, emissive: 0x0a0204 }));
  body.add(torso);
  torso.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton(bones));
  body.frustumCulled = false;
  content.add(body);

  // the face furniture rides on the head bone (positions are in mesh units, so shift by the pivot)
  const onHead = (mesh) => { mesh.position.set(-PIVOT.head[0], -PIVOT.head[1], -PIVOT.head[2]); head.add(mesh); return mesh; };
  const eyes = onHead(new THREE.Mesh(geometry(data.eyes), new THREE.MeshBasicMaterial({ map: texture(data.tex.eyes) })));
  const hair = onHead(new THREE.Mesh(geometry(data.hair), new THREE.MeshLambertMaterial({ map: texture(data.tex.hair, darkHair), transparent: true, side: THREE.DoubleSide, alphaTest: 0.1, emissive: 0x050505 })));
  onHead(new THREE.Mesh(geometry(data.teethU), new THREE.MeshLambertMaterial({ map: texture(data.tex.teethU), side: THREE.DoubleSide })));
  onHead(new THREE.Mesh(geometry(data.teethL), new THREE.MeshLambertMaterial({ map: texture(data.tex.teethL), side: THREE.DoubleSide })));

  // legs swing from the hips, under the hem
  const legs = [];
  for (const [side, key] of [[-1, 'legL'], [1, 'legR']]) {
    const hip = new THREE.Group();
    const pz = -32 + side * 14, py = -40;
    hip.position.set(-300, py, pz);
    const m = new THREE.Mesh(geometry(data[key]), new THREE.MeshLambertMaterial({ map: texture(data.tex.leg), side: THREE.DoubleSide, emissive: 0x100808 }));
    m.position.set(300, -py, -pz);
    hip.add(m);
    content.add(hip);
    legs.push(hip);
  }

  // the spiked bat in her right hand: along the hand's local z, which points down when the arm hangs
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a7650, emissive: 0x2a1c10 });
  const iron = new THREE.MeshLambertMaterial({ color: 0xd0d0d8, emissive: 0x34343c });
  const gore = new THREE.MeshLambertMaterial({ color: 0x8a1010, emissive: 0x3a0606 });
  const bat = new THREE.Group();
  bat.rotation.order = 'YXZ';
  const part = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.z = y; bat.add(m); return m; };
  part(new THREE.CylinderGeometry(2.2, 2.4, 32, 8), wood, 6);                 // handle
  part(new THREE.CylinderGeometry(6.8, 2.6, 78, 10), wood, 52);               // barrel
  part(new THREE.CylinderGeometry(6.9, 6.9, 12, 10), gore, 88);               // stained end
  for (let r = 0; r < 4; r++) for (let a = 0; a < 6; a++) {                   // spikes
    const z = 32 + r * 17, ang = a * Math.PI / 3 + r * 0.5, rad = 3 + (z - 20) * 0.075;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.5, 11, 5), iron);
    spike.position.set(Math.cos(ang) * (rad + 3.5), Math.sin(ang) * (rad + 3.5), z);
    spike.lookAt(spike.position.x * 3, spike.position.y * 3, z);
    spike.rotateX(Math.PI / 2);
    bat.add(spike);
  }
  bat.position.set(0, 0, 4);
  hR.add(bat);

  const arms = [{ sh: uL, el: fL, s: -1 }, { sh: uR, el: fR, s: 1 }];
  return {
    root, body: tilt, holder, torso, head, neck: head, bat,
    legs: legs.map((hip, i) => ({ hip, s: i === 0 ? -1 : 1 })),
    arms, bones: { torso, head, uL, fL, hL, uR, fR, hR }, eyes, hair, SCALE,
  };
}
