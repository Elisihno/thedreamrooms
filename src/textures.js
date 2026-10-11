import * as THREE from 'three';
import { img } from './assets.js';

// Regions of public/img/atlas.png (250x250): [x, y, w, h]
const TILES = {
  grime: [0, 0, 62, 62],
  planks: [62, 0, 62, 62],
  streak: [125, 0, 62, 62],
  concrete: [188, 0, 62, 62],
  gray: [0, 62, 62, 62],
  floral: [62, 62, 62, 62],
  peel: [125, 62, 62, 62],
  darkwood: [188, 62, 62, 62],
  vert: [0, 125, 62, 62],
  plaster: [62, 125, 62, 62],
  vent: [188, 125, 62, 62],
};

// Per-tile darkening so the house stays gloomy.
const TINT = {
  floral: 0x9aa08a, peel: 0xa89a90, gray: 0x8e8e8e, concrete: 0x808080,
  planks: 0x8a7a6a, darkwood: 0x6e6258, vert: 0x8a7a6a, grime: 0x909090,
};

export function loadMaterials() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const mats = {};
      for (const [name, [x, y, w, h]] of Object.entries(TILES)) {
        const inset = 2; // avoid bleeding from neighbouring tiles
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        c.getContext('2d').drawImage(image, x + inset, y + inset, w - inset * 2, h - inset * 2, 0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.anisotropy = 4;
        mats[name] = new THREE.MeshLambertMaterial({ map: tex, color: TINT[name] ?? 0x999999 });
      }
      resolve(mats);
    };
    image.onerror = reject;
    image.src = img('atlas.png');
  });
}
