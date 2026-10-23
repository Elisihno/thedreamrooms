// Inventory icons, drawn on small canvases and returned as data URLs.

function make(draw, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  return cv.toDataURL('image/png');
}

const drawKey = g => {
  g.translate(64, 64); g.rotate(-0.6);
  g.strokeStyle = '#c9a54a'; g.lineWidth = 9; g.beginPath(); g.arc(-34, 0, 17, 0, 7); g.stroke();
  g.fillStyle = '#c9a54a'; g.fillRect(-18, -4, 70, 8); g.fillRect(30, 0, 8, 20); g.fillRect(44, 0, 8, 14);
  g.fillStyle = '#b22'; g.fillRect(-52, 14, 14, 20);
};

const drawCutters = g => {
  g.translate(64, 64); g.rotate(-0.7);
  g.strokeStyle = '#b02a20'; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-58, -14); g.lineTo(22, -3); g.moveTo(-58, 14); g.lineTo(22, 3); g.stroke();
  g.strokeStyle = '#23292e'; g.lineWidth = 10; g.beginPath(); g.moveTo(-58, -14); g.lineTo(-38, -11); g.moveTo(-58, 14); g.lineTo(-38, 11); g.stroke();
  g.fillStyle = '#23292e'; g.fillRect(16, -14, 18, 28);
  g.fillStyle = '#aeb4b9'; g.beginPath(); g.moveTo(32, -12); g.lineTo(60, -3); g.lineTo(60, 3); g.lineTo(32, 12); g.closePath(); g.fill();
};

const drawCleaver = g => {
  g.translate(64, 64); g.rotate(-0.6);
  const blade = g.createLinearGradient(0, -22, 0, 22);
  blade.addColorStop(0, '#f2f4f6'); blade.addColorStop(1, '#8a9096');
  g.fillStyle = blade; g.fillRect(-8, -26, 66, 50);
  g.fillStyle = '#23292e'; g.beginPath(); g.arc(46, -12, 6, 0, 7); g.fill();
  g.fillStyle = '#3a2416'; g.beginPath(); g.roundRect(-56, -9, 48, 18, 5); g.fill();
  g.fillStyle = '#c9a54a'; for (const x of [-46, -32, -18]) { g.beginPath(); g.arc(x, 0, 2.4, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(110,10,10,.6)'; g.beginPath(); g.arc(20, 12, 7, 0, 7); g.arc(36, -2, 5, 0, 7); g.fill();
};

const drawPeach = g => {
  const grd = g.createRadialGradient(54, 56, 6, 64, 70, 52);
  grd.addColorStop(0, '#fbd27a'); grd.addColorStop(0.6, '#f0925a'); grd.addColorStop(1, '#c9503a');
  g.fillStyle = grd; g.beginPath(); g.arc(62, 72, 40, 0, 7); g.fill();
  g.strokeStyle = 'rgba(150,50,30,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 34); g.quadraticCurveTo(76, 70, 62, 110); g.stroke();
  g.strokeStyle = '#4a3a1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(62, 34); g.lineTo(66, 22); g.stroke();
  g.fillStyle = '#5e8a2e'; g.beginPath(); g.ellipse(82, 24, 17, 7, -0.4, 0, 7); g.fill();
};

const drawShotgun = g => {
  g.translate(64, 64); g.rotate(-0.35);
  g.fillStyle = '#2d3237'; g.fillRect(-10, -9, 78, 7);
  g.fillStyle = '#4b5258'; g.fillRect(-4, -1, 58, 5);
  g.fillStyle = '#6a4325'; g.fillRect(14, 0, 24, 8);
  g.fillStyle = '#1c2023'; g.fillRect(-30, -11, 26, 14);
  g.fillStyle = '#6a4325';
  g.beginPath(); g.moveTo(-30, -9); g.lineTo(-72, -3); g.lineTo(-76, 18); g.lineTo(-56, 14); g.lineTo(-30, 4); g.closePath(); g.fill();
  g.strokeStyle = '#1c2023'; g.lineWidth = 2; g.beginPath(); g.arc(-18, 8, 6, 0, Math.PI); g.stroke();
};

const drawShells = g => {
  const shell = (x, y) => {
    g.save(); g.translate(x, y); g.rotate(-0.25);
    g.fillStyle = '#c8321f'; g.fillRect(-9, -34, 18, 48);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-6, -34, 4, 48);
    g.fillStyle = '#b89a32'; g.fillRect(-9, 14, 18, 16);
    g.fillStyle = '#7e6a1e'; g.fillRect(-9, 14, 18, 3);
    g.restore();
  };
  shell(36, 64); shell(64, 62); shell(92, 66);
};

const drawBattery = g => {
  g.fillStyle = '#2a3035'; g.fillRect(22, 48, 84, 52);
  g.fillStyle = '#3a5aa0'; g.fillRect(20, 40, 88, 14);
  g.fillStyle = '#b89a32'; g.fillRect(34, 28, 16, 14); g.fillRect(78, 28, 16, 14);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(22, 58, 84, 4);
  g.fillStyle = '#ddd'; g.font = 'bold 22px system-ui'; g.fillText('+', 30, 24); g.fillText('−', 82, 24);
};

const drawGas = g => {
  g.fillStyle = '#c8321f'; g.fillRect(32, 40, 62, 66);
  g.fillStyle = '#8a1c10'; g.fillRect(32, 62, 62, 8);
  g.fillStyle = '#c8321f'; g.fillRect(52, 28, 26, 14);
  g.fillStyle = '#23292e'; g.fillRect(40, 24, 10, 18);
  g.fillStyle = '#d9c23a'; g.fillRect(36, 18, 18, 8);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = 'bold 20px system-ui'; g.fillText('GAS', 42, 94);
};

const drawJar = g => {
  g.fillStyle = 'rgba(214,154,42,.7)'; g.beginPath(); g.roundRect(34, 34, 60, 76, 10); g.fill();
  g.fillStyle = '#b44a1a'; g.beginPath(); g.roundRect(40, 48, 48, 58, 8); g.fill();
  g.fillStyle = '#aeb4b9'; g.fillRect(32, 26, 64, 14);
  g.fillStyle = '#efe6cf'; g.fillRect(44, 62, 40, 26);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(40, 44, 6, 56);
};

export const icons = {
  key: make(drawKey), cutters: make(drawCutters), cleaver: make(drawCleaver), peach: make(drawPeach), shotgun: make(drawShotgun),
  shells: make(drawShells), battery: make(drawBattery), gas: make(drawGas), jar: make(drawJar),
};
