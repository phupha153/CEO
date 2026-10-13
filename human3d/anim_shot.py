"""Jump-shot blockout animation for the MB-Lab character (IK keyframes, solved hand grips).
usage:  python3 anim_shot.py solve            -> shot.blend
        python3 anim_shot.py render A B [hq]  -> shot_frames/f####.png (blockout) ; hq = single high-quality still
"""
import bpy, math, sys, os, json
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mb_pose import setup_ik, grip, rot_bone

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "mb_human.blend"); OUT = os.path.join(D, "shot.blend")
FPS = 24; END = 120

def orient_hand(arm, s, fdir, step=15):
    """Point the fingers along fdir (wrist flick / follow-through)."""
    vl = bpy.context.view_layer; hb = arm.pose.bones[f"hand_{s}"]; hb.rotation_mode = "XYZ"; W = arm.matrix_world
    best = (9, (0, 0, 0))
    for x in range(-90, 91, step):
        for y in range(-60, 61, 30):
            for z in range(-60, 61, step):
                hb.rotation_euler = tuple(math.radians(v) for v in (x, y, z)); vl.update()
                d = ((W @ arm.pose.bones[f"middle01_{s}"].head) - (W @ hb.head)).normalized()
                c = 1 - d.dot(fdir.normalized())
                if c < best[0]: best = (c, (x, y, z))
    hb.rotation_euler = tuple(math.radians(v) for v in best[1]); vl.update()

def solve():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = END
    arm = bpy.data.objects["RIG"]; rb = arm.data.bones
    C = setup_ik(arm)
    for s in ("L", "R"):
        fe = bpy.data.objects.new(f"footrot_{s}", None); bpy.context.collection.objects.link(fe)
        fe.matrix_world = arm.matrix_world @ rb[f"foot_{s}"].matrix_local
        cr = arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION"); cr.target = fe
    chest = rb["spine03"].head_local.z; waist = rb["spine01"].head_local.z; headz = rb["head"].tail_local.z
    fz = rb["foot_L"].head_local.z; kz = rb["calf_L"].head_local.z
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.12)
    ball = bpy.context.object; ball.name = "Ball"; bpy.ops.object.shade_smooth()
    mb = bpy.data.materials.new("ball"); mb.use_nodes = True; nt = mb.node_tree
    pr = nt.nodes["Principled BSDF"]; pr.inputs["Base Color"].default_value = (0.55, 0.13, 0.025, 1); pr.inputs["Roughness"].default_value = 0.65
    vz = nt.nodes.new("ShaderNodeTexVoronoi"); vz.inputs["Scale"].default_value = 260
    bpn = nt.nodes.new("ShaderNodeBump"); bpn.inputs["Strength"].default_value = 0.35; bpn.invert = True
    nt.links.new(vz.outputs["Distance"], bpn.inputs["Height"]); nt.links.new(bpn.outputs["Normal"], pr.inputs["Normal"])
    ball.data.materials.append(mb)
    ms = bpy.data.materials.new("seam"); ms.use_nodes = True; ms.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
    for rot in ((0, 0, 0), (math.pi / 2, 0, 0), (0, math.pi / 2, 0)):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1203, minor_radius=0.0025, rotation=rot)
        t = bpy.context.object; t.data.materials.append(ms); t.parent = ball

    pl = arm.pose.bones["pelvis"]; pl.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update(); pl_rest = pl.matrix.copy()
    HAND_BONES = [f"hand_{s}" for s in "LR"] + [f"{f}0{k}_{s}" for s in "LR" for f in ("index", "middle", "ring", "pinky") for k in (1, 2, 3)] + \
                 [f"thumb0{k}_{s}" for s in "LR" for k in (1, 2, 3)]
    # key poses: frame, pelvis offset, feet z, lean, ball pos (None = released), hands, elbows, grip dirs, head tilt
    R_ = -1  # right hand side (x<0)
    K = [
        dict(f=1,  pel=(0, 0, -0.03), fz=0, lean=4, head=0, ball=(0.0, -0.30, chest - 0.05),
             hL=(0.14, 0.05, -0.06), hR=(-0.14, 0.05, -0.06), eL=(0.28, 0.30, waist - 0.10), eR=(-0.28, 0.30, waist - 0.10),
             gL=(0, -0.45, 1), gR=(0, -0.45, 1)),
        dict(f=18, pel=(0, 0, -0.04), fz=0, lean=5, head=0, ball=(0.0, -0.30, chest - 0.07),
             hL=(0.14, 0.05, -0.06), hR=(-0.14, 0.05, -0.06), eL=(0.28, 0.30, waist - 0.10), eR=(-0.28, 0.30, waist - 0.10),
             gL=(0, -0.45, 1), gR=(0, -0.45, 1)),
        dict(f=30, pel=(0, 0.02, -0.15), fz=0, lean=14, head=-6, ball=(-0.02, -0.34, waist - 0.02),
             hL=(0.135, 0.04, -0.03), hR=(-0.12, 0.09, -0.06), eL=(0.32, 0.25, waist - 0.25), eR=(-0.32, 0.25, waist - 0.25),
             gL=(0, -0.3, 1), gR=(0, 0.2, 1)),
        dict(f=42, pel=(0, 0, -0.02), fz=0, lean=2, head=-4, ball=(-0.08, -0.22, headz + 0.02),
             hL=(0.125, 0.03, -0.02), hR=(0.0, 0.07, -0.11), eL=(0.45, 0.0, chest), eR=(-0.25, -0.6, chest - 0.1),
             gL=(0, -0.2, 1), gR=(0, -0.15, 1)),
        dict(f=50, pel=(0, -0.03, 0.28), fz=0.25, lean=-2, head=-10, ball=(-0.08, -0.36, headz + 0.58),
             hL=(0.125, 0.05, -0.04), hR=(0.0, 0.08, -0.12), eL=(0.5, 0.1, headz), eR=(-0.3, -0.7, headz),
             gL=(0, -0.2, 1), gR=(0, -0.3, 1)),
        dict(f=58, pel=(0, -0.03, 0.26), fz=0.24, lean=-2, head=-10, ball=None,
             hL=(0.30, -0.25, headz + 0.05), hR=(-0.08, -0.50, headz + 0.48), eL=(0.6, 0.2, chest), eR=(-0.3, -0.7, headz),
             fR=(0, -0.65, -0.75), fL=(0.3, -0.5, 0.4)),
        dict(f=70, pel=(0, -0.02, -0.08), fz=0, lean=6, head=-6, ball=None,
             hL=(0.30, -0.15, chest - 0.15), hR=(-0.08, -0.50, headz + 0.25), eL=(0.6, 0.3, waist), eR=(-0.3, -0.7, chest),
             fR=(0, -0.65, -0.75), fL=(0, -0.3, 0.6)),
        dict(f=120, pel=(0, -0.01, -0.03), fz=0, lean=3, head=-6, ball=None,
             hL=(0.30, -0.10, chest - 0.30), hR=(-0.08, -0.50, headz + 0.22), eL=(0.6, 0.3, waist), eR=(-0.3, -0.7, chest),
             fR=(0, -0.65, -0.75), fL=(0, -0.3, 0.6)),
    ]
    vl = bpy.context.view_layer
    release = None
    for k in K:
        f = k["f"]; sc.frame_set(f)
        for pb in arm.pose.bones:
            if pb.name in HAND_BONES or pb.name in ("spine01", "spine02", "head", "neck"):
                pb.rotation_mode = "XYZ"; pb.rotation_euler = (0, 0, 0)
        pl.matrix = Matrix.Translation(k["pel"]) @ pl_rest; vl.update()
        for s, sg in (("L", 1), ("R", -1)):
            C[f"foot_{s}"].location = (0.14 * sg, -0.03 if s == "L" else 0.04, fz + k["fz"])
            C[f"knee_{s}"].location = (0.40 * sg, -0.8, kz + k["fz"])
        arm.pose.bones["spine01"].rotation_euler = (math.radians(k["lean"] * 0.6), 0, 0)
        arm.pose.bones["spine02"].rotation_euler = (math.radians(k["lean"] * 0.4), 0, 0)
        arm.pose.bones["head"].rotation_euler = (math.radians(k["head"]), 0, 0)
        if k["ball"] is not None:
            bc = Vector(k["ball"]); ball.location = bc
            C["hand_L"].location = bc + Vector(k["hL"]); C["hand_R"].location = bc + Vector(k["hR"])
        else:
            C["hand_L"].location = Vector(k["hL"]); C["hand_R"].location = Vector(k["hR"])
        C["elbow_L"].location = k["eL"]; C["elbow_R"].location = k["eR"]
        vl.update()
        if k["ball"] is not None:
            grip(arm, "L", bc, 0.12, fdir=Vector(k["gL"])); grip(arm, "R", bc, 0.12, fdir=Vector(k["gR"]))
            ball.keyframe_insert("location", frame=f); release = (f, bc.copy())
        else:
            orient_hand(arm, "R", Vector(k["fR"])); orient_hand(arm, "L", Vector(k["fL"]))
            for n in HAND_BONES:
                if n.startswith(("index", "middle", "ring", "pinky")):
                    pb = arm.pose.bones[n]; pb.rotation_euler = (-math.radians(14 if n.endswith("_R") else 22), 0, 0)
        # keyframe everything
        pl.keyframe_insert("location", frame=f); pl.keyframe_insert("rotation_quaternion", frame=f)
        for n in HAND_BONES + ["spine01", "spine02", "head"]:
            arm.pose.bones[n].keyframe_insert("rotation_euler", frame=f)
        for e in C.values(): e.keyframe_insert("location", frame=f)
        print("key", f, flush=True)
    # ball flight after release
    rf, p0 = release
    v = Vector((0.0, -2.2, 4.6)); g = 9.81
    for f in range(rf + 1, END + 1):
        t = (f - rf) / FPS
        ball.location = p0 + v * t + Vector((0, 0, -0.5 * g * t * t)); ball.keyframe_insert("location", frame=f)
        ball.rotation_euler = (-t * 14, 0, 0); ball.keyframe_insert("rotation_euler", frame=f)
    if ball.animation_data:
        for fc in ball.animation_data.action.fcurves if hasattr(ball.animation_data.action, "fcurves") else []:
            for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
    build_scene(sc)
    bpy.ops.wm.save_as_mainfile(filepath=OUT); print("saved", OUT)

def build_scene(sc):
    sc.render.engine = "CYCLES"; sc.cycles.use_denoising = True
    sc.render.resolution_x = 720; sc.render.resolution_y = 1280
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.28, 0.80, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    def area(loc, tgt, e, s=3, c=(1, 1, 1)):
        L = bpy.data.lights.new("a", "AREA"); L.energy = e; L.size = s; L.color = c
        o = bpy.data.objects.new("a", L); o.location = loc
        o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(o)
    area((2.0, -3.0, 3.0), (0, 0, 1.4), 700, 3, (1, .96, .92)); area((-2.6, -1.8, 2.0), (0, 0, 1.3), 250, 3, (.85, .92, 1))
    area((0.4, 2.6, 3.0), (0, 0, 1.6), 450, 2.5)
    # cyclorama floor+wall
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); fl = bpy.context.object
    mf = bpy.data.materials.new("floor"); mf.use_nodes = True
    mf.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.22, 0.75, 1)
    mf.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
    fl.data.materials.append(mf)
    cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (2.0, -2.6, 1.35); cd.lens = 30
    cam.rotation_euler = (Vector((0, -0.25, 1.55)) - cam.location).to_track_quat("-Z", "Y").to_euler()

def render(a, b, hq=False):
    bpy.ops.wm.open_mainfile(filepath=OUT)
    sc = bpy.context.scene
    od = os.path.join(D, "shot_hq" if hq else "shot_frames"); os.makedirs(od, exist_ok=True)
    sc.cycles.samples = 64 if hq else 10
    if not hq:
        sc.render.resolution_percentage = 100
    for f in range(a, b + 1):
        fn = os.path.join(od, f"f{f:04d}.png")
        if os.path.exists(fn): continue
        sc.frame_set(f); sc.render.filepath = fn; bpy.ops.render.render(write_still=True)
        print("frame", f, flush=True)

if __name__ == "__main__":
    if sys.argv[1] == "solve": solve()
    else: render(int(sys.argv[2]), int(sys.argv[3]), len(sys.argv) > 4)
