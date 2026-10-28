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
  'wallpaper_main', 'wallpaper_secondary', 'wallpaper_accent', 'ceiling_tiles', 'carpet_party',
  'carpet_arcade', 'padding_playground', 'padding_wall', 'concrete_floor', 'wall_maintenance',
  'tile_kitchen_floor', 'tile_kitchen_wall', 'tile_bath_floor', 'tile_bath_wall', 'door_red',
  'door_blue', 'door_industrial', 'door_roller', 'wood', 'counter_reception', 'stairs',
  'railing', 'panel_electrical', 'shelf_metal', 'wall_office',
];

export const AVAILABLE_TEXTURES = [];
export const AVAILABLE_MODELS = [];

// Where each key falls back to when it has no image yet: a procedural style + tint.
export const PROCEDURAL = {
  wallpaper_main:      { style: 'wallpaper', base: '#a8975a', alt: '#b5a566' },
  wallpaper_secondary: { style: 'wallpaper', base: '#9a7f70', alt: '#7f93a0' },
  wallpaper_accent:    { style: 'wallpaper', base: '#a89c6a', alt: '#a89c6a' },
  ceiling_tiles:       { style: 'ceiling' },
  carpet_party:        { style: 'carpet', base: '#241f4a' },
  carpet_arcade:       { style: 'carpet', base: '#1c1a3a' },
  padding_playground:  { style: 'padding', base: '#a23a30' },
  padding_wall:        { style: 'padding', base: '#2f4f8a' },
  concrete_floor:      { style: 'concrete', base: '#6b6a66' },
  wall_maintenance:    { style: 'concrete', base: '#5e7a6a' },
  tile_kitchen_floor:  { style: 'tile', base: '#b9b2a0' },
  tile_kitchen_wall:   { style: 'tile', base: '#c4bca8' },
  tile_bath_floor:     { style: 'tile', base: '#aaa596' },
  tile_bath_wall:      { style: 'tile', base: '#c0b9a6' },
  door_red:            { style: 'metal', base: '#8a2a24' },
  door_blue:           { style: 'metal', base: '#2c4f7a' },
  door_industrial:     { style: 'metal', base: '#5a5c5c' },
  door_roller:         { style: 'metal', base: '#6a6a66' },
  wood:                { style: 'wood', base: '#6b4a2e' },
  counter_reception:   { style: 'wood', base: '#b8aa90' },
  stairs:              { style: 'metal', base: '#3a3a3a' },
  railing:             { style: 'metal', base: '#7a2e26' },
  panel_electrical:    { style: 'metal', base: '#4c6a58' },
  shelf_metal:         { style: 'metal', base: '#7a7a76' },
  wall_office:         { style: 'wood', base: '#5a4026' },
};
