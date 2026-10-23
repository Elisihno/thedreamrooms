# Credits

**The Sunshine Hillbilly Massacre** is made by Elisihno, and takes its structure from the earlier game *Dread*
in this repository.

## 3D models (all from Sketchfab, licensed CC BY 4.0 unless noted)

| Used for | Model | Author |
| --- | --- | --- |
| The Hillbilly's body and animations | [Granny 3 - Grandpa](https://sketchfab.com/3d-models/granny-3-grandpa-e14c2da16120444286a84e143a8d9ca2) | Horror Game Fan |
| His chainsaw | [DOOM eternal chainsaw](https://sketchfab.com/3d-models/doom-eternal-chainsaw-61d0028634804e019950328ef4355d7a) | DJ_Nugget |
| The kitchen cabinets | Kitchen Cabinets | jimbogies |
| The dining table and chairs | Table and Chairs | Graham |
| The trestle table | Vintage Wooden Table | Poring |
| The meat hooks in the cellar | Butcher Hook_18MB | Mehdi Shahsavan |
| The piles of bones | Low Poly Bone Pile (Downloadable) | 3dsauce |
| The copper tea kettle | Polished Tea Kettle | *(author and license to be filled in)* |
| The candelabra on the dining table | Candelabra | *(author and license to be filled in)* |
| The cleaver on the butcher block | Cleaver - Butcher's Best Friend | *(author and license to be filled in)* |
| The kitchen fridge | Old Fridge | *(author and license to be filled in)* |
| The copper pots and pans | 3DDecember 2021 - Copper Pots and Pans | *(author and license to be filled in)* |
| The wood stove | Wood Stove | *(author and license to be filled in)* |
| The dish rack | Dish Rack with Dishes | *(author and license to be filled in)* |
| The bird cage and the dead bird | Low Poly Bird Cage, Dead Bird | *(author and license to be filled in)* |
| The pendulum clock | Old Wall Clock | *(author and license to be filled in)* |
| The armchair | Morris Chair | *(author and license to be filled in)* |
| The chest freezer | Fridgadaire Chest Freezer | *(author and license to be filled in)* |
| The armadillo skeleton | Armadillo (Dasypodidae Dasypus) | *(author and license to be filled in)* |
| The bird skull | Bird Skull | *(author and license to be filled in)* |
| The old iron bed | Hospital Bed | *(author and license to be filled in)* |
| *(optional, not included)* a bentwood chair | Chair | shuvalov.di, Sketchfab Standard license |

The Hillbilly is Grandpa with a stitched leather mask, glowing eyes, a bloody apron and a new chainsaw added in
code (`js/hillbilly.js`). The kitchen is one wall cut out of the L-shaped kitchen model.

CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ — the models were resized, merged and had their textures
shrunk for the web (`tools/bake.mjs`, `tools/shrink.mjs`).

### The chair

The Sketchfab *Standard* license does not allow the model file to be shared publicly, so `chair.glb` is **not** in
this repository. If you have the file, run `node tools/bake.mjs chair` (see below) or drop the baked result into
`assets/models/optional/chair.glb` and the game will use it for its chairs; without it the game draws a plain chair.

## Items

The things you pick up (key, cutting pliers, kitchen knife, apple, shotgun, shells, car battery, fuel can, flashlight
and the spiral vase), their hand-held models and their icons are copied from *Dread* in this repository
(`js/held.js`, `js/apple.js`, `js/vase.js`, `js/icons.js`, `assets/textures/item_key.png`, `item_pliers.png`).

## Textures

The wall and floor textures are from the earlier *Dread* project in this repository (`assets/textures/floor_02.jpg`,
copied as `floor_wood.jpg`) and a set of ten wall textures supplied for this game (`assets/textures/wall_01..10.jpg`).
Everything else (wallpapers, curtains, leather, apron, sky, sound) is painted or synthesised in code.

## Code

[three.js](https://threejs.org) r170 (MIT) in `vendor/`, including its `GLTFLoader`, `BufferGeometryUtils`
and `SkeletonUtils`; `tools/GLTFExporter.js` is also from three.js.
