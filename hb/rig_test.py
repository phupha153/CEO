"""Pose the Rigify rig via its controls and render clay checks. arg: pose name"""
import bpy, sys, math, os
from mathutils import Vector, Matrix, Euler
bpy.ops.wm.open_mainfile(filepath=os.environ.get("CHAR", "/home/claude/hb/hb_rig.blend"))
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
        hik.rotation_mode = "QUATERNION"
        print("IK_FK", P[f"upper_arm_parent.{s}"].get("IK_FK"), "Lr", round(Lr,3))
elif pose == "rest":
    pass
bpy.context.view_layer.update()
b = bpy.data.objects["Body"]
if not os.environ.get("CHAR"):
    mm = bpy.data.materials.new("clay"); mm.use_nodes = True
    mm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.44, 0.34, 1)
    b.data.materials.clear(); b.data.materials.append(mm)
for o in bpy.data.objects:
    if o.type == "ARMATURE" or o.name.startswith("WGT"): o.hide_render = True
sc.render.engine = "CYCLES"; sc.cycles.samples = int(os.environ.get("SPP", 16)); sc.cycles.use_denoising = True; sc.view_settings.view_transform = os.environ.get("VT", "AgX"); sc.view_settings.look = "AgX - Medium High Contrast" if sc.view_settings.view_transform == "AgX" else "None"; sc.view_settings.exposure = float(os.environ.get("EXPO", 0.0)); sc.render.resolution_x = 540; sc.render.resolution_y = 960
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.25, 0.75, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.25
def area(loc, tgt, e, s=1.5, c=(1, 1, 1)):
    L = bpy.data.lights.new("a", "AREA"); L.energy = e; L.size = s; L.color = c
    o = bpy.data.objects.new("a", L); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area((-1.6, -3.0, 2.8), (0, 0, 1.3), float(os.environ.get("KEY", 220)), 1.0, (1, .95, .88)); area((2.4, -2.2, 1.6), (0, 0, 1.2), 60, 3, (.85, .92, 1))
area((-2.0, 1.0, 2.2), (0, 0, 1.4), 220, 0.8); area((2.0, 1.0, 2.2), (0, 0, 1.4), 220, 0.8)
bpy.ops.mesh.primitive_plane_add(size=20); fl = bpy.context.object
mf = bpy.data.materials.new("floor"); mf.use_nodes = True; mf.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.12, 0.45, 1); fl.data.materials.append(mf)
cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.0, -6.0, 1.0); cd.lens = float(os.environ.get("LENS", 70)); cam.rotation_euler = (Vector((0, 0, float(os.environ.get("CAMZ", 0.95)))) - cam.location).to_track_quat("-Z", "Y").to_euler()
if os.environ.get("MR0"): b.modifiers["Multires"].render_levels = 0
sc.render.filepath = f"/tmp/rig_{pose}.png"; bpy.ops.render.render(write_still=True)
