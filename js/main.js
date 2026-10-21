import * as THREE from '../vendor/three.module.min.js';
import { buildHouse, levelY } from './house.js';
import { createHeld } from './held.js';
import { icons } from './icons.js';
import { createHollow, ENTITY_NAME } from './entity.js';

// Every run is different: the house layout, doors and hiding places come from a random seed.
// Page flags (after the #, joined with . or &): fast = skip the title, test = fast plus a loaded
// shotgun, s123 = use seed 123, nohollow = no creature, hollow = the creature starts close (for testing).
const hashFlags = new Set(location.hash.slice(1).split(/[&.,]/).filter(Boolean));
const seedFlag = [...hashFlags].map(f => /^s(\d+)$/.exec(f)).find(Boolean);
const seed = Number(new URLSearchParams(location.search).get('seed')) || (seedFlag ? Number(seedFlag[1]) : 0)
  || 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 999999);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0e);
scene.fog = new THREE.FogExp2(0x0a0a0e, 0.05);
const ambient = new THREE.AmbientLight(0x7a7a92, 2.1);
scene.add(ambient);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 45);
scene.add(camera);

// flashlight
const flash = new THREE.SpotLight(0xfff1d6, 7, 20, 0.52, 0.55, 1.1);
flash.position.set(0.1, -0.1, 0);
flash.target.position.set(0, 0, -5);
camera.add(flash, flash.target);
flash.visible = false; // the beam only exists once you own a flashlight and switch it on

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

// ---- title screen and waking up ----------------------------------------------------------
// The game starts on a "tap to begin" screen (browsers need a tap before they allow sound). Then
// the player wakes up on the floor: eyes open in slow blinks through blurry, tilted vision with a
// heartbeat, then sits up and stands. Open the page with #fast (or #test) to skip all that.
const fastStart = hashFlags.has('fast') || hashFlags.has('test') || new URLSearchParams(location.search).has('fast');
const wake = { active: false, t: 0, dur: 8.4, skippable: false };
const lidT = document.getElementById('lidT'), lidB = document.getElementById('lidB');
const startEl = document.getElementById('start'), fadeEl = document.getElementById('fade');
const glowEl = document.getElementById('glow'), fxEl = document.getElementById('fx'), winEl = document.getElementById('win');
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
  initAudio();
  startEl.hidden = true;
  playStart = performance.now();
  wake.active = true; wake.t = 0; wake.skippable = false;
  document.body.classList.add('waking');
  wakeSounds();
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
// ---- settings (kept in the browser) -----------------------------------------------------------------
const DEFAULTS = { sound: true, sens: 100, fear: true, speed: 100, sense: 100, grace: 25, batt: 100, days: 7, dread: true, pspeed: 100, dark: false, limp: false, quality: 'high', mode: 'medium' };
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('dread.settings') || '{}')); } catch { /* storage may be blocked */ }
const saveSettings = () => { try { localStorage.setItem('dread.settings', JSON.stringify(settings)); } catch { /* ignore */ } };
const title = { active: false, phase: 'idle', k: 0 };   // k: 0 looking at the room, 1 looking at the floor

// after being caught the next day begins: a black card, then waking up again in a new house
const dayFlag = [...hashFlags].map(f => /^day(\d+)$/.exec(f)).find(Boolean);
const LAST_DAY = Math.max(1, Math.min(7, settings.days));
const day = Math.min(LAST_DAY, dayFlag ? +dayFlag[1] : 1);
const dayEl = document.getElementById('day');
if (day > 1 && !fastStart) {
  startEl.hidden = true; lidT.hidden = lidB.hidden = false;
  dayEl.textContent = `Day ${day}`; dayEl.style.opacity = '1'; dayEl.hidden = false;
  setTimeout(() => { dayEl.style.opacity = '0'; startWake(); setTimeout(() => { dayEl.hidden = true; }, 1600); }, 2200);
} else if (fastStart) { startEl.hidden = true; lidT.hidden = lidB.hidden = true; }
else { lidT.hidden = lidB.hidden = true; document.body.classList.add('waking'); }   // the title screen
const titleMode = !fastStart && day === 1;
addEventListener('keydown', e => { if (title.active) { if ((e.code === 'Space' || e.code === 'Enter') && title.phase === 'idle' && !document.getElementById('opts').offsetParent) { e.preventDefault(); document.getElementById('btnPlay').click(); } } else skipWake(); });
renderer.domElement.addEventListener('touchstart', skipWake, { passive: true });
renderer.domElement.addEventListener('click', skipWake);

const floorLabel = document.getElementById('floor');
const vignette = document.getElementById('hide');
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
  if (wake.active || driving || title.active) return;
  dx *= settings.sens / 100; dy *= settings.sens / 100;
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
const useBtn = document.getElementById('use');
const dotEl = document.getElementById('dot');
useBtn.querySelector('img').src = globalThis.__DR_TEX?.ui_hand ?? 'assets/textures/ui_hand.png';
let target = null;
const NAMES = { key: 'key', pliers: 'cutting pliers', note: 'sticky note', apple: 'apple', knife: 'kitchen knife', shotgun: 'shotgun', shells: 'shotgun shells', battery: 'car battery', fuel: 'fuel can', paper: 'paper', flashlight: 'flashlight', vase: 'vase' };
const label = t => (t.kind === 'item' ? (t.type === 'shells' && selected === 'shotgun' ? 'Load shells' : t.type === 'note' ? 'Read note' : `Take ${NAMES[t.type]}`) : t.kind === 'roomdoor' ? (t.door.open ? 'Close' : 'Open') : t.kind === 'trash' ? 'Trash can' : t.kind === 'wire' ? 'Cut' : t.kind === 'carhood' ? 'Car hood' : t.kind === 'carfuel' ? 'Fuel tank' : t.kind === 'cardoor' ? 'Car door' : t.kind === 'board' ? 'Cutting board' : t.locked ? 'Locked' : t.kind === 'keypad' ? 'Keypad' : t.kind === 'exit' ? 'Door' : t.open ? 'Close' : 'Open');
function useTarget() {
  if (wake.active || driving) return;
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
  useBtn.dataset.label = t?.kind === 'hide' ? 'Hide' : t?.kind === 'board' ? 'Cutting board' : t?.kind?.startsWith('car') || t?.kind === 'trash' ? label(t) : t?.locked ? 'Locked' : '';
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
  if (selected !== 'shotgun' || uiOpen || escaped || hide.spot || wake.active || driving) return;
  if (ammo <= 0) { house.onSound('dry'); showToast('Click. The shotgun is empty.', 1400); return; }
  ammo--;
  house.onSound('shot');
  heldView.kick();
  house.shoot(camera, player);
  if (hollow) { hollow.addFear(10); if (hollow.tryShoot(camera, player)) showToast(`${ENTITY_NAME} is down. Run, or hide.`, 2400); }
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
  if (type !== 'vase') house.onSound('drop');   // the vase makes its own sound when it lands
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
const battEl = document.getElementById('battery'), battFill = document.getElementById('battFill');
// the battery: a rough, worn bar at the bottom left; amber when the light is on, dull when off, red when low
function renderLight() {
  battEl.hidden = !gear.flashlight || wake.active || !!driving;
  battFill.style.width = gear.charge.toFixed(1) + '%';
  battEl.classList.toggle('on', gear.on);
  battEl.classList.toggle('low', gear.charge < 20);
}
function toggleLight() {
  if (!gear.flashlight || wake.active || driving) return;
  if (!gear.on && gear.charge <= 0) { showToast('The flashlight is dead.', 1600); return; }
  gear.on = !gear.on;
  house.onSound('click');
  renderLight();
}
addEventListener('keydown', e => { if (e.code === 'KeyF' && !uiOpen) toggleLight(); });

house.onPickup = type => {
  if (type === 'flashlight') {       // worn, not held: your hand stays free
    gear.flashlight = true; gear.on = true;
    renderLight();
    showToast('Picked up the flashlight. Click or tap the screen to switch it on and off.', 3000);
    chime();
    return;
  }
  setHand(type);
  showToast(`Picked up the ${NAMES[type]}`, 1800);
  chime();
};
house.onMessage = showToast;
// Something loud happened (a window was shot out): the creature comes to look.
let lastAlert = null;
house.onAlert = a => {
  lastAlert = { ...a, at: performance.now() };
  setTimeout(() => { house.onSound('alert'); showToast('Something in the house heard that...', 3200); hollow?.investigate(a.x, a.z, a.level); }, 1600);
};
window.__alert = () => lastAlert;
Object.defineProperty(window, '__gear', { get: () => gear });
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
if (testMode) setHand('shotgun'); // only the test start begins with the shotgun in hand

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
function showWin(title, verb, kind = 'front') {
  escaped = true;
  winEl.className = kind;
  const s = Math.round((performance.now() - playStart) / 1000);
  document.getElementById('winTitle').textContent = title;
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  document.getElementById('winTime').textContent = kind === 'dead' ? `You lasted ${clock}.` : `You ${verb} in ${clock}.`;
  winEl.hidden = false;
  fadeEl.style.opacity = '0';
  glowEl.style.opacity = '0';
  fxEl.hidden = true;
  heldView.show(null);
  if (kind !== 'dead') chime();
}
// ---- the three endings ------------------------------------------------------------------------
// Each escape has its own short film: the front door walks out into warm daylight, the hatch climbs
// out into a cold starry night, and the car speeds off toward the dawn.
let driving = null;   // the ending that is playing, if any
const GLOW = {
  front: 'radial-gradient(ellipse at 50% 45%, rgba(255,246,220,1) 0%, rgba(255,226,170,.85) 38%, rgba(255,200,120,0) 78%)',
  hatch: 'radial-gradient(ellipse at 50% 15%, rgba(170,195,255,.95) 0%, rgba(70,100,180,.55) 42%, rgba(10,20,60,0) 82%)',
  car: 'linear-gradient(to top, rgba(255,140,70,.95), rgba(255,205,140,.65) 55%, rgba(255,240,200,0))',
};
const FADE = { front: '#fff7e6', hatch: '#04070e', car: '#ffcf9a' };
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
  finaleSounds(kind);
}
house.onEscape = exit => startFinale(exit.id === 'hatch' ? 'hatch' : 'front', exit);
house.onDrive = () => startFinale('car');   // the engine sound is started by the house

// the overlay canvas: light rays at the front door, stars at the hatch, speed streaks in the car
function resizeFx() { fxEl.width = innerWidth; fxEl.height = innerHeight; }
addEventListener('resize', resizeFx);
const fxRand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
const stars = Array.from({ length: 140 }, () => ({ x: fxRand(), y: fxRand() * 0.7, r: 0.5 + fxRand() * 1.4, ph: fxRand() * 6 }));
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
  } else if (f.kind === 'hatch') {   // a moon and twinkling stars
    const a = smooth(1.6, 3.4, k);
    for (const s of stars) {
      g.fillStyle = `rgba(235,242,255,${a * (0.5 + 0.5 * Math.sin(k * 2 + s.ph))})`;
      g.beginPath(); g.arc(s.x * W, s.y * H, s.r, 0, 7); g.fill();
    }
    g.fillStyle = `rgba(245,248,255,${0.9 * a})`; g.beginPath(); g.arc(W * 0.7, H * 0.2, Math.min(W, H) * 0.06, 0, 7); g.fill();
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

// sounds for the three endings
function finaleSounds(kind) {
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const noise = (len) => {
      const buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = audio.createBufferSource(); src.buffer = buf; return src;
    };
    const tone = (type, f, t0, dur, vol, f2) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(f, now + t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t0 + dur);
      g.gain.setValueAtTime(0.0001, now + t0); g.gain.linearRampToValueAtTime(vol, now + t0 + Math.min(0.2, dur / 3));
      g.gain.setValueAtTime(vol, now + t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      o.connect(g).connect(audio.destination); o.start(now + t0); o.stop(now + t0 + dur + 0.05);
    };
    if (kind === 'front') {         // a warm chord swelling in, and birds
      [220, 277.2, 329.6, 440].forEach((f, i) => tone('sine', f, 0.2 + i * 0.25, 4.2, 0.07));
      for (let i = 0; i < 9; i++) { const t0 = 1.0 + i * 0.32 + Math.random() * 0.2, f = 3000 + Math.random() * 1600; tone('sine', f, t0, 0.09, 0.05, f * (1.3 + Math.random() * 0.4)); tone('sine', f * 1.2, t0 + 0.11, 0.08, 0.04, f * 0.9); }
    } else if (kind === 'hatch') {  // wind, and crickets
      const w = noise(5), bp = audio.createBiquadFilter(), g = audio.createGain();
      bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(300, now); bp.frequency.linearRampToValueAtTime(900, now + 3);
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.35, now + 2.5); g.gain.linearRampToValueAtTime(0.0001, now + 5);
      w.connect(bp).connect(g).connect(audio.destination); w.start(now);
      for (let i = 0; i < 28; i++) tone('sine', 4300, 1.6 + i * 0.12, 0.05, 0.022);
    } else {                        // the horn, a moment after the engine catches
      tone('square', 392, 2.5, 0.45, 0.12); tone('square', 494, 2.5, 0.45, 0.12);
    }
  } catch { /* audio is optional */ }
}
document.getElementById('again').addEventListener('click', () => { location.hash = '#fast'; location.reload(); });
renderInventory();

useBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); useTarget(); }, { passive: false });
useBtn.addEventListener('click', useTarget);

// ---- sound ----------------------------------------------------------------
// Browsers only allow audio after a touch or key press, so the context is made then.
let audio = null;
function initAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  if (audio && !settings.sound) audio.suspend?.();
}
addEventListener('touchstart', initAudio, { passive: true });
addEventListener('keydown', initAudio);
addEventListener('click', initAudio);

house.onThud = () => {
  hollow?.addFear(14);
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
    } else if (name === 'glass') {     // a crash, then tinkling
      const a = noise(0.5, 0.09), hp = audio.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2200;
      out.gain.value = 0.9;
      a.connect(hp).connect(out); a.start(now);
      for (let i = 0; i < 12; i++) {
        const o = audio.createOscillator(), g = audio.createGain(), t0 = 0.08 + i * 0.07 + Math.random() * 0.05;
        o.type = 'sine'; o.frequency.value = 2500 + Math.random() * 3000;
        g.gain.setValueAtTime(0.0001, now + t0); g.gain.linearRampToValueAtTime(0.06, now + t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + 0.08);
        o.connect(g).connect(audio.destination); o.start(now + t0); o.stop(now + t0 + 0.1);
      }
    } else if (name === 'pop') {        // a metallic rattle and a hollow pop
      for (let i = 0; i < 5; i++) {
        const o = audio.createOscillator(), g = audio.createGain(), t0 = i * 0.07;
        o.type = 'triangle'; o.frequency.value = 520 + Math.random() * 400;
        g.gain.setValueAtTime(0.0001, now + t0); g.gain.linearRampToValueAtTime(0.16, now + t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + 0.07);
        o.connect(g).connect(audio.destination); o.start(now + t0); o.stop(now + t0 + 0.08);
      }
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.setValueAtTime(260, now + 0.35); o.frequency.exponentialRampToValueAtTime(90, now + 0.5);
      g.gain.setValueAtTime(0.3, now + 0.35); g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      o.connect(g).connect(audio.destination); o.start(now + 0.35); o.stop(now + 0.56);
    } else if (name === 'click') {      // a switch
      const a = noise(0.04, 0.006), hp = audio.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1500;
      out.gain.value = 0.6;
      a.connect(hp).connect(out); a.start(now);
    } else if (name === 'alert') {      // something far away, low and long
      const o = audio.createOscillator(), g = audio.createGain(), lp = audio.createBiquadFilter(), lfo = audio.createOscillator(), lg = audio.createGain();
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 160;
      o.frequency.setValueAtTime(52, now); o.frequency.linearRampToValueAtTime(34, now + 3);
      lfo.frequency.value = 5.5; lg.gain.value = 0.05; lfo.connect(lg).connect(g.gain);
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.26, now + 0.8); g.gain.linearRampToValueAtTime(0.0001, now + 3.2);
      o.connect(lp).connect(g).connect(audio.destination); o.start(now); lfo.start(now); o.stop(now + 3.3); lfo.stop(now + 3.3);
    } else if (name === 'doorOpen') {  // a short wooden creak
      const o = audio.createOscillator(), g = audio.createGain(), lp = audio.createBiquadFilter();
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 600;
      o.frequency.setValueAtTime(110, now); o.frequency.linearRampToValueAtTime(190, now + 0.45);
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.1, now + 0.12); g.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      o.connect(lp).connect(g).connect(audio.destination); o.start(now); o.stop(now + 0.52);
    } else if (name === 'doorClose') { // a dull wooden thud
      const th = audio.createOscillator(), tg = audio.createGain();
      th.frequency.setValueAtTime(95, now); th.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      tg.gain.setValueAtTime(0.5, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      th.connect(tg).connect(audio.destination); th.start(now + 0.35); th.stop(now + 0.56);
      tg.gain.cancelScheduledValues(now); tg.gain.setValueAtTime(0.0001, now); tg.gain.setValueAtTime(0.5, now + 0.35); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    } else if (name === 'vase') {      // a ceramic clack, then a ringing
      const a = noise(0.09, 0.012), hp = audio.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1400;
      out.gain.value = 0.8;
      a.connect(hp).connect(out); a.start(now);
      for (const [f, d] of [[1180, 0.9], [1760, 0.6], [2410, 0.4]]) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.09 * d, now + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
        o.connect(g).connect(audio.destination); o.start(now); o.stop(now + d + 0.05);
      }
      const th = audio.createOscillator(), tg = audio.createGain();
      th.frequency.setValueAtTime(110, now); th.frequency.exponentialRampToValueAtTime(55, now + 0.12);
      tg.gain.setValueAtTime(0.4, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      th.connect(tg).connect(audio.destination); th.start(now); th.stop(now + 0.17);
    } else if (name === 'pour') {     // liquid glugging
      for (let i = 0; i < 4; i++) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.setValueAtTime(300 + i * 40, now + i * 0.18); o.frequency.exponentialRampToValueAtTime(140, now + i * 0.18 + 0.14);
        g.gain.setValueAtTime(0.0001, now + i * 0.18); g.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.15);
        o.connect(g).connect(audio.destination); o.start(now + i * 0.18); o.stop(now + i * 0.18 + 0.16);
      }
    } else if (name === 'engine') {   // a starter grinds, then the engine catches and settles
      const o = audio.createOscillator(), g = audio.createGain(), lp = audio.createBiquadFilter();
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 420;
      o.frequency.setValueAtTime(34, now); o.frequency.linearRampToValueAtTime(40, now + 0.9);
      o.frequency.linearRampToValueAtTime(95, now + 1.3); o.frequency.exponentialRampToValueAtTime(55, now + 2.4);
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.18, now + 0.2);
      g.gain.setValueAtTime(0.18, now + 0.9); g.gain.linearRampToValueAtTime(0.32, now + 1.3); g.gain.linearRampToValueAtTime(0.2, now + 3.0);
      g.gain.linearRampToValueAtTime(0.0001, now + 4);
      o.connect(lp).connect(g).connect(audio.destination); o.start(now); o.stop(now + 4);
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

// A heartbeat and a high ringing in the ears while waking up.
function wakeSounds() {
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const ring = audio.createOscillator(), rg = audio.createGain();
    ring.frequency.value = 2900;
    rg.gain.setValueAtTime(0.0001, now); rg.gain.linearRampToValueAtTime(0.03, now + 0.6); rg.gain.exponentialRampToValueAtTime(0.0001, now + 6.5);
    ring.connect(rg).connect(audio.destination); ring.start(now); ring.stop(now + 6.6);
    let at = 0.5, gap = 1.0;
    while (at < 8.0) {
      for (const [d, amp] of [[0, 0.5], [0.22, 0.34]]) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.setValueAtTime(70, now + at + d); o.frequency.exponentialRampToValueAtTime(38, now + at + d + 0.16);
        g.gain.setValueAtTime(0.0001, now + at + d); g.gain.linearRampToValueAtTime(amp, now + at + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + at + d + 0.2);
        o.connect(g).connect(audio.destination); o.start(now + at + d); o.stop(now + at + d + 0.22);
      }
      at += gap; gap = Math.max(0.62, gap - 0.04);
    }
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
    l.intensity = 2.4 * (settings.dark ? 0.6 : 1) * room.base * (0.85 + 0.15 * Math.sin(t * (2 + room.base * 3) + room.pos.x));
  }
}

// ---- the creature -----------------------------------------------------------------------------
// ENTITY_NAME wanders the house and follows your fear (see entity.js). Fear shows as a bar and a
// heartbeat at the edges of the screen.
function entitySound(name, vol = 1) {
  if (!audio || vol <= 0) return;
  try {
    const now = audio.currentTime;
    const g = audio.createGain();
    g.connect(audio.destination);
    const osc = (type, f0, f1, dur, level, lp) => {
      const o = audio.createOscillator(), og = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(f1, now + dur);
      og.gain.setValueAtTime(0.0001, now); og.gain.linearRampToValueAtTime(level * vol, now + Math.min(0.08, dur / 3)); og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      let node = o;
      if (lp) { const f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
      node.connect(og).connect(g);
      o.start(now); o.stop(now + dur + 0.02);
    };
    if (name === 'step') osc('sine', 85, 38, 0.2, 0.55);
    else if (name === 'beat') { osc('sine', 62, 38, 0.16, 0.9); setTimeout(() => { if (audio) entitySound('beat2', vol * 0.7); }, 190); }
    else if (name === 'beat2') osc('sine', 56, 36, 0.16, 0.8);
    else if (name === 'growl') { osc('sawtooth', 78, 40, 1.4, 0.3, 260); osc('sawtooth', 83, 44, 1.4, 0.22, 260); }
    else if (name === 'sting') { osc('square', 880, 860, 0.9, 0.12, 2400); osc('square', 932, 900, 0.9, 0.12, 2400); osc('sawtooth', 120, 60, 0.9, 0.3, 400); }
    else if (name === 'hurt') osc('sawtooth', 420, 70, 0.7, 0.3, 900);
    else if (name === 'swing') {                       // air torn by the bat
      const len = 0.35, buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
      const src = audio.createBufferSource(), bp = audio.createBiquadFilter();
      src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(400, now); bp.frequency.exponentialRampToValueAtTime(2400, now + len);
      g.gain.value = 0.7; src.connect(bp).connect(g); src.start(now);
    } else if (name === 'hit') {                       // a dull crack and a body blow
      osc('sine', 120, 30, 0.35, 1.0);
      const len = 0.25, buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.04));
      const src = audio.createBufferSource(), lp = audio.createBiquadFilter();
      src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.value = 0.9; src.connect(lp).connect(g); src.start(now);
    } else if (name === 'catch') { osc('sawtooth', 200, 40, 1.2, 0.6, 800); osc('square', 1400, 300, 0.5, 0.25); }
  } catch { /* audio is optional */ }
}
const hollow = hashFlags.has('nohollow') ? null : createHollow(house, hashFlags.has('hollow') ? { near: 6, grace: 2 } : {});
if (hollow) {
  scene.add(hollow.group);
  hollow.spawn(player);
  hollow.onSound = entitySound;
  hollow.onCaught = () => {
    if (driving) return;
    driving = { kind: 'caught', t: 0 };
    entitySound('catch', 1);
    setHand(null);
  };
}
let hollowOn = !!hollow && settings.dread;
function applyHollowSettings() {
  if (!hollow) return;
  hollow.speedMul = settings.speed / 100 * (settings.limp ? 0.8 : 1);
  hollow.limp = !!settings.limp;
  hollow.senseMul = settings.sense / 100;
  if (!hashFlags.has('hollow')) hollow.setGrace(settings.grace);
}
applyHollowSettings();
window.__hollow = hollow;

// ---- the menu --------------------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const FIELDS = [['oSens', 'sens', v => v + '%']];
const CHECKS = [['oSound', 'sound'], ['oFear', 'fear'], ['sSound', 'sound'], ['sFear', 'fear'], ['sDark', 'dark'], ['sLimp', 'limp']];
function refreshMenu() {
  for (const [id, key, fmt] of FIELDS) { $(id).value = settings[key]; $(id + 'V').textContent = fmt(settings[key]); }
  for (const [id, key] of CHECKS) $(id).checked = !!settings[key];
}
for (const [id, key, fmt] of FIELDS) $(id).addEventListener('input', () => { settings[key] = +$(id).value; $(id + 'V').textContent = fmt(settings[key]); saveSettings(); });
for (const [id, key] of CHECKS) $(id).addEventListener('change', () => {
  settings[key] = $(id).checked; saveSettings();
  if (key === 'sound' && audio) (settings.sound ? audio.resume() : audio.suspend()).catch?.(() => {});
});
// the modes, Granny-style: you pick one on the floor and the game begins
const MODES = {   // speed: Dread's, pspeed: yours, both as a percentage of the normal walking pace
  easy:     { pspeed: 75,  speed: 65,  sense: 60,  grace: 50, batt: 200, days: 3, dread: true },
  medium:   { pspeed: 100, speed: 95,  sense: 100, grace: 25, batt: 100, days: 7, dread: true },
  hard:     { pspeed: 115, speed: 115, sense: 140, grace: 10, batt: 70,  days: 7, dread: true },
  extreme:  { pspeed: 120, speed: 135, sense: 200, grace: 0,  batt: 50,  days: 7, dread: true },
  practice: { pspeed: 85,  speed: 100, sense: 100, grace: 25, batt: 100, days: 1, dread: false },   // no Dread, nothing to fear
};
refreshMenu();
applyLook();
$('btnOptions').addEventListener('click', () => { $('opts').hidden = false; $('menuMain').hidden = true; });
$('optBack').addEventListener('click', () => { $('opts').hidden = true; $('menuMain').hidden = false; });
$('btnPlay').addEventListener('click', () => { initAudio(); refreshSetup(); title.phase = 'down'; $('menuMain').hidden = true; $('gameTitle').classList.add('gone'); });
$('modBack').addEventListener('click', () => { title.phase = 'up'; $('mods').hidden = true; $('gameTitle').classList.remove('gone'); });
function beginGame(mode) {
  initAudio();
  Object.assign(settings, MODES[mode]); settings.mode = mode; saveSettings();
  $('mods').hidden = true;
  title.active = false;
  hollowOn = !!hollow && settings.dread;
  if (hollow) { applyHollowSettings(); hollow.group.visible = hollowOn; hollow.state = 'roam'; hollow.fear = 0; hollow.spawn(player); }
  if (titleLight) { titleLight.removeFromParent(); }
  player.pitch = 0;
  lidT.hidden = lidB.hidden = false;
  startWake();
}
$('btnContinue').addEventListener('click', () => beginGame(modeSel.value));
const DESC = {
  easy: ['Easy', ['Dread Is Faster Than You']],
  medium: ['Medium', ['Dread Is Faster Than You']],
  hard: ['Hard', ['Dread Is Faster Than You']],
  extreme: ['Extreme', ['Dread Is Faster Than You']],
  practice: ['Practice', ['No Dread. Look around and find the ways out.']],
};
// our own drop-down chooser (the phone's system one looks out of place)
function chooser(id, options, onPick) {
  const root = $(id);
  root.className = 'dd';
  root.innerHTML = '<button type="button" class="dd-btn"></button><ul class="dd-list" hidden></ul>';
  const btn = root.firstChild, list = root.lastChild;
  let value = options[0][0];
  const items = options.map(([v, label]) => {
    const li = document.createElement('li');
    li.textContent = label;
    li.addEventListener('click', e => { e.stopPropagation(); set(v); list.hidden = true; onPick(v); });
    list.append(li);
    return [v, li, label];
  });
  function set(v) {
    value = v;
    for (const [val, li, label] of items) { li.classList.toggle('on', val === v); if (val === v) btn.textContent = label; }
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
  ambient.intensity = settings.dark ? 1.0 : 2.1;
  const q = { low: 0.6, medium: 0.85, high: Math.min(devicePixelRatio, 2) }[settings.quality] ?? 1;
  renderer.setPixelRatio(q); renderer.setSize(innerWidth, innerHeight);
}

for (const id of ['sDark', 'sLimp']) $(id).addEventListener('change', () => { applyLook(); applyHollowSettings(); });
function refreshSetup() { modeSel.value = settings.mode in MODES ? settings.mode : 'medium'; qualSel.value = settings.quality; showDesc(); }
let titleLight = null;
if (titleMode) {
  title.active = true;
  const yaw = hollow ? hollow.placeForTitle(player) : null;
  player.yaw = (yaw ?? 0) + (innerWidth > innerHeight ? 0.28 : 0.1);       // she stands off to the right of the screen
  player.pitch = 0.14;
  if (hollow) {
    titleLight = new THREE.PointLight(0x7f95ff, 7, 9);
    titleLight.position.set(hollow.x + Math.sin(hollow.yaw + Math.PI) * 1.4, hollow.y + 2.3, hollow.z + Math.cos(hollow.yaw + Math.PI) * 1.4);
    scene.add(titleLight);
  }
}
// blood on the screen: splatters from each blow, with drips that run down
const bloodEl = document.getElementById('blood'), bctx = bloodEl.getContext('2d');
let drips = [];
function bloodHit(n) {
  if (bloodEl.width !== innerWidth || bloodEl.height !== innerHeight) { bloodEl.width = innerWidth; bloodEl.height = innerHeight; }
  const W = bloodEl.width, H = bloodEl.height;
  entitySound('hit', 1);
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
const fearEl = document.getElementById('fear'), fearFill = document.getElementById('fearFill'), fearV = document.getElementById('fearV');
let beatT = 0;

// ---- loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let lastYaw = player.yaw, lastPitch = player.pitch, lastShown = -1;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05) * (window.__slow ?? 1);
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
    if (hide.dir < 0 && hide.amt <= 0) { hide.spot = null; hide.dir = 0; player.hidden = false; }
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

  // the title screen: looking at Dread across the room; pressing Play tips the view down to the floor
  if (title.active) {
    const goal = title.phase === 'down' || title.phase === 'mods' ? 1 : 0;
    title.k += Math.sign(goal - title.k) * Math.min(Math.abs(goal - title.k), dt / 1.4);
    const e = smooth(0, 1, title.k);
    pitchAdd = -1.45 * e + Math.sin(t * 0.35) * 0.012 * (1 - e);
    rollAdd = 0.35 * e + Math.sin(t * 0.5) * 0.008;
    eye = EYE - 1.0 * e;
    if (title.phase === 'down' && title.k >= 1) { title.phase = 'mods'; document.getElementById('mods').hidden = false; }
    if (title.phase === 'up' && title.k <= 0) { title.phase = 'idle'; document.getElementById('menuMain').hidden = false; }
  }

  // the endings
  let fov = 72;
  if (driving) {
    const f = driving;
    f.t += dt;
    const k = f.t;
    if (f.kind === 'caught') {
      // Dread raises her spiked bat and brings it down on you twice; blood runs down the screen
      const tx = hollow.x - player.pos.x, tz = hollow.z - player.pos.z;
      const hits = [0.74, 1.55];
      player.yaw += angleDiff(Math.atan2(-tx, -tz), player.yaw) * Math.min(1, dt * 9);
      player.pitch += (0.3 - player.pitch) * Math.min(1, dt * 6);
      f.hit = f.hit ?? 0;
      if (f.hit < 2 && k >= hits[f.hit]) { bloodHit(f.hit++); }
      if (!f.swung1 && k > 0.5) { f.swung1 = true; entitySound('swing', 1); }
      if (!f.swung2 && k > 1.32) { f.swung2 = true; entitySound('swing', 1); }
      let jolt = 0;
      hits.forEach((h, n) => { if (k > h) jolt += Math.exp(-(k - h) * 7) * (n ? 1.3 : 1); });
      pitchAdd = -0.3 * jolt + Math.sin(t * 40) * 0.006 * jolt;
      rollAdd = (0.35 * jolt) + 1.35 * smooth(1.6, 2.5, k);
      eye = EYE + (0.25 - EYE) * smooth(1.6, 2.5, k);              // you go down
      fov = 82;
      glowEl.style.background = 'radial-gradient(ellipse at center, rgba(150,0,0,0), rgba(150,0,0,.8))';
      glowEl.style.opacity = String(Math.min(1, 0.9 * smooth(0.7, 1.0, k)) * (1 - smooth(2.2, 2.7, k)));
      fadeEl.style.opacity = String(smooth(2.2, 2.9, k));
      if (k > 3.1) {
        driving = null; escaped = true;
        dayEl.style.opacity = '1'; dayEl.hidden = false;
        if (day >= settings.days) {       // the seventh day is the end
          dayEl.innerHTML = 'The End<small>Tap to start over</small>';
          setTimeout(() => { dayEl.style.pointerEvents = 'auto'; dayEl.addEventListener('pointerdown', () => { location.hash = ''; location.reload(); }); }, 3000);
        } else {
          dayEl.textContent = `Day ${day + 1}`;
          setTimeout(() => { location.hash = `#day${day + 1}`; location.reload(); }, 2800);
        }
      }
    } else if (f.kind === 'car') {
      // slide into the driver's seat, then the car pulls out through the garage door
      const seat = { x: 16.1, z: 13.4 };
      const settle = smooth(0, 0.9, k), go = Math.max(0, k - 0.9);
      player.pos.x = f.from.x + (seat.x - f.from.x) * settle;
      player.pos.z = f.from.z + (seat.z - f.from.z) * settle + 0.5 * 2.6 * go * go;
      player.yaw += angleDiff(Math.PI, player.yaw) * Math.min(1, dt * 4);
      player.pitch += (0 - player.pitch) * Math.min(1, dt * 4);
      eye = EYE + (1.15 - EYE) * settle;
      const shake = settle * (1 + smooth(0.9, 2.8, k));
      pitchAdd = (Math.sin(t * 38) * 0.004 + Math.sin(t * 17) * 0.003) * shake;
      rollAdd = Math.sin(t * 9) * 0.004 * shake;
      fov = 72 + 28 * smooth(1.0, 3.2, k);
      glowEl.style.opacity = String(0.9 * smooth(2.2, 3.6, k));
      fadeEl.style.opacity = String(smooth(3.1, 4.0, k));
      if (k > 4.4) { driving = null; showWin('You drove away', 'got out', 'car'); }
    } else {
      // walk out of the door: forward, toward the light (front) or up out of the hatch into the night (hatch)
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
      if (k > (hatch ? 5.2 : 5.0)) { driving = null; showWin(hatch ? 'You escaped' : 'You escaped', 'got out', f.kind); }
    }
    if (driving && driving.kind !== 'caught') drawFx(driving);
    if (driving && driving.kind === 'caught') bloodDrips(dt);
  }
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  vignette.style.opacity = wake.active ? vignette.style.opacity : (hideE * 0.95).toFixed(3);
  camera.position.set(player.pos.x, player.y + eye + bob, player.pos.z);
  camera.rotation.set(player.pitch + pitchAdd, player.yaw, rollAdd, 'YXZ');

  if (gear.on) {
    gear.charge = Math.max(0, gear.charge - dt * (100 / 600) / (settings.batt / 100));    // about ten minutes of light
    if (gear.charge <= 0) { gear.on = false; showToast('The flashlight battery died.', 2600); house.onSound('click'); renderLight(); }
    if (Math.floor(gear.charge * 4) !== lastShown) { lastShown = Math.floor(gear.charge * 4); renderLight(); }
  }
  flash.visible = gear.on;
  if (gear.on) flash.intensity = 7 * (gear.charge < 15 ? (Math.sin(t * 37) > -0.55 ? 0.35 + 0.65 * (gear.charge / 15) : 0.05) : 1);
  updateLights(t, dt);
  house.update(dt, player);
  updateTarget();
  if (hollow) hollow.group.visible = hollowOn || title.active;
  if (hollow && (hollowOn || title.active)) {
    const finale = driving && driving.kind !== 'caught';
    hollow.update(dt, t, {
      player, flash: gear.on, hidden: !!hide.spot && hide.amt > 0.8,
      frozen: wake.active || !startEl.hidden || finale || title.active, dead: driving?.kind === 'caught',
    });
    const f = hollow.fear;
    fearEl.hidden = wake.active || !startEl.hidden || !!driving || !settings.fear || !hollowOn;
    fearFill.style.width = f.toFixed(0) + '%';
    beatT -= dt;
    if (f > 18 && !driving && startEl.hidden && !wake.active) {
      if (beatT <= 0) { beatT = 1.25 - f * 0.0085; entitySound('beat', 0.25 + f * 0.007); fearV.dataset.pulse = t; }
      const since = t - (+fearV.dataset.pulse || 0);
      fearV.style.opacity = (Math.min(0.8, f / 100 * 0.9) * (0.55 + 0.45 * Math.exp(-since * 5))).toFixed(3);
    } else fearV.style.opacity = '0';
  }

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

window.__game = { player, house, camera, THREE }; // for debugging
window.__held = heldView;
Object.defineProperty(window, '__inv', { get: () => ({ hand: selected, ammo }) });
window.__ammo = () => ammo;
window.__seed = seed;
Object.defineProperty(window, '__finale', { get: () => driving });
window.__wake = wake;
