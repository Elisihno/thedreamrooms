import * as THREE from '../vendor/three.module.min.js';
import { buildHouse } from './house.js';

const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030303);
scene.fog = new THREE.FogExp2(0x030303, 0.09);
scene.add(new THREE.AmbientLight(0x5a5a6e, 1.0));

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 60);
scene.add(camera);

// flashlight
const flash = new THREE.SpotLight(0xfff1d6, 3.5, 14, Math.PI / 6, 0.5, 1.2);
flash.position.set(0.1, -0.1, 0);
flash.target.position.set(0, 0, -5);
camera.add(flash, flash.target);
let flashOn = true;

const house = buildHouse(renderer, seed);
scene.add(house.group);

// ---- player -------------------------------------------------------------
const player = { pos: house.spawn.clone(), yaw: 0, pitch: 0, radius: 0.3 };
const EYE = 1.6, WALK = 2.2;

function collide(x, z) {
  for (const b of house.colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < player.radius * player.radius) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = player.radius - d;
        x += (dx / d) * push; z += (dz / d) * push;
      } else { // centre inside box: push out along shallowest axis
        const l = x - b.minX, r = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z;
        const m = Math.min(l, r, t, bt);
        if (m === l) x = b.minX - player.radius; else if (m === r) x = b.maxX + player.radius;
        else if (m === t) z = b.minZ - player.radius; else z = b.maxZ + player.radius;
      }
    }
  }
  return [x, z];
}

// ---- input --------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyF') toggleFlash();
});
addEventListener('keyup', e => keys.delete(e.code));

const canvas = renderer.domElement;
canvas.addEventListener('click', () => {
  if (!matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock?.();
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  look(e.movementX * 0.0022, e.movementY * 0.0022);
});

function look(dx, dy) {
  player.yaw -= dx;
  player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - dy));
}

// touch: left half = move stick, right half = look
const stick = document.getElementById('stick');
const knob = document.getElementById('knob');
const move = { x: 0, y: 0 };
const touches = new Map(); // id -> {mode, sx, sy, lx, ly}
const STICK_R = 55;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const mode = t.clientX < innerWidth / 2 ? 'move' : 'look';
    touches.set(t.identifier, { mode, sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY });
    if (mode === 'move') {
      stick.style.left = t.clientX - 70 + 'px';
      stick.style.top = t.clientY - 70 + 'px';
      stick.style.display = 'block';
      knob.style.transform = 'translate(0,0)';
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier);
    if (!s) continue;
    if (s.mode === 'move') {
      let dx = t.clientX - s.sx, dy = t.clientY - s.sy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      move.x = dx / STICK_R; move.y = dy / STICK_R;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    } else {
      look((t.clientX - s.lx) * 0.006, (t.clientY - s.ly) * 0.006);
      s.lx = t.clientX; s.ly = t.clientY;
    }
  }
}, { passive: false });

function endTouch(e) {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier);
    if (s?.mode === 'move') { move.x = move.y = 0; stick.style.display = 'none'; }
    touches.delete(t.identifier);
  }
}
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

function toggleFlash() {
  flashOn = !flashOn;
  flash.visible = flashOn;
  document.getElementById('flashBtn').classList.toggle('off', !flashOn);
}
document.getElementById('flashBtn').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); toggleFlash(); }, { passive: false });
document.getElementById('flashBtn').addEventListener('click', toggleFlash);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---- loop ---------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  let fx = move.y, fz = move.x; // stick: up = forward
  if (keys.has('KeyW') || keys.has('ArrowUp')) fx -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fx += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) fz -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) fz += 1;
  const mag = Math.min(1, Math.hypot(fx, fz));
  if (mag > 0.01) {
    const n = Math.hypot(fx, fz);
    fx /= n; fz /= n;
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    // forward vector is (-sin, -cos); right is (cos, -sin)
    const vx = (-sin * -fx + cos * fz) * WALK * mag * dt;
    const vz = (-cos * -fx - sin * fz) * WALK * mag * dt;
    let [x, z] = collide(player.pos.x + vx, player.pos.z);
    [x, z] = collide(x, player.pos.z + vz);
    player.pos.x = x; player.pos.z = z;
  }

  const bob = mag > 0.01 ? Math.sin(t * 8) * 0.03 * mag : 0;
  camera.position.set(player.pos.x, EYE + bob, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  for (const l of house.lights) {
    l.intensity = l.userData.base * (0.85 + 0.15 * Math.sin(t * (2 + l.userData.base * 3) + l.id));
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.__game = { player, house, camera }; // for debugging
