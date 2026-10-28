import * as THREE from '../three.js';
import { AVAILABLE_TEXTURES, PROCEDURAL, SURFACE } from './manifest.js';
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

const loaded = new Map();   // key -> { map, normalMap }

function loadImage(url, srgb) {
  return new Promise(res => loader.load(url, t => res(prep(t, srgb)), undefined, () => res(null)));
}

// Loads every texture image once, before the world is built.
export async function preloadTextures(onProgress) {
  let done = 0;
  await Promise.all(AVAILABLE_TEXTURES.map(async key => {
    const base = new URL(`../../assets/textures/${key}/`, import.meta.url).href;
    const [map, normalMap] = await Promise.all([loadImage(base + 'color.jpg', true), loadImage(base + 'normal.jpg', false)]);
    if (map) loaded.set(key, { map, normalMap });
    onProgress?.(++done / AVAILABLE_TEXTURES.length);
  }));
}

// Returns a (cached) material. Textures tile in world units: geometry UVs are scaled in builder.js.
const ALIAS = { ceiling: { as: 'concrete_mid', normal: 0.2, color: 0xe6e2da }, stall_paint: { as: 'wall_green_peel', normal: 1, color: 0xffffff, boost: 1.8 } };

export function getMaterial(key, extra = {}) {
  const ck = key + JSON.stringify(extra);
  if (cache.has(ck)) return cache.get(ck);
  const alias = ALIAS[key];
  if (alias) {
    const base = getMaterial(alias.as, extra);
    const m = base.clone(); m.normalScale.set(alias.normal, alias.normal); m.color.setHex(alias.color); if (alias.boost) m.color.multiplyScalar(alias.boost);
    cache.set(ck, m); return m;
  }
  const spec = PROCEDURAL[key] || { style: 'concrete', base: '#777' };
  const [rough, metal] = SURFACE[key] || [0.9, spec.style === 'metal' ? 0.3 : 0];
  const mat = new THREE.MeshStandardMaterial({ roughness: rough, metalness: metal, ...extra });
  const tex = loaded.get(key);
  if (tex) {
    mat.map = tex.map;
    if (tex.normalMap) { mat.normalMap = tex.normalMap; mat.normalScale.set(1, 1); }
  } else {
    mat.map = prep(new THREE.CanvasTexture(proceduralCanvas(key, spec, opts.texSize)), true);
  }
  cache.set(ck, mat);
  return mat;
}

const basic = new Map();
export function getBasic(color) {
  if (!basic.has(color)) basic.set(color, new THREE.MeshBasicMaterial({ color }));
  return basic.get(color);
}

export function allMaterials() { return [...cache.values()]; }
