import * as THREE from './three.js';
import { BUILD, CFG } from './config.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { Input } from './core/input.js';
import { initTouch } from './core/touch.js';
import { createRenderer, applyQuality, resize } from './core/renderer.js';
import { configureAssets } from './assets/registry.js';
import { buildTestRoom } from './world/testroom.js';
import { loadModels } from './assets/models.js';
import { Player } from './player.js';

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

$('primary').textContent = 'LOADING…';
try { await loadModels(); } catch (e) { $('primary').textContent = 'Model load failed'; throw e; }
const world = buildTestRoom(scene);
const input = new Input(settings);
input.canvas = canvas;
const player = new Player(camera, world, input);
player.teleport(world.start);
const releaseTouch = initTouch(input, $('touch-ui'), settings);

applyQuality(renderer, settings.quality, world);
resize(renderer, camera);
addEventListener('resize', () => resize(renderer, camera));

// ---- State & menu ----
let running = false;   // game started
let paused = true;
$('build').textContent = BUILD;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 900);
}

function syncMenu() {
  document.querySelectorAll('[data-setting]').forEach(b => b.classList.toggle('on', String(settings[b.dataset.setting]) === b.dataset.value));
  $('sens').value = settings.sensitivity; $('sensv').textContent = settings.sensitivity.toFixed(2);
  $('fov').value = settings.fov; $('fovv').textContent = settings.fov;
  $('debug-on').checked = settings.debug;
  $('debug').hidden = !settings.debug || paused;
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
$('respawn').addEventListener('click', () => { player.teleport(world.start); setPaused(false); startWake(); });

document.querySelectorAll('[data-setting]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.setting, v = b.dataset.value;
  settings[k] = k === 'quality' || k === 'crouchMode' ? v : Number(v);
  if (k === 'quality') applyQuality(renderer, settings.quality, world);
  saveSettings(settings); syncMenu();
}));
$('sens').addEventListener('input', e => { settings.sensitivity = Number(e.target.value); saveSettings(settings); syncMenu(); });
$('fov').addEventListener('input', e => { settings.fov = Number(e.target.value); camera.fov = settings.fov; camera.updateProjectionMatrix(); saveSettings(settings); syncMenu(); });
$('debug-on').addEventListener('change', e => { settings.debug = e.target.checked; saveSettings(settings); syncMenu(); });

input.on('pause', () => { if (running && !paused) setPaused(true); });
input.on('interact', () => toast('Interact (Stage 3)'));
input.on('throw', () => toast('Throw (Stage 3)'));
input.on('drop', () => toast('Drop (Stage 3)'));
input.on('zapper', () => toast('Party Zapper (Stage 5)'));
$('touch-ui').addEventListener('click', () => {});

// Desktop: click the game to (re)capture the mouse; losing the lock (Esc) pauses.
canvas.addEventListener('click', () => { if (!isTouch && !paused && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => { if (running && !paused && !isTouch && document.pointerLockElement !== canvas) setPaused(true); });
// Pause when the page is hidden or the phone is held in portrait.
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) setPaused(true); });
const portrait = matchMedia('(orientation: portrait)');
portrait.addEventListener?.('change', () => { if (portrait.matches && isTouch && running && !paused) setPaused(true); });

// ---- Loop ----
const dbg = $('debug');
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    player.update(dt);
    world.update(dt);
    frames++; fpsT += dt;
    if (fpsT >= 0.5) {
      fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
      if (settings.debug) {
        const p = player.pos, i = renderer.info.render;
        dbg.textContent = `${fps} fps  ${settings.quality}  calls ${i.calls}  tris ${i.triangles}\n` +
          `x ${p.x.toFixed(1)} y ${p.y.toFixed(2)} z ${p.z.toFixed(1)}  ${player.crouched ? 'crouch' : 'stand'}  lean ${player.lean.toFixed(2)}`;
      }
    }
  }
  renderer.render(scene, camera);
}
setPaused(true);
requestAnimationFrame(frame);

// Test hook for automated checks.
window.LF = { player, world, input, settings, renderer, scene, setPaused };
