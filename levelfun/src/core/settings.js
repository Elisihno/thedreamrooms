import { CFG } from '../config.js';

const KEY = 'levelfun.settings.v1';

export function loadSettings() {
  const s = { ...CFG.defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch (e) { /* storage unavailable: use defaults */ }
  if (!CFG.quality[s.quality]) s.quality = CFG.defaults.quality;
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
