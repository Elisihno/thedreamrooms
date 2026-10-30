// Asset manifest: the upgrade path from procedural placeholders to real art.
//
// TEXTURES: every material key below can be backed by image files. Put them in
//   levelfun/assets/textures/<key>/color.jpg   (sRGB base colour)        required
//   levelfun/assets/textures/<key>/normal.jpg  (tangent-space normal)    optional
//   levelfun/assets/textures/<key>/rough.jpg   (roughness)               optional
// then add the key to AVAILABLE_TEXTURES. Anything not listed falls back to a procedural texture,
// so the game always runs. Height maps are not used (normal maps cover the look on mobile).
//
// MODELS (Stage 4+): levelfun/assets/models/<name>.glb, listed in AVAILABLE_MODELS.

export const TEXTURE_KEYS = [
  'concrete_dark', 'wallpaper_balloons', 'wallpaper_stripes', 'carpet_confetti', 'tile_beige', 'carpet_arcade',
  'foam_puzzle', 'wallpaper_clouds', 'paint_yellow', 'brick_blue', 'padding_squares', 'padding_purple',
  'concrete_mid', 'slide_blue', 'slide_red', 'wall_green_peel', 'checker_red', 'tile_metal', 'wall_cream_blue',
  'diamond_plate', 'panel_concrete', 'hazard_stripes', 'metal_yellow', 'rubber_studs', 'chainlink', 'wall_cream_blue2',
];

// Keys with image files in assets/textures/<key>/ (color.jpg + normal.jpg, 512 px, seams blended).
export const AVAILABLE_TEXTURES = [...TEXTURE_KEYS];
export const AVAILABLE_MODELS = [];

// World metres covered by one repeat of each texture (default 2.5).
export const TILE = {
  wallpaper_balloons: 3, wallpaper_stripes: 3, wallpaper_clouds: 3, carpet_confetti: 2.5, carpet_arcade: 2.5,
  tile_beige: 2.4, checker_red: 2.4, tile_metal: 2.4, foam_puzzle: 2.4, concrete_dark: 3, concrete_mid: 3,
  panel_concrete: 3, wall_green_peel: 3, wall_cream_blue: 3, wall_cream_blue2: 3, paint_yellow: 2.5, brick_blue: 2.5,
  padding_squares: 2.4, padding_purple: 2.4, diamond_plate: 1.6, rubber_studs: 1.8, hazard_stripes: 2, metal_yellow: 1.5,
  chainlink: 1.2, slide_red: 2, slide_blue: 2,
};
// Surface response per texture: [roughness, metalness].
export const SURFACE = {
  diamond_plate: [0.55, 0.5], metal_yellow: [0.5, 0.35], tile_metal: [0.45, 0.3], chainlink: [0.6, 0.5],
  padding_squares: [0.4, 0], padding_purple: [0.4, 0], slide_red: [0.3, 0], slide_blue: [0.3, 0], checker_red: [0.5, 0],
  tile_beige: [0.6, 0], brick_blue: [0.55, 0], rubber_studs: [0.7, 0.1], carpet_confetti: [1, 0], carpet_arcade: [1, 0],
};

// Fallbacks used only if an image fails to load: a procedural style + tint.
export const PROCEDURAL = {
  concrete_dark: { style: 'concrete', base: '#4a4844' }, wallpaper_balloons: { style: 'wallpaper', base: '#c9a85a', alt: '#d6b668' },
  wallpaper_stripes: { style: 'wallpaper', base: '#b8a27a', alt: '#8aa0a8' }, carpet_confetti: { style: 'carpet', base: '#2a2560' },
  tile_beige: { style: 'tile', base: '#b0a38a' }, carpet_arcade: { style: 'carpet', base: '#1c1a3a' },
  foam_puzzle: { style: 'padding', base: '#c0392b' }, wallpaper_clouds: { style: 'wallpaper', base: '#4a7aa8', alt: '#6a8cb0' },
  paint_yellow: { style: 'concrete', base: '#c9a020' }, brick_blue: { style: 'tile', base: '#2a5aa8' },
  padding_squares: { style: 'padding', base: '#2f4f8a' }, padding_purple: { style: 'padding', base: '#5a2a8a' },
  concrete_mid: { style: 'concrete', base: '#6b6a66' }, slide_blue: { style: 'metal', base: '#1f4fc0' }, slide_red: { style: 'metal', base: '#b02a24' },
  wall_green_peel: { style: 'concrete', base: '#4a6a4a' }, checker_red: { style: 'tile', base: '#9a3a30' }, tile_metal: { style: 'tile', base: '#8a8a82' },
  wall_cream_blue: { style: 'concrete', base: '#bdb398' }, diamond_plate: { style: 'metal', base: '#3a3632' }, panel_concrete: { style: 'concrete', base: '#6a6860' },
  hazard_stripes: { style: 'metal', base: '#8a7a20' }, metal_yellow: { style: 'metal', base: '#b09020' }, rubber_studs: { style: 'metal', base: '#2a2622' },
  chainlink: { style: 'metal', base: '#4a3a2a' }, wall_cream_blue2: { style: 'concrete', base: '#b0a890' },
  wood: { style: 'wood', base: '#6b4a2e' }, tablecloth: { style: 'cloth', base: '#efebe0' }, concrete_floor: { style: 'concrete', base: '#6b6a66' },
};
