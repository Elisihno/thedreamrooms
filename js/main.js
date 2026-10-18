import * as THREE from '../vendor/three.module.min.js';
import { buildHouse, levelY } from './house.js';

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

const house = buildHouse(renderer, seed);
scene.add(house.group);

// ---- player -------------------------------------------------------------
const player = { pos: house.spawn.clone(), y: house.spawn.y, level: house.spawnLevel, yaw: 0, pitch: 0, radius: 0.3 };
const EYE = 1.6, WALK = 2.2;

function collide(x, z) {
  for (const b of house.colliders) {
    if (b.level !== player.level) continue;
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

const floorLabel = document.getElementById('floor');
let shownLevel = -1;

// ---- input --------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyE') useTarget();
});
addEventListener('keyup', e => keys.delete(e.code));

const canvas = renderer.domElement;
canvas.addEventListener('click', () => {
  if (matchMedia('(pointer: coarse)').matches) return;
  if (document.pointerLockElement === canvas) useTarget();
  else canvas.requestPointerLock?.();
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

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---- using things -----------------------------------------------------------
// Looking at a drawer, door or lid shows the Use button; E or a click does the same.
const useBtn = document.getElementById('use');
let target = null;
const NAMES = { key: 'key', pliers: 'cutting pliers' };
const label = t => (t.kind === 'item' ? `Take ${NAMES[t.type]}` : t.open ? 'Close' : 'Open');
function useTarget() {
  if (target) house.use(target);
}
function updateTarget() {
  const t = house.pick(camera, player);
  target = t;
  useBtn.hidden = !t;
  if (t) useBtn.textContent = label(t);
}

// ---- inventory --------------------------------------------------------------
const inv = { key: 1, pliers: 1 }; // the player starts with one of each
const invEl = document.getElementById('inv');
const toastEl = document.getElementById('toast');
let toastTimer = 0;
const iconSrc = type => globalThis.__DR_TEX?.[`item_${type}`] ?? `assets/textures/item_${type}.png`;
function renderInventory() {
  invEl.replaceChildren();
  for (const type of Object.keys(inv)) {
    if (!inv[type]) continue;
    const slot = document.createElement('div');
    slot.className = 'slot';
    const img = document.createElement('img');
    img.src = iconSrc(type);
    img.alt = NAMES[type];
    slot.append(img);
    if (inv[type] > 1) {
      const n = document.createElement('span');
      n.textContent = inv[type];
      slot.append(n);
    }
    invEl.append(slot);
  }
}
house.onPickup = type => {
  inv[type]++;
  renderInventory();
  toastEl.textContent = `Picked up ${NAMES[type]}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1800);
  chime();
};
renderInventory();

useBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); useTarget(); }, { passive: false });
useBtn.addEventListener('click', useTarget);

// ---- sound ----------------------------------------------------------------
// Browsers only allow audio after a touch or key press, so the context is made then.
let audio = null;
function initAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
addEventListener('touchstart', initAudio, { passive: true });
addEventListener('keydown', initAudio);
addEventListener('click', initAudio);

house.onThud = () => {
  if (!audio) return;
  try {
    const now = audio.currentTime, len = 0.5;
    const buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.08));
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const lp = audio.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    const thump = audio.createOscillator();
    thump.frequency.setValueAtTime(90, now);
    thump.frequency.exponentialRampToValueAtTime(35, now + 0.3);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + len);
    noise.connect(lp).connect(gain);
    thump.connect(gain);
    gain.connect(audio.destination);
    noise.start(now); thump.start(now); thump.stop(now + len);
  } catch { /* audio is optional */ }
};

function chime() {
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(now); osc.stop(now + 0.35);
  } catch { /* audio is optional */ }
}

house.onUse = (kind, open) => {
  if (!audio) return;
  try {
    const now = audio.currentTime, len = kind === 'drawer' ? 0.28 : 0.4;
    const buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / audio.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * (open ? 9 : 14)) * (kind === 'drawer' ? 1 : 0.8);
    }
    const src = audio.createBufferSource();
    src.buffer = buf;
    const bp = audio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(kind === 'drawer' ? 700 : 420, now);
    bp.frequency.linearRampToValueAtTime(open ? 260 : 600, now + len);
    bp.Q.value = 1.4;
    const gain = audio.createGain();
    gain.gain.value = 0.5;
    src.connect(bp).connect(gain).connect(audio.destination);
    src.start(now);
  } catch { /* audio is optional */ }
};

// ---- room lights ----------------------------------------------------------
// A fixed pool of point lights follows the nearest rooms, so the shader cost stays
// constant however many rooms the house has.
const pool = Array.from({ length: 4 }, () => {
  const l = new THREE.PointLight(0xffd9a0, 0, 8, 1.4);
  l.userData.room = null;
  scene.add(l);
  return l;
});
let assignTimer = 0;
function updateLights(t, dt) {
  assignTimer -= dt;
  if (assignTimer <= 0) {
    assignTimer = 0.25;
    const ranked = house.rooms
      .map(r => ({ r, d: r.pos.distanceTo(camera.position) }))
      .sort((a, b) => a.d - b.d);
    pool.forEach((l, i) => {
      const first = !l.userData.room;
      l.userData.room = ranked[i].r;
      if (first) l.position.copy(ranked[i].r.pos);
    });
  }
  for (const l of pool) {
    const room = l.userData.room;
    if (!room) continue;
    l.position.lerp(room.pos, Math.min(1, dt * 4));
    l.intensity = 1.4 * room.base * (0.85 + 0.15 * Math.sin(t * (2 + room.base * 3) + room.pos.x));
  }
}

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

  // height: each stair is a ramp between two storeys, elsewhere the floor of the current level
  let onStair = false;
  for (const st of house.stairs) {
    const p = player.pos;
    if ((player.level === st.from || player.level === st.from + 1) &&
        p.x > st.x0 && p.x < st.x1 && p.z >= st.z0 && p.z <= st.z1) {
      const f = (p.z - st.z0) / (st.z1 - st.z0);
      player.y = levelY(st.from) + f * st.rise;
      player.level = f >= 0.5 ? st.from + 1 : st.from;
      onStair = true;
      break;
    }
  }
  if (!onStair) player.y = levelY(player.level);
  if (player.level !== shownLevel) {
    shownLevel = player.level;
    floorLabel.textContent = house.levels[shownLevel];
  }

  const bob = mag > 0.01 ? Math.sin(t * 8) * 0.03 * mag : 0;
  camera.position.set(player.pos.x, player.y + EYE + bob, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  updateLights(t, dt);
  house.update(dt, player);
  updateTarget();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.__game = { player, house, camera, THREE }; // for debugging
