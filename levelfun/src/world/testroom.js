import * as THREE from '../three.js';
import { World } from './builder.js';
import { addDiningDecor } from './partyprops.js';

// Stage 1 test environment (NOT the real building): a party room with three long tables,
// a corridor, and a room with stairs and a crawl gap, to exercise movement, crouching,
// leaning, collision and lighting.
export function buildTestRoom(scene) {
  const w = new World(scene);

  // Room A (start): x -8..8, z -6..6
  w.room({ x0: -8, x1: 8, z0: -6, z1: 6, floor: 'carpet_party' });
  w.wall('x', -6, -8.1, 8.1, { mat: 'wallpaper_accent' });
  w.wall('x', 6, -8.1, 8.1, { mat: 'wallpaper_accent' });
  w.wall('z', -8, -6, 6, { mat: 'wallpaper_accent' });
  w.wall('z', 8, -6, 6, { openings: [[-1.2, 1.2, 2.3]], mat: 'wallpaper_accent' });

  // Corridor: x 8..16, z -1.2..1.2
  w.room({ x0: 8, x1: 16, z0: -1.2, z1: 1.2, floor: 'concrete_floor' });
  w.wall('x', -1.3, 8, 16, { mat: 'wallpaper_secondary' });
  w.wall('x', 1.3, 8, 16, { mat: 'wallpaper_secondary' });

  // Room B: x 16..26, z -5..5
  w.room({ x0: 16, x1: 26, z0: -5, z1: 5, floor: 'concrete_floor' });
  w.wall('x', -5, 15.9, 26.1, { mat: 'wall_maintenance' });
  w.wall('x', 5, 15.9, 26.1, { mat: 'wall_maintenance' });
  w.wall('z', 26, -5, 5, { mat: 'wall_maintenance' });
  w.wall('z', 16, -5, 5, { openings: [[-1.3, 1.3, 2.3]], mat: 'wall_maintenance' });

  // Stairs: ramp rising along +x to a 0.8 m platform, with a low side rail.
  w.ramp({ x0: 17, x1: 21, z0: -4.8, z1: -2.4, h0: 0, h1: 0.8 });
  w.ramp({ x0: 21, x1: 25.8, z0: -4.8, z1: -2.4, h0: 0.8, h1: 0.8 });
  w.box({ x: 23.4, y: 0.4, z: -3.6, w: 4.8, h: 0.8, d: 2.4, mat: 'stairs', collide: false });
  w.collision.add(21, -4.8, 25.8, -2.4, 0, 0.8);          // platform sides block from the floor
  for (let i = 0; i < 6; i++) {                              // visual steps
    const x0 = 17 + i * (4 / 6), hh = 0.8 * (i + 1) / 6;
    w.box({ x: x0 + 2 / 6, y: hh / 2, z: -3.6, w: 4 / 6, h: hh, d: 2.4, mat: 'stairs', collide: false });
  }
  w.box({ x: 19, y: 0.45, z: -2.35, w: 4, h: 0.9, d: 0.1, mat: 'railing', y0: 0, y1: 1.2 });

  // Crawl gap: partition wall with a 0.85 m opening only a crouched player fits through.
  w.wall('x', 2, 17, 26, { openings: [[21, 22.4, 0.85]], mat: 'wallpaper_accent' });
  w.box({ x: 24, y: 0.4, z: 3.6, w: 1.2, h: 0.8, d: 1.2, mat: 'wood' });

  // Room A is the Dining Room: three long white-clothed tables (the player starts under the middle one).
  addDiningDecor(w, scene, { tables: [{ x: -4.5, z: -3.5 }, { x: -4.5, z: 0 }, { x: -4.5, z: 3.5 }], bounds: { x0: -8, x1: 8, z0: -6, z1: 6 } });
  // Crates, a column, a counter.
  w.box({ x: 5, y: 0.45, z: 4.5, w: 0.9, h: 0.9, d: 0.9, mat: 'wood' });
  w.box({ x: 5, y: 1.35, z: 4.5, w: 0.7, h: 0.9, d: 0.7, mat: 'wood' });
  w.box({ x: 3, y: 1.5, z: -3, w: 0.6, h: 3, d: 0.6, mat: 'wallpaper_accent' });
  w.box({ x: 4, y: 0.5, z: -5.2, w: 3, h: 1.0, d: 0.8, mat: 'counter_reception', tile: 1 });

  // Lights: bright warm party lighting in the dining room (one flickering), dimmer corridor and far room.
  w.light({ x: -5.5, y: 2.8, z: -2.2, intensity: 22, distance: 16, color: 0xfff0d8, shadow: true });
  w.light({ x: -5.5, y: 2.8, z: 2.2, intensity: 22, distance: 16, color: 0xfff0d8, shadow: true });
  w.light({ x: 2.5, y: 2.8, z: 0, intensity: 20, distance: 16, color: 0xffe6c0, flicker: 0.25 });
  w.light({ x: 12, y: 2.7, z: 0, intensity: 8, distance: 10, flicker: 0.4, color: 0xffc080 });
  w.light({ x: 21, y: 2.8, z: 0, intensity: 16, distance: 16, color: 0xff9a80, flicker: 0.15 });
  w.light({ x: 23, y: 2.8, z: 3.6, intensity: 5, distance: 7, color: 0xff6040, lamp: false });

  scene.add(new THREE.HemisphereLight(0x8a8aa6, 0x3a2e24, 0.9));
  scene.fog = new THREE.FogExp2(0x0b0a0c, 0.02);
  scene.background = new THREE.Color(0x0b0a0c);

  w.start = { x: -4.5, z: 0, yaw: -Math.PI / 2, crouched: true };
  return w;
}
