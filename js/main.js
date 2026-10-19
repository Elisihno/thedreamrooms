import * as THREE from '../vendor/three.module.min.js';
import { buildHouse, levelY } from './house.js';
import { createHeld } from './held.js';
import { icons } from './icons.js';

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

// Hiding under a table or bed: the view slides in underneath, the way out is the hand cursor
// (or pushing the stick). player.hidden is true meanwhile.
const hide = { spot: null, amt: 0, dir: 0, entry: { x: 0, z: 0 }, yawOut: 0, pushing: 0 };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function enterHide(spot) {
  if (hide.spot) return;
  hide.spot = spot; hide.amt = 0; hide.dir = 1; hide.pushing = 0;
  hide.entry.x = player.pos.x; hide.entry.z = player.pos.z;
  hide.yawOut = Math.atan2(-(hide.entry.x - spot.x), -(hide.entry.z - spot.z)); // look back out the way you came
  player.hidden = true;
}
function leaveHide() {
  if (hide.spot && hide.amt > 0.5) hide.dir = -1;
}

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
const vignette = document.getElementById('hide');
let shownLevel = -1;

// ---- input --------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', e => {
  if (uiOpen) { uiKey(e); return; }
  keys.add(e.code);
  if (e.code === 'KeyE') useTarget();
  if (e.code === 'Space') { e.preventDefault(); fire(); }
  if (e.code === 'KeyQ') drop();
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
  if (hide.spot && hide.amt > 0.95) { // only peek around from underneath
    player.yaw = hide.yawOut + Math.max(-1.25, Math.min(1.25, angleDiff(player.yaw, hide.yawOut)));
    player.pitch = Math.max(-0.6, Math.min(0.6, player.pitch));
  }
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
  heldView.resize(innerWidth / innerHeight);
});

// ---- using things -----------------------------------------------------------
// Looking at a drawer, door or lid shows the Use button; E or a click does the same.
const useBtn = document.getElementById('use');
const dotEl = document.getElementById('dot');
useBtn.querySelector('img').src = globalThis.__DR_TEX?.ui_hand ?? 'assets/textures/ui_hand.png';
let target = null;
const NAMES = { key: 'key', pliers: 'cutting pliers', note: 'sticky note', apple: 'apple', knife: 'kitchen knife', shotgun: 'shotgun', shells: 'shotgun shells' };
const label = t => (t.kind === 'item' ? (t.type === 'shells' && selected === 'shotgun' ? 'Load shells' : t.type === 'note' ? 'Read note' : `Take ${NAMES[t.type]}`) : t.kind === 'wire' ? 'Cut' : t.kind === 'board' ? 'Cutting board' : t.locked ? 'Locked' : t.kind === 'keypad' ? 'Keypad' : t.kind === 'exit' ? 'Door' : t.open ? 'Close' : 'Open');
function useTarget() {
  if (hide.spot) { leaveHide(); return; }
  if (target) house.use(target, selected);
}
function updateTarget() {
  if (hide.spot) { // the hand stays up while hiding, to come out
    const show = hide.amt > 0.9 && hide.dir > 0;
    target = null;
    useBtn.hidden = !show;
    dotEl.hidden = show;
    useBtn.dataset.label = 'Come out';
    useBtn.setAttribute('aria-label', 'Come out');
    return;
  }
  const t = house.pick(camera, player);
  target = t;
  useBtn.hidden = !t;
  dotEl.hidden = !!t;
  useBtn.dataset.label = t?.kind === 'hide' ? 'Hide' : t?.kind === 'board' ? 'Cutting board' : t?.locked ? 'Locked' : '';
  if (t) useBtn.setAttribute('aria-label', t.kind === 'hide' ? 'Hide' : label(t));
}
house.onHide = enterHide;

// ---- the hand ---------------------------------------------------------------------
// One item in hand at most. Picking something up needs a free hand; DROP puts it down.
// Test mode (open the page with #test, or ?test) loads the shotgun with 3 shells. Normally it starts empty.
const testMode = location.hash === '#test' || new URLSearchParams(location.search).has('test');
let ammo = testMode ? 3 : 0;  // shells loaded in the shotgun
const invEl = document.getElementById('inv');
const toastEl = document.getElementById('toast');
let toastTimer = 0;
const iconSrc = type => icons[type] ?? globalThis.__DR_TEX?.[`item_${type}`] ?? `assets/textures/item_${type}.png`;
let selected = null; // the item in hand
const heldView = createHeld();
heldView.resize(innerWidth / innerHeight);
function setHand(type) {
  selected = type;
  heldView.show(type);
  renderInventory();
}

const fireBtn = document.getElementById('fire'), dropBtn = document.getElementById('drop');
function fire() {
  if (selected !== 'shotgun' || uiOpen || escaped || hide.spot) return;
  if (ammo <= 0) { house.onSound('dry'); showToast('Click. The shotgun is empty.', 1400); return; }
  ammo--;
  house.onSound('shot');
  heldView.kick();
  renderInventory();
}

// Put the item down in front of you, clear of walls and furniture.
function drop() {
  if (!selected || uiOpen || escaped || hide.spot) return;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const [x, z] = collide(player.pos.x + fx * 0.75, player.pos.z + fz * 0.75);
  const type = selected;
  house.dropItem(type, x, player.y, z, player.yaw, player.level);
  setHand(null);
  house.onSound('drop');
  showToast(`Dropped the ${NAMES[type]}`, 1200);
}
for (const [el, fn] of [[fireBtn, fire], [dropBtn, drop]]) {
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
  el.addEventListener('click', fn);
}

// the strip shows what is in hand (the shotgun also shows its shells)
function renderInventory() {
  invEl.replaceChildren();
  if (selected) {
    const slot = document.createElement('div');
    slot.className = 'slot sel';
    const img = document.createElement('img');
    img.src = iconSrc(selected);
    img.alt = NAMES[selected];
    slot.append(img);
    if (selected === 'shotgun') {
      const n = document.createElement('span');
      n.textContent = ammo;
      slot.append(n);
    }
    invEl.append(slot);
  }
  fireBtn.hidden = selected !== 'shotgun';
  dropBtn.hidden = !selected;
}
function showToast(text, ms = 2600) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}
house.canTake = () => !selected;
house.onPickup = type => {
  setHand(type);
  showToast(`Picked up the ${NAMES[type]}`, 1800);
  chime();
};
house.onMessage = showToast;
house.onRead = () => openNote();
// shells loaded into the shotgun in hand: each pack gives 3 shots
house.onLoad = () => {
  ammo += 3;
  house.onSound('load');
  showToast(`Loaded 3 shells. ${ammo} in the shotgun.`);
  renderInventory();
};
// a key is used up when it opens a lock; an apple when it is put on the board
house.onConsume = type => { if (selected === type) setHand(null); };
setHand('shotgun'); // test start: begin with the shotgun in hand

// ---- keypad and note screens ------------------------------------------------------
let uiOpen = false;
const keypadEl = document.getElementById('keypad'), noteEl = document.getElementById('note');
const kpDisplay = document.getElementById('kpDisplay'), kpMsg = document.getElementById('kpMsg');
let kpTarget = null, kpEntered = '', kpLocked = false;
function renderKeypad() {
  kpDisplay.textContent = (kpEntered + '____').slice(0, 4).split('').join(' ');
}
function openKeypad(target) {
  kpTarget = target; kpEntered = ''; kpLocked = false;
  kpMsg.textContent = 'Enter the 4-digit code';
  kpDisplay.classList.remove('bad');
  renderKeypad();
  keypadEl.hidden = false;
  uiOpen = true;
  move.x = move.y = 0;
  document.exitPointerLock?.();
}
function openNote() {
  document.getElementById('noteImg').src = house.noteIcon;
  noteEl.hidden = false;
  uiOpen = true;
  move.x = move.y = 0;
  document.exitPointerLock?.();
}
function closeUi() {
  keypadEl.hidden = true; noteEl.hidden = true;
  uiOpen = false;
}
function keypadPress(d) {
  if (kpLocked) return;
  if (d === 'C') { kpEntered = kpEntered.slice(0, -1); renderKeypad(); return; }
  if (kpEntered.length >= 4) return;
  kpEntered += d;
  renderKeypad();
  if (kpEntered.length < 4) return;
  kpLocked = true;
  if (house.tryCode(kpTarget, kpEntered)) {
    kpMsg.textContent = 'Click.';
    setTimeout(closeUi, 400);
  } else {
    kpMsg.textContent = 'Wrong code';
    kpDisplay.classList.add('bad');
    setTimeout(() => { kpEntered = ''; kpLocked = false; kpDisplay.classList.remove('bad'); kpMsg.textContent = 'Enter the 4-digit code'; renderKeypad(); }, 700);
  }
}
for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'X']) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = d === 'X' ? '\u00d7' : d === 'C' ? '\u232b' : d;
  b.setAttribute('aria-label', d === 'X' ? 'Close' : d === 'C' ? 'Delete' : d);
  b.addEventListener('click', () => (d === 'X' ? closeUi() : keypadPress(d)));
  document.getElementById('kpGrid').append(b);
}
noteEl.addEventListener('click', closeUi);
function uiKey(e) {
  if (e.code === 'Escape' || e.code === 'KeyE') { closeUi(); return; }
  if (keypadEl.hidden) return;
  if (/^[0-9]$/.test(e.key)) keypadPress(e.key);
  else if (e.key === 'Backspace') keypadPress('C');
}
house.onKeypad = openKeypad;

// ---- escaping -------------------------------------------------------------------
let escaped = false;
house.onEscape = () => {
  escaped = true;
  const s = Math.round(performance.now() / 1000);
  document.getElementById('winTime').textContent = `You got out in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.`;
  document.getElementById('win').hidden = false;
  heldView.show(null);
  chime();
};
document.getElementById('again').addEventListener('click', () => location.reload());
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

house.onSound = name => {
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const noise = (len, decay) => {
      const buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * decay));
      const src = audio.createBufferSource();
      src.buffer = buf;
      return src;
    };
    const out = audio.createGain();
    out.connect(audio.destination);
    if (name === 'unlock') {          // a bright metal click
      const src = noise(0.15, 0.015), hp = audio.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2500;
      out.gain.value = 0.7;
      src.connect(hp).connect(out); src.start(now);
    } else if (name === 'drop') {     // a soft thump
      const th = audio.createOscillator(), tg = audio.createGain();
      th.frequency.setValueAtTime(120, now); th.frequency.exponentialRampToValueAtTime(50, now + 0.12);
      tg.gain.setValueAtTime(0.45, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      th.connect(tg).connect(audio.destination); th.start(now); th.stop(now + 0.17);
    } else if (name === 'chop') {     // a blade through something dry
      const a = noise(0.18, 0.03), lp = audio.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      out.gain.value = 0.8;
      a.connect(lp).connect(out); a.start(now);
      const th = audio.createOscillator(), tg = audio.createGain();
      th.frequency.setValueAtTime(140, now); th.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      tg.gain.setValueAtTime(0.5, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      th.connect(tg).connect(audio.destination); th.start(now); th.stop(now + 0.15);
    } else if (name === 'shot') {     // a boom: a burst of noise and a deep thump
      const a = noise(0.9, 0.2), lp = audio.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, now); lp.frequency.exponentialRampToValueAtTime(200, now + 0.5);
      out.gain.value = 1;
      a.connect(lp).connect(out); a.start(now);
      const th = audio.createOscillator(), tg = audio.createGain();
      th.type = 'sine'; th.frequency.setValueAtTime(95, now); th.frequency.exponentialRampToValueAtTime(30, now + 0.4);
      tg.gain.setValueAtTime(0.9, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      th.connect(tg).connect(audio.destination); th.start(now); th.stop(now + 0.5);
    } else if (name === 'dry') {      // an empty click
      const a = noise(0.06, 0.008), hp = audio.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      out.gain.value = 0.5;
      a.connect(hp).connect(out); a.start(now);
    } else if (name === 'load') {     // two clacks
      for (const dt of [0, 0.16]) {
        const a = noise(0.07, 0.01), bp = audio.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
        out.gain.value = 0.6;
        a.connect(bp).connect(out); a.start(now + dt);
      }
    } else if (name === 'wrong') {    // a low buzz
      const osc = audio.createOscillator(), g = audio.createGain();
      osc.type = 'square'; osc.frequency.value = 110;
      g.gain.setValueAtTime(0.12, now); g.gain.linearRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(g).connect(audio.destination); osc.start(now); osc.stop(now + 0.35);
    } else if (name === 'cut') {      // snip, then a short zap
      const a = noise(0.12, 0.012), b = noise(0.4, 0.09), bp = audio.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
      out.gain.value = 0.7;
      a.connect(out); a.start(now);
      b.connect(bp).connect(out); b.start(now + 0.05);
    } else {                          // a long door creak
      const osc = audio.createOscillator(), g = audio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.9);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, now + 1.1);
      const lp = audio.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 500;
      osc.connect(lp).connect(g).connect(audio.destination);
      osc.start(now); osc.stop(now + 1.1);
    }
  } catch { /* audio is optional */ }
};

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
let lastYaw = player.yaw, lastPitch = player.pitch;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (escaped) { // the game is over: keep drawing the scene behind the message
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

  let fx = move.y, fz = move.x; // stick: up = forward
  if (keys.has('KeyW') || keys.has('ArrowUp')) fx -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fx += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) fz -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) fz += 1;
  if (uiOpen) { fx = 0; fz = 0; }
  const mag = Math.min(1, Math.hypot(fx, fz));

  let hideE = 0;
  if (hide.spot) {
    hide.amt = Math.max(0, Math.min(1, hide.amt + hide.dir * dt / 0.5));
    hideE = hide.amt * hide.amt * (3 - 2 * hide.amt);
    player.pos.x = hide.entry.x + (hide.spot.x - hide.entry.x) * hideE;
    player.pos.z = hide.entry.z + (hide.spot.z - hide.entry.z) * hideE;
    if (hide.dir > 0 && hide.amt < 1) player.yaw += angleDiff(hide.yawOut, player.yaw) * Math.min(1, dt * 5);
    // pushing the stick crawls you back out
    if (hide.amt >= 1 && mag > 0.6) { hide.pushing += dt; if (hide.pushing > 0.25) leaveHide(); } else hide.pushing = 0;
    if (hide.dir < 0 && hide.amt <= 0) { hide.spot = null; hide.dir = 0; player.hidden = false; }
  }
  if (mag > 0.01 && !hide.spot) {
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

  const bob = mag > 0.01 && !hide.spot ? Math.sin(t * 8) * 0.03 * mag : 0;
  const eye = hide.spot ? EYE + (hide.spot.eye - EYE) * hideE : EYE;
  vignette.style.opacity = (hideE * 0.95).toFixed(3);
  camera.position.set(player.pos.x, player.y + eye + bob, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  updateLights(t, dt);
  house.update(dt, player);
  updateTarget();

  const yawRate = (player.yaw - lastYaw) / Math.max(dt, 1e-3), pitchRate = (player.pitch - lastPitch) / Math.max(dt, 1e-3);
  lastYaw = player.yaw; lastPitch = player.pitch;
  heldView.update(t, dt, { walk: hide.spot ? 0 : mag, bobAccel: -64 * bob, yawRate, pitchRate });

  renderer.render(scene, camera);
  if (heldView.visible) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(heldView.scene, heldView.camera);
    renderer.autoClear = true;
  }
  requestAnimationFrame(frame);
}
frame();

window.__game = { player, house, camera, THREE }; // for debugging
window.__held = heldView;
Object.defineProperty(window, '__inv', { get: () => ({ hand: selected, ammo }) });
window.__ammo = () => ammo;
