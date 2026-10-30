import * as THREE from './three.js';
import { BUILD, CFG } from './config.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { Input } from './core/input.js';
import { initTouch } from './core/touch.js';
import { createRenderer, applyQuality, resize } from './core/renderer.js';
import { configureAssets, preloadTextures } from './assets/registry.js';
import { buildBuilding } from './world/building.js';
import { LightPool } from './world/lightpool.js';
import { START, LEVEL_Y, LEVELS, LEVEL_NAME, CAMERAS, AREAS } from './world/layout.js';
import { loadModels, screenMaterials } from './assets/models.js';
import { Player } from './player.js';
import { playGame, GAMES } from './arcade/games.js';
import { ItemSystem } from './items/items.js';
import { UseSystem } from './items/uses.js';
import { initAudio, sfx } from './audio/sfx.js';
import { Smiley, DIFFICULTY } from './ai/smiley.js';

const $ = id => document.getElementById(id);
const settings = loadSettings();
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
document.body.classList.toggle('touch', isTouch);

const qd = /[?&]difficulty=(\w+)/.exec(location.search); if (qd) settings.difficulty = qd[1];
if (!(settings.difficulty in DIFFICULTY)) settings.difficulty = 'normal';
configureAssets({ texSize: CFG.quality[settings.quality].texSize, aniso: CFG.quality[settings.quality].aniso });

const canvas = $('game');
// Birthday-party lettering for the action buttons: every letter in its own colour, tilted and bouncing a little.
function partyLetters(el, text) {
  const cols = ['#ff4f5e', '#ffd23c', '#3fd0ff', '#7ee05a', '#ff8ad8', '#ff9a1f'];
  el.setAttribute('aria-label', text); el.textContent = '';
  [...text].forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch; s.style.color = cols[(i * 2 + text.length) % cols.length]; s.style.transform = `translateY(${i % 2 ? -0.06 : 0.05}em) rotate(${[-9, 6, -4, 8][i % 4]}deg)`; el.appendChild(s); });
}
partyLetters($('usebtn'), 'USE'); partyLetters($('dropbtn'), 'DROP');

const renderer = createRenderer(canvas, settings.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 80);
scene.add(camera);

// Quality buttons work during loading too; applyQuality runs once the world exists.
let onQuality = null, onDifficulty = null;
document.querySelectorAll('[data-setting]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.setting, v = b.dataset.value;
  settings[k] = k === 'quality' || k === 'crouchMode' || k === 'difficulty' ? v : Number(v);
  if (k === 'quality') onQuality?.();
  if (k === 'difficulty') onDifficulty?.();
  saveSettings(settings);
  document.querySelectorAll('[data-setting]').forEach(x => x.classList.toggle('on', String(settings[x.dataset.setting]) === x.dataset.value));
}));
document.querySelectorAll('[data-setting]').forEach(x => x.classList.toggle('on', String(settings[x.dataset.setting]) === x.dataset.value));
// Start-up progress: models 0-45 %, textures 45-70 %, world build 70-100 %.
const setLoad = (frac, msg) => { $('loadfill').style.width = Math.round(frac * 100) + '%'; $('loadmsg').textContent = msg; };
$('primary').disabled = true;
$('primary').textContent = 'LOADING…';
setLoad(0.02, 'Loading models…');
let modelsDone = 0, texDone = 0;
try {
  await Promise.all([
    loadModels(undefined, f => { modelsDone = f; setLoad(0.45 * modelsDone + 0.25 * texDone, `Loading… models ${Math.round(modelsDone * 100)}%, textures ${Math.round(texDone * 100)}%`); }),
    preloadTextures(f => { texDone = f; setLoad(0.45 * modelsDone + 0.25 * texDone, `Loading… models ${Math.round(modelsDone * 100)}%, textures ${Math.round(texDone * 100)}%`); }),
  ]);
} catch (e) { $('primary').textContent = 'Load failed'; $('loadmsg').textContent = 'Load failed: ' + (e && e.message || e); throw e; }
setLoad(0.72, 'Building the building… (can take a while on phones)');
$('primary').textContent = 'BUILDING…';
await new Promise(r => setTimeout(r, 60));   // let the label paint before the (synchronous) build
scene.background = new THREE.Color(0x0b0a0c);
scene.fog = new THREE.FogExp2(0x0b0a0c, 0.02);
const ambient = new THREE.HemisphereLight(0x8a8aa6, 0x3a2e24, 1.1);
scene.add(ambient);
const world = buildBuilding(scene);
const pool = new LightPool(scene, world.lightDefs, 8);
const input = new Input(settings);
input.canvas = canvas;
const player = new Player(camera, world, input);
const startPos = { x: START.x, z: START.z, y: LEVEL_Y[START.level], yaw: START.yaw, crouched: true };
player.teleport(startPos);
const items = new ItemSystem(scene, camera, world);
ItemSystem.clear();   // a run is never resumed: every launch is a fresh game with newly scattered items (and no test layouts carried over)
items.init(null);
const uses = new UseSystem({ items, world, player, camera, scene, ui: { toast: m => toast(m), note: d => showNote(d), ending: k => showEnding(k), flash: () => doFlash(), need: t => showNeed(t) } });
uses.restore(items.loadedExtra);
if (!uses.p.day) uses.p.day = 1;
const smiley = new Smiley({ scene, world, player, items, camera, difficulty: settings.difficulty });
smiley.respawn(12);
smiley.onCatch = kind => startScare(kind);
const DIFFNOTE = { practice: 'Practice: Smiley is not in the building. Explore in peace.', easy: 'Easy: Smiley walks slowly (75%).', normal: 'Normal: Smiley is a little slower than you (90%).', hard: 'Hard: Smiley walks as fast as you (100%).', extreme: 'Extreme: Smiley is faster than you (110%), hears much further and checks hiding places he saw.' };
onDifficulty = () => { const was = smiley.present; smiley.difficulty = settings.difficulty; if (smiley.present && !was) smiley.respawn(20); $('diffnote').textContent = DIFFNOTE[settings.difficulty]; };
$('diffnote').textContent = DIFFNOTE[settings.difficulty];
addEventListener('pointerdown', initAudio, { once: true });
const releaseTouch = initTouch(input, $('touch-ui'), settings);

applyQuality(renderer, settings.quality, pool, world);
resize(renderer, camera);
addEventListener('resize', () => resize(renderer, camera));

// ---- State & menu ----
let running = false;   // game started
let paused = true;
$('build').textContent = BUILD;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), /^Error/.test(msg) ? 8000 : 900);
}

function syncMenu() {
  document.querySelectorAll('[data-setting]').forEach(b => b.classList.toggle('on', String(settings[b.dataset.setting]) === b.dataset.value));
  $('sens').value = settings.sensitivity; $('sensv').textContent = settings.sensitivity.toFixed(2);
  $('fov').value = settings.fov; $('fovv').textContent = settings.fov;
}

function setPaused(p) {
  paused = p;
  input.enabled = !p;
  $('menu').hidden = !p;
  $('touch-ui').hidden = p || !isTouch;
  if (p) { $('pcmark').hidden = $('pcname').hidden = true; }
  $('primary').textContent = running ? 'RESUME' : 'START';
  $('hint').hidden = running;
  if (p) { items.save(); releaseTouch(); if (document.pointerLockElement) document.exitPointerLock(); }
  else if (!isTouch) canvas.requestPointerLock?.();
  syncMenu();
}

// Wake-up: eyelids open, vision clears, and the player rises from the floor.
function startWake() {
  player.wake();
  for (const el of [$('lids'), canvas]) { el.classList.remove('waking'); void el.offsetWidth; el.classList.add('waking'); }
}

async function enterFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch (e) { /* not supported (e.g. iOS Safari) */ }
}

// Any way of leaving the start menu counts as starting the game (floor jumps, passage unlock, respawn).
function startRunning() { initAudio(); if (!running) { running = true; if (isTouch) enterFullscreen(); } }
$('primary').addEventListener('click', () => {
  initAudio();
  const first = !running;
  if (first) { running = true; if (isTouch) enterFullscreen(); }
  setPaused(false);
  if (first) showDayCard(uses.p.day, 2600, () => startWake());
});
$('fs').addEventListener('click', enterFullscreen);
const SPOTS = { B: { x: 24, z: 4, yaw: -Math.PI / 2 }, 1: { x: 24, z: 8, yaw: -Math.PI / 2 }, 2: { x: 30, z: 11.5, yaw: -Math.PI / 2 }, 3: { x: 24, z: 8, yaw: -Math.PI / 2 } };
document.querySelectorAll('[data-floor]').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.floor, sp = SPOTS[id];
  startRunning(); player.teleport({ x: sp.x, z: sp.z, y: LEVEL_Y[id], yaw: sp.yaw }); setPaused(false);
}));
$('spawnall').addEventListener('click', () => { startRunning(); player.wakeT = 99; items.spawnAllInFront(player); setPaused(false); toast('All items laid out in front of you'); });
$('xray').addEventListener('click', () => { smiley.setXray(!smiley.xray); $('xray').textContent = 'Show Smiley, green glow through walls (test): ' + (smiley.xray ? 'ON' : 'OFF'); });
$('newgame').addEventListener('click', () => { if (confirm('Start a new game? Item positions are re-rolled.')) { ItemSystem.clear(); location.reload(); } });
addEventListener('pagehide', () => items.save());
$('unlock').addEventListener('click', () => { startRunning(); world.passages.forEach(p => p.open()); setPaused(false); toast('All secret passages opened (test)'); });
$('respawn').addEventListener('click', () => { startRunning(); player.teleport(startPos); setPaused(false); startWake(); });

onQuality = () => applyQuality(renderer, settings.quality, pool, world);
$('sens').addEventListener('input', e => { settings.sensitivity = Number(e.target.value); saveSettings(settings); syncMenu(); });
$('fov').addEventListener('input', e => { settings.fov = Number(e.target.value); camera.fov = settings.fov; camera.updateProjectionMatrix(); saveSettings(settings); syncMenu(); });

input.on('pause', () => { if (running && !paused) setPaused(true); });
// Nearest interactable the player is looking at (doors, secret hatches, later items).
const _dir = new THREE.Vector3(), _pv = new THREE.Vector3();
function findTarget() {
  if (player.hide) return { kind: 'unhide', x: 0, y: 0, z: 0, onUse: () => exitHide() };
  const it = items.target();
  if (it) return { kind: 'item', item: it, onUse: () => items.pickUp(it) };
  const st = uses.stationTarget(items.heldId());   // machines and locks: the hand shows; wrong item says what you need
  if (st) return { kind: 'station', station: st, onUse: () => uses.useStation(st) };
  const eye = camera.position; camera.getWorldDirection(_dir);
  let best = null, bestScore = 0.45;
  for (const it of world.interactables) {
    const dx = it.x - eye.x, dy = it.y - eye.y, dz = it.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > it.radius || Math.abs(dy) > 2.6) continue;
    const dot = (dx * _dir.x + dy * _dir.y + dz * _dir.z) / Math.max(d, 0.001);
    const score = dot - d * 0.08;
    if (dot > 0.35 && score > bestScore) { best = it; bestScore = score; }
  }
  return best;
}
input.on('interact', () => {
  const best = findTarget();
  if (best) {
    try { best.onUse(items.heldId()); } catch (e) { toast('Error: ' + (e && e.message || e)); throw e; }
    if (best.kind === 'arcade') toast('Loading ' + GAMES[best.game].title + '…');
  } else if (items.held && uses.canUse()) uses.useHeld();
});
input.on('use', () => { if (!modal) uses.useHeld(); });
// ---- Overlays: notes, the keypad, endings ----
let modal = null;
function enterModal(id) { if (modal) return false; setPaused(true); $('menu').hidden = true; $(id).hidden = false; modal = id; return true; }
function leaveModal() { if (!modal) return; $(modal).hidden = true; modal = null; setPaused(false); }
function showNote(d) { if (!enterModal('note')) return; $('notet').textContent = d.title; $('noteb').textContent = d.body; $('noteb').classList.toggle('bignum', !!d.big); }
$('noteclose').addEventListener('click', leaveModal);
addEventListener('keydown', e => { if (modal && modal !== 'ending' && modal !== 'cams' && e.code === 'Escape') leaveModal(); });
function showEnding(kind) {
  items.save(); if (!enterModal('ending')) return;
  const E = $('ending'); E.className = kind;
  $('endt').textContent = kind === 'over' ? 'GAME OVER' : kind === 'exit' ? 'YOU ESCAPED LEVEL FUN' : 'YOU ESCAPED';
  $('endp').textContent = kind === 'over' ? 'Smiley found you on the fifth day. The party is never over.' : kind === 'exit'
    ? 'The emergency door opens onto a yellow hallway of buzzing lights and damp carpet. You have left Level Fun... but not the Backrooms.'
    : 'The service elevator groans open onto warm daylight. Real grass, real sky. You made it out.';
}
$('endbtn').addEventListener('click', () => { ItemSystem.clear(); location.reload(); });
let needT = 0;
function showNeed(text) { const n = $('need'); n.textContent = text; n.hidden = false; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); clearTimeout(needT); needT = setTimeout(() => { n.hidden = true; }, 1900); }
function doFlash() { const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 70); }

// ---- Hiding places: step into tables, lockers, stalls, benches, tunnels and nooks; Smiley only checks one he saw you enter ----
function enterHide(sp) {
  if (player.hide || scare) return;
  const px = player.pos.x, pz = player.pos.z, py = player.pos.y;
  smiley.noteHide(sp, px, pz);
  player.hide = { spot: sp, eye: sp.kind === 'locker' || sp.kind === 'stall' ? 1.25 : 0.6, ox: px, oy: py, oz: pz };
  player.crouched = true; input.crouch = true;
  toast('Hiding. Tap the hand to come out.');
}
function exitHide() {
  const h = player.hide; if (!h) return;
  player.hide = null; player.teleport({ x: h.ox, z: h.oz, y: h.oy, yaw: player.yaw, crouched: true });
}
for (const sp of world.hiding) world.interactable({ x: sp.x, y: sp.y + 0.9, z: sp.z, radius: 1.7, kind: 'hide', spot: sp, onUse: () => enterHide(sp) });

// The day card: black screen, a small scratchy handwritten "DAY n" and nothing else.
function showDayCard(n, ms, then) {
  const c = $('daycard'); $('dayt').textContent = 'DAY ' + n; c.classList.remove('out'); c.hidden = false; dayHold = true;
  setTimeout(() => { c.classList.add('out'); dayHold = false; then && then(); setTimeout(() => { c.hidden = true; }, 850); }, ms);
}
// ---- Caught: a short, quick scare, then the next day ----
let scare = null, dayHold = false;
function startScare(kind) {
  if (scare) return;
  if (camView) closeCameras();
  if (player.hide && kind !== 'table') kind = 'grab';
  scare = { t: 0, kind, init: false, flashed: false }; $('touch-ui').hidden = true; releaseTouch();
}
function runScare(dt) {
  const S = scare, sm = smiley, cp = camera.position; S.t += dt;
  if (!S.init) {
    S.init = true; S.cam = cp.clone();
    let dx = sm.pos.x - cp.x, dz = sm.pos.z - cp.z; const d = Math.hypot(dx, dz);
    if (d < 0.2) { dx = -Math.sin(player.yaw); dz = -Math.cos(player.yaw); } else { dx /= d; dz /= d; }
    S.ux = dx; S.uz = dz; S.floorY = sm.pos.y;
  }
  const dist = S.kind === 'table' ? 2.1 : Math.max(0.95, 2.2 - S.t * 4);
  sm.pos.set(S.cam.x + S.ux * dist, S.floorY, S.cam.z + S.uz * dist);
  sm.yaw = Math.atan2(S.ux, S.uz); sm.root.visible = true; sm.sync();
  const r = sm.rig;
  if (r.legL) {
    r.legL.rotation.x = r.legR.rotation.x = 0;
    if (S.kind === 'table') { r.root.rotation.x = 1.25; r.armL.rotation.x = r.armR.rotation.x = -0.5; }
    else if (S.kind === 'hit') { r.root.rotation.x = 0.2; r.armL.rotation.x = -0.4; r.armR.rotation.x = S.t < 0.35 ? -2.6 + S.t * 0 : -2.6 + Math.min(1, (S.t - 0.35) * 8) * 2.1; }
    else { r.root.rotation.x = 0.25; r.armL.rotation.x = r.armR.rotation.x = -1.45; }
  }
  const tgt = Math.atan2(-S.ux, -S.uz); let dy = Math.atan2(Math.sin(tgt - player.yaw), Math.cos(tgt - player.yaw));
  player.yaw += dy * Math.min(1, dt * 12);
  const headY = S.kind === 'table' ? 0.55 : 1.7, eyeY = S.cam.y, dd = Math.max(0.5, Math.hypot(S.cam.x - sm.pos.x, S.cam.z - sm.pos.z));
  player.pitch += (Math.atan2(headY + S.floorY - eyeY, dd) - player.pitch) * Math.min(1, dt * 8);
  const sh = Math.max(0, S.t - 0.3) * 0.03, kick = S.kind === 'hit' && S.t > 0.35 ? Math.min(1, (S.t - 0.35) * 5) * 0.5 : 0;
  camera.position.set(S.cam.x + (Math.random() - 0.5) * sh, S.cam.y + (Math.random() - 0.5) * sh - kick * 0.2, S.cam.z + (Math.random() - 0.5) * sh);
  camera.rotation.set(player.pitch - kick, player.yaw, kick * 0.8 + (Math.random() - 0.5) * sh * 0.5, 'YXZ');
  const sc = $('scare');
  if (!S.flashed && S.t > 0.3) { S.flashed = true; sfx.scream(); if (S.kind === 'hit') sfx.thump(); sc.className = 'red'; sc.style.opacity = 0.75; }
  if (S.flashed && S.t < 1.2) sc.style.opacity = Math.max(0.25, 0.75 - (S.t - 0.3) * 0.5);
  if (S.t > 1.2) { sc.className = ''; sc.style.opacity = Math.min(1, (S.t - 1.2) / 0.5); }
  world.update(dt); world.updateVisibility(player.pos.x, player.pos.y, player.pos.z); pool.update(dt, camera.position.x, camera.position.y, camera.position.z);
  if (S.t > 1.8) endCaught();
}
function endCaught() {
  scare = null; $('touch-ui').hidden = paused || !isTouch; const sc = $('scare'); smiley.rig.root && (smiley.rig.root.rotation.x = 0);
  items.drop(); player.hide = null; player.stuckT = 0; input.crouch = true;
  const q = uses.p; q.day = q.day || 1;
  if (q.day >= 5) { sc.style.opacity = 0; showEnding('over'); return; }
  q.day++; items.save();
  player.teleport(startPos); smiley.respawn(10);
  $('scare').style.opacity = 0;
  showDayCard(q.day, 3000, () => startWake());
}

// ---- Security cameras: watched from the Security Room monitors, in night vision ----
let camView = null;   // { i, fov }
function camPose(c) {
  const a = AREAS.find(q => q.level === c.level && q.id === c.room), cx = (a.rect[0] + a.rect[2]) / 2, cz = (a.rect[1] + a.rect[3]) / 2;
  const x = c.x, y = LEVEL_Y[c.level] + c.y, z = c.z, dx = cx - x, dz = cz - z, dy = LEVEL_Y[c.level] + 0.8 - y;
  return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
function showCam(i) {
  const n = CAMERAS.length; camView.i = (i + n) % n; const c = CAMERAS[camView.i];
  $('camlabel').textContent = `CAM ${camView.i + 1}/${n}  ${c.name.toUpperCase()}  (FLOOR ${c.level === 'B' ? 'B' : c.level})`;
}
function openCameras() {
  if (camView || modal || !enterModal('cams')) return;
  world.noises.push({ x: player.pos.x, y: player.pos.y, z: player.pos.z, loud: 0.5, src: 'cams', t: -99 });
  camView = { i: 0, fov: camera.fov }; items.hand.visible = false;
  $('game').classList.add('nightvision'); camera.fov = 78; camera.updateProjectionMatrix(); showCam(0);
}
function closeCameras() {
  if (!camView) return;
  camera.fov = camView.fov; camera.updateProjectionMatrix(); camView = null; items.hand.visible = true;
  $('game').classList.remove('nightvision'); leaveModal();
}
world.fixtures.openCameras = openCameras;
world.fixtures.heavyDoor = () => sfx.heavyDoor();
$('camprev').addEventListener('click', () => showCam(camView.i - 1));
$('camnext').addEventListener('click', () => showCam(camView.i + 1));
$('camexit').addEventListener('click', closeCameras);
addEventListener('keydown', e => { if (!camView) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA') showCam(camView.i - 1); else if (e.code === 'ArrowRight' || e.code === 'KeyD') showCam(camView.i + 1); else if (e.code === 'Escape') closeCameras(); });

// ---- Arcade minigames: a full-screen pixel overlay; the world is frozen while it is open ----
let arcadeStop = null;
const rewards = {};   // prizes won so far (kept for the item system)
function openArcade(game, screen) {
  if (arcadeStop || !running) return;
  if (items.heldId() !== 'token') { screen?.warn(); return; }   // the machines need the Arcade Token in your hand
  setPaused(true); $('menu').hidden = true; $('arcade').hidden = false;
  $('amsg').textContent = 'LOADING GAME…';
  try {
    arcadeStop = playGame(game, $('acv'), {
      onWin: id => {
      rewards[id] = true;
      const m = (world.fixtures.arcade || []).find(a => a.game === id);
      if (m) items.spawnReward(id, m.x, LEVEL_Y['2'], m.z);   // the prize drops out in front of the machine
    },
      onExit: closeArcade,
    });
  } catch (e) { $('amsg').textContent = 'Could not start: ' + (e && e.message || e); arcadeStop = () => {}; }
}
function closeArcade() {
  if (!arcadeStop) return;
  arcadeStop(); arcadeStop = null; $('arcade').hidden = true;
  setPaused(false);
}
$('aquit').addEventListener('click', closeArcade);
world.fixtures.arcadeHandler = openArcade;
input.on('throw', () => items.throwHeld());
input.on('drop', () => items.drop());
input.on('zapper', () => uses.fireZapper());
$('touch-ui').addEventListener('click', () => {});

// Desktop: click the game to (re)capture the mouse; losing the lock (Esc) pauses.
canvas.addEventListener('click', () => { if (!isTouch && !paused && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => { if (running && !paused && !arcadeStop && !isTouch && document.pointerLockElement !== canvas) setPaused(true); });
// Pause when the page is hidden or the phone is held in portrait.
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) setPaused(true); });
const portrait = matchMedia('(orientation: portrait)');
portrait.addEventListener?.('change', () => { if (portrait.matches && isTouch && running && !paused) setPaused(true); });

// ---- Loop ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (scare) runScare(dt);
  else if (!paused && !dayHold) {
    player.update(dt);
    world.update(dt);
    items.update(dt, player);
    uses.update(dt);
    smiley.update(dt);
    for (let i = world.traps.length - 1; i >= 0; i--) {   // party traps: goo that holds you for a few seconds
      const t = world.traps[i];
      if (!player.hide && player.stuckT <= 0 && Math.hypot(player.pos.x - t.x, player.pos.z - t.z) < 0.55 && Math.abs(player.pos.y - t.y) < 0.7) {
        player.stuckT = 3.5; scene.remove(t.mesh); world.traps.splice(i, 1); sfx.stick(); toast('Stuck in party goo!');
        world.noises.push({ x: t.x, y: t.y, z: t.z, loud: 0.45, src: 'trap', t: -99 });
      }
    }
    $('stucknote').hidden = player.stuckT <= 0;
    if (player.stuckT > 0) { player._sq = (player._sq || 0) - dt; if (player._sq <= 0) { player._sq = 0.7; sfx.struggle(); } }
    if (isTouch) { const h = !!items.held; $('dropbtn').hidden = !h; $('usebtn').hidden = !uses.canUse(); }
    world.updateVisibility(player.pos.x, player.pos.y, player.pos.z);
    pool.update(dt, camera.position.x, camera.position.y, camera.position.z);
    if (isTouch) {   // context buttons: the hand shows only when something can be opened, the circle only for items
      const t = findTarget(), item = t && t.kind === 'item';
      $('hand').hidden = !t || item; $('grab').hidden = !item; $('itemname').hidden = !item;
      if (item) {   // the pickup circle sits on the item itself
        const it = t.item, p = _pv.set(it.x, it.y + it.def.size * 0.5, it.z).project(camera);
        const px = Math.min(innerWidth - 40, Math.max(40, (p.x * 0.5 + 0.5) * innerWidth)), py = Math.min(innerHeight - 40, Math.max(40, (-p.y * 0.5 + 0.5) * innerHeight));
        const gb = $('grab'); gb.style.left = px + 'px'; gb.style.top = py + 'px';
        const nm = $('itemname'); if (nm.textContent !== it.def.name) nm.textContent = it.def.name; nm.style.left = px + 'px'; nm.style.top = Math.min(innerHeight - 24, py + 26) + 'px';
      }
      $('crouchfig').classList.toggle('crouched', player.crouched);
    }
    if (!isTouch) {   // PC: the pickup circle with an E sits on the item you are looking at
      const t = findTarget(), item = t && t.kind === 'item', pm = $('pcmark'), pn = $('pcname');
      pm.hidden = pn.hidden = !item;
      if (item) {
        const it = t.item, p = _pv.set(it.x, it.y + it.def.size * 0.5, it.z).project(camera);
        const px = Math.min(innerWidth - 30, Math.max(30, (p.x * 0.5 + 0.5) * innerWidth)), py = Math.min(innerHeight - 30, Math.max(30, (-p.y * 0.5 + 0.5) * innerHeight));
        pm.style.left = px + 'px'; pm.style.top = py + 'px'; if (pn.textContent !== it.def.name) pn.textContent = it.def.name; pn.style.left = px + 'px'; pn.style.top = Math.min(innerHeight - 24, py + 26) + 'px';
      }
    }
    const tt = now / 1000;
    for (const s of world.fixtures.arcadeScreens || []) s.tick(tt);
    screenMaterials.forEach((m, i) => { m.emissiveIntensity = 0.75 + 0.25 * Math.sin(tt * 3 + i); });
    const dark = player.pos.y > 6 || player.pos.y < -2;
    ambient.intensity += ((dark ? 0.6 : 1.1) - ambient.intensity) * Math.min(1, dt * 2);
  }
  if (camView) {   // looking through a security camera
    const p = camPose(CAMERAS[camView.i]); camera.position.set(p.x, p.y, p.z); camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    smiley.update(dt); world.updateVisibility(p.x, LEVEL_Y[CAMERAS[camView.i].level] + 0.1); pool.update(dt, p.x, p.y, p.z); world.update(dt);
    const s = $('camtime'); const t = Math.floor(now / 1000); s.textContent = 'REC ' + String(Math.floor(t / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }
  if (!arcadeStop) renderer.render(scene, camera);   // the 3D view is hidden behind the arcade overlay: skip the work
}
setPaused(true);
$('primary').disabled = false;
setLoad(1, 'Ready'); $('loadbar').classList.add('done'); $('loadmsg').classList.add('done');
requestAnimationFrame(frame);

// Test hook for automated checks.
window.LF = { smiley, uses, items, rewards, openArcade, player, world, input, settings, renderer, scene, setPaused, pool, camera };
