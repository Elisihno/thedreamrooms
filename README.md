# thedreamrooms
Where Am I? In Heaven?

## Level 0 - The Lobby
A mobile-friendly 3D Backrooms level (three.js, no build step).

- Endless procedural maze of yellow wallpaper, damp carpet and humming fluorescent lights
- Left thumb moves (floating joystick), right thumb looks. Desktop: WASD + mouse drag
- Find the thin spot in reality: listen for the static. Walk into it to noclip out to Level 1

Run it: `python3 -m http.server` in this folder, open `http://<your-ip>:8000` on your phone
(or host it on GitHub Pages).

## Level 1 - The Habitable Zone
Laid out after the Escape the Backrooms floor 4 map: a long main hall with numbered pillars, side rooms,
puddles, a stem down to the elevator where you start, and an upper area up a ramp.

- The exit door turns up in one of nine places each run, and it is locked.
- The keycard is in the drawer of the office in the upper area.
- The skin stealer patrols, hears footsteps (puddles are loud) and sees you from far away when you stand
  and from much less when you crouch. Crates and pillars block its view.

The skin stealer model is `models/skinstealer.glb` (textures shrunk to 1024px, mesh simplified).
