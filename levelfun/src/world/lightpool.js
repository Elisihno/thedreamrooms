import * as THREE from '../three.js';

// Only a few real lights exist (forward rendering cost grows with every light). Each frame the nearest
// room lights are assigned to the pool; a newly assigned light fades in so nothing pops.
export class LightPool {
  constructor(scene, defs, size = 8) {
    this.defs = defs; this.slots = []; this.count = size; this.timer = 0;
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      light.position.y = -100;
      scene.add(light);
      this.slots.push({ light, def: null, fade: 0 });
    }
  }
  setCount(n) { this.count = n; this.slots.forEach((s, i) => { s.light.visible = i < n; }); }
  setShadows(n) { this.slots.forEach((s, i) => { s.light.castShadow = i < n; if (i < n) { s.light.shadow.mapSize.set(512, 512); s.light.shadow.bias = -0.002; s.light.shadow.camera.near = 0.2; s.light.shadow.camera.far = 14; } }); }

  assign(px, py, pz) {
    const scored = [];
    for (const d of this.defs) {
      const dx = d.x - px, dy = (d.y - py) * 2.5, dz = d.z - pz, s = dx * dx + dy * dy + dz * dz;
      if (s < 28 * 28) scored.push([s, d]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    const want = scored.slice(0, this.count).map(e => e[1]);
    const free = [];
    for (const sl of this.slots) { if (sl.def && !want.includes(sl.def)) { sl.def = null; sl.fade = 0; } }
    for (const d of want) if (!this.slots.some(sl => sl.def === d)) free.push(d);
    for (const sl of this.slots) if (!sl.def && free.length && this.slots.indexOf(sl) < this.count) { sl.def = free.shift(); sl.fade = 0; }
  }

  update(dt, px, py, pz) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = 0.2; this.assign(px, py, pz); }
    for (const sl of this.slots) {
      const d = sl.def, L = sl.light;
      if (!d) { L.intensity = 0; continue; }
      sl.fade = Math.min(1, sl.fade + dt * 3);
      L.position.set(d.x, d.y, d.z); L.color.setHex(d.color); L.distance = d.distance;
      let f = 1;
      if (d.flicker) {
        const st = d._f || (d._f = { timer: 1 + Math.random() * 6, glitch: 0, next: 0, cur: 1 });
        st.timer -= dt;
        if (st.glitch > 0) {
          st.glitch -= dt; st.next -= dt;
          if (st.next <= 0) { st.next = 0.03 + Math.random() * 0.06; st.cur = Math.random() < 0.4 ? 0.02 : 0.3 + Math.random(); }
          f = st.cur;
        } else if (st.timer <= 0) { st.timer = 2 + Math.random() * (1 / d.flicker) * 4; st.glitch = 0.1 + Math.random() * 0.5; st.next = 0; st.cur = 1; }
      }
      L.intensity = d.intensity * sl.fade * f;
    }
  }
}
