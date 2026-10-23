// node tools/bake.mjs  (needs a static server on :8123 serving the game folder, and playwright)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const R = '../assets/models/raw/', OUT = new URL('../assets/models/', import.meta.url).pathname;
const JOBS = [
  // the back run of the kitchen: base cabinets with a sink, the counter top, wall cabinets and handles (one L-kitchen, cut to its long wall)
  { name: 'kitchen_run', src: R + 'kitchen_cabinets.glb', unit: 0.0254, topOf: 'SketchUp', anchor: 'back', maxTex: 512,
    select: 's.x < 2.6 && s.z < 1.0 && c.z < -1.55 && c.x > -2.1 && c.x < 1.95 && s.y < 1.4' },
  { name: 'dining_set', src: R + 'table_and_chairs.glb', fit: 'max', size: 2.7, anchor: 'center', maxTex: 512 },
  { name: 'trestle_table', src: R + 'vintage_table.glb', fit: 'max', size: 1.9, anchor: 'center', maxTex: 512 },
  { name: 'butcher_hooks', src: R + 'butcher_hook.glb', fit: 'y', size: 2.3, anchor: 'center', maxTex: 512 },
  { name: 'bone_pile', src: R + 'bone_pile.glb', fit: 'max', size: 0.62, anchor: 'center', maxTex: 512 },
  { name: 'chair', src: R + 'chair.glb', fit: 'y', size: 0.95, anchor: 'center', maxTex: 512, out: 'optional/' },
  { name: 'kettle', src: R + 'kettle_s.glb', fit: 'max', size: 0.3, anchor: 'center', maxTex: 256 },
  { name: 'candelabra', src: R + 'candelabra_s.glb', fit: 'y', size: 0.5, anchor: 'center', maxTex: 256 },
  { name: 'cleaver', src: R + 'cleaver.glb', fit: 'max', size: 0.34, anchor: 'center', maxTex: 256 },
  { name: 'old_fridge', src: R + 'old_fridge.glb', fit: 'y', size: 1.75, anchor: 'center', maxTex: 512 },
  { name: 'copper_pots', src: R + 'copper_pots_s.glb', fit: 'max', size: 0.7, anchor: 'center', maxTex: 512 },
  { name: 'wood_stove', src: R + 'wood_stove_s.glb', fit: 'y', size: 1.3, anchor: 'center', maxTex: 512 },
  { name: 'dish_rack', src: R + 'dish_rack_s.glb', fit: 'max', size: 0.6, anchor: 'center', maxTex: 512 },
  { name: 'bird_cage', src: R + 'bird_cage_s.glb', fit: 'y', size: 0.55, anchor: 'center', maxTex: 256 },
  { name: 'kitchen_knife', src: R + 'kitchen_knife_s.glb', fit: 'max', size: 0.32, anchor: 'center', maxTex: 256 },
  { name: 'dead_bird', src: R + 'dead_bird_s.glb', fit: 'max', size: 0.22, anchor: 'center', maxTex: 256 },
  { name: 'wall_clock', src: R + 'wall_clock.glb', fit: 'y', size: 1.5, anchor: 'center', maxTex: 512 },
  { name: 'morris_chair', src: R + 'morris_chair.glb', fit: 'y', size: 1.05, anchor: 'center', maxTex: 512 },
  { name: 'chest_freezer', src: R + 'chest_freezer.glb', fit: 'x', size: 1.4, anchor: 'center', maxTex: 512 },
  { name: 'armadillo', src: R + 'armadillo_s.glb', fit: 'max', size: 0.75, anchor: 'center', maxTex: 512 },
  { name: 'bird_skull', src: R + 'bird_skull_s.glb', fit: 'max', size: 0.12, anchor: 'center', maxTex: 256 },
  { name: 'old_bed', src: R + 'hospital_bed.glb', fit: 'max', size: 2.0, anchor: 'center', maxTex: 512 },
  // three finishes stand side by side in the download: austere (left), ornate (middle), painted blue (right, not used)
  { name: 'drawers_austere', src: R + 'drawer_table.glb', topOf: 'GLTF_SceneRootNode', select: 'c.x < -0.7', fit: 'x', size: 1.3, anchor: 'back', maxTex: 512 },
  { name: 'drawers_ornate', src: R + 'drawer_table.glb', topOf: 'GLTF_SceneRootNode', select: 'c.x > -0.7 && c.x < 0.7', fit: 'x', size: 1.3, anchor: 'back', maxTex: 512 },
];
const only = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); });
await p.goto('http://localhost:8123/tools/bake.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
for (const job of JOBS) {
  if (only.length && !only.includes(job.name)) continue;
  const r = await p.evaluate(j => window.bake(j), job);
  const dir = OUT + (job.out ?? ''); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + job.name + '.glb', Buffer.from(r.data, 'base64'));
  console.log(`${job.name}: ${(r.bytes / 1e6).toFixed(2)}MB tris ${r.tris} materials ${r.materials} nodes ${r.nodes} size ${r.size} min ${r.min}`);
}
await b.close();
