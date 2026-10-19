# Blade Antagonist

Arena blade fighting: free-for-all or 2 vs 2.

## Setup
Install [Rojo](https://rojo.space), run `rojo serve` in this folder, and connect from the Studio Rojo plugin.

## Layout
- `src/shared`: `Config` (modes, labels, popup delay), `Types`, `Remotes`
- `src/server/Systems/Lobby`: builds the lobby, golden chest and cyber chest
- `src/server/Systems/Modes`: validates the mode a player picks
- `src/client/Controllers/ModePopup`: mode popup shown shortly after joining

If your place has the default Baseplate or SpawnLocation, delete them. The lobby builds its own.
