import * as THREE from '../three.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';

// Model library. Files live in levelfun/assets/models/<name>.glb (optimized with real-world scale,
// origin at bottom-centre). To upgrade a model, drop a new .glb with the same name.
export const MODEL_NAMES = ['table', 'chair', 'cup', 'cake', 'party_hat', 'door', 'counter', 'balloons'];

const templates = new Map();
const loader = new GLTFLoader();

export async function loadModels(names = MODEL_NAMES) {
  await Promise.all(names.map(async n => {
    const gltf = await loader.loadAsync(new URL(`../../assets/models/${n}.glb`, import.meta.url).href);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      if (o.material) { o.material.envMapIntensity = 0.4; }
    });
    gltf.scene.updateMatrixWorld(true);
    templates.set(n, gltf.scene);
  }));
}

export function hasModel(n) { return templates.has(n); }

// Places many copies of a model using one InstancedMesh per sub-mesh (few draw calls).
// placements: [{ x, y, z, ry, s, sx, sy, sz }]
export function instanceModel(scene, name, placements, { cast = true, receive = true } = {}) {
  const tpl = templates.get(name);
  if (!tpl) return [];
  const out = [], M = new THREE.Matrix4(), P = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  tpl.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, placements.length);
    placements.forEach((p, i) => {
      e.set(0, p.ry || 0, 0); q.setFromEuler(e);
      pos.set(p.x, p.y || 0, p.z);
      const s = p.s ?? 1; sc.set((p.sx ?? 1) * s, (p.sy ?? 1) * s, (p.sz ?? 1) * s);
      P.compose(pos, q, sc);
      M.multiplyMatrices(P, o.matrixWorld);
      im.setMatrixAt(i, M);
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false;
    scene.add(im);
    out.push(im);
  });
  return out;
}
