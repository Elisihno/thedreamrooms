import * as THREE from '../../vendor/three.module.min.js';
import { W, D, buildWorld, resolveCircle, roomAt } from './world.js';
import { createMother } from './mother.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const FAST = qs.has('fast');

const NIGHTS = 5;
const PREP = FAST ? [12, 12, 12, 12, 12] : [80, 70, 65, 60, 55];
const SIEGE = FAST ? [40, 40, 40, 40, 40] : [100, 115, 130, 145, 160];
const CARRY_MAX = 4;
const EYE = 1.6;

// ---- renderer / scene -----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x030405, 0.11);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 80);
camera.rotation.order = 'YXZ';
scene.add(camera);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

scene.add(new THREE.AmbientLight(0x4a5260, 1.2));
const torch = new THREE.SpotLight(0xfff0d0, 120, 16, 0.62, 0.5, 1.6);
torch.position.set(0.15, -0.1, 0);
torch.target.position.set(0, 0, -5);
camera.add(torch, torch.target);
const glow = new THREE.PointLight(0xffe2b0, 6, 5, 2);
camera.add(glow);

const world = buildWorld();
scene.add(world.group);
const audio = createAudio();

// ---- state ----------------------------------------------------------------
const player = { x: 3, z: 6.8, yaw: 0, pitch: 0, hidden: false, spot: null, carry: 0, stamina: 1 };
const G = { phase: 'title', night: 1, t: 0, noise: null, shake: 0, snapshot: null, dead: false };
const input = { keys: new Set(), mx: 0, my: 0, act: false, actPressed: false, run: false };

const mother = createMother(world, audio, {
  subtitle: (t) => toast(t),
  shake: (x, z) => { G.shake = Math.max(G.shake, 0.03 * Math.max(0, 1 - Math.hypot(player.x - x, player.z - z) / 12)); },
  opened: () => { G.noise = null; },
  caught: (spot) => caught(spot),
});

// ---- helpers --------------------------------------------------------------
let toastTimer = 0;
function toast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
}
const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const panTo = (x, z) => {
  const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz) || 1;
  return (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d;
};

function emitNoise(x, z, r) {
  G.noise = { x, z };
  mother.hear(x, z, r);
}

// ---- nights ---------------------------------------------------------------
function distributeSupply(n) {
  const total = 12 + 2 * n;
  const shares = [0.4, 0.2, 0.2, 0.2];
  let left = total;
  world.piles.forEach((p, i) => {
    const c = i === world.piles.length - 1 ? left : Math.round(total * shares[i]);
    left -= c;
    world.setPileCount(p, c);
  });
}

function startNight(n, retry = false) {
  G.night = n;
  G.dead = false;
  if (retry && G.snapshot) {
    world.entries.forEach((e, i) => Object.assign(e, G.snapshot[i]));
  } else {
    G.snapshot = world.entries.map(e => ({ planks: e.planks, open: e.open, paneBroken: e.paneBroken }));
  }
  world.entries.forEach(e => { e.heat = 0; e.refresh(); });
  distributeSupply(n);
  Object.assign(player, { x: 3, z: 6.8, yaw: 0, pitch: 0, hidden: false, spot: null, carry: 0, stamina: 1 });
  world.hides.forEach(h => { h.occupied = false; });
  G.phase = 'prep';
  G.t = PREP[n - 1];
  G.noise = null;
  mother.stop();
  $('over').hidden = true;
  $('flash').style.opacity = 0; $('flash').style.background = '#000';
  $('hideov').style.opacity = 0;
  toast(n === 1 ? 'Board up every door and window before she gets here.' : `Night ${n}. She remembers what you left weak.`, 4200);
}

function startSiege() {
  G.phase = 'siege';
  G.t = SIEGE[G.night - 1];
  mother.start(G.night, player.x, player.z);
  audio.pound(0, 0.5);
  toast('She is here.', 3000);
}

function dawn() {
  mother.stop();
  audio.win();
  if (player.hidden) leaveHide();
  const last = G.night >= NIGHTS;
  G.phase = last ? 'won' : 'dawn';
  showOver(
    last ? 'The sun is up' : `Dawn — night ${G.night} survived`,
    last ? 'Mother Marrow is gone. For now. You held the house.' : 'The light drives her back into the trees. Whatever she broke stays broken.',
    last ? 'Play again' : `Night ${G.night + 1}`,
    () => { if (last) { world.entries.forEach(e => { e.planks = 0; e.open = false; e.paneBroken = false; }); startNight(1); } else startNight(G.night + 1); },
  );
}

function caught(spot) {
  if (G.dead) return;
  G.dead = true;
  G.phase = 'dead';
  audio.scare();
  // turn to face her
  player.yaw = Math.atan2(-(mother.x - player.x), -(mother.z - player.z));
  if (spot) leaveHide();
  $('flash').style.transition = 'opacity .15s';
  $('flash').style.background = '#3a0000'; $('flash').style.opacity = 0.55;
  setTimeout(() => {
    $('flash').style.transition = 'opacity 1.2s';
    showOver('She found you', 'Mother Marrow does not like guests.', 'Try the night again', () => startNight(G.night, true));
  }, 900);
}

function showOver(h, p, b, fn) {
  $('overH').textContent = h; $('overP').textContent = p; $('overB').textContent = b;
  $('over').hidden = false;
  document.exitPointerLock?.();
  $('overB').onclick = () => { requestLock(); fn(); };
}

// ---- hiding ---------------------------------------------------------------
function enterHide(h) {
  player.hidden = true; player.spot = h; h.occupied = true;
  player.x = h.x; player.z = h.z;
  const sawEnter = mother.isInside() && Math.hypot(mother.x - player.x, mother.z - player.z) < 9 && mother.state === 'hunt' && mother.sub === 'chase';
  mother.tellHidden(h, sawEnter);
  $('hideov').style.opacity = 1;
  toast(`You hide in ${h.label}. Hold still.`, 2200);
}
function leaveHide() {
  if (!player.spot) return;
  player.x = player.spot.front.x; player.z = player.spot.front.z;
  player.spot.occupied = false;
  player.spot = null; player.hidden = false;
  $('hideov').style.opacity = 0;
}

// ---- input ----------------------------------------------------------------
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) { document.body.classList.add('touch'); $('howKey').remove(); } else { $('howTouch').remove(); }

function requestLock() { if (!isTouch && !document.pointerLockElement) canvas.requestPointerLock?.(); }
addEventListener('keydown', (e) => {
  input.keys.add(e.code);
  if (e.code === 'KeyE' && !e.repeat) { input.act = true; input.actPressed = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
});
addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
  if (e.code === 'KeyE') input.act = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - e.movementY * 0.0022));
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (document.pointerLockElement !== canvas) { requestLock(); return; }
  input.act = true; input.actPressed = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.act = false; });

// touch: left side = stick, right side = look
const stick = $('stick'), knob = $('knob');
let stickId = null, lookId = null, stickOrigin = null, lookLast = null;
const move = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  canvas.setPointerCapture(e.pointerId);
  if (e.clientX < innerWidth * 0.45 && stickId === null) {
    stickId = e.pointerId; stickOrigin = { x: e.clientX, y: e.clientY };
    stick.style.display = 'block';
    stick.style.left = e.clientX - 65 + 'px'; stick.style.top = e.clientY - 65 + 'px';
  } else if (lookId === null) {
    lookId = e.pointerId; lookLast = { x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === stickId) {
    const dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y;
    const d = Math.min(Math.hypot(dx, dy), 55), a = Math.atan2(dy, dx);
    move.x = Math.cos(a) * d / 55; move.y = Math.sin(a) * d / 55;
    knob.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
  } else if (e.pointerId === lookId) {
    player.yaw -= (e.clientX - lookLast.x) * 0.006;
    player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - (e.clientY - lookLast.y) * 0.006));
    lookLast = { x: e.clientX, y: e.clientY };
  }
});
const endPtr = (e) => {
  if (e.pointerId === stickId) { stickId = null; move.x = move.y = 0; stick.style.display = 'none'; knob.style.transform = ''; }
  if (e.pointerId === lookId) lookId = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);

function holdButton(el, down, up) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); down(); });
  const end = () => { el.classList.remove('on'); up(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
holdButton($('btnAct'), () => { input.act = true; input.actPressed = true; }, () => { input.act = false; });
holdButton($('btnRun'), () => { input.run = true; }, () => { input.run = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

$('play').onclick = () => {
  audio.init();
  $('title').hidden = true;
  requestLock();
  const n = Math.max(1, Math.min(NIGHTS, +qs.get('night') || 1));
  startNight(n);
};

// ---- interaction ----------------------------------------------------------
const fwd = new THREE.Vector3();
const tmp = new THREE.Vector3();
function findTarget() {
  camera.getWorldDirection(fwd);
  let best = null, bestScore = 1e9;
  const consider = (type, obj, pos, reach) => {
    tmp.subVectors(pos, camera.position);
    const dist = tmp.length();
    if (dist > reach) return;
    const dot = tmp.normalize().dot(fwd);
    if (dot < 0.8) return;
    const score = dist * (1.5 - dot);
    if (score < bestScore) { bestScore = score; best = { type, obj }; }
  };
  for (const e of world.entries) consider('entry', e, e.mid, 2.4);
  for (const p of world.piles) consider('pile', p, p.pos, 2.2);
  for (const h of world.hides) consider('hide', h, h.pos, 2.2);
  return best;
}

let nail = 0, hitT = 0, takeT = 0;
function interact(dt, target) {
  const prompt = $('prompt'), bar = $('bar');
  let text = '', showBar = false;
  if (player.hidden) {
    text = isTouch ? 'Tap USE to come out' : 'Press E to come out';
    if (input.actPressed) leaveHide();
    nail = 0;
  } else if (target) {
    const o = target.obj;
    if (target.type === 'entry') {
      if (o.planks >= o.max) { text = `${o.name} — fully boarded`; nail = 0; }
      else if (player.carry <= 0) { text = `${o.name} (${o.planks}/${o.max}) — you need planks`; nail = 0; }
      else {
        text = `Hold to nail a plank — ${o.name} (${o.planks}/${o.max})`;
        if (input.act) {
          nail += dt / 0.9; hitT -= dt; showBar = true;
          if (hitT <= 0) {
            hitT = 0.3;
            audio.hammer(0, 0.9);
            o.heat = Math.min(6, o.heat + 0.8);
            emitNoise(player.x, player.z, 11);
          }
          if (nail >= 1) {
            nail = 0; o.planks++; o.open = false; player.carry--;
            o.refresh(); audio.crack(0, 0.35);
          }
        } else nail = 0;
      }
    } else if (target.type === 'pile') {
      nail = 0;
      if (o.count <= 0) text = 'No planks left here';
      else if (player.carry >= CARRY_MAX) text = 'Your hands are full';
      else {
        text = `Hold to take planks (${o.count} here)`;
        takeT -= dt;
        if (input.act && takeT <= 0) {
          takeT = 0.3; player.carry++; world.setPileCount(o, o.count - 1); audio.pickup();
        }
      }
    } else if (target.type === 'hide') {
      nail = 0;
      text = `Hide in ${o.label}`;
      if (input.actPressed) enterHide(o);
    }
  } else nail = 0;
  prompt.textContent = text;
  bar.style.display = showBar ? 'block' : 'none';
  bar.firstElementChild.style.width = Math.min(100, nail * 100) + '%';
}

// ---- player movement ------------------------------------------------------
let stepAcc = 0;
function movePlayer(dt) {
  if (player.hidden) {
    if (Math.hypot(move.x, move.y) > 0.6 || input.keys.has('KeyW') || input.keys.has('KeyS') || input.keys.has('KeyA') || input.keys.has('KeyD')) leaveHide();
    return;
  }
  let f = -move.y, s = move.x;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) f += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) f -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) s += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) s -= 1;
  const mag = Math.hypot(f, s);
  if (mag > 1) { f /= mag; s /= mag; }
  const moving = mag > 0.05;
  const running = input.run && moving && player.stamina > 0.02;
  player.stamina = Math.max(0, Math.min(1, player.stamina + (running ? -0.28 : 0.15) * dt));
  const speed = running ? 4.5 : 3.0;
  const sx = Math.sin(player.yaw), cx = Math.cos(player.yaw);
  const pos = { x: player.x + (-sx * f + cx * s) * speed * dt, z: player.z + (-cx * f - sx * s) * speed * dt };
  resolveCircle(pos, 0.3, world.rects);
  pos.x = Math.max(0.4, Math.min(W - 0.4, pos.x));
  pos.z = Math.max(0.4, Math.min(D - 0.4, pos.z));
  player.x = pos.x; player.z = pos.z;
  if (moving) {
    stepAcc += speed * mag * dt;
    if (stepAcc > (running ? 1.6 : 2.2)) {
      stepAcc = 0;
      if (running) emitNoise(player.x, player.z, 7); else mother.hear(player.x, player.z, 3);
    }
  }
}

// ---- HUD ------------------------------------------------------------------
let hudT = 0;
function updateHud(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.2;
  $('phase').textContent = G.phase === 'prep' ? `Night ${G.night} · dusk` : G.phase === 'siege' ? `Night ${G.night} · until dawn` : '';
  $('timer').textContent = G.phase === 'prep' || G.phase === 'siege' ? fmt(G.t) : '';
  $('carry').textContent = G.phase === 'prep' || G.phase === 'siege' ? `Planks carried  ${player.carry}/${CARRY_MAX}` : '';
  $('ents').innerHTML = G.phase === 'prep' || G.phase === 'siege'
    ? world.entries.map(e => {
      const pips = '■'.repeat(e.planks) + '□'.repeat(e.max - e.planks);
      const cls = e.open ? 'open' : e.planks >= e.max ? 'full' : '';
      return `<div class="${cls}">${e.name} ${pips}${e.open ? ' OPEN' : ''}</div>`;
    }).join('')
    : '';
}

// ---- main loop ------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const playing = G.phase === 'prep' || G.phase === 'siege';

  if (playing) {
    movePlayer(dt);
    const target = findTarget();
    interact(dt, target);
    G.t -= dt;
    if (G.phase === 'prep' && G.t <= 0) startSiege();
    else if (G.phase === 'siege' && G.t <= 0) dawn();
    mother.update(dt, player, world.rects, G);
    if (G.phase === 'prep' || G.phase === 'siege') {
      // her hunting sound design: heartbeat and a red vignette as she closes in
      let fear = 0;
      if (mother.isInside()) {
        const d = Math.hypot(mother.x - player.x, mother.z - player.z);
        fear = Math.max(0, Math.min(1, 1 - (d - 2) / 10));
      }
      $('vig').style.opacity = fear * 0.9;
      audio.heart(dt, fear > 0.05 ? 0.9 + fear * 1.8 : 0);
      torch.intensity = 120 * (fear > 0.5 && Math.random() < 0.08 ? 0.15 : 1);
    }
  } else {
    $('prompt').textContent = ''; $('bar').style.display = 'none';
    audio.heart(dt, 0);
    if (G.phase === 'dead') mother.update(dt * 0.0001, player, world.rects, G);
  }
  input.actPressed = false;

  // doors swing open and shut
  for (const e of world.entries) {
    if (!e.doorPivot) continue;
    const goal = e.open ? 1.5 : 0;
    e.doorAngle += (goal - e.doorAngle) * Math.min(1, dt * 7);
    e.doorPivot.rotation.y = e.doorPivot.userData.base + e.doorAngle * (e.axis === 'x' ? -e.out : e.out);
  }

  // camera
  G.shake = Math.max(0, G.shake - dt * 0.05);
  const sh = G.shake;
  const eye = player.hidden ? 1.0 : EYE + Math.sin(performance.now() / 260) * 0.012;
  camera.position.set(player.x + (Math.random() - 0.5) * sh, eye + (Math.random() - 0.5) * sh, player.z + (Math.random() - 0.5) * sh);
  camera.rotation.set(player.pitch, player.yaw, 0);
  updateHud(dt);
  renderer.render(scene, camera);
}
frame();

window.__boarded = { G, player, world, mother, startNight, input, caught };
