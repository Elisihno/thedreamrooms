import * as THREE from '../three.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { getMaterial } from './registry.js';

// Model library. Files live in levelfun/assets/models/<name>.glb (optimized with real-world scale,
// origin at bottom-centre). To upgrade a model, drop a new .glb with the same name.
export const MODEL_NAMES = ['table', 'chair', 'cup', 'cake', 'party_hat', 'door', 'counter', 'balloons', 'arcade',
  'metal_table', 'slide', 'bench', 'trash_can', 'crate', 'exit_sign', 'fridge', 'locker', 'floor_lamp', 'table_bell', 'spiral',
  'stall', 'toilet', 'sink', 'boiler', 'generator', 'breaker', 'winch', 'desk', 'chair_office', 'cabinet'];
// Item models (picked up in later stages); not loaded until needed.
export const ITEM_NAMES = ['screwdriver', 'needle', 'wire_cutters', 'key', 'whistle', 'windup_robot', 'fuse'];
// Some downloads carry stray geometry (the arcade machine's power cord): triangles entirely behind zMin are removed.
const CLIP = { arcade: { zMin: -0.42 } };
export const screenMaterials = [];   // animated emissive screens

const templates = new Map();
const loader = new GLTFLoader();

export async function loadModels(names = MODEL_NAMES) {
  await Promise.all(names.map(async n => {
    const gltf = await loader.loadAsync(new URL(`../../assets/models/${n}.glb`, import.meta.url).href);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      if (o.material) {   // no environment map in the scene: fully metallic surfaces would render black
        o.material.envMapIntensity = 0.4;
        if (o.material.metalness > 0.4) o.material.metalness = 0.4;
        if (o.material.roughness < 0.35) o.material.roughness = 0.35;
        if (o.material.transmission > 0) {   // transmission makes three.js render the whole scene a second time
          o.material.transmission = 0; o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity, 0.3); o.material.depthWrite = false;
        }
      }
    });
    gltf.scene.updateMatrixWorld(true);
    if (CLIP[n]) clipModel(gltf.scene, CLIP[n]);
    if (n === 'arcade') prepArcade(gltf.scene);
    if (n === 'spiral') prepSpiral(gltf.scene);
    if (n === 'stall') gltf.scene.traverse(o => { if (o.isMesh && o.material.name === 'plastic') o.userData.matKey = 'stall_paint'; });   // the source has no textures: painted panels are textured here
    templates.set(n, gltf.scene);
  }));
}

export function hasModel(n) { return templates.has(n); }
export function cloneModel(n) { return templates.get(n).clone(true); }

// Places many copies of a model using one InstancedMesh per sub-mesh (few draw calls).
// placements: [{ x, y, z, ry, s, sx, sy, sz }]
export function instanceModel(scene, name, placements, { cast = true, receive = true, optional = null } = {}) {
  const tpl = templates.get(name);
  if (!tpl) return [];
  const out = [], M = new THREE.Matrix4(), P = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  tpl.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.userData.matKey ? getMaterial(o.userData.matKey) : o.material, placements.length);
    placements.forEach((p, i) => {
      e.set(0, p.ry || 0, 0); q.setFromEuler(e);
      pos.set(p.x, p.y || 0, p.z);
      const s = p.s ?? 1; sc.set((p.sx ?? 1) * s, (p.sy ?? 1) * s, (p.sz ?? 1) * s);
      P.compose(pos, q, sc);
      M.multiplyMatrices(P, o.matrixWorld);
      im.setMatrixAt(i, M);
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = receive; im.computeBoundingSphere();
    if (optional) { im.userData.optional = true; optional.push(im); }
    scene.add(im);
    out.push(im);
  });
  return out;
}


function clipModel(scene, { zMin }) {
  const v = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index.array, keep = [];
    const z = i => v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).z;
    for (let t = 0; t < idx.length; t += 3) if (Math.max(z(idx[t]), z(idx[t + 1]), z(idx[t + 2])) >= zMin) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    o.geometry = o.geometry.clone();
    o.geometry.setIndex(keep);
  });
}

// Centre the machine on its footprint, sit it on the floor, and light up its screen.
function prepArcade(scene) {
  const box = new THREE.Box3().setFromObject(scene), c = box.getCenter(new THREE.Vector3());
  scene.position.set(-c.x, -box.min.y, -c.z);
  scene.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(scene);
  scene.userData.size = b2.getSize(new THREE.Vector3());
  scene.traverse(o => {
    if (o.isMesh && o.material && o.material.name === 'material') {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(0x2a56c0); o.material.emissiveIntensity = 0.9;
      screenMaterials.push(o.material);
    }
  });
}
export function modelSize(n) { return templates.get(n)?.userData.size; }

// The spiral's own tread texture was lost in transit: treads use the diamond-plate texture, the rest is dark cast iron.
function prepSpiral(scene) {
  const iron = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.55, metalness: 0.3 });
  scene.traverse(o => {
    if (!o.isMesh) return;
    if (o.material.name === 'treads') o.userData.matKey = 'diamond_plate'; else o.material = iron;
  });
}
