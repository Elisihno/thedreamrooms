# LEVEL FUN

First-person survival horror (Three.js). Lives in this folder; the rest of the repo is a separate game.

- Play/test: open `levelfun/` on the GitHub Pages site (e.g. `https://elisihno.github.io/thedreamrooms/levelfun/`).
- Build stamp is shown on the start screen, so you can confirm the phone loaded the latest version.
- Progress: **Stage 1** foundation, **Stage 2** the whole building (4 floors, 29 rooms, stairs, doors, 6 secret passages, 21 hiding spots, 9 camera mounts).
- `node levelfun/tools/validate_layout.mjs` checks the spec totals and that ordinary routes reach every room.

## Assets
- Texture library: see `src/assets/manifest.js` for the 25 material keys and the file layout.
  Until image files are added, procedural placeholders are used.
- `assets/models/partygoer_original.glb`: Smiley model (static mesh, 7.3k tris, no skeleton/animations, 12.4 MB
  of textures that will be compressed before use). Filename in the file: "PartygoerByFilinMinv". Author/licence still to be confirmed and credited here.

## Models (levelfun/assets/models)
Optimized from Sketchfab downloads (scaled to metres, origin at bottom-centre, textures shrunk to WebP,
triangle counts cut for phones): table, chair, cup, cake, party_hat, door, counter, balloons.
Paper plates and party hats are generated in code. See `CREDITS.md` for every model's author and licence (two are non-commercial).
Replace any model by dropping a new .glb with the same name. Pipes, ball-pit balls, balloons' strings, bunting and the paper plates are generated in code.

## Textures (levelfun/assets/textures)
26 supplied textures (512 px, seams blended, normal maps generated). Source images were 1254-1312 px.
Add more by listing keys in `src/assets/manifest.js`. Arcade machine model: `assets/models/arcade.glb` (author/licence to be credited).
