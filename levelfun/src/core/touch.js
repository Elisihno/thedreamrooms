import { CFG } from '../config.js';

// Touch layer: floating joystick (left), swipe-to-look (anywhere else), action buttons.
export function initTouch(input, ui, settings) {
  const stick = ui.querySelector('#stick');
  const knob = ui.querySelector('#knob');
  const pts = new Map();
  let stickId = null, cx = 0, cy = 0, R = 60;

  const setStickVisible = on => stick.classList.toggle('active', on);

  function press(btn, down) {
    btn.classList.toggle('down', down);
    const act = btn.dataset.act;
    if (act === 'leanL') input.touchLeanL = down;
    else if (act === 'leanR') input.touchLeanR = down;
    else if (down) {
      if (act === 'crouch') input.toggleCrouch(); else input.emit(act);
    }
  }

  ui.addEventListener('pointerdown', e => {
    if (!input.enabled) return;
    e.preventDefault();
    try { ui.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointers */ }
    const btn = e.target.closest('[data-act]');
    if (btn) { pts.set(e.pointerId, { role: 'btn', btn }); press(btn, true); return; }
    if (stickId === null && e.clientX < innerWidth * 0.42) {
      stickId = e.pointerId;
      R = Math.max(50, Math.min(90, Math.min(innerWidth, innerHeight) * 0.14));
      cx = e.clientX; cy = e.clientY;
      stick.style.left = cx + 'px'; stick.style.top = cy + 'px';
      stick.style.setProperty('--r', R + 'px');
      knob.style.transform = 'translate(-50%,-50%)';
      setStickVisible(true);
      pts.set(e.pointerId, { role: 'move' });
    } else {
      pts.set(e.pointerId, { role: 'look', x: e.clientX, y: e.clientY });
    }
  });

  ui.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.role === 'move') {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(calc(-50% + ${dx * 0.22}px), calc(-50% + ${dy * 0.22}px))`;   // the ball nearly fills the ring, so it only shifts a little
      let nx = dx / R, ny = -dy / R;
      const m = Math.hypot(nx, ny);
      if (m < 0.1) { nx = 0; ny = 0; } else { const s = (m - 0.1) / 0.9 / m; nx *= s; ny *= s; }
      input.touchMove.x = nx; input.touchMove.y = ny;
    } else if (p.role === 'look') {
      const k = CFG.look.touchPerScreenHeight / innerHeight * settings.sensitivity;
      input.addLook((e.clientX - p.x) * k, (e.clientY - p.y) * k);
      p.x = e.clientX; p.y = e.clientY;
    }
  });

  function end(e) {
    const p = pts.get(e.pointerId);
    if (!p) return;
    pts.delete(e.pointerId);
    if (p.role === 'btn') press(p.btn, false);
    else if (p.role === 'move') {
      stickId = null; input.touchMove.x = 0; input.touchMove.y = 0; setStickVisible(false);
    }
  }
  ui.addEventListener('pointerup', end);
  ui.addEventListener('pointercancel', end);

  // Release everything (used when pausing).
  return function releaseAll() {
    pts.forEach(p => { if (p.btn) press(p.btn, false); });
    pts.clear(); stickId = null;
    input.touchMove.x = 0; input.touchMove.y = 0; input.touchLeanL = false; input.touchLeanR = false;
    setStickVisible(false);
  };
}
