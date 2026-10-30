# Smiley (Stage 4)

The Partygoer patrols all four floors with a walking-grid pathfinder (`src/ai/nav.js`) built from the same collision and floor data the player walks on: he opens normal doors, climbs the spiral staircase, never teleports, never uses secret passages and cannot fit into the playground crawl tunnels or nooks. Locked doors stop him, and he stays out of the Security Room.

* **Senses**: sight (about 18 m, shorter in dark rooms, crouching or standing still, but never under 7 m; about 160 degree view, blocked by walls) and hearing (thrown items, balloon pops, whistle, music box, doors you open, the camera monitors, party traps). He has no magic knowledge of where you are.
* **Footsteps**: he hears you walking within about 11 m (about 5.5 m if you crouch-walk; standing still is silent beyond 2 m) and goes straight for you. The Security Room's heavy door is very loud when opened. He investigates noises up to one floor away, no further.
* **States**: patrol, idle, investigate a noise (5-10 s), chase, search (about 10 s after losing you), check a hiding place he saw you enter, place a sticky party trap, stunned (Party Stun Gun, 30 s).
* **Plushie rage**: once he sees you holding the Partygoer Plushie he tracks you until you drop it.
* **Difficulty** (menu): Practice (he is absent), Easy 75 %, Normal 90 %, Hard 100 %, Extreme 110 % of your walking speed (Extreme also hears further and always checks a hiding place he saw you enter).
* **Hiding**: tap the hand at a table, locker, stall, workbench, tunnel or nook. Tables are never safe from a Smiley who watched you go in (he always checks, crouches and looks under); lockers, stalls and benches are grabbed; tunnels and nooks he cannot reach.
* **Caught**: one of three short scares (hit with an object, grab, crouching to look under a table), then a DAY card. You wake under the dining table again, held item dropped, solved puzzles stay solved, items stay where they are. Caught on Day 5 is GAME OVER. every launch is a fresh game; nothing is saved between runs.
