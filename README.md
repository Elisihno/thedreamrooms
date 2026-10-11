# The Dream Rooms

A Granny-style first-person survival horror game for the browser, built with three.js + Vite.
You wake up in a locked bedroom, and the old woman downstairs hears everything.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Move | WASD / arrows | left stick |
| Look | mouse | drag the right side |
| Crouch (quieter) | C / Ctrl | tap the stance icon (top-left) |
| Use / hide | E or left click | USE |
| Throw a vase to lure Granny | F or right click | THROW |
| Drop what you hold | G | DROP |
| Switch item in hand | Q, mouse wheel, 1-9 | tap the item at top right |

## Goal

Padlock Key (in the Bathroom sink, next to the starting bedroom) -> cellar door -> Master Key (Sauna, basement) -> study door -> Front Door Key -> front door.

## How it works

- `src/layout.js` - the whole house as data (walls, doorways, stairs, furniture, items, Granny's path nodes).
  Reshape the house here; collision, floors and the AI graph rebuild from it.
- `src/world.js` - builds meshes, collision and line-of-sight from the layout.
- `src/granny.js` - AI: patrol, investigate noises, chase on sight, search, check hiding spots.
- `src/player.js` - movement, crouch, interaction, hiding, throwing.
- `public/img/` - reference screenshot, the wall/floor texture atlas (sliced at runtime) and the stance icons.

## The house

Four levels, with room names taken from the Granny wiki (the geometry is our own, since the wiki has no floor plan):

- **Attic:** Nursery, Mannequin Room, Jail, Special Room
- **Upper floor:** Starting Bedroom, Bathroom (next door), Bookshelf Room, Bedroom 1, Walk-In Closet, Bedroom 2
- **Ground floor:** Foyer, Study, Living Room, Dining Room, Kitchen
- **Basement:** Basement, Dirt Room, Sauna, Garage

Not built yet: the secret area, abandoned house/sewers, spider cellar, backyard and shed.
The layout is meant to be edited in `src/layout.js`.

## Single-file build

`npm run build && python3 scripts/make-single-file.py out.html` produces one self-contained HTML fragment
(JS and images inlined). If the host refuses pointer lock, dragging with the mouse looks around instead.
