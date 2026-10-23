import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// The two 3D models the Hillbilly is made from (both CC BY 4.0 from Sketchfab, see CREDITS.md):
//   Grandpa: "Granny 3 - Grandpa" by Horror Game Fan, a skinned character with a full set of animations
//   Chainsaw: "DOOM eternal chainsaw" by DJ_Nugget
// Everything else in the game is built in code.

const loader = new GLTFLoader();

// Furniture and props: each was shrunk by tools/bake.mjs from the original download (see CREDITS.md).
//   kitchen_run   "Kitchen Cabinets" by jimbogies, cut down to one long wall of the kitchen
//   dining_set    "Table and Chairs" by Graham
//   trestle_table "Vintage Wooden Table" by Poring
//   butcher_hooks "Butcher Hook_18MB" by Mehdi Shahsavan
//   bone_pile     "Low Poly Bone Pile" by 3dsauce
// chair is optional: "Chair" by shuvalov.di is under Sketchfab's Standard license, which does not let it be
// shared publicly, so it is not committed. Put chair.glb in assets/models/optional/ to use it locally.
const PROPS = ['kitchen_run', 'dining_set', 'trestle_table', 'butcher_hooks', 'bone_pile'];

// lit the way the rest of the house is lit: cheap and flat, which also keeps phones happy
const lambertCache = new Map();
function lambertOf(src) {
  if (!lambertCache.has(src)) {
    lambertCache.set(src, new THREE.MeshLambertMaterial({
      map: src.map ?? null, color: src.map ? 0xffffff : src.color, normalMap: src.normalMap ?? null,
      side: src.side, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest,
    }));
  }
  return lambertCache.get(src);
}

async function loadProp(url, optional) {
  try {
    const g = (await loader.loadAsync(url)).scene;
    g.traverse(o => { if (o.isMesh) o.material = lambertOf(o.material); });
    return g;
  } catch (e) {
    if (!optional) console.warn('Could not load', url, e);
    return null;
  }
}

export async function loadAssets(onProgress) {
  const jobs = [
    loader.loadAsync('assets/models/grandpa.glb'),
    loader.loadAsync('assets/models/chainsaw.glb'),
    ...PROPS.map(n => loadProp(`assets/models/${n}.glb`, false)),
    loadProp('assets/models/optional/chair.glb', true),
  ];
  let done = 0;
  jobs.forEach(j => j.then(() => onProgress?.(++done / jobs.length)));
  const [grandpa, saw, ...rest] = await Promise.all(jobs);
  const props = {};
  [...PROPS, 'chair'].forEach((n, i) => { if (rest[i]) props[n] = rest[i]; });

  // The chainsaw file uses an old material extension that three.js no longer reads, so the paint
  // is put back by hand from the textures stored inside the file.
  const tex = i => saw.parser.getDependency('texture', i);
  const [diffuse, normal, glassDiffuse] = await Promise.all([tex(0), tex(2), tex(3)]);
  diffuse.colorSpace = THREE.SRGBColorSpace;
  glassDiffuse.colorSpace = THREE.SRGBColorSpace;
  const meshes = [];
  saw.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const glass = m.material?.name === 'chainsaw_glass';
    m.material = glass
      ? new THREE.MeshStandardMaterial({ map: glassDiffuse, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map: diffuse, normalMap: normal, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide });
  }
  return { grandpa, saw, props };
}
