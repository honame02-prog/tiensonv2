# Area kits and camera shots

Grid: 32 px. Placement coordinates in JSON are **pixels**, not cells.
All asset URLs are relative to the public web root (`assets/...`).

## Source and bake

Declare `kits` and `pieces` at source top level, or inside `area`.
Top-level fields override the corresponding `area` fields. For example:

```json
{
  "kits": { "C-R1": "assets/kits/C-R1/kit.json" },
  "pieces": [{ "k": "C-R1/rwall_4", "x": 384, "y": 672 }]
}
```

`node tools/area_bake.mjs tools/areas/AREA.src.json` copies these fields to
`area.json` and validates manifests/references before writing.
`--out records/kit-bake` writes a test bake without touching live areas.
Absent fields stay absent; legacy ground PNGs remain byte-identical.
Kit collision rectangles stay exact; they are not rounded to the 32 px grid.

## kit.json

```json
{
  "kit": "C-B3",
  "pieces": {
    "wall": {
      "file": "wall.png", "layer": "base",
      "anchor": [0, 64], "footprint": [128, 12],
      "collide": [[0, -12, 128, 12]], "pair": "wall_roof"
    },
    "wall_roof": {
      "file": "wall_roof.png", "layer": "roof",
      "anchor": [0, 80], "footprint": [128, 12], "collide": []
    }
  }
}
```

- `kit` must match the area's kit key. `file` is relative to its manifest.
- `anchor` is a point in that PNG. Placement `(x,y)` puts that point in world space.
- `footprint`: width/height on the floor, descriptive metadata; the anchor's y is
  the sorting foot. Collision comes only from `collide`, never the full image.
- `collide`: `[x,y,w,h]` rectangles relative to the world anchor. Empty means no
  collider. A gate uses separate side rectangles so its passage stays open.
- `pair`: optional roof name in the same kit. Placing a base also places its roof
  at the same world anchor; each image keeps its own anchor. An explicit roof
  at the same position suppresses the automatic duplicate.
- `ground`: drawn at depth **−99**, immediately above baked ground (−100), below
  actors. These overlays are deliberately not baked into `ground.png`.
- `base`: `depthOf(anchorY, tierAt(anchorX, anchorY))`, same y ordering as actors.
- `roof`: above actors at `area.height + 1`; registered with the existing alpha
  masks/fade (0.35 when covering the actor, restored when clear).
- Manifests and textures are removed on scene shutdown and reloaded on re-entry.

## Repeating floor textures

An opt-in material in `tools/area_materials.json`:

```json
"kit_slab": { "type": "texture", "piece": "C-R1/slab_256" }
```

Use `material: "kit_slab"` in the desired bake region; the area must declare C-R1.
The piece must be a fully opaque ground PNG. Texture sampling wraps at native
size, anchored to world `(0,0)`, without mirroring/noise. A local PNG can instead
use `{"type":"texture","file":"public/assets/.../floor.png"}`.
The example material is lazy: existing areas using `slab` are unaffected.

## Exact camera frames with Dao Si rulers

```powershell
node tools/scene_shot.mjs --area huyen-van-quan-v2 --view 1,16 --actors "3,21;7,22;12,23" --out records/HK-ENG/shots/V1.png
node tools/scene_shot.mjs --area huyen-van-quan-v2 --view 12.5,15.2 --actors "14,21;19,22;24,23" --out records/HK-ENG/shots/V2.png
```

`--view` is the exact top-left in **cells**, fractional cells supported.
`--actors` is a semicolon-separated list of foot positions in **cells**.
Actors use the real `dao_si_idle_down_00` frame, face South, and sort by tier/y.
The playable hero is hidden. UI, fog, mist, smoke, particles and night are hidden;
simulation, animations and tweens are paused. Roof fading considers all rulers.
Camera zoom and device scale are 1; output is exactly 480×270.
The second file `NAME@2x.png` is 960×540, exact nearest-neighbour enlargement.
An out-of-bounds view fails instead of silently shifting the camera.

The requested `.agents/codex/HK-ENG/shots/` destination is read-only in this
sandbox; `records/HK-ENG/shots/` is the permitted generated-output fallback.
With writable permissions, any `--out` location can be used.

## Checks

```powershell
node tools/area_kits_test.mjs
node tools/area_tool_vite.mjs --port 5199
# In a second terminal (leave the server above running):
node --import ./tools/area_tool_runtime.mjs tools/area_layers_test.mjs http://127.0.0.1:5199/
node --import ./tools/area_tool_runtime.mjs tools/blockout_walk.mjs http://127.0.0.1:5199/
node tools/blockout_reach.mjs
```

`tests/fixtures/kits/FAKE/` contains labelled artificial PNGs, a solid obstacle,
and a gate with a 48 px opening. `make.mjs` reproduces those fixture PNGs.
The new integration test uses real loaders, physics, alpha masks, camera capture,
source bake propagation, modulo texture sampling and SHA256 legacy comparisons.
Only test output is written to `records/HK-ENG/`; no real kit is assembled in HVQ.

Tools reuse existing Playwright/Vite/Phaser from this worktree or an ancestor's
`tiensonv2/node_modules`. `TIENSON_NODE_MODULES` can select another installed set.
No packages are installed. The preload flag lets unchanged legacy tests use the
same dependencies when an isolated worktree lacks its own `node_modules`.
