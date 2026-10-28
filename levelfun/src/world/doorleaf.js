import * as THREE from '../three.js';
import { cloneModel } from '../assets/models.js';

// Both faces of a door show the model's detailed face: two half-thickness copies back to back
// (the second one mirrored so the handle stays on the same edge from either side).
export function doubleSidedModel(key, sx, sy, depth) {
  const g = new THREE.Group();
  for (const side of [1, -1]) {
    const m = cloneModel(key);
    m.scale.set(side * sx, sy, 0.5);
    m.position.z = side * depth / 4;
    if (side < 0) m.rotation.y = Math.PI;
    g.add(m);
  }
  return g;
}
