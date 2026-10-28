import * as THREE from '../three.js';
import { AVAILABLE_TEXTURES, PROCEDURAL } from './manifest.js';
import { proceduralCanvas } from './procedural.js';

const cache = new Map();
let opts = { texSize: 512, aniso: 4 };
const loader = new THREE.TextureLoader();

export function configureAssets(o) { opts = { ...opts, ...o }; }

function prep(tex, srgb) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = opts.aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Returns a (cached) material. Textures tile in world units: geometry UVs are scaled in
// builder.js, so one material serves every surface size.
export function getMaterial(key, extra = {}) {
  const ck = key + JSON.stringify(extra);
  if (cache.has(ck)) return cache.get(ck);
  const spec = PROCEDURAL[key] || { style: 'concrete', base: '#777' };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: spec.style === 'metal' ? 0.35 : 0, ...extra });
  if (AVAILABLE_TEXTURES.includes(key)) {
    const base = `assets/textures/${key}/`;
    const set = (prop, file, srgb) => loader.load(new URL(`../../${base}${file}`, import.meta.url).href, t => { mat[prop] = prep(t, srgb); mat.needsUpdate = true; });
    set('map', 'color.jpg', true); set('normalMap', 'normal.jpg', false); set('roughnessMap', 'rough.jpg', false);
  } else {
    mat.map = prep(new THREE.CanvasTexture(proceduralCanvas(key, spec, opts.texSize)), true);
  }
  cache.set(ck, mat);
  return mat;
}

export function allMaterials() { return [...cache.values()]; }
