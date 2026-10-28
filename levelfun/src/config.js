export const BUILD = 'stage3-r1';

export const CFG = {
  player: {
    radius: 0.3,
    eyeStand: 1.6,
    eyeCrouch: 0.75,
    hStand: 1.7,
    hCrouch: 0.8,   // must stay below table undersides (0.85) so the player can hide under them
    stepUp: 0.15,
    walk: 2.4,      // m/s, no sprint
    crouch: 1.2,
    accel: 12,
    leanOffset: 0.4,
    leanRoll: 0.14,
  },
  look: { mouse: 0.0022, touchPerScreenHeight: 3.0, pitchLimit: 1.45 },
  quality: {
    low:    { pixelRatio: 0.75, antialias: false, shadows: false, texSize: 512,  aniso: 1, maxLights: 4 },
    medium: { pixelRatio: 1.0,  antialias: true,  shadows: false, texSize: 512,  aniso: 4, maxLights: 6 },
    high:   { pixelRatio: 1.75, antialias: true,  shadows: true,  texSize: 1024, aniso: 8, maxLights: 8 },
  },
  defaults: { quality: 'medium', sensitivity: 1, fov: 70, crouchMode: 'toggle' },
};
