import * as THREE from '../three.js';
import { CFG } from '../config.js';
import { allMaterials } from '../assets/registry.js';

export function createRenderer(canvas, quality) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: CFG.quality[quality].antialias, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.1;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

// Applies a quality preset. Antialiasing and texture detail take effect on next launch.
export function applyQuality(renderer, quality, world) {
  const q = CFG.quality[quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = q.shadows;
  world.lights.forEach((l, i) => {
    l.visible = i < q.maxLights;
    const sh = q.shadows && l.userData.shadowCapable;
    l.castShadow = sh;
    if (sh) { l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; l.shadow.camera.near = 0.2; l.shadow.camera.far = l.distance; }
  });
  allMaterials().forEach(m => { m.needsUpdate = true; });
}

export function resize(renderer, camera) {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
