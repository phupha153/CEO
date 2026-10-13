"""IK posing helpers for the MB-Lab character + a relaxed 'holding ball' stance still."""
import bpy, math, sys, os
from mathutils import Vector, Quaternion, Matrix

def setup_ik(arm):
    """Add IK targets/poles for arms and legs; returns dict of control empties."""
    C = {}
    def empty(name, loc):
        e = bpy.data.objects.new(name, None); e.empty_display_size = 0.05
        bpy.context.collection.objects.link(e); e.location = loc; return e
    rb = arm.data.bones
    for s, sg in (("L", 1), ("R", -1)):
        hand = empty(f"ik_hand_{s}", arm.matrix_world @ rb[f"hand_{s}"].head_local)
        elbow = empty(f"pole_elbow_{s}", arm.matrix_world @ (rb[f"lowerarm_{s}"].head_local + Vector((0.15 * sg, 0.35, -0.1))))
        c = arm.pose.bones[f"lowerarm_{s}"].constraints.new("IK")
        c.target = hand; c.pole_target = elbow; c.chain_count = 2; c.pole_angle = math.radians(-90 if s == "L" else -90)
        foot = empty(f"ik_foot_{s}", arm.matrix_world @ rb[f"foot_{s}"].head_local)
        knee = empty(f"pole_knee_{s}", arm.matrix_world @ (rb[f"calf_{s}"].head_local + Vector((0.05 * sg, -0.6, 0))))
        c = arm.pose.bones[f"calf_{s}"].constraints.new("IK")
        c.target = foot; c.pole_target = knee; c.chain_count = 2; c.pole_angle = math.radians(-90)
        C.update({f"hand_{s}": hand, f"elbow_{s}": elbow, f"foot_{s}": foot, f"knee_{s}": knee})
    # calibrate pole angles so the rest pose is reproduced with no twist
    bpy.context.view_layer.update()
    for s in ("L", "R"):
        for low, up in ((f"lowerarm_{s}", f"upperarm_{s}"), (f"calf_{s}", f"thigh_{s}")):
            c = arm.pose.bones[low].constraints[-1]
            best = None
            for d in range(-180, 180, 5):
                c.pole_angle = math.radians(d); bpy.context.view_layer.update()
                M = arm.pose.bones[up].matrix; R = arm.data.bones[up].matrix_local
                err = M.to_quaternion().rotation_difference(R.to_quaternion()).angle
                if best is None or err < best[0]: best = (err, d)
            c.pole_angle = math.radians(best[1])
            print("pole", low, best[1], round(math.degrees(best[0]), 1))
    return C

def _tip(arm, n):
    return arm.matrix_world @ arm.pose.bones[n].tail
def grip(arm, s, ball_c, R, palm_off=0.035, fdir=Vector((0, -0.3, 1))):
    """Rotate hand so fingertips wrap the ball; then curl each finger to touch it."""
    from mathutils import Euler
    vl = bpy.context.view_layer
    hb = arm.pose.bones[f"hand_{s}"]; hb.rotation_mode = "XYZ"
    tips = [f"{f}03_{s}" for f in ("index", "middle", "ring", "pinky")] + [f"thumb03_{s}"]
    roots = [f"{f}01_{s}" for f in ("index", "middle", "ring", "pinky")]
    def cost():
        c = 0
        for t in tips: c += abs((_tip(arm, t) - ball_c).length - R) * 1.0
        for r_ in roots: c += abs((arm.matrix_world @ arm.pose.bones[r_].head - ball_c).length - R - 0.012) * 2.0
        wr = arm.matrix_world @ hb.head; md = arm.matrix_world @ arm.pose.bones[f"middle01_{s}"].head
        c += (1 - (md - wr).normalized().dot(fdir.normalized())) * 0.25
        return c
    best = (1e9, None)
    rng = range(-75, 76, 15)
    for x in rng:
        for y in rng:
            for z in rng:
                hb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z)); vl.update()
                c = cost()
                if c < best[0]: best = (c, (x, y, z))
    bx, by, bz = best[1]
    for x in range(bx - 10, bx + 11, 5):
        for y in range(by - 10, by + 11, 5):
            for z in range(bz - 10, bz + 11, 5):
                hb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z)); vl.update()
                c = cost()
                if c < best[0]: best = (c, (x, y, z))
    hb.rotation_euler = tuple(math.radians(v) for v in best[1]); vl.update()
    # per-finger curl
    for f in ("index", "middle", "ring", "pinky", "thumb"):
        chain = [f"{f}0{k}_{s}" for k in ((2, 3) if f == "thumb" else (1, 2, 3))]
        tip = chain[-1]; bc = (1e9, 0)
        for d in range(-10, 75, 5):
            for n in chain:
                pb = arm.pose.bones[n]; pb.rotation_mode = "XYZ"; pb.rotation_euler = (math.radians(d), 0, 0)
            vl.update()
            dist = (_tip(arm, tip) - ball_c).length
            c = abs(dist - R - 0.004) + (0.05 if dist < R - 0.002 else 0)
            if c < bc[0]: bc = (c, d)
        for n in chain: arm.pose.bones[n].rotation_euler = (math.radians(bc[1]), 0, 0)
    vl.update()
    print("grip", s, best, round(cost(), 3))

def rot_bone(arm, name, axis, deg):
    pb = arm.pose.bones[name]; pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion(axis, math.radians(deg)) @ pb.rotation_quaternion

if __name__ == "__main__":
    bpy.ops.wm.open_mainfile(filepath=os.environ.get("MB_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "mb_human.blend")))
    sc = bpy.context.scene
    arm = bpy.data.objects["RIG"]
    C = setup_ik(arm)
    rb = arm.data.bones
    pelvis = rb["pelvis"].head_local
    # stance: feet shoulder width, slight knee bend, ball held at waist in front
    C["foot_L"].location = (0.17, -0.07, rb["foot_L"].head_local.z)
    C["foot_R"].location = (-0.16, 0.05, rb["foot_R"].head_local.z)
    ball_c = Vector((0.02, -0.34, rb["spine03"].head_local.z - 0.12))
    STAND = os.environ.get("POSE") == "stand"
    if STAND: ball_c = Vector((0, 3.0, -3.0))
    C["hand_L"].location = ball_c + Vector((0.135, 0.05, -0.085))
    C["hand_R"].location = ball_c + Vector((-0.135, 0.05, -0.085))
    if STAND:
        C["foot_L"].location = (0.13, -0.02, rb["foot_L"].head_local.z); C["foot_R"].location = (-0.13, -0.02, rb["foot_R"].head_local.z)
        hz = rb["thigh_L"].head_local.z - 0.05
        C["hand_L"].location = (0.31, -0.01, hz); C["hand_R"].location = (-0.31, -0.01, hz)
    for s, sg in (("L", 1), ("R", -1)):
        if STAND:
            C[f"elbow_{s}"].location = Vector((0.3 * sg, 0.5, rb["spine01"].head_local.z + 0.05)); C[f"knee_{s}"].location = Vector((0.15 * sg, -0.8, rb["calf_L"].head_local.z)); continue
        C[f"elbow_{s}"].location = Vector((0.40 * sg, 0.35, rb["spine01"].head_local.z - 0.19))
        C[f"knee_{s}"].location = Vector((0.40 * sg, -0.8, rb["calf_L"].head_local.z))
    pl = arm.pose.bones["pelvis"]; pl.rotation_mode = "QUATERNION"
    pl.matrix = Matrix.Translation((0, 0.01, -0.03)) @ pl.matrix
    if STAND: pl.matrix = Matrix.Translation((0, -0.01, 0.03)) @ pl.matrix
    else: rot_bone(arm, "spine01", (1, 0, 0), 6); rot_bone(arm, "spine02", (1, 0, 0), 3)
    if os.environ.get("POSE") != "stand": rot_bone(arm, "head", (1, 0, 0), -4)
    # keep feet flat on the floor regardless of IK leg rotation
    for s in ("L", "R"):
        fe = bpy.data.objects.new(f"footrot_{s}", None); bpy.context.collection.objects.link(fe)
        fe.matrix_world = arm.matrix_world @ arm.data.bones[f"foot_{s}"].matrix_local
        cr = arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION"); cr.target = fe
    bpy.context.view_layer.update()
    if not STAND: grip(arm, "L", ball_c, 0.12); grip(arm, "R", ball_c, 0.12)
    else:
        for pb in arm.pose.bones:
            if pb.name[:-2] in [f"{f}0{k}" for f in ("index", "middle", "ring", "pinky") for k in (1, 2, 3)]:
                pb.rotation_mode = "XYZ"; pb.rotation_euler = (math.radians(14), 0, 0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.12, location=ball_c)
    ball = bpy.context.object; bpy.ops.object.shade_smooth()
    mb = bpy.data.materials.new("ball"); mb.use_nodes = True
    mb.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.13, 0.025, 1)
    mb.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.65
    nt_ = mb.node_tree; vz = nt_.nodes.new("ShaderNodeTexVoronoi"); vz.inputs["Scale"].default_value = 260
    bpn = nt_.nodes.new("ShaderNodeBump"); bpn.inputs["Strength"].default_value = 0.35; bpn.invert = True
    nt_.links.new(vz.outputs["Distance"], bpn.inputs["Height"]); nt_.links.new(bpn.outputs["Normal"], nt_.nodes["Principled BSDF"].inputs["Normal"])
    ball.data.materials.append(mb)
    for rot in ((0, 0, 0), (math.pi / 2, 0, 0), (0, math.pi / 2, 0)):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1205, minor_radius=0.004, rotation=rot, location=ball_c)
        t = bpy.context.object; ms = bpy.data.materials.get("seam") or bpy.data.materials.new("seam")
        ms.use_nodes = True; ms.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
        t.data.materials.append(ms)
    bpy.context.view_layer.update()
    if os.environ.get("HIDE"):
        for n_ in os.environ["HIDE"].split(","): bpy.data.objects[n_].hide_render = True
    sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.use_denoising = True
    sc.render.resolution_x = 540; sc.render.resolution_y = 810; sc.render.use_persistent_data=True; sc.cycles.tile_size=512
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.28, 0.80, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    def area(loc, tgt, e, s=3, c=(1, 1, 1)):
        L = bpy.data.lights.new("a", "AREA"); L.energy = e; L.size = s; L.color = c
        o = bpy.data.objects.new("a", L); o.location = loc
        o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(o)
    area((1.6, -2.6, 2.4), (0, 0, 1.3), 380, 2.5, (1, .96, .92)); area((-2.2, -1.6, 1.5), (0, 0, 1.2), 90, 3, (.85, .92, 1))
    area((0.3, 2.2, 2.6), (0, 0, 1.5), 220, 2)
    bpy.ops.mesh.primitive_plane_add(size=20); fl = bpy.context.object
    mf = bpy.data.materials.new("floor"); mf.use_nodes = True
    mf.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.22, 0.75, 1)
    fl.data.materials.append(mf)
    cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
    for name, loc, tgt, lens in [x for x in (("full", (0.7, -4.6, 1.0), (0, 0, 0.95), 45), ("face", (0.35, -1.0, 1.62), (0, 0, 1.6), 62), ("hip", (0.3, -1.6, 0.85), (0, 0, 0.85), 50), ("feet", (0.5, -1.2, 0.35), (0, -0.05, 0.08), 45), ("front", (0.0, -1.05, 1.68), (0, 0, 1.66), 70)) if x[0] in sys.argv[-1].split(",")]:
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); cd.lens = lens
        sc.render.filepath = f"/tmp/pose_{name}.png"; bpy.ops.render.render(write_still=True)
