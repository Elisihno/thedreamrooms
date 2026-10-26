import * as THREE from '../vendor/three.module.min.js';
import data from './nanny_data.js';

// The creature's body: the model "Granny All Parts Mesh" (Sketchfab), recoloured here
// (darker gown, paler skin, black hair). The model is a single static pose, so it is posed as a
// whole from code (lean, sway, bob) and only the bat is a separate piece that swings from the grip.
// Everything is in the mesh's own units (+z forward, +y up, ~51 high) and scaled down at the end.

const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const f32 = s => new Float32Array(bytes(s).buffer);
const u16 = s => new Uint16Array(bytes(s).buffer);

function geometry(p, shift = [0, 0, 0]) {
  const g = new THREE.BufferGeometry();
  const pos = f32(p.pos);
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= shift[0]; pos[i + 1] -= shift[1]; pos[i + 2] -= shift[2]; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(f32(p.nor), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(f32(p.uv), 2));
  g.setIndex(new THREE.BufferAttribute(u16(p.idx), 1));
  return g;
}

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

export function buildGranny() {
  const SCALE = 1.7 / 51;
  const root = new THREE.Group();            // origin at the feet, +z forward
  const tilt = new THREE.Group();            // falls over, rolls when she limps
  root.add(tilt);
  const holder = new THREE.Group();          // mesh units
  holder.scale.setScalar(SCALE);
  tilt.add(holder);

  // everything above the knees hinges at the waist
  const HIP = 24;
  const torso = new THREE.Group();
  torso.position.set(0, HIP, 0);
  holder.add(torso);
  const upper = (mesh) => { mesh.position.y = -HIP; torso.add(mesh); return mesh; };

  const body = upper(new THREE.Mesh(geometry(data.body), new THREE.MeshLambertMaterial({ map: texture(data.tex.body, gownAndSkin), side: THREE.DoubleSide, emissive: 0x0a0204 })));
  const eyes = upper(new THREE.Mesh(geometry(data.eyes), new THREE.MeshBasicMaterial({ map: texture(data.tex.eyes) })));
  const hair = upper(new THREE.Mesh(geometry(data.hair), new THREE.MeshLambertMaterial({ map: texture(data.tex.hair, darkHair), transparent: true, side: THREE.DoubleSide, alphaTest: 0.1, emissive: 0x050505 })));
  upper(new THREE.Mesh(geometry(data.teeth), new THREE.MeshLambertMaterial({ color: 0xcfc6a8, side: THREE.DoubleSide })));
  holder.add(new THREE.Mesh(geometry(data.legs), new THREE.MeshLambertMaterial({ color: 0x8c7a70, emissive: 0x100808, side: THREE.DoubleSide })));
  const head = new THREE.Group();            // the head is part of the body mesh; kept so callers can still pose it
  torso.add(head);

  // the bat swings about her grip
  const piv = data.batPivot;
  const bat = new THREE.Group();
  bat.rotation.order = 'YXZ';
  bat.position.set(piv[0], piv[1] - HIP, piv[2]);
  const batMat = new THREE.MeshLambertMaterial({ map: texture(data.tex.bat), side: THREE.DoubleSide, emissive: 0x201410 });
  const bloodMat = new THREE.MeshLambertMaterial({ map: texture(data.tex.batBlood), side: THREE.DoubleSide, emissive: 0x300808 });
  bat.add(new THREE.Mesh(geometry(data.bat, piv), batMat));
  bat.add(new THREE.Mesh(geometry(data.batBlood, piv), bloodMat));
  // iron spikes along the barrel
  const iron = new THREE.MeshLambertMaterial({ color: 0xd0d0d8, emissive: 0x34343c });
  const ax = new THREE.Vector3(...data.batAxis), c = new THREE.Vector3(...data.batC).sub(new THREE.Vector3(...piv));
  const side = new THREE.Vector3(0, 1, 0).cross(ax).normalize(), up = ax.clone().cross(side).normalize();
  for (let r = 0; r < 5; r++) for (let a = 0; a < 6; a++) {
    const t = 7 + r * 3.2, ang = a * Math.PI / 3 + r * 0.5;
    const out = side.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang));
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 5), iron);
    spike.position.copy(ax.clone().multiplyScalar(t)).addScaledVector(out, 2.1);
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    bat.add(spike);
  }
  torso.add(bat);

  return { root, body: tilt, holder, torso, head, neck: head, bat, legs: [], arms: [], bones: { torso, head }, eyes, hair, SCALE };
}
