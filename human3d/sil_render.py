"""Fast silhouette render of the stand pose (Workbench, transparent) -> PNG alpha."""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mb_pose import setup_ik
P = {"foot_x": 0.16, "hand_dx": 0.12, "hand_dy": -0.06, "hand_L": 0.95, "pel_z": 0.03}
P.update(json.loads(os.environ.get("POSE_JSON", "{}")))
bpy.ops.wm.open_mainfile(filepath=os.environ.get("MB_OUT", "/home/claude/human/mb_human.blend"))
sc = bpy.context.scene; arm = bpy.data.objects["RIG"]; rb = arm.data.bones
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()): C = setup_ik(arm)
for s, sg in (("L", 1), ("R", -1)):
    C[f"foot_{s}"].location = (P["foot_x"] * sg, -0.02, rb[f"foot_{s}"].head_local.z)
    sh = rb[f"upperarm_{s}"].head_local; Lr = rb[f"upperarm_{s}"].length + rb[f"lowerarm_{s}"].length
    C[f"hand_{s}"].location = sh + Vector((P["hand_dx"] * sg, P["hand_dy"], -Lr * P["hand_L"]))
    C[f"elbow_{s}"].location = Vector((sh.x + 0.10 * sg, 0.7, rb["spine01"].head_local.z + 0.05))
    C[f"knee_{s}"].location = Vector((0.15 * sg, -0.8, rb["calf_L"].head_local.z))
    fe = bpy.data.objects.new(f"footrot_{s}", None); sc.collection.objects.link(fe)
    fe.matrix_world = arm.matrix_world @ rb[f"foot_{s}"].matrix_local
    arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION").target = fe
pl = arm.pose.bones["pelvis"]; pl.rotation_mode = "QUATERNION"; bpy.context.view_layer.update()
pl.matrix = Matrix.Translation((0, -0.01, P["pel_z"])) @ pl.matrix
for pb in arm.pose.bones:
    if pb.name[:-2] in [f"{f}0{k}" for f in ("index", "middle", "ring", "pinky") for k in (1, 2, 3)]:
        pb.rotation_mode = "XYZ"; pb.rotation_euler = (-math.radians(18), 0, 0)
sc.render.engine = "BLENDER_WORKBENCH"; sc.render.film_transparent = True
sc.render.resolution_x = 480; sc.render.resolution_y = 720
cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.0, -6.0, 1.0); cd.lens = 92
cam.rotation_euler = (Vector((0, 0, 0.94)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.render.filepath = sys.argv[-1]; bpy.ops.render.render(write_still=True)
