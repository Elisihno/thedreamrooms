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

## Starting a run

A run opens with a waking-up intro (about 5 seconds): eyes shut and blurred, they open, the blur clears and you sit up. Controls unlock when it ends.

## How to win (spoilers)

1. Take the **Padlock Key** from the sink in the bathroom, right next to the starting bedroom.
2. Unlock the **basement door** (ground floor, at the bottom of the foyer stairs) and go down.
3. In the garage, find the **red box** among all the boxes on the shelves. The **Attic Key** is inside.
4. Use it on the locked door in the attic (the Special Room). Two **Front Door Keys** are inside.
5. Unlock the **front door** (ground floor, east side) with both keys. It isn't the way out: it opens the kitchen and living room.
6. In the living room drawer: **scissors**. They work twice.
7. Use the scissors on the **safe** in the basement's dirt room (a **Rusty Key**) and on the **sealed box** in the master bedroom (a **Silver Key**).
8. In the **sauna**, throw a vase into the trash can. The stove heats up and a **lockpick** drops onto the bench.
9. Use the lockpick on the **locker** in the starting bedroom for the **Black Key**.
10. In the basement (dirt room, south wall), **crouch through the crawlspace** to the vault. Use the three keys on the three-lock door and walk out.

## How it works

- `src/layout.js` - the whole house as data (walls, doorways, stairs, furniture, items, Granny's path nodes).
  Reshape the house here; collision, floors and the AI graph rebuild from it.
- `src/world.js` - builds meshes, collision and line-of-sight from the layout.
- `src/granny.js` - AI: patrol, investigate noises, chase on sight, search, check hiding spots.
- `src/player.js` - movement, crouch, interaction (doors with several locks, containers, tools), hiding, throwing.
- `src/models.js`, `src/held.js` - the flat Granny-style key, scissors, lockpick, vase, and how they are held (pointing forward).
- `public/img/` - reference screenshot, the wall/floor texture atlas (sliced at runtime) and the stance icons.

## The house

Four levels, with room names taken from the Granny wiki (the geometry is our own, since the wiki has no floor plan):

- **Attic:** Nursery, Mannequin Room, Jail, Special Room
- **Upper floor (each room has its own wall tile; the hall keeps one):** Starting Bedroom (locker), Bathroom (next door), Bookshelf Room, Master Bedroom (sealed box), Walk-In Closet, Bedroom 2
- **Ground floor:** Foyer, Study, Dining Room, and behind the Front Door the Kitchen and Living Room
- **Basement:** Basement hall, Dirt Room (safe), Sauna, Boiler Room, Garage (shelves of boxes), then under the yard a Crawlspace, the Vault and the exit tunnel

Not built yet: the secret area, abandoned house/sewers, spider cellar, backyard and shed.
The layout is meant to be edited in `src/layout.js`.

## Single-file build

`npm run build && python3 scripts/make-single-file.py out.html` produces one self-contained HTML fragment
(JS and images inlined). If the host refuses pointer lock, dragging with the mouse looks around instead.
