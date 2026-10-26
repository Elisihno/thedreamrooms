import * as THREE from '../vendor/three.module.min.js';
import data from './nanny_data.js';

// Nanny's body: the Meshy model "The Hollow Granny" with its own texture, skinned to seven bones
// (hip, torso, head, two arms, two legs). The left arm carries the spiked bat, so swinging that
// bone swings the bat. Everything is in the mesh's own units (+z forward, +y up, 50 high) and
// scaled down at the end. The pose is set from code each frame (see animate() in entity.js).

const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const f32 = s => new Float32Array(bytes(s).buffer);
const u16 = s => new Uint16Array(bytes(s).buffer);

function geometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f32(data.pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(f32(data.nor), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(f32(data.uv), 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(bytes(data.si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(bytes(data.sw), 4, true));
  g.setIndex(new THREE.BufferAttribute(u16(data.idx), 1));
  return g;
}

let skinTex = null;
const skin = () => {   // Meshy's own texture, shared by every Nanny
  if (!skinTex) { skinTex = new THREE.TextureLoader().load(globalThis.__DR_TEX?.nanny ?? 'assets/textures/nanny.jpg'); skinTex.colorSpace = THREE.SRGBColorSpace; skinTex.anisotropy = 4; }
  return skinTex;
};

export function buildGranny() {
  const SCALE = 1.7 / data.height;
  const root = new THREE.Group();            // origin at the feet, +z forward
  const tilt = new THREE.Group();            // falls over, rolls when she limps
  root.add(tilt);
  const holder = new THREE.Group();          // mesh units
  holder.scale.setScalar(SCALE);
  tilt.add(holder);

  const bones = [];
  data.bones.forEach((p, i) => {
    const b = new THREE.Bone();
    b.name = data.names[i];
    const par = data.parents[i], pp = par < 0 ? [0, 0, 0] : data.bones[par];
    b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (par >= 0) bones[par].add(b);
    bones.push(b);
  });
  const [hip, torso, head, armL, armR, legL, legR] = bones;
  holder.add(hip);

  const mesh = new THREE.SkinnedMesh(geometry(), new THREE.MeshLambertMaterial({ map: skin(), emissive: 0x0c0708, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  holder.add(mesh);
  holder.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));

  // `bat` is the arm that holds it: rotating it swings the bat about the shoulder
  return { root, body: tilt, holder, torso, head, neck: head, bat: armL, hip, armL, armR, legL, legR, SCALE };
}
