# The Sunshine Hillbilly Massacre

A first-person horror game for the browser, in the spirit of *Granny* and *The Texas Chainsaw Massacre*, built on the
bones of *Dread* (the game one folder up).

You wake up in a sunlit upstairs bedroom of a Texas farmhouse. Somewhere in the house a chainsaw is idling. You have a
few days to escape from **The Hillbilly** — and you can hear him long before you see him.

The house is laid out like the classic 1974 farmhouse: the entrance hall with the stairs and the room of bones behind its
sliding steel door at the front; the parlour, the dining room, the kitchen and the freezer room with its hooks at the back;
bedrooms upstairs, a cellar, an attic and a front porch with a swing.

Open `index.html` through any web server (`npx http-server`, GitHub Pages, ...). It works on phones: left half of the
screen moves, right half looks, a quick tap toggles the flashlight.

## How to play

* **Escape** any of four ways:
  * **Front door** — two padlocks (keys) and a keypad. The code is on a postcard in a drawer in the parlor.
  * **Storm hatch** (cellar) — cut the three fuse-box wires with the cutting pliers, then unlock two padlocks.
  * **Sally's window** (upstairs, above the front door) — cut the two chains with keys and jump.
  * **The pickup truck** (garage) — a battery (attic), a can of gas (cellar) and a key; the garage door opens when it starts.
* **Hide** under beds and tables, or inside a wardrobe, by looking at it and tapping the hand.
* **Fear** drives him: darkness, noise and the sight of him raise it; sunshine (stand in a patch of sun), the
  flashlight and hiding lower it. The more afraid you are, the farther he smells you.
* **The shotgun** (padlocked in the attic; shells are inside an apple that you cut on the butcher block with the kitchen knife)
  stalls his saw for a few seconds. A smashed vase or a broken window sends him to investigate.
* If he catches you, a new day begins in a new house. Survive the days and the game ends.

Difficulty modes: Easy (7 days), Medium (5), Hard (4), Extreme (3, he is faster than you), Practice (no Hillbilly).

Page flags (after the `#`, joined with `.`): `fast` skips the title, `test` starts with a loaded shotgun, `s123` picks a
house seed, `nohill` removes him, `hill` starts him close, `day3` starts on day 3, `nosplash` skips the opening.

## Layout

```
index.html          the page and all its HUD
js/main.js          the game loop, input, menus, days and the three endings
js/world.js         the farmhouse: rooms, doors, windows, locks, items, sunbeams, the truck
js/props.js         furniture, built from boxes, with real 3D models where it has them
js/hillbilly.js     The Hillbilly: his model, pathfinding and fear-driven brain
js/outdoors.js      the sky, the sun, the yard, the windmill, the corn
js/audio.js         every sound, synthesised (including the chainsaw engine)
js/textures.js      painted textures, plus the photo wallpapers and floor
js/assets.js        loads the .glb models
tools/              bake.mjs and shrink.mjs turn the raw downloads into the lean .glb files in assets/models
```

See [CREDITS.md](CREDITS.md) for the 3D models and who made them.
