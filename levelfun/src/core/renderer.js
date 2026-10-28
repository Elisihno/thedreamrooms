import * as THREE from '../three.js';
import { CFG } from '../config.js';
import { allMaterials } from '../assets/registry.js';

export function createRenderer(canvas, quality) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: CFG.quality[quality].antialias, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.3;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

// Applies a quality preset. Antialiasing and texture detail take effect on next launch.
export function applyQuality(renderer, quality, pool, world) {
  const q = CFG.quality[quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = q.shadows;
  pool.setCount(q.maxLights);
  pool.setShadows(q.shadows ? 2 : 0);
  if (world) for (const m of world.optional) m.visible = quality !== 'low';
  allMaterials().forEach(m => { m.needsUpdate = true; });
}

export function resize(renderer, camera) {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
