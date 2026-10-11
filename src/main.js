import * as THREE from 'three';
import { loadMaterials } from './textures.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Granny } from './granny.js';
import { Sound } from './audio.js';
import { KEYS, groundY } from './layout.js';
import { img } from './assets.js';

// Set to true to bring Granny back. Off while the house is being tested on its own.
const ENABLE_GRANNY = false;

const $ = (id) => document.getElementById(id);

// ---------- UI helpers ----------
let toastT = 0;
const ui = {
  setStance(crouch) {
    const s = cut[crouch ? 'crouch.webp' : 'stand.png'];
    if (!s) return;
    const el = $('stanceImg');
    el.src = s.url;
    el.style.height = crouch ? 'calc(var(--fig) * 0.6)' : 'var(--fig)'; // a crouching person is about 60% as tall
  },
  setHp(hp) { $('hp').textContent = '♥'.repeat(Math.max(0, hp)); },
  pressHand() { const c = $('cross'); c.classList.add('press'); setTimeout(() => c.classList.remove('press'), 160); },
  setPrompt(t) { $('prompt').textContent = t; $('cross').classList.toggle('hand', !!t); },
  setHidden(h) { $('hide').style.opacity = h ? 1 : 0; },
  flashHurt() { $('hurt').style.opacity = 1; setTimeout(() => ($('hurt').style.opacity = 0), 350); },
  toast(t) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; toastT = 3.2; },
  setInv(inv, vases) {
    $('inv').innerHTML =
      [...inv].map((k) => `<span class="chip"><i class="dot" style="background:#${KEYS[k].color.toString(16).padStart(6, '0')}"></i>${KEYS[k].label}</span>`).join('') +
      (vases ? `<span class="chip">Vase x${vases}</span>` : '');
  },
};

// The HUD art is white on black (or has a black box); use brightness as transparency and crop to the shape.
const cut = {};
function cutOut(name, crop = false) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const c = document.createElement('canvas');
      c.width = image.width; c.height = image.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let i = 0; i < d.data.length; i += 4) {
        const b = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
        const a = Math.round(Math.min(1, Math.max(0, (b - 45) / 150)) * 255); // ignore the near-black backdrop
        d.data[i + 3] = a;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
        if (a > 60) {
          const p = i / 4, x = p % c.width, y = (p - x) / c.width;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      ctx.putImageData(d, 0, 0);
      let out = c;
      if (crop && x1 > x0) {
        out = document.createElement('canvas');
        out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
        out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      }
      cut[name] = { url: out.toDataURL(), w: out.width, h: out.height };
      resolve();
    };
    image.onerror = resolve;
    image.src = img(name);
  });
}

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.Fog(0x04060a, 1.5, 20);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
scene.add(camera);
scene.add(new THREE.AmbientLight(0xa4aab8, 0.5));
const lamp = new THREE.PointLight(0xe9edf5, 9, 13, 1.6); // the faint glow around you
camera.add(lamp);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- input ----------
const input = { keys: new Set(), lookX: 0, lookY: 0, joy: { x: 0, y: 0 } };
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
let state = 'menu';
let game = null;

addEventListener('keydown', (e) => {
  if (state !== 'play' || paused) return;
  input.keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyC' || e.code === 'ControlLeft') game.player.toggleCrouch();
  if (e.code === 'KeyE') game.player.interact();
  if (e.code === 'KeyF') game.throw();
});
addEventListener('keyup', (e) => input.keys.delete(e.code));
let lockOK = true; // false when the host refuses pointer lock; then dragging the mouse looks around
const tryLock = () => { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => { lockOK = false; }); } catch { lockOK = false; } };
document.addEventListener('pointerlockerror', () => { lockOK = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas && !(!lockOK && e.buttons & 1)) return;
  input.lookX += e.movementX * 0.0022;
  input.lookY += e.movementY * 0.0022;
});
// Left click = [E] (use / open / take / hide). Right click or F throws a vase.
let downAt = null;
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'play' || paused) return;
  if (e.button === 2) { game.throw(); return; }
  if (e.button !== 0) return;
  if (document.pointerLockElement !== canvas && lockOK) { tryLock(); return; } // first click captures the mouse
  if (lockOK) game.player.interact();
  else downAt = [e.clientX, e.clientY]; // no pointer lock: a click that doesn't drag counts as a use
});
canvas.addEventListener('mouseup', (e) => {
  if (!downAt || e.button !== 0) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved < 5 && state === 'play' && !paused) game.player.interact();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'play' && !isTouch && lockOK) setPaused(true);
});
$('stance').addEventListener('pointerdown', (e) => { e.stopPropagation(); game?.player.toggleCrouch(); });

// touch: virtual stick (left) + look drag (anywhere else)
const stick = $('stick'), knob = $('knob');
let stickId = null, lookId = null, lookPos = null;
const R_STICK = 52;
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; input.joy.x = input.joy.y = 0; knob.style.transform = ''; };
stick.addEventListener('pointerup', endStick);
stick.addEventListener('pointercancel', endStick);
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > R_STICK) { dx = (dx / d) * R_STICK; dy = (dy / d) * R_STICK; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.joy.x = dx / R_STICK;
  input.joy.y = dy / R_STICK;
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  lookId = e.pointerId; lookPos = [e.clientX, e.clientY];
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || e.pointerId !== lookId) return;
  input.lookX += (e.clientX - lookPos[0]) * 0.006;
  input.lookY += (e.clientY - lookPos[1]) * 0.006;
  lookPos = [e.clientX, e.clientY];
});
canvas.addEventListener('pointerup', (e) => { if (e.pointerId === lookId) lookId = null; });
$('btnE').addEventListener('pointerdown', (e) => { e.stopPropagation(); game?.player.interact(); });
$('btnF').addEventListener('pointerdown', (e) => { e.stopPropagation(); game?.throw(); });

// ---------- game ----------
const sound = new Sound();
let paused = false;

function setPaused(p) {
  paused = p;
  $('menu').classList.toggle('show', p);
  $('start').textContent = p ? 'RESUME' : 'START';
}

function startGame() {
  sound.init();
  if (!game) return;
  if (paused) {
    setPaused(false);
  } else {
    game.reset();
    state = 'play';
    $('menu').classList.remove('show');
    $('dead').classList.remove('show');
    $('won').classList.remove('show');
  }
  if (!isTouch) tryLock();
}

function buildGame(mats) {
  const world = new World(scene, mats);
  const player = new Player(camera, world, sound, ui);
  const granny = ENABLE_GRANNY ? new Granny(scene, world, sound) : null;
  const g = {
    world, player, granny, time: 0,
    reset() {
      player.reset();
      granny?.reset();
      world.doors.forEach((d) => { d.unlocked = !d.key; world.setDoor(d, false); d.angle = 0; });
      world.pickups.forEach((p) => { p.taken = false; p.group.visible = true; });
      ui.setStance(false); ui.setHp(player.hp); ui.setInv(player.inv, 0); ui.setHidden(false);
      input.keys.clear();
    },
    throw() {
      player.throwVase((x, y, z) => {
        sound.crash(0.8);
        world.noise(x, y, z, 17);
      });
    },
  };
  return g;
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  if (!game) return;
  if (state === 'play' && !paused) {
    game.time += dt;
    game.player.update(dt, input);
    if (game.granny) game.granny.update(dt, game.player);
    else game.world.noises.length = 0;
    game.world.update(dt, game.time);
    const chase = !!game.granny?.chasing;
    sound.heartbeat(dt, chase ? 1 : 0);
    $('fear').style.opacity = chase ? 1 : 0;
    // end conditions
    if (game.player.hp <= 0) end('dead');
    else if (game.player.z > 15.2 && game.player.y < 4) { sound.win(); end('won'); }
  } else {
    game.player.update(0, input);
  }
  renderer.render(scene, camera);
}

function end(which) {
  state = which;
  $('fear').style.opacity = 0;
  document.exitPointerLock?.();
  $(which).classList.add('show');
}

$('retry').onclick = $('again').onclick = () => { state = 'menu'; paused = false; startGame(); };
$('start').onclick = startGame;
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && state === 'play' && !paused) setPaused(true);
});

Promise.all([cutOut('hand.png'), cutOut('stand.png', true), cutOut('crouch.webp', true)])
  .then(() => {
    $('cross').style.setProperty('--hand', `url(${cut['hand.png']?.url})`);
    // crouch art is drawn bigger than the standing art, so scale it to the standing figure's proportions
    return loadMaterials();
  })
  .then((mats) => {
    game = buildGame(mats);
    game.reset();
    ui.setStance(false);
    $('start').textContent = 'START';
    window.__game = game; window.__gy = groundY; // handy for debugging
    window.__startForTest = () => { sound.init(); state = 'play'; paused = false; $('menu').classList.remove('show'); };
  })
  .catch((err) => { $('start').textContent = 'FAILED TO LOAD'; console.error(err); });
requestAnimationFrame(frame);
