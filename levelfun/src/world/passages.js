import * as THREE from '../three.js';
import { PASSAGES, LEVEL_Y, CEIL } from './layout.js';
import { getMaterial } from '../assets/registry.js';

// Secret passages: a floor hatch in the upper room, a crawl duct through the 0.9 m gap between floors,
// and a ladder down through a ceiling hatch in the lower room. All of it stays sealed until opened.
// Passage 5 is the vertical maintenance shaft on the building's east side.
const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const sn = v => Math.round(v * 4) / 4;
const RUN = 1.0, LADDER = 3.0, CELL = 0.25, HW = 0.75;   // tunnels are 1.5 m wide: comfortable for the 0.56 m player

function geometry(p) {
  const u = p.upper, yU = LEVEL_Y[u.level], yP = yU - 1;
  const [dx, dz] = DIR[u.dir];
  const ux = sn(u.x), uz = sn(u.z);
  const hatch = dx !== 0
    ? { rect: [Math.min(ux, ux + dx * RUN), uz - HW, Math.max(ux, ux + dx * RUN), uz + HW], axis: 'x', topFirst: dx > 0 }
    : { rect: [ux - HW, Math.min(uz, uz + dz * RUN), ux + HW, Math.max(uz, uz + dz * RUN)], axis: 'z', topFirst: dz > 0 };
  hatch.h0 = hatch.topFirst ? yU : yP; hatch.h1 = hatch.topFirst ? yP : yU;
  const bottom = [ux + dx * RUN, uz + dz * RUN];
  const pts = [bottom, ...p.crawl.map(c => [sn(c[0]), sn(c[1])])];
  const T = pts[pts.length - 1];
  const l = p.lower, yL = LEVEL_Y[l.level], [lx, lz] = DIR[l.dir];
  let ladder, ceilHole;
  if (lx !== 0) {
    const xa = T[0], xb = T[0] + lx * LADDER, xh = T[0] + lx * 2.2;
    ladder = { rect: [Math.min(xa, xb), T[1] - HW, Math.max(xa, xb), T[1] + HW], axis: 'x', topFirst: lx > 0 };
    ceilHole = [Math.min(xa, xh), T[1] - HW, Math.max(xa, xh), T[1] + HW];
  } else {
    const za = T[1], zb = T[1] + lz * LADDER, zh = T[1] + lz * 2.2;
    ladder = { rect: [T[0] - HW, Math.min(za, zb), T[0] + HW, Math.max(za, zb)], axis: 'z', topFirst: lz > 0 };
    ceilHole = [T[0] - HW, Math.min(za, zh), T[0] + HW, Math.max(za, zh)];
  }
  ladder.h0 = ladder.topFirst ? yP : yL; ladder.h1 = ladder.topFirst ? yL : yP;
  return { yU, yP, yL, hatch, pts, T, ladder, ceilHole, ldir: [lx, lz] };
}

export function passageHoles() {
  const out = { floor: {}, ceil: {} };
  for (const p of PASSAGES) {
    if (p.shaft) continue;
    const g = geometry(p);
    (out.floor[p.upper.level] ||= []).push(g.hatch.rect);
    (out.ceil[p.lower.level] ||= []).push(g.ceilHole);
  }
  return out;
}

class Passage {
  constructor(p) { this.id = p.id; this.name = p.name; this.requires = p.requires; this.isOpen = false; this.onOpen = []; this.closedThings = []; this.openThings = []; }
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    for (const t of this.closedThings) t();
    for (const t of this.openThings) t();
  }
}

export function buildPassages(w) {
  const mats = { plate: 'diamond_plate', wall: 'panel_concrete', cover: 'hazard_stripes' };
  return PASSAGES.map(p => (p.shaft ? buildShaft(w, p) : buildCrawl(w, p, mats)));
}

function cellsOf(rects) {
  const set = new Set();
  for (const r of rects) {
    for (let cx = Math.round(r[0] / CELL); cx < Math.round(r[2] / CELL); cx++)
      for (let cz = Math.round(r[1] / CELL); cz < Math.round(r[3] / CELL); cz++) set.add(cx + ',' + cz);
  }
  return set;
}

function buildCrawl(w, p, mats) {
  const P = new Passage(p), g = geometry(p);
  const { yU, yP, yL } = g, up = p.upper.level, lo = p.lower.level;

  // --- crawl segments (extended 0.5 m into interior joints so corners are filled) ---
  const segs = [];
  for (let i = 0; i < g.pts.length - 1; i++) {
    const A = g.pts[i], B = g.pts[i + 1];
    const horiz = Math.abs(A[1] - B[1]) < 1e-6, vert = Math.abs(A[0] - B[0]) < 1e-6;
    if (!horiz && !vert) throw new Error(`passage ${p.id}: crawl segment ${i} is not axis-aligned`);
    const ext0 = i > 0 ? HW : 0, ext1 = i + 1 < g.pts.length - 1 ? HW : 0;
    if (horiz) { const s = Math.sign(B[0] - A[0]) || 1; const xa = A[0] - s * ext0, xb = B[0] + s * ext1; segs.push([Math.min(xa, xb), A[1] - HW, Math.max(xa, xb), A[1] + HW]); }
    else { const s = Math.sign(B[1] - A[1]) || 1; const za = A[1] - s * ext0, zb = B[1] + s * ext1; segs.push([A[0] - HW, Math.min(za, zb), A[0] + HW, Math.max(za, zb)]); }
  }
  // the top metre of the ladder counts as part of the crawl space (so a turn at the ladder works)
  const [lx, lz] = g.ldir, T = g.T;
  const ladderTop = lx !== 0 ? [Math.min(T[0], T[0] + lx), T[1] - HW, Math.max(T[0], T[0] + lx), T[1] + HW] : [T[0] - HW, Math.min(T[1], T[1] + lz), T[0] + HW, Math.max(T[1], T[1] + lz)];
  const crawlCells = cellsOf([...segs, ladderTop]), rampCells = cellsOf([g.hatch.rect]);
  const occupied = (cx, cz) => crawlCells.has(cx + ',' + cz) || rampCells.has(cx + ',' + cz);

  // --- walls along the boundary of the duct, merged into runs ---
  const hEdges = new Map(), vEdges = new Map();   // key line -> [{c, tall}]
  const push = (map, line, c, tall) => { (map.get(line) || map.set(line, []).get(line)).push({ c, tall }); };
  // the hatch's entry edge (where you step onto the ramp from the room) stays open
  const hr0 = g.hatch.rect, topLine = g.hatch.axis === 'x'
    ? Math.round((g.hatch.topFirst ? hr0[0] : hr0[2]) / CELL) : Math.round((g.hatch.topFirst ? hr0[1] : hr0[3]) / CELL);
  // ...and the far side of the ladder's top metre stays open too
  const farLine = Math.round((lx !== 0 ? T[0] + lx : T[1] + lz) / CELL);
  for (const set of [crawlCells, rampCells]) {
    const tall = set === rampCells;
    for (const key of set) {
      const [cx, cz] = key.split(',').map(Number);
      const skipH = (tall && g.hatch.axis === 'z') ? topLine : (!tall && lx === 0 ? farLine : null);
      const skipV = (tall && g.hatch.axis === 'x') ? topLine : (!tall && lx !== 0 ? farLine : null);
      if (!occupied(cx, cz - 1) && cz !== skipH) push(hEdges, cz, cx, tall);
      if (!occupied(cx, cz + 1) && cz + 1 !== skipH) push(hEdges, cz + 1, cx, tall);
      if (!occupied(cx - 1, cz) && cx !== skipV) push(vEdges, cx, cz, tall);
      if (!occupied(cx + 1, cz) && cx + 1 !== skipV) push(vEdges, cx + 1, cz, tall);
    }
  }
  const runs = (map, fn) => {
    for (const [line, arr] of map) {
      for (const tall of [false, true]) {
        const cs = arr.filter(e => e.tall === tall).map(e => e.c).sort((a, b) => a - b);
        for (let i = 0; i < cs.length;) {
          let j = i; while (j + 1 < cs.length && cs[j + 1] === cs[j] + 1) j++;
          fn(line * CELL, cs[i] * CELL, (cs[j] + 1) * CELL, tall);
          i = j + 1;
        }
      }
    }
  };
  const wallTop = tall => (tall ? yU : yP + 0.9);
  runs(hEdges, (z, x0, x1, tall) => {
    w.block(up, x0 - 0.05, z - 0.05, x1 + 0.05, z + 0.05, yP, wallTop(tall), mats.wall, { collide: true, y0: yP - 0.5, y1: tall ? yU + 0.1 : yP + 1.0 });
  });
  runs(vEdges, (x, z0, z1, tall) => {
    w.block(up, x - 0.05, z0 - 0.05, x + 0.05, z1 + 0.05, yP, wallTop(tall), mats.wall, { collide: true, y0: yP - 0.5, y1: tall ? yU + 0.1 : yP + 1.0 });
  });
  // roof colliders (stop the player standing up) + visual floor/roof for the crawl cells
  // The roof collider starts 0.4 m past the hatch ramp so the player (still sloping down at the ramp's foot) clears it.
  segs.forEach((s, i) => {
    const roof = s.slice();
    if (i === 0) {
      const A = g.pts[0], B = g.pts[1], horiz = Math.abs(A[1] - B[1]) < 1e-6;
      const sg = Math.sign(horiz ? B[0] - A[0] : B[1] - A[1]) || 1;
      if (horiz) { if (sg > 0) roof[0] += 0.4; else roof[2] -= 0.4; } else { if (sg > 0) roof[1] += 0.4; else roof[3] -= 0.4; }
    }
    w.block(up, roof[0], roof[1], roof[2], roof[3], yP + 0.85, yP + 1.0, mats.wall, { collide: true, y0: yP + 0.85, y1: yP + 1.0, cast: false, receive: false });
    w.block(up, s[0], s[1], s[2], s[3], yP - 0.05, yP + 0.004, 'concrete_dark', { collide: false, cast: false });
  });
  for (const s of segs) w.flat(s, yP, [], 'duct').enabled = false;
  const ductSurfaces = w.surfaces.slice(-segs.length);

  // --- hatch ramp (upper room) ---
  const hr = g.hatch.rect;
  const hatchRamp = w.ramp(hr, g.hatch.axis, g.hatch.h0, g.hatch.h1, 'hatch'); hatchRamp.enabled = false;
  const hatchVis = new THREE.Group(); hatchVis.visible = false; w.group(up).add(hatchVis);
  addSteps(hatchVis, hr, g.hatch.axis, g.hatch.h0, g.hatch.h1, 4, yU);

  // cover that fills the hole while the passage is sealed
  const hCover = new THREE.Mesh(new THREE.BoxGeometry(hr[2] - hr[0] - 0.04, 0.06, hr[3] - hr[1] - 0.04), getMaterial(mats.cover));
  hCover.position.set((hr[0] + hr[2]) / 2, yU - 0.02, (hr[1] + hr[3]) / 2);
  w.group(up).add(hCover);
  const hCoverSurface = w.flat(hr, yU, [], 'hatch-cover');
  w.interactable({ x: (hr[0] + hr[2]) / 2, y: yU, z: (hr[1] + hr[3]) / 2, radius: 2.4, kind: 'hatch', passage: P, onUse: () => P.open() });

  // --- ladder (lower room) ---
  const lr = g.ladder.rect;
  const ladderRamp = w.ramp(lr, g.ladder.axis, g.ladder.h0, g.ladder.h1, 'ladder'); ladderRamp.enabled = false;
  const ladderVis = new THREE.Group(); ladderVis.visible = false; w.group(lo).add(ladderVis);
  addSteps(ladderVis, lr, g.ladder.axis, g.ladder.h0, g.ladder.h1, 6, yL);
  const ladderBoxes = [];
  const side = (x0, z0, x1, z1) => { const b = w.collision.add(x0, z0, x1, z1, yL - 0.5, g.yP + 0.1); b.enabled = false; ladderBoxes.push(b); };
  if (g.ladder.axis === 'x') { side(lr[0], lr[1] - 0.1, lr[2], lr[1]); side(lr[0], lr[3], lr[2], lr[3] + 0.1); }
  else { side(lr[0] - 0.1, lr[1], lr[0], lr[3]); side(lr[2], lr[1], lr[2] + 0.1, lr[3]); }
  const nSeg = 6, along = g.ladder.axis === 'x' ? lr[2] - lr[0] : lr[3] - lr[1];
  for (let i = 0; i < nSeg; i++) {
    const t0 = i / nSeg, t1 = (i + 1) / nSeg;
    const hA = g.ladder.h0 + (g.ladder.h1 - g.ladder.h0) * t0, hB = g.ladder.h0 + (g.ladder.h1 - g.ladder.h0) * t1;
    const hLow = Math.min(hA, hB); if (hLow - 0.3 <= yL) continue;
    const a = (g.ladder.axis === 'x' ? lr[0] : lr[1]) + along * t0, b = (g.ladder.axis === 'x' ? lr[0] : lr[1]) + along * t1;
    const box = g.ladder.axis === 'x' ? w.collision.add(a, lr[1], b, lr[3], yL, hLow - 0.3) : w.collision.add(lr[0], a, lr[2], b, yL, hLow - 0.3);
    box.enabled = false; ladderBoxes.push(box);
  }
  // ceiling cover in the lower room
  const ch = g.ceilHole;
  const cCover = new THREE.Mesh(new THREE.BoxGeometry(ch[2] - ch[0] - 0.04, 0.06, ch[3] - ch[1] - 0.04), getMaterial('panel_concrete'));
  cCover.position.set((ch[0] + ch[2]) / 2, yL + CEIL + 0.02, (ch[1] + ch[3]) / 2);
  w.group(lo).add(cCover);
  w.interactable({ x: (ch[0] + ch[2]) / 2, y: yL + CEIL, z: (ch[1] + ch[3]) / 2, radius: 2.6, kind: 'hatch', passage: P, onUse: () => P.open() });

  P.openThings.push(() => {
    hCover.visible = false; cCover.visible = false; hCoverSurface.enabled = false;
    hatchRamp.enabled = true; ladderRamp.enabled = true; hatchVis.visible = true; ladderVis.visible = true;
    ductSurfaces.forEach(s => { s.enabled = true; });
    ladderBoxes.forEach(b => { b.enabled = true; });
  });
  return P;
}

// Stepped planks for ladders and hatch stairs.
function addSteps(group, rect, axis, h0, h1, n, floorY) {
  const mat = getMaterial('diamond_plate');
  const len = axis === 'x' ? rect[2] - rect[0] : rect[3] - rect[1];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, h = h0 + (h1 - h0) * t, a = len * i / n, l = len / n;
    const g = axis === 'x' ? new THREE.BoxGeometry(l * 0.8, 0.07, rect[3] - rect[1] - 0.1) : new THREE.BoxGeometry(rect[2] - rect[0] - 0.1, 0.07, l * 0.8);
    const m = new THREE.Mesh(g, mat);
    m.position.set(axis === 'x' ? rect[0] + a + l / 2 : (rect[0] + rect[2]) / 2, h - 0.04, axis === 'x' ? (rect[1] + rect[3]) / 2 : rect[1] + a + l / 2);
    group.add(m);
  }
}

function buildShaft(w, p) {
  const P = new Passage(p), s = p.shaft;
  const yTop = LEVEL_Y['3'], yBot = LEVEL_Y.B;
  const z0 = s.openTop[0], z1 = s.openBottom[1];
  const rect = [s.x0, z0, s.x1, z1];
  // walkable: top platform, steep ramp, bottom platform
  const ramp = w.ramp([s.x0, s.zTop, s.x1, s.zBottom], 'z', yTop, yBot, 'shaft'); ramp.enabled = false;
  const top = w.flat([s.x0, z0, s.x1, s.zTop], yTop, [], 'shaft'); top.enabled = false;
  const bottom = w.flat([s.x0, s.zBottom, s.x1, z1], yBot, [], 'shaft'); bottom.enabled = false;
  // shell (outside the building, in the always-group)
  w.block('always', s.x1, z0 - 0.1, s.x1 + 0.1, z1 + 0.1, yBot - 0.5, yTop + 2.5, 'panel_concrete');
  w.block('always', s.x0, z0 - 0.1, s.x1, z0, yBot - 0.5, yTop + 2.5, 'panel_concrete');
  w.block('always', s.x0, z1, s.x1, z1 + 0.1, yBot - 0.5, yTop + 2.5, 'panel_concrete');
  w.block('always', s.x0, z0, s.x1, z1, yTop + 2.4, yTop + 2.5, 'panel_concrete', { collide: false });
  // rungs
  const rungs = new THREE.Group(); rungs.visible = false; w.always.add(rungs);
  const nr = 24, mat = getMaterial('diamond_plate');
  for (let i = 0; i < nr; i++) {
    const t = (i + 0.5) / nr, h = yTop + (yBot - yTop) * t, z = s.zTop + (s.zBottom - s.zTop) * t;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 - 0.1, 0.06, (s.zBottom - s.zTop) / nr * 0.7), mat);
    m.position.set((s.x0 + s.x1) / 2, h - 0.04, z); rungs.add(m);
  }
  // blocks the space under the steep ramp
  const under = [];
  const segN = 12;
  for (let i = 0; i < segN; i++) {
    const za = s.zTop + (s.zBottom - s.zTop) * i / segN, zb = s.zTop + (s.zBottom - s.zTop) * (i + 1) / segN;
    const hLow = Math.min(yTop + (yBot - yTop) * i / segN, yTop + (yBot - yTop) * (i + 1) / segN);
    if (hLow - 0.3 <= yBot) continue;
    const b = w.collision.add(s.x0, za, s.x1, zb, yBot, hLow - 0.3); b.enabled = false; under.push(b);
  }
  // covers in the two wall openings
  const mk = (level, o) => {
    const y0 = LEVEL_Y[level];
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.25, o[1] - o[0] - 0.04), getMaterial('hazard_stripes'));
    cover.position.set(59.95, y0 + 1.125, (o[0] + o[1]) / 2);
    w.group(level).add(cover);
    const box = w.collision.add(59.9, o[0], 60.1, o[1], y0, y0 + 2.25);
    w.interactable({ x: 59.9, y: y0 + 1.1, z: (o[0] + o[1]) / 2, radius: 2.4, kind: 'hatch', passage: P, onUse: () => P.open() });
    return () => { cover.visible = false; box.enabled = false; };
  };
  const hideTop = mk('3', s.openTop), hideBottom = mk('B', s.openBottom);
  P.openThings.push(() => {
    hideTop(); hideBottom();
    ramp.enabled = true; top.enabled = true; bottom.enabled = true; rungs.visible = true; under.forEach(b => { b.enabled = true; });
  });
  return P;
}
