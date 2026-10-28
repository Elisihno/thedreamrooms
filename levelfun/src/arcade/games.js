import { drawText, drawCentered } from './pixelfont.js';

// The three arcade minigames, drawn at 320x180 on a canvas that is scaled up with crisp pixels.
export const GAMES = {
  pop:  { title: 'POP THE BALLOONS', reward: 'SCREWDRIVER', goal: 'POP 15 BALLOONS' },
  dash: { title: 'BIRTHDAY DASH', reward: 'ELEVATOR CIRCUIT', goal: 'RUN TO THE CAKE' },
  find: { title: 'FIND THE PARTY', reward: 'EXIT CODE NOTE', goal: 'FIND THE ODD ONE OUT' },
};
const W = 320, H = 180;
const COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ff7eb6', '#ff8c1a', '#1abc9c'];
const rnd = (a, b) => a + Math.random() * (b - a);

function disc(ctx, cx, cy, r, col) {   // pixel-art disc
  ctx.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
}
function balloon(ctx, x, y, r, col) {
  ctx.fillStyle = '#ddd'; ctx.fillRect(Math.round(x), Math.round(y + r), 1, r * 2);   // string
  disc(ctx, x, y, r, col); disc(ctx, x - r / 3, y - r / 3, Math.max(1, Math.floor(r / 4)), 'rgba(255,255,255,.7)');
  ctx.fillStyle = col; ctx.fillRect(Math.round(x) - 1, Math.round(y + r), 3, 2);
}
function background(ctx, t, top = '#1b1033', bottom = '#3a1650') {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) { ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fillRect((i * 53 + Math.floor(t * 12)) % W, (i * 37 + Math.floor(t * 20)) % H, 2, 2); }   // confetti
}

// Shared shell: title screen ("START GAME"), play, win, lose. Each game supplies reset/update/draw/tap.
export function playGame(id, canvas, { onWin, onExit }) {
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const meta = GAMES[id], impl = IMPL[id]();
  let state = 'title', t = 0, last = performance.now(), raf = 0, msg = '', stopped = false;

  const point = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  function press(p) {
    if (state === 'title' || state === 'lose') { impl.reset(); state = 'play'; return; }
    if (state === 'win') { onExit(); return; }
    impl.tap(p, result => { if (result === 'win') { state = 'win'; onWin(id); } else if (result === 'lose') { state = 'lose'; msg = impl.msg || ''; } });
  }
  const down = e => { e.preventDefault(); press(point(e)); };
  const key = e => {
    if (e.code === 'Escape') { onExit(); return; }
    if (['Space', 'Enter', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); press({ x: W / 2, y: H / 2, key: true }); }
  };
  canvas.addEventListener('pointerdown', down); addEventListener('keydown', key);

  function frame(now) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    try { tick(now); } catch (e) { const m = document.getElementById('amsg'); if (m) m.textContent = 'Game error: ' + (e && e.message || e); stopped = true; }
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const am = document.getElementById('amsg'); if (am && am.textContent === 'LOADING GAME…') am.textContent = '';
    if (state === 'play') { const r = impl.update(dt); if (r === 'win') { state = 'win'; onWin(id); } else if (r === 'lose') { state = 'lose'; msg = impl.msg || ''; } }
    background(ctx, t);
    if (state === 'title') {
      impl.draw(ctx, t, true);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
      drawCentered(ctx, meta.title, W / 2, 28, 2, '#ffd23c', '#7a2a00');
      if (Math.floor(t * 2.5) % 2 === 0) drawCentered(ctx, 'START GAME', W / 2, 82, 3, '#fff', '#c0392b');
      drawCentered(ctx, meta.goal, W / 2, 128, 1, '#9fe8ff'); drawCentered(ctx, 'TAP TO PLAY', W / 2, 146, 1, '#ccc');
    } else if (state === 'play') impl.draw(ctx, t, false);
    else {
      impl.draw(ctx, t, true);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      if (state === 'win') {
        drawCentered(ctx, 'YOU WIN!', W / 2, 40, 4, '#ffd23c', '#7a2a00');
        drawCentered(ctx, 'PRIZE: ' + meta.reward, W / 2, 98, 1, '#fff'); drawCentered(ctx, 'TAP TO EXIT', W / 2, 140, 1, '#ccc');
      } else {
        drawCentered(ctx, 'GAME OVER', W / 2, 44, 3, '#ff6b6b', '#600');
        if (msg) drawCentered(ctx, msg, W / 2, 92, 1, '#fff');
        drawCentered(ctx, 'TAP TO TRY AGAIN', W / 2, 140, 1, '#ccc');
      }
    }
  }
  raf = requestAnimationFrame(frame);
  return function stop() { stopped = true; cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', down); removeEventListener('keydown', key); };
}

const IMPL = {
  // ---- Pop the Balloons: 30 seconds, pop 15 ----
  pop() {
    let balloons, pops, time, spawn, bursts;
    const o = {
      msg: '',
      reset() { balloons = []; pops = 0; time = 30; spawn = 0; bursts = []; },
      update(dt) {
        time -= dt; spawn -= dt;
        if (spawn <= 0) { spawn = rnd(0.35, 0.7); balloons.push({ x: rnd(20, W - 20), y: H + 20, r: Math.floor(rnd(11, 16)), v: rnd(28, 62), c: COLORS[Math.floor(rnd(0, COLORS.length))], w: rnd(0, 6) }); }
        balloons.forEach(b => { b.y -= b.v * dt; b.x += Math.sin(b.y / 14 + b.w) * 12 * dt; });
        balloons = balloons.filter(b => b.y > -30);
        bursts.forEach(b => b.t += dt); bursts = bursts.filter(b => b.t < 0.3);
        if (pops >= 15) return 'win';
        if (time <= 0) { o.msg = 'POPPED ' + pops + ' OF 15'; return 'lose'; }
      },
      tap(p, done) {
        for (let i = balloons.length - 1; i >= 0; i--) { const b = balloons[i]; if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 5) { balloons.splice(i, 1); pops++; bursts.push({ x: b.x, y: b.y, c: b.c, t: 0 }); if (pops >= 15) done('win'); return; } }
      },
      draw(ctx, t, idle) {
        if (idle && !balloons) { for (let i = 0; i < 8; i++) balloon(ctx, 30 + i * 36, 60 + (i % 3) * 30, 13, COLORS[i]); return; }
        (balloons || []).forEach(b => balloon(ctx, b.x, b.y, b.r, b.c));
        (bursts || []).forEach(b => { for (let k = 0; k < 8; k++) { const a = k * 0.785, d = b.t * 120; ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x + Math.cos(a) * d), Math.round(b.y + Math.sin(a) * d), 3, 3); } });
        if (!idle) { drawText(ctx, 'POPPED ' + pops + '/15', 20, 6, 1, '#fff', '#000'); drawText(ctx, 'TIME ' + Math.ceil(time), W - 54, 6, 1, time < 8 ? '#ff6b6b' : '#fff', '#000'); }
      },
    };
    return o;
  },

  // ---- Birthday Dash: jump over candles and presents until you reach the cake ----
  dash() {
    const GOAL = 2600, GY = 142;
    let px, py, vy, dist, obs, spawnAt;
    const o = {
      msg: '',
      reset() { py = 0; vy = 0; dist = 0; obs = []; spawnAt = 220; },
      update(dt) {
        const speed = 115 + dist / 40;
        dist += speed * dt; vy -= 620 * dt; py = Math.max(0, py + vy * dt); if (py === 0) vy = 0;
        obs.forEach(b => b.x -= speed * dt); obs = obs.filter(b => b.x > -30);
        if (dist >= spawnAt && dist < GOAL - 260) { const gift = Math.random() < 0.5; obs.push({ x: W + 10, w: gift ? 16 : 8, h: gift ? 16 : 22, gift, c: COLORS[Math.floor(rnd(0, 8))] }); spawnAt = dist + rnd(150, 260); }
        for (const b of obs) if (b.x < 46 + 10 && b.x + b.w > 40 && py < b.h - 3) { o.msg = 'YOU TRIPPED!'; return 'lose'; }
        if (dist >= GOAL) return 'win';
      },
      tap(p, done) { if (py === 0) vy = 235; },
      draw(ctx, t, idle) {
        ctx.fillStyle = '#2b1642'; ctx.fillRect(0, GY + 16, W, H - GY - 16);
        ctx.fillStyle = '#5a2d82'; for (let x = -((dist || 0) % 16); x < W; x += 16) ctx.fillRect(x, GY + 16, 8, 4);
        (obs || []).forEach(b => {
          ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x), GY + 16 - b.h, b.w, b.h);
          if (b.gift) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x) + 7, GY + 16 - b.h, 2, b.h); ctx.fillRect(Math.round(b.x), GY + 16 - b.h / 2, b.w, 2); }
          else { ctx.fillStyle = '#ffd23c'; ctx.fillRect(Math.round(b.x) + 3, GY + 16 - b.h - 4, 2, 4); }
        });
        const gx = (dist || 0) > GOAL - 330 ? W - ((dist - (GOAL - 330)) / 330) * 250 : W + 40;   // the cake slides in near the end
        ctx.fillStyle = '#f5d2a0'; ctx.fillRect(Math.round(gx), GY - 4, 30, 20); ctx.fillStyle = '#ff7eb6'; ctx.fillRect(Math.round(gx), GY - 4, 30, 6); ctx.fillStyle = '#ffd23c'; ctx.fillRect(Math.round(gx) + 14, GY - 12, 2, 8);
        // the kid in a party hat
        const y = GY + 16 - 16 - (py || 0), step = Math.floor((t || 0) * 10) % 2;
        ctx.fillStyle = '#3498db'; ctx.fillRect(40, y + 5, 10, 8); ctx.fillStyle = '#f5cba7'; ctx.fillRect(41, y, 8, 6);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(43, y - 5, 4, 5); ctx.fillStyle = '#222'; ctx.fillRect(42, y + 12, 3, 4 - step); ctx.fillRect(46, y + 12, 3, 3 + step);
        if (!idle) { ctx.fillStyle = '#333'; ctx.fillRect(20, 6, 100, 6); ctx.fillStyle = '#ffd23c'; ctx.fillRect(20, 6, Math.min(100, (dist / GOAL) * 100), 6); drawText(ctx, 'TAP TO JUMP', W - 80, 6, 1, '#ccc', '#000'); }
      },
    };
    return o;
  },

  // ---- Find the Party: spot the odd present, four rounds, less time each round ----
  find() {
    let round, grid, odd, time, cols, rows;
    const build = () => {
      cols = 5 + round; rows = 3; const base = COLORS[Math.floor(rnd(0, COLORS.length))];
      let alt = COLORS[Math.floor(rnd(0, COLORS.length))]; while (alt === base) alt = COLORS[Math.floor(rnd(0, COLORS.length))];
      odd = Math.floor(rnd(0, cols * rows)); time = 9 - round; grid = { base, alt, size: Math.floor(Math.min(34, (W - 20) / cols - 4)) };
    };
    const cell = i => { const s = grid.size + 4; return { x: Math.round((W - cols * s) / 2 + (i % cols) * s), y: 34 + Math.floor(i / cols) * (s + 8) }; };
    const o = {
      msg: '',
      reset() { round = 0; build(); },
      update(dt) { time -= dt; if (time <= 0) { o.msg = 'OUT OF TIME'; return 'lose'; } },
      tap(p, done) {
        for (let i = 0; i < cols * rows; i++) {
          const c = cell(i), s = grid.size;
          if (p.x >= c.x && p.x <= c.x + s && p.y >= c.y && p.y <= c.y + s + 6) {
            if (i !== odd) { o.msg = 'WRONG PRESENT'; done('lose'); return; }
            round++; if (round >= 4) { done('win'); return; } build(); return;
          }
        }
      },
      draw(ctx, t, idle) {
        if (!grid) { o.reset(); }
        for (let i = 0; i < cols * rows; i++) {
          const c = cell(i), s = grid.size, hot = i === odd, body = hot && round < 2 ? grid.alt : grid.base, ribbon = hot && round >= 2 ? grid.alt : '#fff';
          ctx.fillStyle = body; ctx.fillRect(c.x, c.y + 6, s, s - 6); ctx.fillStyle = ribbon; ctx.fillRect(c.x + s / 2 - 1, c.y + 6, 3, s - 6); ctx.fillRect(c.x, c.y + 6 + (s - 6) / 2 - 1, s, 3);
          ctx.fillStyle = hot && round === 3 ? '#fff' : ribbon; ctx.fillRect(c.x + s / 2 - 5, c.y, 4, 6); ctx.fillRect(c.x + s / 2 + 1, c.y, 4, 6);
        }
        if (!idle) { drawText(ctx, 'ROUND ' + (round + 1) + '/4', 20, 6, 1, '#fff', '#000'); drawText(ctx, 'TIME ' + Math.ceil(time), W - 54, 6, 1, time < 3 ? '#ff6b6b' : '#fff', '#000'); drawCentered(ctx, 'TAP THE ODD ONE', W / 2, 20, 1, '#9fe8ff'); }
      },
    };
    return o;
  },
};
