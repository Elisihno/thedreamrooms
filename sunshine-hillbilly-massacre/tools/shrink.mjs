// node tools/shrink.mjs  (static server on :8123 + playwright)
// Shrinks the textures inside a GLB without touching its meshes, skeleton or animations: images that are
// used are scaled down and re-encoded as JPEG, images nothing uses any more become 4x4 placeholders.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const M = new URL('../assets/models/', import.meta.url).pathname;
const JOBS = {
  // Grandpa: 0 = body atlas, 1 = its second map, 5 = the club, 6/7 = the shotgun (both removed from the game)
  'grandpa': { from: 'raw/grandpa_original.glb', images: { 0: 1024, 1: 512, 2: 256, 3: 256, 4: 64, 5: 0, 6: 0, 7: 0 } },
  // Chainsaw: 0 = paint, 1 = specular/glossiness (unused by three.js now), 2 = normal map, 3-5 = the glass
  'chainsaw': { from: 'raw/chainsaw_original.glb', images: { 0: 1024, 1: 0, 2: 1024, 3: 256, 4: 0, 5: 256 } },
};
const b = await chromium.launch(); const p = await b.newPage();
const enc = (data, max, q) => p.evaluate(async ([data, max, q]) => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob());
  const k = max ? Math.min(1, max / Math.max(bmp.width, bmp.height)) : 0;
  const w = max ? Math.max(1, Math.round(bmp.width * k)) : 4, h = max ? Math.max(1, Math.round(bmp.height * k)) : 4;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  if (max) g.drawImage(bmp, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q).split(',')[1];
}, [data, max, q]);
for (const [name, job] of Object.entries(JOBS)) {
  const buf = fs.readFileSync(M + job.from), jl = buf.readUInt32LE(12), j = JSON.parse(buf.slice(20, 20 + jl).toString()), bin = buf.slice(20 + jl + 8);
  const views = j.bufferViews.map(v => bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  for (const [i, im] of j.images.entries()) {
    const max = job.images[i] ?? 1024;
    views[im.bufferView] = Buffer.from(await enc(views[im.bufferView].toString('base64'), max, 0.86), 'base64');
    im.mimeType = 'image/jpeg';
  }
  const parts = []; let off = 0;
  j.bufferViews.forEach((v, i) => { v.byteOffset = off; v.byteLength = views[i].length; const pad = (4 - views[i].length % 4) % 4; parts.push(views[i], Buffer.alloc(pad)); off += views[i].length + pad; });
  j.buffers[0].byteLength = off;
  const nb = Buffer.concat(parts); let js = JSON.stringify(j); while (Buffer.byteLength(js) % 4) js += ' ';
  const jb = Buffer.from(js), total = 12 + 8 + jb.length + 8 + nb.length, out = Buffer.alloc(total);
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jb.length, 12); out.write('JSON', 16); jb.copy(out, 20);
  const bo = 20 + jb.length; out.writeUInt32LE(nb.length, bo); out.write('BIN\0', bo + 4); nb.copy(out, bo + 8);
  fs.writeFileSync(M + name + '.glb', out);
  console.log(name, (buf.length / 1e6).toFixed(2) + 'MB ->', (total / 1e6).toFixed(2) + 'MB');
}
await b.close();
