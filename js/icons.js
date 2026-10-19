import { appleSkinCanvas } from './apple.js';

// Inventory icons, drawn on small canvases and returned as data URLs.

function make(draw, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  return cv.toDataURL('image/png');
}

function apple(g) {
  // the lopsided apple outline, filled with the painted skin
  g.save();
  g.beginPath();
  g.moveTo(62, 40);
  g.bezierCurveTo(36, 22, 8, 46, 18, 84);
  g.bezierCurveTo(26, 116, 54, 120, 64, 108);
  g.bezierCurveTo(78, 122, 104, 112, 110, 82);
  g.bezierCurveTo(118, 48, 92, 24, 62, 40);
  g.closePath();
  g.clip();
  g.drawImage(appleSkinCanvas().color, 0, 0, 256, 256, 0, 6, 128, 128);
  const shade = g.createRadialGradient(46, 62, 6, 64, 78, 62);
  shade.addColorStop(0, 'rgba(255,255,255,.12)'); shade.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = shade; g.fillRect(0, 0, 128, 128);
  g.restore();
  g.strokeStyle = '#3e2a1a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(62, 40); g.quadraticCurveTo(66, 22, 80, 14); g.stroke();
  g.fillStyle = '#5b4a22'; g.beginPath(); g.ellipse(86, 26, 14, 5, -0.5, 0, 7); g.fill();
}

function knife(g) {
  g.translate(64, 64); g.rotate(-Math.PI / 4);
  const blade = g.createLinearGradient(0, -14, 0, 14);
  blade.addColorStop(0, '#f2f4f6'); blade.addColorStop(0.5, '#aab0b6'); blade.addColorStop(1, '#6d7379');
  g.fillStyle = blade;
  g.beginPath(); g.moveTo(-6, -12); g.lineTo(52, -12); g.quadraticCurveTo(66, -2, 56, 4); g.quadraticCurveTo(20, 14, -6, 12); g.closePath(); g.fill();
  g.fillStyle = '#7b8086'; g.fillRect(-10, -13, 6, 26);
  g.fillStyle = '#3a2416';
  g.beginPath(); g.roundRect(-58, -11, 50, 22, 6); g.fill();
  g.fillStyle = '#c9b377';
  for (const x of [-48, -30, -16]) { g.beginPath(); g.arc(x, 0, 2.6, 0, 7); g.fill(); }
}

function shotgun(g) {
  g.translate(64, 64); g.rotate(-0.35);
  g.fillStyle = '#2d3237'; g.fillRect(-10, -9, 78, 7);       // barrel
  g.fillStyle = '#4b5258'; g.fillRect(-4, -1, 58, 5);        // magazine tube
  g.fillStyle = '#6a4325'; g.fillRect(14, 0, 24, 8);         // pump
  g.fillStyle = '#1c2023'; g.fillRect(-30, -11, 26, 14);     // receiver
  g.fillStyle = '#6a4325';                                   // stock
  g.beginPath(); g.moveTo(-30, -9); g.lineTo(-72, -3); g.lineTo(-76, 18); g.lineTo(-56, 14); g.lineTo(-30, 4); g.closePath(); g.fill();
  g.strokeStyle = '#1c2023'; g.lineWidth = 2; g.beginPath(); g.arc(-18, 8, 6, 0, Math.PI); g.stroke();
}

function shells(g) {
  const shell = (x, y) => {
    g.save(); g.translate(x, y); g.rotate(-0.25);
    g.fillStyle = '#c8321f'; g.fillRect(-9, -34, 18, 48);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-6, -34, 4, 48);
    g.fillStyle = '#b89a32'; g.fillRect(-9, 14, 18, 16);
    g.fillStyle = '#7e6a1e'; g.fillRect(-9, 14, 18, 3); g.beginPath(); g.arc(0, 24, 3, 0, 7); g.fill();
    g.restore();
  };
  shell(36, 64); shell(64, 62); shell(92, 66);
}

function battery(g) {
  g.fillStyle = '#2a3035'; g.fillRect(22, 48, 84, 52);
  g.fillStyle = '#3a5aa0'; g.fillRect(20, 40, 88, 14);
  g.fillStyle = '#b89a32'; g.fillRect(34, 28, 16, 14); g.fillRect(78, 28, 16, 14);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(22, 58, 84, 4);
  g.fillStyle = '#ddd'; g.font = 'bold 22px system-ui'; g.fillText('+', 30, 24); g.fillText('−', 82, 24);
}

function fuel(g) {
  g.fillStyle = '#c8321f'; g.fillRect(32, 40, 62, 66);
  g.fillStyle = '#8a1c10'; g.fillRect(32, 70, 62, 8);
  g.fillStyle = '#c8321f'; g.fillRect(50, 28, 30, 12);
  g.fillStyle = '#2a3035'; g.beginPath(); g.moveTo(40, 40); g.lineTo(34, 24); g.lineTo(46, 22); g.lineTo(50, 40); g.fill();
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(36, 44, 6, 56);
}

export const icons = {
  battery: make(battery),
  fuel: make(fuel),
  apple: make(apple),
  knife: make(knife),
  shotgun: make(shotgun),
  shells: make(shells),
};
