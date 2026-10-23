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
