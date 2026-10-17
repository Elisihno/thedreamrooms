# Reaper Jack

A first-person stealth-horror game that runs in any browser, phone included.
Harvest night on Hallow Hill: collect five lanterns, open the gate, and escape Reaper Jack, the scarecrow who walks.

Single file (`index.html`) built on Three.js with an HDR post stack (bloom, ACES tonemapping, film grain, vignette, chromatic aberration), shadow-casting moon and lamp, wind-swept instanced cornfield and a procedural audio mix.

## Play
Open `index.html` over HTTP (`python3 -m http.server`) or host it with GitHub Pages.

- **Phone:** left thumb moves, right thumb looks, buttons for RUN / CROUCH / LAMP. Landscape is best.
- **Desktop:** WASD move, Shift run, C crouch, F lamp, mouse look.

## Mechanics
- Crouch inside the corn to hide. Running is loud. A lit lamp makes you easier to see.
- Hold the lamp on Jack's face for about a second to stagger him. He recovers.
- When the crickets stop, he is close.
