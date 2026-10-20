import * as THREE from '../vendor/three.module.min.js';

// The black and white spiral vase: a smooth, glossy lathe-turned shape. The stripes spiral up it, so
// the picture wraps around once per revolution and never shows a seam.
let vaseMat = null;
function spiralMaterial() {
  if (vaseMat) return vaseMat;
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const BANDS = 6, TWIST = 3;    // six spiral arms, turning three times from foot to lip
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const t = (u * BANDS + v * TWIST) % 1;                       // position within one stripe
    const e = 0.018;                                              // soft edge, so no jaggies
    const a = Math.min(1, Math.max(0, (t - 0.0) / e)) * Math.min(1, Math.max(0, (0.5 - t) / e));
    const k = (y * S + x) * 4, c = 16 + 232 * (1 - a);            // black stripe, white stripe
    d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  vaseMat = new THREE.MeshPhongMaterial({ map: tex, specular: 0xffffff, shininess: 160 });
  return vaseMat;
}

export function makeVase(scale = 1) {
  // profile from the foot up: a small foot, a wide rounded belly, a slim neck and a flared lip
  const prof = [[0.001, 0], [0.05, 0], [0.066, 0.012], [0.09, 0.06], [0.112, 0.13], [0.114, 0.2], [0.098, 0.27],
    [0.064, 0.33], [0.04, 0.38], [0.034, 0.42], [0.036, 0.46], [0.05, 0.5], [0.062, 0.525], [0.056, 0.532], [0.03, 0.522]];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(70).map(p => new THREE.Vector2(Math.max(0.0005, p.x) * scale, p.y * scale));
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, spiralMaterial());
}
