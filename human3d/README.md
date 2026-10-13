# human3d — realistic 3D character pipeline (Blender bpy, headless)

- `build_mb.py` → builds `mb_human.blend` from MB-Lab data (AGPL, fetched at runtime): young Asian male body + skin, curve-strand hair, black/white basketball kit, socks, sneakers.
- `mb_pose.py` → IK rig (auto-calibrated pole angles), feet locked flat, ball grip optimizer, test renders: `python3 mb_pose.py full,front,face,hip,feet`.

Setup: `pip install bpy` (5.x) ; sparse-clone MB-Lab to /tmp/mblab:
```
git clone --depth 1 --filter=blob:none --sparse https://github.com/animate1978/MB-Lab /tmp/mblab
cd /tmp/mblab && git sparse-checkout set data
```
(build_mb.py reads m_as01 vertices / joints / vgroups json under /tmp/mblab/data.)
