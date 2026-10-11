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
| Use / hide | E | USE |
| Throw a vase to lure Granny | F or click | THROW |

## Goal

Padlock Key (Bathroom, upper floor) -> cellar door -> Master Key (Sauna, basement) -> study door -> Front Door Key -> front door.

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
- **Upper floor:** Starting Bedroom, Bookshelf Room, Bathroom, Bedroom 1, Walk-In Closet, Bedroom 2
- **Ground floor:** Foyer, Study, Living Room, Dining Room, Kitchen
- **Basement:** Basement, Dirt Room, Sauna, Garage

Not built yet: the secret area, abandoned house/sewers, spider cellar, backyard and shed.
The layout is meant to be edited in `src/layout.js`.
