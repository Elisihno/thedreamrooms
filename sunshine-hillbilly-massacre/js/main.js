import * as THREE from '../vendor/three.module.min.js';
import { buildHouse, levelY } from './world.js';
import { buildOutdoors, HAZE } from './outdoors.js';
import { createHeld } from './held.js';
import { icons } from './icons.js';
import { ITEM_NAMES } from './models.js';
import { createHillbilly, ENTITY_NAME } from './hillbilly.js';
import { createAudio } from './audio.js';
import { loadAssets } from './assets.js';

// Every run is different: the house layout, doors and hiding places come from a random seed.
// Page flags (after the #, joined with . or &): fast = skip the title, test = fast plus a loaded
// shotgun, s123 = use seed 123, nohill = no Hillbilly, hill = he starts close (for testing),
// day3 = start on day 3, nosplash = skip the opening.
const hashFlags = new Set(location.hash.slice(1).split(/[&.,]/).filter(Boolean));
const seedFlag = [...hashFlags].map(f => /^s(\d+)$/.exec(f)).find(Boolean);
const seed = Number(new URLSearchParams(location.search).get('seed')) || (seedFlag ? Number(seedFlag[1]) : 0)
  || 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 999999);

const $ = id => document.getElementById(id);
const loadingEl = $('loading');
const setLoading = t => { if (loadingEl) loadingEl.querySelector('b').textContent = t; };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fogColor = new THREE.Color(HAZE), cellarFog = new THREE.Color(0x0a0806);
scene.background = fogColor.clone();
scene.fog = new THREE.FogExp2(HAZE, 0.026);
// the light inside is the sun through the windows, so this is the glow of a bright afternoon
const hemi = new THREE.HemisphereLight(0xfff0d0, 0x8a6a48, 2.2);
scene.add(hemi);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 60);
scene.add(camera);

// flashlight
const flash = new THREE.SpotLight(0xfff1d6, 7, 20, 0.52, 0.55, 1.1);
flash.position.set(0.1, -0.1, 0);
flash.target.position.set(0, 0, -5);
camera.add(flash, flash.target);
flash.visible = false; // the beam only exists once you own a flashlight and switch it on

setLoading('Loading the farm...');
let assets;
try { assets = await loadAssets(f => setLoading(`Loading the farm... ${Math.round(f * 100)}%`)); }
catch (e) { console.error(e); setLoading('Could not load the models. Reload the page to try again.'); throw e; }
setLoading('Building the house...');
await new Promise(r => setTimeout(r, 30));   // let the message paint before the heavy part

const house = buildHouse(renderer, seed, assets.props);
scene.add(house.group);
const outdoors = buildOutdoors(house.textures, house.size);
scene.add(outdoors.group);

// ---- dust drifting in the sunlight -----------------------------------------------------------------
const DUST = 260;
const dustPos = new Float32Array(DUST * 3), dustVel = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) {
  dustPos.set([(Math.random() - 0.5) * 12, Math.random() * 3, (Math.random() - 0.5) * 12], i * 3);
  dustVel.set([(Math.random() - 0.5) * 0.05, 0.01 + Math.random() * 0.03, (Math.random() - 0.5) * 0.05], i * 3);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: house.textures.mote, size: 0.07, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff0c0 }));
dust.frustumCulled = false;
scene.add(dust);

// ---- player -------------------------------------------------------------
const player = { pos: house.spawn.clone(), y: house.spawn.y, level: house.spawnLevel, yaw: 0, pitch: 0, radius: 0.3 };
const EYE = 1.6, WALK = 2.2;

// Hiding under a table or bed, or in a wardrobe: the view slides in, the way out is the hand cursor
// (or pushing the stick). player.hidden is true meanwhile.
const hide = { spot: null, amt: 0, dir: 0, entry: { x: 0, z: 0 }, yawOut: 0, pushing: 0 };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function enterHide(spot) {
  if (hide.spot) return;
  hide.spot = spot; hide.amt = 0; hide.dir = 1; hide.pushing = 0;
  hide.entry.x = player.pos.x; hide.entry.z = player.pos.z;
  hide.yawOut = Math.atan2(-(hide.entry.x - spot.x), -(hide.entry.z - spot.z)); // look back out the way you came
  player.hidden = true;
  $('hide').classList.toggle('closet', !!spot.closet);
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

// ---- settings (kept in the browser) -----------------------------------------------------------------
const DEFAULTS = { sound: true, music: true, sens: 100, fear: true, speed: 100, sense: 100, grace: 25, batt: 100, days: 5, hill: true, pspeed: 100, dark: false, limp: false, quality: 'high', mode: 'medium', volume: 100 };
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('sunshine.settings') || '{}')); } catch { /* storage may be blocked */ }
const saveSettings = () => { try { localStorage.setItem('sunshine.settings', JSON.stringify(settings)); } catch { /* ignore */ } };
const audio = createAudio(() => settings);
let darkMul = 1;
let paused = false;
const title = { active: false, phase: 'idle', k: 0 };   // k: 0 looking at the room, 1 looking at the floor

// ---- title screen and waking up ----------------------------------------------------------
// The game starts on a title screen (browsers need a tap before they allow sound). Then the player
// wakes up on the floor in the sunlit bedroom: eyes open in slow blinks through blurry, tilted
// vision with a heartbeat, then sits up and stands. Open the page with #fast (or #test) to skip it.
const fastStart = hashFlags.has('fast') || hashFlags.has('test') || new URLSearchParams(location.search).has('fast');
const wake = { active: false, t: 0, dur: 8.4, skippable: false };
const lidT = $('lidT'), lidB = $('lidB');
const startEl = $('start'), fadeEl = $('fade');
const glowEl = $('glow'), fxEl = $('fx'), winEl = $('win');
let playStart = performance.now();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// how open the eyes are over time: a first heavy blink, a longer look, a last blink, then wide open
function eyeOpen(t) {
  const keys = [[0, 0], [1.0, 0], [1.7, 0.3], [2.1, 0.3], [2.4, 0], [3.0, 0], [3.8, 0.7], [4.4, 0.7], [4.7, 0.1], [5.3, 0.1], [6.2, 1], [8.4, 1]];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * smooth(t0, t1, t); }
  }
  return 1;
}

function startWake() {
  audio.init();
  startEl.hidden = true;
  playStart = performance.now();
  wake.active = true; wake.t = 0; wake.skippable = false;
  document.body.classList.add('waking');
  audio.wake();
}
function skipWake() {
  if (wake.active && wake.skippable && wake.t < wake.dur - 1) wake.t = wake.dur - 1; // jump to the standing-up part
}
function endWake() {
  wake.active = false;
  lidT.hidden = lidB.hidden = true;
  renderer.domElement.style.filter = '';
  document.body.classList.remove('waking');
  showToast('Where am I?', 2600);
}

// after being caught the next day begins: a black card, then waking up again in a new house
const dayFlag = [...hashFlags].map(f => /^day(\d+)$/.exec(f)).find(Boolean);
const LAST_DAY = Math.max(1, Math.min(7, settings.days));
const day = Math.min(LAST_DAY, dayFlag ? +dayFlag[1] : 1);
const dayEl = $('day');
const DAY_LINES = ['The sun is high.', 'The sun is still up.', 'Nobody is coming.', 'He is getting hungry.', 'The corn is whispering.', 'Not much longer.', 'Last chance.'];
if (day > 1 && !fastStart) {
  startEl.hidden = true; lidT.hidden = lidB.hidden = false;
  dayEl.innerHTML = `Day ${day}<small>${DAY_LINES[day - 1] ?? ''}</small>`; dayEl.style.opacity = '1'; dayEl.hidden = false;
  setTimeout(() => { dayEl.style.opacity = '0'; startWake(); setTimeout(() => { dayEl.hidden = true; }, 1600); }, 2200);
} else if (fastStart) { startEl.hidden = true; lidT.hidden = lidB.hidden = true; }
else { lidT.hidden = lidB.hidden = true; document.body.classList.add('waking'); }   // the title screen
const titleMode = !fastStart && day === 1;
addEventListener('keydown', e => { if (title.active) { if ((e.code === 'Space' || e.code === 'Enter') && title.phase === 'idle' && !$('opts').offsetParent) { e.preventDefault(); $('btnPlay').click(); } } else skipWake(); });
renderer.domElement.addEventListener('touchstart', skipWake, { passive: true });
renderer.domElement.addEventListener('click', skipWake);

const floorLabel = $('floor');
const vignette = $('hide');
let shownLevel = -1;

// ---- input --------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', e => {
  if (uiOpen) { uiKey(e); return; }
  keys.add(e.code);
  if (e.code === 'KeyE') useTarget();
  if (e.code === 'Space') { e.preventDefault(); drop(); }   // PC: Space drops what you hold
  if (e.code === 'KeyQ') drop();
  if (e.code === 'KeyR') fire();                             // PC: R fires (or click when nothing is in reach)
});
addEventListener('keyup', e => keys.delete(e.code));

const canvas = renderer.domElement;
canvas.addEventListener('click', () => {
  if (title.active) return;
  if (matchMedia('(pointer: coarse)').matches) return;
  if (document.pointerLockElement === canvas) { if (target) useTarget(); else if (selected === 'shotgun') fire(); else toggleLight(); }
  else canvas.requestPointerLock?.();
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  look(e.movementX * 0.0022, e.movementY * 0.0022);
});

function look(dx, dy) {
  if (wake.active || driving || title.active || paused) return;
  dx *= settings.sens / 100; dy *= settings.sens / 100;
  player.yaw -= dx;
  player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - dy));
  if (hide.spot && hide.amt > 0.95) { // only peek around from underneath
    player.yaw = hide.yawOut + Math.max(-1.25, Math.min(1.25, angleDiff(player.yaw, hide.yawOut)));
    player.pitch = Math.max(-0.6, Math.min(0.6, player.pitch));
  }
}

// touch: left half = move stick, right half = look
const stick = $('stick');
const knob = $('knob');
const move = { x: 0, y: 0 };
const touches = new Map(); // id -> {mode, sx, sy, lx, ly}
const STICK_R = 55;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (title.active) return;
  for (const t of e.changedTouches) {
    const mode = t.clientX < innerWidth / 2 ? 'move' : 'look';
    touches.set(t.identifier, { mode, sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY, t0: performance.now(), moved: false });
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
    if (Math.hypot(t.clientX - s.sx, t.clientY - s.sy) > 12) s.moved = true;
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
    if (s && !s.moved && performance.now() - s.t0 < 260 && e.type === 'touchend') toggleLight();   // a quick tap: flashlight on/off
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
const useBtn = $('use');
const dotEl = $('dot');
useBtn.querySelector('img').src = 'assets/ui_hand.png';
let target = null;
const NAMES = ITEM_NAMES;
const label = t => (t.kind === 'item' ? (t.type === 'shells' && selected === 'shotgun' ? 'Load shells' : t.type === 'postcard' ? 'Read postcard' : `Take ${NAMES[t.type]}`) : t.kind === 'roomdoor' ? (t.door.open ? 'Close' : 'Open') : t.kind === 'wire' ? 'Cut' : t.kind === 'carhood' ? 'Truck hood' : t.kind === 'carfuel' ? 'Gas tank' : t.kind === 'cardoor' ? 'Truck door' : t.kind === 'board' ? 'Butcher block' : t.locked ? 'Padlocked' : t.kind === 'keypad' ? 'Keypad' : t.kind === 'exit' ? (t.exit.name ?? 'Door') : t.open ? 'Close' : 'Open');
function useTarget() {
  if (wake.active || driving || paused) return;
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
  placeHand(t);
  useBtn.dataset.label = t?.kind === 'hide' ? 'Hide' : t?.kind === 'board' || t?.kind?.startsWith('car') || t?.kind === 'exit' ? label(t) : t?.locked ? 'Padlocked' : '';
  if (t) useBtn.setAttribute('aria-label', t.kind === 'hide' ? 'Hide' : label(t));
}
house.onHide = enterHide;

// The hand cursor is small, and when it points at something to pick up it shrinks further and
// sits on that item instead of the middle of the screen.
const handPos = { x: innerWidth / 2, y: innerHeight / 2, size: 64 };
const _v = new THREE.Vector3();
function placeHand(t) {
  let x = innerWidth / 2, y = innerHeight / 2, size = 64;
  if (t?.kind === 'item') {
    camera.updateMatrixWorld();
    t.mesh.getWorldPosition(_v).project(camera);
    if (_v.z < 1) {
      x = Math.max(40, Math.min(innerWidth - 40, (_v.x * 0.5 + 0.5) * innerWidth));
      y = Math.max(40, Math.min(innerHeight - 40, (-_v.y * 0.5 + 0.5) * innerHeight));
      size = 38;
    }
  }
  const k = t ? 0.45 : 1; // glide onto the item
  handPos.x += (x - handPos.x) * k; handPos.y += (y - handPos.y) * k; handPos.size += (size - handPos.size) * k;
  useBtn.style.left = handPos.x + 'px';
  useBtn.style.top = handPos.y + 'px';
  useBtn.style.width = useBtn.style.height = handPos.size + 'px';
  useBtn.style.margin = `${-handPos.size / 2}px 0 0 ${-handPos.size / 2}px`;
}

// ---- the hand ---------------------------------------------------------------------
// One item in hand at most. Picking something up needs a free hand; DROP puts it down.
// Test mode (open the page with #test, or ?test) starts with the shotgun in hand, loaded with 3 shells.
// Normally you start empty-handed.
const testMode = hashFlags.has('test') || new URLSearchParams(location.search).has('test');
let ammo = testMode ? 3 : 0;  // shells loaded in the shotgun
const invEl = $('inv');
const toastEl = $('toast');
let toastTimer = 0;
const iconSrc = type => (type === 'postcard' ? house.postcardIcon : icons[type]);
let selected = null; // the item in hand
const heldView = createHeld();
heldView.resize(innerWidth / innerHeight);
function setHand(type) {
  selected = type;
  heldView.show(type);
  renderInventory();
}

const fireBtn = $('fire'), dropBtn = $('drop');
function fire() {
  if (selected !== 'shotgun' || uiOpen || escaped || hide.spot || wake.active || driving) return;
  if (ammo <= 0) { audio.sfx('dry'); showToast('Click. The shotgun is empty.', 1400); return; }
  ammo--;
  audio.sfx('shot');
  heldView.kick();
  house.shoot(camera, player);
  if (hill) { hill.addFear(10); if (hill.tryShoot(camera, player)) showToast(`${ENTITY_NAME} is down. His saw has stalled. Run, or hide.`, 2600); }
  renderInventory();
}

// Put the item down in front of you, clear of walls and furniture.
function drop() {
  if (!selected || uiOpen || escaped || hide.spot || wake.active || driving) return;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const [x, z] = collide(player.pos.x + fx * 0.75, player.pos.z + fz * 0.75);
  const type = selected;
  house.dropItem(type, x, player.y, z, player.yaw, player.level, null, true);
  setHand(null);
  if (type !== 'jar') audio.sfx('drop');   // the vase makes its own sound when it lands
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
// ---- the flashlight: gear you own once you have found it, with a battery that drains -------------
const gear = { flashlight: false, on: false, charge: 100 };
const battEl = $('battery'), battFill = $('battFill');
// the battery: a rough, worn bar at the bottom left; amber when the light is on, dull when off, red when low
function renderLight() {
  battEl.hidden = !gear.flashlight || wake.active || !!driving;
  battFill.style.width = gear.charge.toFixed(1) + '%';
  battEl.classList.toggle('on', gear.on);
  battEl.classList.toggle('low', gear.charge < 20);
}
function toggleLight() {
  if (!gear.flashlight || wake.active || driving || paused) return;
  if (!gear.on && gear.charge <= 0) { showToast('The flashlight is dead.', 1600); return; }
  gear.on = !gear.on;
  audio.sfx('click');
  renderLight();
}
addEventListener('keydown', e => { if (e.code === 'KeyF' && !uiOpen) toggleLight(); });

house.onPickup = type => {
  if (type === 'flashlight') {       // worn, not held: your hand stays free
    gear.flashlight = true; gear.on = true;
    renderLight();
    showToast('Picked up the flashlight. Click or tap the screen to switch it on and off. The cellar is dark.', 3400);
    audio.chime();
    return;
  }
  setHand(type);
  showToast(`Picked up the ${NAMES[type]}`, 1800);
  audio.chime();
};
house.onMessage = showToast;
// Something loud happened (a window was shot out, a vase smashed): the Hillbilly comes to look.
let lastAlert = null;
house.onAlert = a => {
  lastAlert = { ...a, at: performance.now() };
  if (a.kind === 'jar') { setTimeout(() => hill?.investigate(a.x, a.z, a.level), 400); return; }   // a crash close by: he is on his way
  setTimeout(() => { audio.sfx('alert'); showToast('Something in the house heard that...', 3200); hill?.investigate(a.x, a.z, a.level); }, 1600);
};
house.onTrap = () => {
  if (driving || escaped) return;
  driving = { kind: 'fall', t: 0, H: 3 + 1.3 };
  setHand(null);
  audio.entity('crack', 1);
  audio.entity('wind', 1);
};
window.__alert = () => lastAlert;
Object.defineProperty(window, '__gear', { get: () => gear });
house.onRead = () => openNote();
// shells loaded into the shotgun in hand: each pack gives 3 shots
house.onLoad = () => {
  ammo += 3;
  audio.sfx('load');
  showToast(`Loaded 3 shells. ${ammo} in the shotgun.`);
  renderInventory();
};
// a key is used up when it opens a lock; an apple when it is put on the block
house.onConsume = type => { if (selected === type) setHand(null); };
if (testMode) setHand('shotgun'); // only the test start begins with the shotgun in hand
house.onSound = name => audio.sfx(name);
house.onUse = (kind, open) => audio.use(kind, open);
house.onThud = () => { hill?.addFear(14); audio.thud(); };

// ---- keypad and postcard screens ------------------------------------------------------
let uiOpen = false;
const keypadEl = $('keypad'), noteEl = $('note');
const kpDisplay = $('kpDisplay'), kpMsg = $('kpMsg');
let kpTarget = null, kpEntered = '', kpLocked = false;
function renderKeypad() {
  kpDisplay.textContent = (kpEntered + '____').slice(0, 4).split('').join(' ');
}
function openKeypad(tg) {
  kpTarget = tg; kpEntered = ''; kpLocked = false;
  kpMsg.textContent = 'Enter the 4-digit code';
  kpDisplay.classList.remove('bad');
  renderKeypad();
  keypadEl.hidden = false;
  uiOpen = true;
  move.x = move.y = 0;
  document.exitPointerLock?.();
}
function openNote() {
  $('noteImg').src = house.postcardIcon;
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
  b.textContent = d === 'X' ? '×' : d === 'C' ? '⌫' : d;
  b.setAttribute('aria-label', d === 'X' ? 'Close' : d === 'C' ? 'Delete' : d);
  b.addEventListener('click', () => (d === 'X' ? closeUi() : keypadPress(d)));
  $('kpGrid').append(b);
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
function showWin(heading, verb, kind = 'front') {
  escaped = true;
  winEl.className = kind;
  const s = Math.round((performance.now() - playStart) / 1000);
  $('winTitle').textContent = heading;
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('winTime').textContent = kind === 'dead' ? `You lasted ${clock}.` : `You ${verb} in ${clock}.`;
  winEl.hidden = false;
  fadeEl.style.opacity = '0';
  glowEl.style.opacity = '0';
  fxEl.hidden = true;
  heldView.show(null);
  if (kind !== 'dead') audio.chime();
}
// a day is over (the Hillbilly got you, or you fell): the next one begins, or it was the last
function endDay() {
  escaped = true;
  dayEl.style.opacity = '1'; dayEl.hidden = false;
  if (day >= settings.days) {
    dayEl.innerHTML = 'The End<small>Tap to start over</small>';
    setTimeout(() => { dayEl.style.pointerEvents = 'auto'; dayEl.addEventListener('pointerdown', () => { location.hash = ''; location.reload(); }); }, 3000);
  } else {
    dayEl.innerHTML = `Day ${day + 1}<small>${DAY_LINES[day] ?? ''}</small>`;
    setTimeout(() => { location.hash = `#day${day + 1}`; location.reload(); }, 2800);
  }
}
// ---- the three endings ------------------------------------------------------------------------
// Each escape has its own short film: the front door walks out into blinding sunshine, the cellar
// hatch climbs out into the hot afternoon field, and the truck speeds off down the dirt road.
let driving = null;   // the ending that is playing, if any
const GLOW = {
  front: 'radial-gradient(ellipse at 50% 45%, rgba(255,250,225,1) 0%, rgba(255,232,170,.9) 38%, rgba(255,205,120,0) 78%)',
  hatch: 'radial-gradient(ellipse at 50% 15%, rgba(255,240,190,.95) 0%, rgba(255,205,120,.6) 42%, rgba(255,160,60,0) 82%)',
  car: 'linear-gradient(to top, rgba(255,140,70,.95), rgba(255,205,140,.65) 55%, rgba(255,240,200,0))',
};
const FADE = { front: '#fff7e6', hatch: '#ffe9b8', car: '#ffcf9a' };
function startFinale(kind, exit) {
  if (driving || escaped) return;
  setHand(null);
  heldView.show(null);
  closeUi();
  driving = { kind, exit, t: 0, from: { x: player.pos.x, z: player.pos.z } };
  glowEl.style.background = GLOW[kind];
  glowEl.style.opacity = '0';
  fadeEl.style.background = FADE[kind];
  fxEl.hidden = false;
  resizeFx();
  audio.finale(kind);
}
house.onEscape = exit => startFinale(exit.id === 'hatch' ? 'hatch' : 'front', exit);
house.onDrive = () => startFinale('car');   // the engine sound is started by the house

// the overlay canvas: light rays at the front door, heat shimmer at the hatch, speed streaks in the truck
function resizeFx() { fxEl.width = innerWidth; fxEl.height = innerHeight; }
addEventListener('resize', resizeFx);
const fxRand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
const motes = Array.from({ length: 90 }, () => ({ x: fxRand(), y: fxRand(), r: 0.6 + fxRand() * 2, ph: fxRand() * 6 }));
const streaks = Array.from({ length: 70 }, () => ({ a: fxRand() * Math.PI * 2, r0: 0.25 + fxRand() * 0.5, len: 0.15 + fxRand() * 0.4, w: 0.6 + fxRand() * 1.8, ph: fxRand() }));
function drawFx(f) {
  const g = fxEl.getContext('2d'), W = fxEl.width, H = fxEl.height, k = f.t;
  g.clearRect(0, 0, W, H);
  if (f.kind === 'front') {          // soft light rays fanning out from the doorway
    const a = smooth(0.4, 2.4, k) * (1 - smooth(3.8, 4.6, k));
    g.save(); g.translate(W / 2, H * 0.42); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 + (i - 4) * 0.2 + Math.sin(k * 0.6 + i) * 0.03;
      g.fillStyle = `rgba(255,236,190,${0.1 * a})`;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang - 0.05) * W, Math.sin(ang - 0.05) * W); g.lineTo(Math.cos(ang + 0.05) * W, Math.sin(ang + 0.05) * W); g.fill();
    }
    g.restore();
  } else if (f.kind === 'hatch') {   // dust and pollen rising in the heat
    const a = smooth(1.2, 3.0, k);
    for (const s of motes) {
      g.fillStyle = `rgba(255,240,190,${a * (0.35 + 0.35 * Math.sin(k * 2 + s.ph))})`;
      g.beginPath(); g.arc(s.x * W, ((s.y - k * 0.05) % 1 + 1) % 1 * H, s.r, 0, 7); g.fill();
    }
  } else {                           // speed streaks, flying outward from the middle
    const a = smooth(0.9, 1.8, k) * (1 - smooth(3.3, 4.0, k));
    g.save(); g.translate(W / 2, H / 2); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineCap = 'round';
    const R = Math.hypot(W, H) / 2;
    for (const s of streaks) {
      const p = (s.ph + k * (1.2 + a * 2)) % 1, r1 = R * (s.r0 + p * 0.9), r0 = r1 - R * s.len * a * p;
      g.globalAlpha = a * (0.15 + 0.5 * p); g.lineWidth = s.w * 1.4;
      g.beginPath(); g.moveTo(Math.cos(s.a) * r0, Math.sin(s.a) * r0); g.lineTo(Math.cos(s.a) * r1, Math.sin(s.a) * r1); g.stroke();
    }
    g.restore();
  }
}
$('again').addEventListener('click', () => { location.hash = '#fast'; location.reload(); });
renderInventory();

useBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); useTarget(); }, { passive: false });
useBtn.addEventListener('click', useTarget);

// ---- sound ----------------------------------------------------------------
addEventListener('touchstart', () => audio.init(), { passive: true });
addEventListener('keydown', () => audio.init());
addEventListener('click', () => audio.init());

// ---- room lights ----------------------------------------------------------
// A fixed pool of point lights follows the nearest rooms, so the shader cost stays
// constant however many rooms the house has. Upstairs they warm the shade; in the cellar
// they are bare bulbs, the only light there is.
const pool = Array.from({ length: 4 }, () => {
  const l = new THREE.PointLight(0xffd9a0, 0, 10, 1.3);
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
    const bulb = room.level === 0;
    l.intensity = (bulb ? 2.6 : 0.45) * (settings.dark ? 0.6 : 1) * room.base * (bulb ? 0.8 + 0.2 * Math.sin(t * (6 + room.base * 5) + room.pos.x) * Math.sin(t * 1.7 + room.pos.z) : 1);
  }
}

// ---- the Hillbilly ----------------------------------------------------------------------------
// ENTITY_NAME wanders the house with the chainsaw running and follows your fear (see hillbilly.js).
// Fear shows as a bar and a heartbeat at the edges of the screen.
const hill = hashFlags.has('nohill') ? null : createHillbilly(house, assets, hashFlags.has('hill') ? { near: 6, grace: 2 } : {});
if (hill) {
  scene.add(hill.group);
  hill.spawn(player);
  hill.onSound = (name, vol) => audio.entity(name, vol);
  hill.onCaught = () => {
    if (driving) return;
    driving = { kind: 'caught', t: 0 };
    audio.entity('catch', 1);
    setHand(null);
  };
}
let hillOn = !!hill && settings.hill;
function applyHillSettings() {
  if (!hill) return;
  hill.speedMul = settings.speed / 100 * (settings.limp ? 0.8 : 1);
  hill.limp = !!settings.limp;
  hill.senseMul = settings.sense / 100;
  if (!hashFlags.has('hill')) hill.setGrace(settings.grace);
}
applyHillSettings();
window.__hill = hill;

// ---- the menu --------------------------------------------------------------------------------------
const FIELDS = [['oSens', 'sens', v => v + '%'], ['oVol', 'volume', v => v + '%'], ['pVol', 'volume', v => v + '%']];
const CHECKS = [['oSound', 'sound'], ['oFear', 'fear'], ['sSound', 'music'], ['sFear', 'fear'], ['sDark', 'dark'], ['sLimp', 'limp']];
function refreshMenu() {
  for (const [id, key, fmt] of FIELDS) { $(id).value = settings[key]; $(id + 'V').textContent = fmt(settings[key]); }
  for (const [id, key] of CHECKS) $(id).checked = !!settings[key];
}
for (const [id, key, fmt] of FIELDS) $(id).addEventListener('input', () => {
  settings[key] = +$(id).value; $(id + 'V').textContent = fmt(settings[key]); saveSettings();
  if (key === 'volume') { refreshMenu(); audio.applyVolume(); audio.sfx('click'); }
});
for (const [id, key] of CHECKS) $(id).addEventListener('change', () => {
  settings[key] = $(id).checked; saveSettings();
  if (key === 'sound') audio.setEnabled(settings.sound);
});
// the modes, Granny-style: you pick one on the floor and the game begins
const MODES = {   // speed: his, pspeed: yours, both as a percentage of the normal walking pace
  easy:     { pspeed: 75,  speed: 65,  sense: 60,  grace: 50, batt: 200, days: 7, hill: true },
  medium:   { pspeed: 100, speed: 95,  sense: 100, grace: 25, batt: 100, days: 5, hill: true },
  hard:     { pspeed: 115, speed: 115, sense: 140, grace: 10, batt: 70,  days: 4, hill: true },
  extreme:  { pspeed: 120, speed: 135, sense: 200, grace: 0,  batt: 50,  days: 3, hill: true },
  practice: { pspeed: 85,  speed: 100, sense: 100, grace: 25, batt: 100, days: 1, hill: false },   // no Hillbilly, nothing to fear
};
refreshMenu();
applyLook();
$('btnOptions').addEventListener('click', () => { $('opts').hidden = false; $('menuMain').hidden = true; });
$('optBack').addEventListener('click', () => { $('opts').hidden = true; $('menuMain').hidden = false; });
$('btnPlay').addEventListener('click', () => { audio.init(); refreshSetup(); title.phase = 'down'; $('menuMain').hidden = true; $('gameTitle').classList.add('gone'); });
$('modBack').addEventListener('click', () => { title.phase = 'up'; $('mods').hidden = true; $('gameTitle').classList.remove('gone'); });
function beginGame(mode) {
  audio.init();
  Object.assign(settings, MODES[mode]); settings.mode = mode; saveSettings();
  $('mods').hidden = true;
  title.active = false;
  hillOn = !!hill && settings.hill;
  if (hill) { applyHillSettings(); hill.group.visible = hillOn; hill.state = 'roam'; hill.fear = 0; hill.spawn(player); }
  if (titleLight) { titleLight.removeFromParent(); }
  player.pitch = 0;
  lidT.hidden = lidB.hidden = false;
  startWake();
}
$('btnContinue').addEventListener('click', () => beginGame(modeSel.value));
const DESC = {
  easy: ['Easy', ['The Hillbilly is slower than you.', 'The flashlight lasts twice as long.', 'You have 7 days to escape.']],
  medium: ['Medium', ['The Hillbilly is a little slower than you.', 'You have 5 days to escape.', 'A quiet start: 25 seconds before he hunts.']],
  hard: ['Hard', ['The Hillbilly is as fast as you.', 'He smells your fear from far away.', 'You have 4 days to escape.']],
  extreme: ['Extreme', ['The Hillbilly Is Faster Than You.', 'He smells your fear from everywhere.', 'You have 3 days to escape.']],
  practice: ['Practice', ['No Hillbilly.', 'Nothing is hunting you.', 'Take your time and find the ways out.']],
};
// our own drop-down chooser (the phone's system one looks out of place)
function chooser(id, options, onPick) {
  const root = $(id);
  root.className = 'dd';
  root.innerHTML = '<button type="button" class="dd-btn"></button><ul class="dd-list" hidden></ul>';
  const btn = root.firstChild, list = root.lastChild;
  let value = options[0][0];
  const items = options.map(([v, lab]) => {
    const li = document.createElement('li');
    li.textContent = lab;
    li.addEventListener('click', e => { e.stopPropagation(); set(v); list.hidden = true; onPick(v); });
    list.append(li);
    return [v, li, lab];
  });
  function set(v) {
    value = v;
    for (const [val, li, lab] of items) { li.classList.toggle('on', val === v); if (val === v) btn.textContent = lab; }
  }
  btn.addEventListener('click', e => { e.stopPropagation(); const open = list.hidden; document.querySelectorAll('.dd-list').forEach(l => { l.hidden = true; }); list.hidden = !open; });
  set(value);
  return { get value() { return value; }, set value(v) { set(v); } };
}
addEventListener('pointerdown', e => { if (!e.target.closest?.('.dd')) document.querySelectorAll('.dd-list').forEach(l => { l.hidden = true; }); });
const modeSel = chooser('sMode', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['extreme', 'Extreme'], ['practice', 'Practice']], v => { settings.mode = v; saveSettings(); showDesc(); });
const qualSel = chooser('sQuality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], v => { settings.quality = v; saveSettings(); applyLook(); });
function showDesc() {
  const [name, lines] = DESC[modeSel.value];
  $('sDesc').innerHTML = `<b>Difficulty: ${name}</b>` + lines.map(l => '*' + l).join('<br>');
}

function applyLook() {
  darkMul = settings.dark ? 0.5 : 1;
  const q = { low: 0.6, medium: 0.85, high: Math.min(devicePixelRatio, 2) }[settings.quality] ?? 1;
  renderer.setPixelRatio(q); renderer.setSize(innerWidth, innerHeight);
}

for (const id of ['sDark', 'sLimp']) $(id).addEventListener('change', () => { applyLook(); applyHillSettings(); });
function refreshSetup() { modeSel.value = settings.mode in MODES ? settings.mode : 'medium'; qualSel.value = settings.quality; showDesc(); }
// ---- pause: the wrench button (or Escape) stops the game and shows the volume ----------------------
const pauseBtn = $('pauseBtn'), pauseEl = $('pause');
const canPause = () => startEl.hidden && !title.active && !wake.active && !driving && !escaped && !uiOpen;
function setPaused(on) {
  if (on === paused) return;
  if (on && !canPause()) return;
  paused = on; uiOpen = on;
  pauseEl.hidden = !on;
  if (on) { refreshMenu(); document.exitPointerLock?.(); }
}
pauseBtn.addEventListener('click', () => setPaused(true));
pauseBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); setPaused(true); }, { passive: false });
$('pResume').addEventListener('click', () => setPaused(false));
$('pQuit').addEventListener('click', () => { location.hash = ''; location.reload(); });
addEventListener('keydown', e => { if (e.code === 'Escape') setPaused(!paused); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && canPause()) setPaused(true); });
// ---- the opening: the developer's name in blood, with drips, before the title ------------------------
function runSplash() {
  const cv = $('splash'), g = cv.getContext('2d');
  cv.hidden = false;
  cv.width = innerWidth; cv.height = innerHeight;
  const W = cv.width, H = cv.height, size = Math.min(W * 0.17, H * 0.32), text = 'Elisihno';
  g.font = `italic 700 ${size}px Georgia, 'Times New Roman', serif`;
  const tw = g.measureText(text).width, x0 = (W - tw) / 2, base = H * 0.55;
  const drips = Array.from({ length: 16 }, () => ({
    x: x0 + tw * (0.04 + Math.random() * 0.92), y: base - size * 0.05 - Math.random() * size * 0.18,
    len: size * (0.25 + Math.random() * 0.9), w: 2 + Math.random() * 5, at: 1.6 + Math.random() * 1.6, speed: 0.5 + Math.random() * 0.8,
  }));
  let clock = 0, prevT = 0;   // advanced by capped steps, so a slow first frame (loading) does not eat the animation
  let over = false;
  const end = () => { if (over) return; over = true; cv.style.opacity = '0'; setTimeout(() => { cv.hidden = true; }, 1200); };
  cv.addEventListener('pointerdown', end);
  addEventListener('keydown', end, { once: true });
  (function frame() {
    if (cv.hidden) return;
    const now = performance.now();
    clock += Math.min(0.05, prevT ? (now - prevT) / 1000 : 0); prevT = now;
    const t = clock;
    if (t > 4.4) end();
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // the name flickers in like a bad bulb
    const flick = t < 1.9 ? (Math.sin(t * 61) > -0.3 ? 1 : 0.15) : 1;
    const a = Math.min(1, Math.max(0, (t - 0.5) / 1.1)) * flick;
    g.globalAlpha = a;
    g.font = `italic 700 ${size}px Georgia, 'Times New Roman', serif`;
    g.textBaseline = 'alphabetic';
    const grad = g.createLinearGradient(0, base - size, 0, base);
    grad.addColorStop(0, '#d01414'); grad.addColorStop(0.6, '#8a0808'); grad.addColorStop(1, '#4a0000');
    g.shadowColor = 'rgba(190,0,0,.75)'; g.shadowBlur = size * 0.2;
    g.fillStyle = grad; g.fillText(text, x0, base);
    g.shadowBlur = 0; g.lineWidth = Math.max(2, size * 0.02); g.strokeStyle = 'rgba(30,0,0,.85)'; g.strokeText(text, x0, base);
    // drips run down from the letters
    for (const d of drips) {
      const k = Math.max(0, t - d.at) * d.speed, len = Math.min(d.len, d.len * (1 - Math.exp(-k * 2.2)));
      if (len <= 0) continue;
      g.strokeStyle = '#7a0606'; g.lineWidth = d.w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x, d.y + len); g.stroke();
      g.fillStyle = '#8e0a0a'; g.beginPath(); g.arc(d.x, d.y + len, d.w * 0.95, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    requestAnimationFrame(frame);
  })();
}
let titleLight = null;
if (titleMode) {
  if (!hashFlags.has('nosplash')) runSplash();
  title.active = true;
  const yaw = hill ? hill.placeForTitle(player) : null;
  player.yaw = (yaw ?? 0) + (innerWidth > innerHeight ? 0.28 : 0.1);       // he stands off to the right of the screen
  player.pitch = 0.14;
  if (hill) {
    titleLight = new THREE.PointLight(0xffe2a8, 6, 9);
    titleLight.position.set(hill.x + Math.sin(hill.yaw + Math.PI) * 1.4, hill.y + 2.3, hill.z + Math.cos(hill.yaw + Math.PI) * 1.4);
    scene.add(titleLight);
  }
}
// blood on the screen: splatters from each blow, with drips that run down
const bloodEl = $('blood'), bctx = bloodEl.getContext('2d');
let drips = [];
function bloodHit(n) {
  if (bloodEl.width !== innerWidth || bloodEl.height !== innerHeight) { bloodEl.width = innerWidth; bloodEl.height = innerHeight; }
  const W = bloodEl.width, H = bloodEl.height;
  audio.entity('hit', 1);
  heldView.kick();
  for (let i = 0; i < 9 + n * 6; i++) {
    const x = W * (0.12 + Math.random() * 0.76), y = H * (0.08 + Math.random() * 0.7), r = (0.03 + Math.random() * 0.08) * Math.min(W, H);
    const g = bctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,6,6,.92)'); g.addColorStop(0.7, 'rgba(90,0,0,.85)'); g.addColorStop(1, 'rgba(60,0,0,0)');
    bctx.fillStyle = g; bctx.beginPath(); bctx.arc(x, y, r, 0, 7); bctx.fill();
    for (let k = 0; k < 7; k++) {                                   // flecks thrown outward
      const a = Math.random() * 6.3, d = r * (1 + Math.random() * 1.8), rr = 1 + Math.random() * 5;
      bctx.fillStyle = 'rgba(110,4,4,.9)'; bctx.beginPath(); bctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, 7); bctx.fill();
    }
    if (Math.random() < 0.6) drips.push({ x, y, w: 2 + Math.random() * 5, v: 25 + Math.random() * 70, life: 1.6 + Math.random() * 1.5 });
  }
}
function bloodDrips(dt) {
  for (const d of drips) {
    if (d.life <= 0) continue;
    d.life -= dt;
    const ny = d.y + d.v * dt;
    bctx.strokeStyle = 'rgba(100,3,3,.9)'; bctx.lineWidth = d.w; bctx.lineCap = 'round';
    bctx.beginPath(); bctx.moveTo(d.x, d.y); bctx.lineTo(d.x, ny); bctx.stroke();
    d.y = ny;
  }
}
const fearEl = $('fear'), fearFill = $('fearFill'), fearV = $('fearV');
let beatT = 0;

loadingEl?.remove();

// ---- loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let lastYaw = player.yaw, lastPitch = player.pitch, lastShown = -1;
const lerpColor = (out, a, b, k) => out.copy(a).lerp(b, k);
function frame() {
  const dt = paused ? (clock.getDelta(), 0) : Math.min(clock.getDelta(), 0.05) * (window.__slow ?? 1);
  const t = clock.elapsedTime;
  pauseBtn.hidden = paused || !canPause();
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
  if (uiOpen || wake.active || driving || title.active) { fx = 0; fz = 0; }
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
    if (hide.dir < 0 && hide.amt <= 0) { hide.spot = null; hide.dir = 0; player.hidden = false; vignette.classList.remove('closet'); }
  }
  if (mag > 0.01 && !hide.spot) {
    const n = Math.hypot(fx, fz);
    fx /= n; fz /= n;
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    // forward vector is (-sin, -cos); right is (cos, -sin)
    const vx = (-sin * -fx + cos * fz) * WALK * (settings.pspeed / 100) * mag * dt;
    const vz = (-cos * -fx - sin * fz) * WALK * (settings.pspeed / 100) * mag * dt;
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
  let eye = hide.spot ? EYE + (hide.spot.eye - EYE) * hideE : EYE;
  let pitchAdd = 0, rollAdd = 0;

  // waking up: lying on the floor looking at the ceiling, then sitting up and standing
  if (wake.active) {
    wake.t += dt;
    if (wake.t > 1.6) wake.skippable = true;
    const rise = smooth(5.2, 7.9, wake.t);
    eye = 0.2 + (EYE - 0.2) * rise;
    pitchAdd = (1 - rise) * 1.0 + Math.sin(wake.t * 1.1) * 0.05 * (1 - rise);
    rollAdd = (1 - rise) * 0.3 + Math.sin(wake.t * 1.7) * 0.04 * (1 - rise);
    const o = eyeOpen(wake.t);
    lidT.style.height = lidB.style.height = (50 * (1 - o)) + '%';
    renderer.domElement.style.filter = `blur(${(12 * (1 - smooth(1.0, 6.6, wake.t)) + (1 - o) * 4).toFixed(1)}px)`;
    vignette.style.opacity = (0.8 * (1 - smooth(4.0, 8.0, wake.t))).toFixed(3);
    if (wake.t >= wake.dur) endWake();
  }

  // the title screen: looking at the Hillbilly across the room; pressing Play tips the view down to the floor
  if (title.active) {
    const goal = title.phase === 'down' || title.phase === 'mods' ? 1 : 0;
    title.k += Math.sign(goal - title.k) * Math.min(Math.abs(goal - title.k), dt / 1.4);
    const e = smooth(0, 1, title.k);
    pitchAdd = -1.45 * e + Math.sin(t * 0.35) * 0.012 * (1 - e);
    rollAdd = 0.35 * e + Math.sin(t * 0.5) * 0.008;
    eye = EYE - 1.0 * e;
    if (title.phase === 'down' && title.k >= 1) { title.phase = 'mods'; $('mods').hidden = false; }
    if (title.phase === 'up' && title.k <= 0) { title.phase = 'idle'; $('menuMain').hidden = false; }
  }

  // the endings
  let fov = 72;
  if (driving) {
    const f = driving;
    f.t += dt;
    const k = f.t;
    if (f.kind === 'fall') {
      // the boards give way: you drop through the floors, tumbling, and hit the bottom
      const g = 16, T = Math.sqrt(2 * f.H / g), y = Math.min(f.H, 0.5 * g * k * k);
      eye = EYE - y;
      pitchAdd = -0.5 * smooth(0, T, k);
      rollAdd = Math.sin(k * 6) * 0.3 * smooth(0, 0.5, k);
      fov = 72 + 26 * smooth(0, T, k);
      if (!f.hit && k >= T) { f.hit = true; audio.entity('hit', 1); bloodHit(0); }
      fadeEl.style.opacity = String(smooth(T + 0.05, T + 0.8, k));
      if (k > T + 1.8) { driving = null; endDay(); }
    } else if (f.kind === 'caught') {
      // he raises the chainsaw and brings it down on you twice; blood runs down the screen
      const tx = hill.x - player.pos.x, tz = hill.z - player.pos.z;
      const hits = [0.62, 2.15];
      player.yaw += angleDiff(Math.atan2(-tx, -tz), player.yaw) * Math.min(1, dt * 9);
      player.pitch += (0.3 - player.pitch) * Math.min(1, dt * 6);
      f.hit = f.hit ?? 0;
      if (f.hit < 2 && k >= hits[f.hit]) { bloodHit(f.hit++); }
      if (!f.swung1 && k > 0.3) { f.swung1 = true; audio.entity('swing', 1); }
      if (!f.swung2 && k > 1.85) { f.swung2 = true; audio.entity('swing', 1); }
      let jolt = 0;
      hits.forEach((h, n) => { if (k > h) jolt += Math.exp(-(k - h) * 7) * (n ? 1.3 : 1); });
      pitchAdd = -0.3 * jolt + Math.sin(t * 40) * 0.006 * jolt;
      rollAdd = (0.35 * jolt) + 1.35 * smooth(2.3, 3.2, k);
      eye = EYE + (0.25 - EYE) * smooth(2.3, 3.2, k);              // you go down
      fov = 82;
      glowEl.style.background = 'radial-gradient(ellipse at center, rgba(150,0,0,0), rgba(150,0,0,.8))';
      glowEl.style.opacity = String(Math.min(1, 0.9 * smooth(0.7, 1.0, k)) * (1 - smooth(2.9, 3.4, k)));
      fadeEl.style.opacity = String(smooth(2.9, 3.6, k));
      if (k > 3.8) { driving = null; endDay(); }
    } else if (f.kind === 'car') {
      // slide into the driver's seat, then the truck pulls out through the barn door
      const seat = { x: 22.9, z: 13.6 };
      const settle = smooth(0, 0.9, k), go = Math.max(0, k - 0.9);
      player.pos.x = f.from.x + (seat.x - f.from.x) * settle;
      player.pos.z = f.from.z + (seat.z - f.from.z) * settle + 0.5 * 2.6 * go * go;
      player.yaw += angleDiff(Math.PI, player.yaw) * Math.min(1, dt * 4);
      player.pitch += (0 - player.pitch) * Math.min(1, dt * 4);
      eye = EYE + (1.4 - EYE) * settle;
      const shake = settle * (1 + smooth(0.9, 2.8, k));
      pitchAdd = (Math.sin(t * 38) * 0.004 + Math.sin(t * 17) * 0.003) * shake;
      rollAdd = Math.sin(t * 9) * 0.004 * shake;
      fov = 72 + 28 * smooth(1.0, 3.2, k);
      glowEl.style.opacity = String(0.9 * smooth(2.2, 3.6, k));
      fadeEl.style.opacity = String(smooth(3.1, 4.0, k));
      if (k > 4.4) { driving = null; showWin('You drove away', 'got out', 'car'); }
    } else {
      // walk out of the door: forward, toward the light (front) or up out of the hatch into the field (hatch)
      const out = f.exit.out, hatch = f.kind === 'hatch';
      const heading = Math.atan2(-out[0], -out[1]);
      player.yaw += angleDiff(heading, player.yaw) * Math.min(1, dt * 3);
      player.pitch += ((hatch ? 0.9 * smooth(1.4, 3.8, k) : 0.04) - player.pitch) * Math.min(1, dt * 2.5);
      const speed = hatch ? 1.0 * (1 - smooth(1.0, 1.9, k)) : 0.6 + 1.0 * smooth(0, 2.6, k);
      player.pos.x += out[0] * speed * dt; player.pos.z += out[1] * speed * dt;
      if (hatch) eye = EYE + 1.5 * smooth(1.2, 4.2, k);                  // climbing up out of the hatch
      pitchAdd = Math.sin(k * 5.5) * 0.006 * (hatch ? 0.5 : 1);        // steps
      rollAdd = Math.sin(k * 2.75) * 0.01 * (hatch ? 0.3 : 1);
      fov = 72 + (hatch ? 6 : 14) * smooth(0.3, 3.4, k);
      glowEl.style.opacity = String((hatch ? 0.8 : 1) * smooth(hatch ? 1.2 : 0.4, hatch ? 3.8 : 3.4, k));
      fadeEl.style.opacity = String(smooth(hatch ? 3.9 : 3.6, hatch ? 4.8 : 4.5, k));
      if (k > (hatch ? 5.2 : 5.0)) { driving = null; showWin(hatch ? 'You crawled out' : 'You walked out into the sunshine', hatch ? 'crawled out' : 'got out', f.kind); }
    }
    if (driving && driving.kind !== 'caught' && driving.kind !== 'fall') drawFx(driving);
    if (driving && (driving.kind === 'caught' || driving.kind === 'fall')) bloodDrips(dt);
  }
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  vignette.style.opacity = wake.active ? vignette.style.opacity : (hideE * 0.95).toFixed(3);
  camera.position.set(player.pos.x, player.y + eye + bob, player.pos.z);
  camera.rotation.set(player.pitch + pitchAdd, player.yaw, rollAdd, 'YXZ');

  // daylight upstairs, black in the cellar
  const day01 = smooth(-3.0, -0.9, camera.position.y);
  hemi.intensity = (0.3 + 2.6 * day01) * (settings.dark ? 0.55 : 1);
  scene.fog.density = 0.06 - 0.034 * day01;
  lerpColor(scene.fog.color, cellarFog, fogColor, day01);
  scene.background.copy(scene.fog.color);
  dust.visible = day01 > 0.5;
  const sunNow = house.inSun(player);
  if (dust.visible) {
    // the motes stay put in the world and wrap around you, so you walk through them
    const cx = camera.position.x, cz = camera.position.z, fy = player.y;
    for (let i = 0; i < DUST; i++) {
      const o = i * 3;
      dustPos[o] += dustVel[o] * dt + Math.sin(t * 0.5 + i) * 0.0006; dustPos[o + 1] += dustVel[o + 1] * dt; dustPos[o + 2] += dustVel[o + 2] * dt;
      if (dustPos[o] - cx > 6) dustPos[o] -= 12; else if (dustPos[o] - cx < -6) dustPos[o] += 12;
      if (dustPos[o + 2] - cz > 6) dustPos[o + 2] -= 12; else if (dustPos[o + 2] - cz < -6) dustPos[o + 2] += 12;
      if (dustPos[o + 1] > fy + 3.2) dustPos[o + 1] = fy; else if (dustPos[o + 1] < fy - 0.2) dustPos[o + 1] = fy + 3;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dust.material.opacity = 0.3 + 0.3 * (sunNow ? 1 : 0);
  }
  outdoors.update(dt, t, camera.position);

  if (gear.on) {
    gear.charge = Math.max(0, gear.charge - dt * (100 / 600) / (settings.batt / 100));    // about ten minutes of light
    if (gear.charge <= 0) { gear.on = false; showToast('The flashlight battery died.', 2600); audio.sfx('click'); renderLight(); }
    if (Math.floor(gear.charge * 4) !== lastShown) { lastShown = Math.floor(gear.charge * 4); renderLight(); }
  }
  flash.visible = gear.on;
  if (gear.on) flash.intensity = 7 * (gear.charge < 15 ? (Math.sin(t * 37) > -0.55 ? 0.35 + 0.65 * (gear.charge / 15) : 0.05) : 1);
  updateLights(t, dt);
  house.update(dt, player);
  updateTarget();
  if (hill) hill.group.visible = hillOn || title.active;
  const hidden = !!hide.spot && hide.amt > 0.8;
  const sunny = house.inSun(player);
  if (hill && (hillOn || title.active)) {
    const finale = driving && driving.kind !== 'caught';
    // the cellar and the hayloft are dark and the Hillbilly smells your fear; sunshine calms you
    const rest = gear.on || sunny ? 0 : player.level === 0 ? 30 : player.level === 3 ? 16 : 6;
    hill.update(dt, t, {
      player, rest, calm: sunny, hidden,
      frozen: wake.active || !startEl.hidden || finale || title.active, dead: driving?.kind === 'caught',
    });
    const f = hill.fear;
    fearEl.hidden = wake.active || !startEl.hidden || !!driving || !settings.fear || !hillOn;
    fearFill.style.width = f.toFixed(0) + '%';
    beatT -= dt;
    if (f > 18 && !driving && startEl.hidden && !wake.active) {
      if (beatT <= 0) { beatT = 1.25 - f * 0.0085; audio.entity('beat', 0.25 + f * 0.007); fearV.dataset.pulse = t; }
      const since = t - (+fearV.dataset.pulse || 0);
      fearV.style.opacity = (Math.min(0.8, f / 100 * 0.9) * (0.55 + 0.45 * Math.exp(-since * 5))).toFixed(3);
    } else fearV.style.opacity = '0';
    // the chainsaw: you hear him before you see him
    const info = hill.soundInfo(player, player.yaw);
    audio.chainsaw({ vol: title.active ? 0.35 : wake.active ? info.vol * 0.4 : info.vol, pan: info.pan, rpm: hill.state === 'stun' ? 0 : hill.rpm, muffle: info.muffle });
    audio.music(dt, f, settings.music && startEl.hidden && !wake.active);
  } else {
    audio.chainsaw({ vol: 0, pan: 0, rpm: 0, muffle: 0 });
    audio.music(dt, 0, settings.music && startEl.hidden && !wake.active && !!hill === false);
  }
  audio.ambience(day01, settings.music);

  const yawRate = (player.yaw - lastYaw) / Math.max(dt, 1e-3), pitchRate = (player.pitch - lastPitch) / Math.max(dt, 1e-3);
  lastYaw = player.yaw; lastPitch = player.pitch;
  heldView.update(t, dt, { walk: hide.spot || wake.active ? 0 : mag, bobAccel: -64 * bob, yawRate, pitchRate });

  renderer.render(scene, camera);
  if (heldView.visible && !wake.active) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(heldView.scene, heldView.camera);
    renderer.autoClear = true;
  }
  requestAnimationFrame(frame);
}
frame();

window.__game = { player, house, camera, THREE, scene, hill, assets }; // for debugging
window.__held = heldView;
Object.defineProperty(window, '__inv', { get: () => ({ hand: selected, ammo }) });
window.__ammo = () => ammo;
window.__seed = seed;
Object.defineProperty(window, '__finale', { get: () => driving });
window.__wake = wake;
window.__ready = true;
