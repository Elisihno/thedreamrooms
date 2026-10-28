import * as THREE from './three.js';
import { BUILD, CFG } from './config.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { Input } from './core/input.js';
import { initTouch } from './core/touch.js';
import { createRenderer, applyQuality, resize } from './core/renderer.js';
import { configureAssets, preloadTextures } from './assets/registry.js';
import { buildBuilding } from './world/building.js';
import { LightPool } from './world/lightpool.js';
import { START, LEVEL_Y, LEVELS, LEVEL_NAME } from './world/layout.js';
import { loadModels, screenMaterials } from './assets/models.js';
import { Player } from './player.js';
import { playGame, GAMES } from './arcade/games.js';

const $ = id => document.getElementById(id);
const settings = loadSettings();
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
document.body.classList.toggle('touch', isTouch);

configureAssets({ texSize: CFG.quality[settings.quality].texSize, aniso: CFG.quality[settings.quality].aniso });

const canvas = $('game');
const renderer = createRenderer(canvas, settings.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 80);
scene.add(camera);

// Quality buttons work during loading too; applyQuality runs once the world exists.
let onQuality = null;
document.querySelectorAll('[data-setting]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.setting, v = b.dataset.value;
  settings[k] = k === 'quality' || k === 'crouchMode' ? v : Number(v);
  if (k === 'quality') onQuality?.();
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
  $('primary').textContent = running ? 'RESUME' : 'START';
  $('hint').hidden = running;
  if (p) { releaseTouch(); if (document.pointerLockElement) document.exitPointerLock(); }
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

$('primary').addEventListener('click', () => {
  const first = !running;
  if (first) { running = true; if (isTouch) enterFullscreen(); }
  setPaused(false);
  if (first) startWake();
});
$('fs').addEventListener('click', enterFullscreen);
const SPOTS = { B: { x: 24, z: 4, yaw: -Math.PI / 2 }, 1: { x: 24, z: 8, yaw: -Math.PI / 2 }, 2: { x: 30, z: 11.5, yaw: -Math.PI / 2 }, 3: { x: 24, z: 8, yaw: -Math.PI / 2 } };
document.querySelectorAll('[data-floor]').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.floor, sp = SPOTS[id];
  player.teleport({ x: sp.x, z: sp.z, y: LEVEL_Y[id], yaw: sp.yaw }); setPaused(false);
}));
$('unlock').addEventListener('click', () => { world.passages.forEach(p => p.open()); setPaused(false); toast('All secret passages opened (test)'); });
$('respawn').addEventListener('click', () => { player.teleport(startPos); setPaused(false); startWake(); });

onQuality = () => applyQuality(renderer, settings.quality, pool, world);
$('sens').addEventListener('input', e => { settings.sensitivity = Number(e.target.value); saveSettings(settings); syncMenu(); });
$('fov').addEventListener('input', e => { settings.fov = Number(e.target.value); camera.fov = settings.fov; camera.updateProjectionMatrix(); saveSettings(settings); syncMenu(); });

input.on('pause', () => { if (running && !paused) setPaused(true); });
// Nearest interactable the player is looking at (doors, secret hatches, later items).
const _dir = new THREE.Vector3();
function findTarget() {
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
    try { best.onUse(); } catch (e) { toast('Error: ' + (e && e.message || e)); throw e; }
    if (best.kind === 'hatch') toast('Secret passage opened');
    else if (best.kind === 'arcade') toast('Loading ' + GAMES[best.game].title + '…');
  } else toast('Nothing to use here');
});

// ---- Arcade minigames: a full-screen pixel overlay; the world is frozen while it is open ----
let arcadeStop = null;
const rewards = {};   // prizes won so far (kept for the item system)
function openArcade(game) {
  if (arcadeStop || !running) return;
  setPaused(true); $('menu').hidden = true; $('arcade').hidden = false;
  $('amsg').textContent = 'LOADING GAME…'; arcadeDebug();
  try {
    arcadeStop = playGame(game, $('acv'), {
      onWin: id => { rewards[id] = true; toast('Prize won: ' + GAMES[id].reward + ' (items arrive in a later stage)'); },
      onExit: closeArcade,
    });
  } catch (e) { $('amsg').textContent = 'Could not start: ' + (e && e.message || e); arcadeStop = () => {}; }
}
// Temporary on-screen diagnostics while the arcade is being tested on phones.
let dbgTimer = 0;
function arcadeDebug() {
  let d = document.getElementById('dbg');
  if (!d) { d = document.createElement('pre'); d.id = 'dbg'; d.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99;margin:0;padding:4px 6px;background:rgba(0,0,0,.75);color:#8f8;font:11px monospace;pointer-events:none;max-width:70vw;white-space:pre-wrap'; document.body.appendChild(d); }
  clearInterval(dbgTimer); let n = 0; window.__arcFrames = 0;
  dbgTimer = setInterval(() => {
    const a = $('arcade'), r = $('acv').getBoundingClientRect(), cs = getComputedStyle(a);
    d.textContent = `arcade hidden=${a.hidden} display=${cs.display} z=${cs.zIndex}\ncanvas ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}\nframes=${window.__arcFrames} msg="${$('amsg').textContent}"\nstop=${!!arcadeStop} paused=${paused}`;
    if (++n > 40) { clearInterval(dbgTimer); d.remove(); }
  }, 250);
}
function closeArcade() {
  if (!arcadeStop) return;
  arcadeStop(); arcadeStop = null; $('arcade').hidden = true;
  setPaused(false);
}
$('aquit').addEventListener('click', closeArcade);
world.fixtures.arcadeHandler = openArcade;
input.on('throw', () => toast('Throw (Stage 3)'));
input.on('drop', () => toast('Drop (Stage 3)'));
input.on('zapper', () => toast('Party Zapper (Stage 5)'));
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
  if (!paused) {
    player.update(dt);
    world.update(dt);
    world.updateVisibility(player.pos.x, player.pos.y);
    pool.update(dt, camera.position.x, camera.position.y, camera.position.z);
    if (isTouch) {   // context buttons: the hand shows only when something can be opened, the circle only for items
      const t = findTarget(), item = t && t.kind === 'item';
      $('hand').hidden = !t || item; $('grab').hidden = !item;
      $('crouchfig').classList.toggle('crouched', player.crouched);
    }
    const tt = now / 1000;
    for (const s of world.fixtures.arcadeScreens || []) s.tick(tt);
    screenMaterials.forEach((m, i) => { m.emissiveIntensity = 0.75 + 0.25 * Math.sin(tt * 3 + i); });
    const dark = player.pos.y > 6 || player.pos.y < -2;
    ambient.intensity += ((dark ? 0.6 : 1.1) - ambient.intensity) * Math.min(1, dt * 2);
  }
  if (!arcadeStop) renderer.render(scene, camera);   // the 3D view is hidden behind the arcade overlay: skip the work
}
setPaused(true);
$('primary').disabled = false;
setLoad(1, 'Ready'); $('loadbar').classList.add('done'); $('loadmsg').classList.add('done');
requestAnimationFrame(frame);

// Test hook for automated checks.
window.LF = { rewards, openArcade, player, world, input, settings, renderer, scene, setPaused, pool, camera };
