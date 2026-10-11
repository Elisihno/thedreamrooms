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
  plaster: [62, 125, 125, 62],
  vent: [188, 125, 62, 62],
  moss: [0, 187, 125, 63],
};

export function loadMaterials() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const mats = {};
      for (const [name, [x, y, w, h]] of Object.entries(TILES)) {
        const inset = 2; // avoid bleeding from neighbouring tiles
        const c = document.createElement('canvas');
        c.width = w - inset * 2;
        c.height = h - inset * 2;
        c.getContext('2d').drawImage(image, x + inset, y + inset, c.width, c.height, 0, 0, c.width, c.height);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.anisotropy = 4;
        mats[name] = new THREE.MeshLambertMaterial({ map: tex }); // the atlas tile exactly as drawn
        mats[name].userData.aspect = w / h; // wide tiles (plaster) must not be stretched;
      }
      resolve(mats);
    };
    image.onerror = reject;
    image.src = img('atlas.png');
  });
}
