"""Pose the Rigify rig via its controls and render clay checks. arg: pose name"""
import bpy, sys, math, os
from mathutils import Vector, Matrix, Euler
bpy.ops.wm.open_mainfile(filepath="/home/claude/hb/hb_rig.blend")
sc = bpy.context.scene; rig = bpy.data.objects["rig"]; P = rig.pose.bones
pose = sys.argv[-1]
def setp(n, prop, val): P[n][prop] = val
# IK on arms & legs
for s in ("L", "R"):
    for limb in ("upper_arm_parent", "thigh_parent"):
        if f"{limb}.{s}" in P: P[f"{limb}.{s}"]["IK_FK"] = 0.0
if pose == "stand":
    for s, sg in (("L", 1), ("R", -1)):
        hik = P[f"hand_ik.{s}"]; B = rig.data.bones
        sh = B[f"DEF-upper_arm.{s}"].head_local
        Lr = sum(B[n].length for n in B.keys() if n.startswith((f"DEF-upper_arm.{s}", f"DEF-forearm.{s}")) and n.endswith(s) or n in (f"DEF-upper_arm.{s}.001", f"DEF-forearm.{s}.001"))
        Lr = sum(B[n].length for n in (f"DEF-upper_arm.{s}", f"DEF-upper_arm.{s}.001", f"DEF-forearm.{s}", f"DEF-forearm.{s}.001") if n in B)
        tgt = sh + Vector((0.06 * sg, -0.02, -Lr * 0.97))
        M = B[f"hand_ik.{s}"].matrix_local.copy(); M.translation = tgt
        hik.matrix = M
        print("IK_FK", P[f"upper_arm_parent.{s}"].get("IK_FK"), "Lr", round(Lr,3))
elif pose == "rest":
    pass
bpy.context.view_layer.update()
mm = bpy.data.materials.new("clay"); mm.use_nodes = True
mm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.44, 0.34, 1)
b = bpy.data.objects["Body"]; b.data.materials.clear(); b.data.materials.append(mm)
for o in bpy.data.objects:
    if o.type == "ARMATURE" or o.name.startswith("WGT"): o.hide_render = True
sc.render.engine = "CYCLES"; sc.cycles.samples = 16; sc.render.resolution_x = 540; sc.render.resolution_y = 960
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.25, 0.75, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.5
L = bpy.data.lights.new("k", "AREA"); L.energy = 700; L.size = 1.2; lo = bpy.data.objects.new("k", L); sc.collection.objects.link(lo)
lo.location = (-1.5, -2.6, 3.0); lo.rotation_euler = (Vector((0, 0, 1.2)) - lo.location).to_track_quat("-Z", "Y").to_euler()
cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.0, -6.0, 0.98); cd.lens = 70; cam.rotation_euler = (Vector((0, 0, 0.95)) - cam.location).to_track_quat("-Z", "Y").to_euler()
if os.environ.get("MR0"): b.modifiers["Multires"].render_levels = 0
sc.render.filepath = f"/tmp/rig_{pose}.png"; bpy.ops.render.render(write_still=True)
