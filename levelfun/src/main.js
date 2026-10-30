// Bootstrap (no top-level await): shows progress text before the heavy game code loads and reports any failure on screen.
const msg = t => { const el = document.getElementById('loadmsg'); if (el) el.textContent = t; };
window.__lfBoot = true;
msg('Game script running - loading engine…');
import('./game.js').catch(e => {
  msg('Failed to start: ' + (e && (e.message || e)) + ' | ' + navigator.userAgent);
  const b = document.getElementById('primary'); if (b) b.textContent = 'Error';
  console.error(e);
});
