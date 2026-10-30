// Random light flicker: steady glow with occasional short stutters.
export class Flicker {
  constructor(light, { chance = 0.12, base = light.intensity } = {}) {
    this.light = light; this.base = base; this.chance = chance;
    this.timer = 1 + Math.random() * 5; this.glitch = 0; this.next = 0;
  }
  update(dt) {
    this.timer -= dt;
    if (this.glitch > 0) {
      this.glitch -= dt;
      this.next -= dt;
      if (this.next <= 0) { this.next = 0.03 + Math.random() * 0.06; this.cur = Math.random() < 0.4 ? 0.02 : 0.3 + Math.random(); }
      this.light.intensity = this.base * this.cur;
      if (this.glitch <= 0) this.light.intensity = this.base;
    } else if (this.timer <= 0) {
      this.timer = 2 + Math.random() * (1 / this.chance) * 4;
      this.glitch = 0.1 + Math.random() * 0.5; this.next = 0; this.cur = 1;
    }
  }
}
