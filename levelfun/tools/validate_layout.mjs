// Run: node levelfun/tools/validate_layout.mjs
// Checks the spec totals and that the ordinary routes (doors + stairs, no secret passages) reach every room.
import { AREAS, OPENINGS, HIDING, CAMERAS, PASSAGES, LEVELS, areaById, STAIR, SPIRAL } from '../src/world/layout.js';
let bad = 0;
const fail = m => { console.log('FAIL', m); bad++; };
const rooms = AREAS.filter(a => a.room);
const perLevel = l => rooms.filter(a => a.level === l).length;
const expect = (name, got, want) => got === want ? console.log('ok  ', name, got) : fail(`${name}: ${got} (want ${want})`);
expect('rooms total', rooms.length, 29);
expect('rooms F1', perLevel('1'), 9); expect('rooms F2', perLevel('2'), 8); expect('rooms F3', perLevel('3'), 7); expect('rooms B', perLevel('B'), 5);
expect('hiding total', HIDING.length, 21);
for (const [l, n] of [['1', 8], ['2', 5], ['3', 6], ['B', 2]]) expect('hiding ' + l, HIDING.filter(h => h.level === l).length, n);
expect('hiding in security', HIDING.filter(h => h.room === 'security').length, 0);
expect('cameras', CAMERAS.length, 9);
for (const [l, n] of [['1', 4], ['2', 3], ['3', 2], ['B', 0]]) expect('cameras ' + l, CAMERAS.filter(h => h.level === l).length, n);
expect('secret passages', PASSAGES.length, 6);
// overlaps
for (const l of LEVELS) {
  const as = AREAS.filter(a => a.level === l);
  for (let i = 0; i < as.length; i++) for (let j = i + 1; j < as.length; j++) {
    const [a, b] = [as[i].rect, as[j].rect];
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) fail(`overlap ${l}: ${as[i].id} / ${as[j].id}`);
  }
}
// hiding spots / cameras inside their room
const inside = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
for (const h of HIDING) if (!inside(areaById(h.level, h.room).rect, h.x, h.z)) fail(`hiding outside room: ${h.level} ${h.room} ${h.x},${h.z}`);
for (const c of CAMERAS) if (!inside(areaById(c.level, c.room).rect, c.x, c.z)) fail(`camera outside room: ${c.room}`);
// openings: find the two areas they join
const nodes = new Map(); // key level:id
const edges = [];
for (const o of OPENINGS) {
  const mid = (o.a + o.b) / 2;
  const hit = AREAS.filter(a => {
    if (a.level !== o.level) return false;
    const [x0, z0, x1, z1] = a.rect;
    if (o.axis === 'x') return (Math.abs(z0 - o.c) < 1e-6 || Math.abs(z1 - o.c) < 1e-6) && mid > x0 && mid < x1 && o.a >= x0 && o.b <= x1;
    return (Math.abs(x0 - o.c) < 1e-6 || Math.abs(x1 - o.c) < 1e-6) && mid > z0 && mid < z1 && o.a >= z0 && o.b <= z1;
  });
  if (hit.length !== 2) { fail(`opening ${o.level} ${o.axis}=${o.c} ${o.a}-${o.b} joins ${hit.length} areas`); continue; }
  edges.push([o.level + ':' + hit[0].id, o.level + ':' + hit[1].id]);
}
// stairs link the hall/landing areas of each level
const stairArea = { B: 'bhall', 1: 'hall', 2: 'landing', 3: 'celeb' };
for (let i = 0; i < LEVELS.length - 1; i++) edges.push([LEVELS[i] + ':' + stairArea[LEVELS[i]], LEVELS[i + 1] + ':' + stairArea[LEVELS[i + 1]]]);
for (const a of AREAS) { const s = STAIR; if (a.id === stairArea[a.level] && !(a.rect[0] <= s.x0 && a.rect[2] >= s.x1 && a.rect[1] <= s.z0 && a.rect[3] >= s.z1)) fail('stair footprint not inside ' + a.level + ':' + a.id); }
const adj = new Map(); for (const [a, b] of edges) { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
const start = '1:reception', seen = new Set([start]), q = [start];
while (q.length) { const n = q.shift(); for (const m of adj.get(n) || []) if (!seen.has(m)) { seen.add(m); q.push(m); } }
for (const a of AREAS) if (!seen.has(a.level + ':' + a.id)) fail('unreachable by ordinary routes: ' + a.level + ':' + a.id);
console.log(`reachable areas: ${seen.size}/${AREAS.length}`);
console.log(bad ? `${bad} problem(s)` : 'LAYOUT OK');
process.exit(bad ? 1 : 0);
