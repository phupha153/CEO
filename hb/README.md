# hb — realistic rigged character pipeline (Blender, headless, all free/CC0)

1. Assets: `.github/workflows/fetch.yml` downloads Blender Studio Human Base Meshes (CC0) into `assets/dl/`.
2. `rig_hb.py`  → `hb_rig.blend`: base mesh → geodesic segmentation (arms/legs/torso/head) → landmarks →
   Rigify Human metarig fitted → `rigify_generate` → automatic weights → limb-bleed cleanup.
3. `dress_hb.py` → `hb_char.blend`: skin shader, eyes, curve-strand hair, jersey (body-surface + clean trims),
   shorts (hull-loft, voxel remesh), cloth-sim drape at rest, Surface Deform follow, socks, sneakers.
4. `rig_test.py stand` renders a check (env: CHAR, SPP, LENS, CAMZ, KEY, VT, EXPO).
Animate with Rigify controls: `hand_ik.L/R`, `foot_ik.L/R`, `torso`, `chest`, `head`, finger controls.
