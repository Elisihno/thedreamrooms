import * as THREE from 'three';
import { loadMaterials } from './textures.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Granny } from './granny.js';
import { Sound } from './audio.js';
import { KEYS, groundY } from './layout.js';
import { img } from './assets.js';

const $ = (id) => document.getElementById(id);

// ---------- UI helpers ----------
let toastT = 0;
const ui = {
  setStance(crouch) { $('stanceImg').src = img(crouch ? 'crouch.webp' : 'stand.png'); },
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

// The hand image is white on black; use its brightness as transparency so only the hand shows.
function cutOutHand(src) {
  const image = new Image();
  image.onload = () => {
    const c = document.createElement('canvas');
    c.width = image.width; c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; }
    ctx.putImageData(d, 0, 0);
    $('cross').style.setProperty('--hand', `url(${c.toDataURL()})`);
  };
  image.src = src;
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
scene.add(new THREE.AmbientLight(0x9096a8, 0.5));
const lamp = new THREE.PointLight(0xffeede, 9, 13, 1.6); // the faint glow around you
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
canvas.addEventListener('mousedown', () => {
  if (state !== 'play') return;
  if (document.pointerLockElement !== canvas) { if (lockOK) tryLock(); }
  else game.throw();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'play' && !isTouch && lockOK) setPaused(true);
});
$('stance').addEventListener('pointerdown', (e) => { e.stopPropagation(); game?.player.toggleCrouch(); });

// touch: virtual stick (left) + look drag (anywhere else)
const stick = $('stick'), knob = $('knob');
let stickId = null, lookId = null, lookPos = null;
const R_STICK = 56;
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
  const granny = new Granny(scene, world, sound);
  const g = {
    world, player, granny, time: 0,
    reset() {
      player.reset();
      granny.reset();
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
    game.granny.update(dt, game.player);
    game.world.update(dt, game.time);
    const chase = game.granny.chasing;
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

ui.setStance(false);
loadMaterials()
  .then((mats) => {
    cutOutHand(img('hand.png'));
    game = buildGame(mats);
    game.reset();
    $('start').textContent = 'START';
    window.__game = game; window.__gy = groundY; // handy for debugging
    window.__startForTest = () => { sound.init(); state = 'play'; paused = false; $('menu').classList.remove('show'); };
  })
  .catch((err) => { $('start').textContent = 'FAILED TO LOAD'; console.error(err); });
requestAnimationFrame(frame);
