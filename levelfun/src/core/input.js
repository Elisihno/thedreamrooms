import { CFG } from '../config.js';

// Unified input state for keyboard/mouse and the touch layer.
export class Input {
  constructor(settings) {
    this.settings = settings;
    this.enabled = false;
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.touchLeanL = false;
    this.touchLeanR = false;
    this.crouch = false;
    this.lookX = 0;
    this.lookY = 0;
    this.listeners = {};
    this.canvas = null;

    addEventListener('keydown', e => this.onKey(e, true));
    addEventListener('keyup', e => this.onKey(e, false));
    addEventListener('blur', () => { this.keys.clear(); if (settings.crouchMode === 'hold') this.crouch = false; });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      this.addLook(e.movementX * CFG.look.mouse * settings.sensitivity, e.movementY * CFG.look.mouse * settings.sensitivity);
    });
    addEventListener('mousedown', e => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      if (e.button === 2) this.emit('throw');
      else if (e.button === 0) this.emit('zapper');
    });
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name) { (this.listeners[name] || []).forEach(fn => fn()); }

  get leanL() { return this.touchLeanL || this.keys.has('KeyQ'); }
  get leanR() { return this.touchLeanR || this.keys.has('KeyR'); }

  get move() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.touchMove.x;
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  addLook(dx, dy) { this.lookX += dx; this.lookY += dy; }
  consumeLook() { const l = { x: this.lookX, y: this.lookY }; this.lookX = 0; this.lookY = 0; return l; }
  toggleCrouch() { this.crouch = !this.crouch; }

  onKey(e, down) {
    if (!this.enabled) return;
    if (down) {
      if (e.repeat) { if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
      this.keys.add(e.code);
      switch (e.code) {
        case 'KeyE': this.emit('interact'); break;
        case 'KeyG': this.emit('drop'); break;
        case 'KeyF': this.emit('zapper'); break;
        case 'KeyC': case 'ControlLeft': case 'ControlRight':
          if (this.settings.crouchMode === 'hold') this.crouch = true; else this.toggleCrouch();
          break;
        case 'Escape': this.emit('pause'); break;
      }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    } else {
      this.keys.delete(e.code);
      if (this.settings.crouchMode === 'hold' && ['KeyC', 'ControlLeft', 'ControlRight'].includes(e.code)) this.crouch = false;
    }
  }
}
