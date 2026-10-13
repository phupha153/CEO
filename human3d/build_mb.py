"""Build a realistic rigged Asian male from MB-Lab data -> mb_human.blend
Skeleton: MBLab_skeleton_base_fk, fitted from joint json; weights from vgroups json;
skin textures from MB-Lab; short particle hair on MB-Lab scalp vertices; basketball kit."""
import bpy, json, math, collections, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector, Matrix

MB = "/tmp/mblab/data"
OUT = os.environ.get("MB_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "mb_human.blend"))
CH = "m_as01"

bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(f"{MB}/humanoid_library.blend") as (src, dst):
    dst.objects = ["MBLab_human_male", "MBLab_skeleton_base_fk"]
for o in dst.objects: bpy.context.collection.objects.link(o)
body = bpy.data.objects["MBLab_human_male"]; arm = bpy.data.objects["MBLab_skeleton_base_fk"]
body.name = "Body"; arm.name = "RIG"
for o in (body, arm):
    o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0); o.scale = (1, 1, 1)

# --- character shape ---
verts = json.load(open(f"{MB}/vertices/{CH}_verts.json"))
for v, co in zip(body.data.vertices, verts): v.co = co
# --- athletic physique via MB-Lab body morphs (mass/tone corners + size sliders) ---
MASS, TONE = float(os.environ.get("MB_MASS", 0.75)), float(os.environ.get("MB_TONE", 1.0))
SLIDERS = {"Torso_Vshape": 0.9, "Shoulders_SizeX": 1.0, "Shoulders_Size": 0.6, "Chest_Girth": 0.82, "Chest_SizeY": 0.65, "Chest_SizeX": 0.75, "Arms_UpperarmSize": 0.75, "Legs_KneeSize": 0.25, "Legs_KneeProminence": 0.3, "Torso_Length": 0.25,
           "Neck_TrapeziousSize": 0.3, "Shoulders_PosZ": 0.0, "Neck_Length": 0.85, "Neck_Size": 0.66, "Arms_UpperarmGirth": 0.7, "Arms_ForearmSize": 0.45,
           "Waist_Size": 0.2, "Legs_CalfGirth": 0.8, "Legs_UpperThighGirth": 0.62, "Legs_LowerThighGirth": 0.62, "Head_Size": 0.7,
           "Legs_UpperlegLength": 0.8, "Legs_LowerlegLength": 0.78, "Arms_UpperarmLength": 0.82, "Arms_ForearmLength": 0.78,
           "Torso_Dorsi": 0.75, "Pelvis_GluteusSize": 0.55}
MORPHS = json.load(open(f"{MB}/morphs/human_male_morphs.json"))
def axis_w(side, v): return max(0.0, (v - 0.5) * 2) if side == "max" else max(0.0, (0.5 - v) * 2)
delta = collections.defaultdict(lambda: Vector((0, 0, 0)))
def addm(name, w):
    if w <= 1e-4 or name not in MORPHS: return
    for i, dx, dy, dz in MORPHS[name]: delta[i] += Vector((dx, dy, dz)) * w
for k in MORPHS:
    base, _, sides = k.rpartition("_")
    if "-" in sides:                                    # combined e.g. Torso_Mass-Tone_max-min
        axes = base.split("_", 1)[1].split("-"); w = 1.0
        for ax, sd in zip(axes, sides.split("-")):
            REG = {"Abdomen": 0.35, "Torso": 0.5, "Pelvis": 0.45, "Legs": 0.7, "Neck": 0.55, "Arms": 0.62, "Hands": 0.45}
            mreg = next((v_ for k_, v_ in REG.items() if k.startswith(k_)), MASS)
            v = mreg if ("Mass" in ax and "Breast" not in ax) else TONE if "Tone" in ax else 0.5
            w *= axis_w(sd, v)
        addm(k, w)
for nm, v in SLIDERS.items():
    addm(f"{nm}_max", axis_w("max", v)); addm(f"{nm}_min", axis_w("min", v))
for i, d in delta.items(): verts[i] = [verts[i][0] + d.x, verts[i][1] + d.y, verts[i][2] + d.z]
for v, co in zip(body.data.vertices, verts): v.co = co
body.data.update()
VC = [Vector(c) for c in verts]

# --- fit skeleton ---
joints = json.load(open(f"{MB}/joints/human_male_joints.json"))
offs = json.load(open(f"{MB}/joints/human_male_joints_offset.json"))
def jpos(key):
    idx = joints[key]; p = sum((VC[i] for i in idx), Vector()) / len(idx)
    if key in offs: p = p + Vector(offs[key])
    return p
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for eb in arm.data.edit_bones:
    h, t = f"{eb.name}_head", f"{eb.name}_tail"
    if h in joints: eb.head = jpos(h)
    if t in joints: eb.tail = jpos(t)
bpy.ops.object.mode_set(mode="OBJECT")

# --- weights ---
vg = json.load(open(f"{MB}/vgroups/human_male_vgroups_base.json"))
for name, lst in vg.items():
    g = body.vertex_groups.new(name=name)
    for i, w in lst: g.add([i], w, "REPLACE")
body.parent = arm
md = body.modifiers.new("arm", "ARMATURE"); md.object = arm
sub = body.modifiers.new("sub", "SUBSURF"); sub.levels = 0; sub.render_levels = 1

# --- skin textures ---
def img(fn, noncolor=False):
    im = bpy.data.images.load(f"{MB}/textures/{fn}", check_existing=True)
    if noncolor: im.colorspace_settings.name = "Non-Color"
    return im
TEX = {"albedo": ("hum_m_asian_albedo.png", False), "bump": ("human_male_bump.png", True),
       "thickness": ("human_male_thickness.png", True), "melanin": ("human_male_melanin.png", True),
       "blush": ("human_male_blush.png", True), "sebum": ("human_male_sebum.png", True),
       "lipmap": ("human_male_lipmap.png", True), "disp": ("human_male_displacement.png", True),
       "frecklemask": ("human_male_frecklemask.png", True)}
for m in body.data.materials:
    if not m or not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type != "TEX_IMAGE": continue
        for k, (fn, nc) in TEX.items():
            if n.name.endswith("skn_" + k) or n.name.endswith("_skn_" + k):
                n.image = img(fn, nc)
        if "eyelash" in n.name.lower(): n.image = img("human_male_eyelash.png")
        if "teeth" in n.name.lower(): n.image = img("human_male_teeth.png")
        if "nails" in n.name.lower(): n.image = img("human_male_nails.png")
        if n.name.lower().endswith("eyes_albedo") or ("eye" in n.name.lower() and "albedo" in n.name.lower()):
            n.image = img("eyes_albedo.png")

# --- hair: buzz-cut painted into skin shader via a geometric scalp mask ---
dom0 = {}; best0 = collections.defaultdict(float)
for name, lst in vg.items():
    for i, w in lst:
        if w > best0[i]: best0[i] = w; dom0[i] = name
eye_slots = [i for i, sl in enumerate(body.material_slots) if sl.material and sl.material.name == "MBlab_human_eyes"]
ev = {vi for p in body.data.polygons if p.material_index in eye_slots for vi in p.vertices}
eye_z = sum(VC[i].z for i in ev) / len(ev); eye_y = sum(VC[i].y for i in ev) / len(ev)
print("eye", eye_z, eye_y)
attr = body.data.color_attributes.new("hairmask", "FLOAT_COLOR", "POINT")
for v in body.data.vertices:
    p = v.co; m = 0.0
    if dom0.get(v.index) in ("head", "neck") and v.index not in ev:
        dy = p.y - eye_y; dz = p.z - eye_z
        if dz > 0.062 - 0.25 * max(0, dy - 0.02): m = 1.0          # top, hairline slopes down toward back
        if dy > 0.075 and dz > -0.075: m = 1.0                       # back of head down to nape
        if dy > 0.045 and abs(p.x) > 0.06 and dz > -0.01 and dz < 0.2: m = 1.0  # above/behind ears
        if dy > 0.0 and abs(p.x) > 0.064 and dz > 0.0 and dz < 0.2: m = 1.0  # temples / side fade
        if abs(p.x) > 0.073 and dy < 0.075 and dy > 0.03 and dz < 0.03: m = 0.0  # keep ears clear
    attr.data[v.index].color = (m, m, m, 1)
# --- real short hair: generated curve strands (textured crop + fade), rigid on head bone ---
import random
random.seed(7)
def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
mask = [attr.data[i].color[0] for i in range(len(body.data.vertices))]
_ec = collections.Counter()
for p_ in body.data.polygons:
    if all(mask[i] > 0.5 for i in p_.vertices):
        vv = list(p_.vertices)
        for k in range(len(vv)): _ec[tuple(sorted((vv[k], vv[(k + 1) % len(vv)])))] += 1
_bv = sorted({i for e, c in _ec.items() if c == 1 for i in e})
import mathutils
_kd = mathutils.kdtree.KDTree(len(_bv))
for k, i in enumerate(_bv): _kd.insert(VC[i], k)
_kd.balance()
cap_p = [p for p in body.data.polygons if all(mask[i] > 0.5 for i in p.vertices)]
areas = [p.area for p in cap_p]; tot = sum(areas)
NS = 90000
hc = bpy.data.hair_curves.new("Hair")
SEG = 7
pos = []; rad = []
fwd_dir = Vector((0, -1, 0))
for _ in range(NS):
    p = random.choices(cap_p, weights=areas)[0]
    vs = [VC[i] for i in p.vertices]
    w = [random.random() for _ in vs]; sw = sum(w)
    root = sum((v * (wi / sw) for v, wi in zip(vs, w)), Vector())
    n = p.normal.copy()
    dz = root.z - eye_z; dy = root.y - eye_y
    edge = min(1.0, _kd.find(root)[2] / 0.022)          # 0 at hairline -> 1 inside
    if random.random() > 0.5 + 0.5 * edge: continue
    top = max(0.0, min(1.0, (dz - 0.05) / 0.07))          # 0 at sides -> 1 on crown
    L = (0.006 + 0.046 * top ** 1.2) * (0.7 + 0.3 * edge) + random.uniform(-0.004, 0.006) * (0.3 + top)
    # comb: crown -> forward & slightly up (textured crop); sides -> down/back flat
    fb_ = ss(0.0, 0.11, dy)
    if top > 0.35:
        comb = Vector((random.uniform(-.3, .3), -1.0, -0.15)).lerp(Vector((random.uniform(-.3, .3), 0.6, -0.6)), fb_)
        if comb.length < 0.3: comb = Vector((random.uniform(-1, 1), random.uniform(-1, 1), 0))
    else: comb = Vector((0, 0.45, -1))
    crown = 1 - abs(fb_ - 0.5) * 2
    t = comb - n * comb.dot(n); t.normalize()
    lift0 = 0.15 + 0.45 * top + 0.25 * crown * top; lift1 = -0.10 + 0.10 * top
    x = root - n * 0.001; d = None
    pts = [x.copy()]
    for k in range(1, SEG):
        s_ = k / (SEG - 1); lift = lift0 + (lift1 - lift0) * s_
        d = (n * lift + t * (1 - lift)).normalized()
        d += Vector((random.gauss(0, .12), random.gauss(0, .12), random.gauss(0, .12)))
        x = x + d.normalized() * (L / (SEG - 1)); pts.append(x.copy())
    pos += pts
    rad += [0.00046 * (0.6 + 0.4 * edge) * (1 - 0.85 * (k / (SEG - 1))) for k in range(SEG)]
hc.add_curves([SEG] * (len(pos) // SEG))
# soften painted scalp: shrink mask away from hairline then blur
nb = collections.defaultdict(set)
for e in body.data.edges:
    a_, b_ = e.vertices; nb[a_].add(b_); nb[b_].add(a_)
sm_ = [m_ if i not in set(_bv) else 0.3 for i, m_ in enumerate(mask)]
for _ in range(4):
    sm_ = [(sm_[i] * 2 + sum(sm_[j] for j in nb[i])) / (2 + len(nb[i])) if nb[i] else sm_[i] for i in range(len(sm_))]
for i, v_ in enumerate(sm_):
    v2 = min(1.0, v_ * 1.15); attr.data[i].color = (v2, v2, v2, 1)
flat = [c for v in pos for c in v]
hc.attributes["position"].data.foreach_set("vector", flat)
ra = hc.attributes.get("radius") or hc.attributes.new("radius", "FLOAT", "POINT")
ra.data.foreach_set("value", rad)
hair = bpy.data.objects.new("Hair", hc); bpy.context.collection.objects.link(hair)
hb = arm.data.bones["head"]
hair.parent = arm; hair.parent_type = "BONE"; hair.parent_bone = "head"
hair.matrix_parent_inverse = (arm.matrix_world @ hb.matrix_local @ Matrix.Translation((0, hb.length, 0))).inverted()
hm2 = bpy.data.materials.new("hair_strands"); hm2.use_nodes = True; nt2 = hm2.node_tree
for n_ in list(nt2.nodes):
    if n_.type != "OUTPUT_MATERIAL": nt2.nodes.remove(n_)
hbs = nt2.nodes.new("ShaderNodeBsdfHairPrincipled")
try: hbs.parametrization = "MELANIN"
except Exception: pass
for k, v in (("Melanin", 0.97), ("Melanin Redness", 0.25), ("Roughness", 0.32), ("Radial Roughness", 0.45), ("Random Roughness", 0.25), ("Random Color", 0.1)):
    if k in hbs.inputs: hbs.inputs[k].default_value = v
nt2.links.new(hbs.outputs[0], nt2.nodes["Material Output"].inputs["Surface"])
hc.materials.append(hm2)
# move modifiers so armature applies before subsurf & hair follows
bpy.context.view_layer.objects.active = body

# --- basketball kit: jersey + shorts from body faces (offset shell) ---
dom = {}; best = collections.defaultdict(float)
for name, lst in vg.items():
    for i, w in lst:
        if w > best[i]: best[i] = w; dom[i] = name
faces = [list(p.vertices) for p in body.data.polygons]
def cen(f): return sum((VC[i] for i in f), Vector()) / len(f)
def fdom(f): return collections.Counter(dom.get(i, "") for i in f).most_common(1)[0][0]
bpy.ops.object.mode_set(mode="EDIT") if False else None
rb = arm.data.bones
knee_z = rb["calf_L"].head_local.z; waist_z = rb["spine01"].head_local.z + 0.02
neck_z = rb["neck"].head_local.z
TORSO = {"spine01", "spine02", "spine03", "pelvis", "clavicle_L", "clavicle_R"}
def mat(name, color, rough=0.8, sheen=0.5, trim=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1); p.inputs["Roughness"].default_value = rough
    p.inputs["Sheen Weight"].default_value = sheen
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 400
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.05
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"]); nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    if trim:
        at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "trim"
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.45; mr.inputs["From Max"].default_value = 0.5
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
        mx.inputs[6].default_value = (*color, 1); mx.inputs[7].default_value = (0.85, 0.85, 0.83, 1)
        nt.links.new(at.outputs["Fac"], mr.inputs["Value"]); nt.links.new(mr.outputs[0], mx.inputs[0])
        nt.links.new(mx.outputs[2], p.inputs["Base Color"])
    return m
M_J = mat("jersey", (0.005, 0.005, 0.006), rough=0.8, sheen=0.02, trim=True); M_S = mat("shorts", (0.005, 0.005, 0.006), rough=0.65, sheen=0.02, trim=True)
for m_ in (M_J, M_S):
    nt_ = m_.node_tree; P_ = nt_.nodes["Principled BSDF"]
    P_.inputs["Specular IOR Level"].default_value = 0.12; P_.inputs["Roughness"].default_value = 0.9
    P_.inputs["Sheen Weight"].default_value = 0.12; P_.inputs["Sheen Roughness"].default_value = 0.6
    P_.inputs["Sheen Tint"].default_value = (0.35, 0.35, 0.4, 1)
    # athletic mesh weave: tiny dimples
    tc_ = nt_.nodes.new("ShaderNodeTexCoord"); vo_ = nt_.nodes.new("ShaderNodeTexVoronoi"); vo_.inputs["Scale"].default_value = 900
    bp_ = nt_.nodes.new("ShaderNodeBump"); bp_.inputs["Strength"].default_value = 0.25; bp_.inputs["Distance"].default_value = 0.0004
    nt_.links.new(tc_.outputs["Object"], vo_.inputs["Vector"]); nt_.links.new(vo_.outputs["Distance"], bp_.inputs["Height"])
    nt_.links.new(bp_.outputs["Normal"], P_.inputs["Normal"])
def shell(name, pred, offset, m):
    fl = [f for f in faces if pred(f)]
    used = sorted({i for f in fl for i in f}); remap = {o: n for n, o in enumerate(used)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(VC[i]) for i in used], [], [[remap[i] for i in f] for f in fl])
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    for gname, lst in vg.items():
        g = ob.vertex_groups.new(name=gname)
        for i, w in lst:
            if i in remap: g.add([remap[i]], w, "REPLACE")
    ob.parent = arm
    a = ob.modifiers.new("arm", "ARMATURE"); a.object = arm
    d = ob.modifiers.new("disp", "DISPLACE"); d.strength = offset; d.mid_level = 0
    s = ob.modifiers.new("sol", "SOLIDIFY"); s.thickness = 0.004; s.offset = 1
    sm = ob.modifiers.new("sm", "SMOOTH"); sm.factor = 0.5; sm.iterations = 3
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 1; sb.render_levels = 2
    ob.data.materials.append(m)
    return ob
import bmesh
def cut_garment(name, keep_planes, offset, m, thick=0.004, extra_scale=None):
    """copy body (with weights), remove eyes etc, bisect with planes (co, normal) keeping the +normal side."""
    me = body.data.copy(); me.name = name
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.modifiers.clear()
    for md0 in list(ob.modifiers): ob.modifiers.remove(md0)
    bm = bmesh.new(); bm.from_mesh(me)
    skin_idx = [i for i, sl in enumerate(body.material_slots) if sl.material and sl.material.name.startswith("MBLab_skin")]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in skin_idx], context="FACES")
    for co, no in keep_planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_inner=True)
    loose = [v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm, geom=loose, context="VERTS")
    # keep only big connected pieces (drop slivers/islands left by the cuts)
    seen = set(); comps = []
    for f0 in bm.faces:
        if f0 in seen: continue
        st = [f0]; comp = []; seen.add(f0)
        while st:
            f = st.pop(); comp.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in seen: seen.add(g); st.append(g)
        comps.append(comp)
    big = max(len(c) for c in comps)
    bmesh.ops.delete(bm, geom=[f for c in comps if len(c) < big * 0.2 for f in c], context="FACES")
    # trim attribute: 1 near open borders (collar / armholes / hems)
    bnd = [v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
    import mathutils
    kd = mathutils.kdtree.KDTree(len(bnd))
    for i, v in enumerate(bnd): kd.insert(v.co, i)
    kd.balance()
    trimv = [max(0.0, 1 - kd.find(v.co)[2] / 0.018) if bnd else 0 for v in bm.verts]
    bm.to_mesh(me); bm.free()
    for ca in list(me.color_attributes): me.color_attributes.remove(ca)
    for i in bnd:
        if snap: me.vertices[remap[i]].co = snap(VC[i], Vector(me.vertices[remap[i]].co))
        for lo, hi, zz in hems:
            if lo < VC[i].z < hi:
                d_ = disp(VC[i], NRM[i]); me.vertices[remap[i]].co.z = zz + (d_.z - VC[i].z)
    ta = me.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for i, t_ in enumerate(trimv): ta.data[i].color = (t_, t_, t_, 1)
    for p in me.polygons: p.use_smooth = True; p.material_index = 0
    me.materials.clear(); me.materials.append(m)
    if me.shape_keys: pass
    ob.parent = arm
    a_ = ob.modifiers.new("arm", "ARMATURE"); a_.object = arm
    d = ob.modifiers.new("disp", "DISPLACE"); d.strength = offset; d.mid_level = 0
    sm = ob.modifiers.new("sm", "CORRECTIVE_SMOOTH"); sm.factor = 0.8; sm.iterations = 6
    s_ = ob.modifiers.new("sol", "SOLIDIFY"); s_.thickness = thick; s_.offset = 1
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 1; sb.render_levels = 2
    return ob
# key landmarks
hipz = rb["thigh_L"].head_local.z
import mathutils, bmesh
skin_slots = {i for i, sl in enumerate(body.material_slots) if sl.material and (sl.material.name.startswith("MBLab_skin") or sl.material.name == "MBlab_generic")}
NRM = [v.normal.copy() for v in body.data.vertices]
def garment(name, face_pred, disp, m, thick=0.004, trim_w=0.018, attr_fn=None, hems=(), snap=None, subd=2, smooth_it=10, smooth_w=0, relax=0):
    sel = {p.index for p in body.data.polygons if p.material_index in skin_slots and face_pred(cen(list(p.vertices)), fdom(list(p.vertices)))}
    vs_ = {i for pi in sel for i in body.data.polygons[pi].vertices}
    grow = [p for p in body.data.polygons if p.material_index in skin_slots and any(i in vs_ for i in p.vertices)]
    fl = [list(p.vertices) for p in grow]
    used = sorted({i for f in fl for i in f}); remap = {o: n for n, o in enumerate(used)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(VC[i]) for i in used], [], [[remap[i] for i in f] for f in fl])
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    gnames = list(vg.keys())
    for gname in gnames:
        g = ob.vertex_groups.new(name=gname)
        for i, w in vg[gname]:
            if i in remap: g.add([remap[i]], w, "REPLACE")
    bm = bmesh.new(); bm.from_mesh(me)
    dl = bm.verts.layers.deform.verify()
    for _ in range(subd):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    def vdom(v):
        d = v[dl]
        return gnames[max(d.items(), key=lambda kv: kv[1])[0]] if len(d) else ""
    dels = []
    for f in bm.faces:
        c = f.calc_center_median()
        dm = collections.Counter(vdom(v) for v in f.verts).most_common(1)[0][0]
        if not face_pred(c, dm): dels.append(f)
    bmesh.ops.delete(bm, geom=dels, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    # largest components
    seen = set(); comps = []
    for f0 in bm.faces:
        if f0 in seen: continue
        st = [f0]; seen.add(f0); comp = []
        while st:
            f = st.pop(); comp.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in seen: seen.add(g); st.append(g)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    bmesh.ops.delete(bm, geom=[f for c in comps if len(c) < 0.2 * len(comps[0]) for f in c], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    # remove boundary spikes (verts with a single face) then smooth boundary loops
    for _ in range(2):
        bad = [f for f in bm.faces if sum(1 for e in f.edges if e.is_boundary) >= 2]
        bmesh.ops.delete(bm, geom=bad, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    rest = {v: v.co.copy() for v in bm.verts}
    nrm = {v: v.normal.copy() for v in bm.verts}
    for _ in range(smooth_it):
        newc = {}
        for v in bm.verts:
            be = [e for e in v.link_edges if e.is_boundary]
            if len(be) == 2:
                a_, b_ = (e.other_vert(v).co for e in be)
                newc[v] = v.co * 0.5 + (a_ + b_) * 0.25
        for v, c in newc.items(): v.co = c
    for v in bm.verts:
        if any(e.is_boundary for e in v.link_edges):
            for lo, hi, zz in hems:
                if lo < v.co.z < hi: v.co.z = zz
    bnd = [v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
    kd = mathutils.kdtree.KDTree(max(1, len(bnd)))
    for k, v in enumerate(bnd): kd.insert(v.co, k)
    kd.balance()
    trims = []
    for v in bm.verts:
        t_ = max(0.0, 1 - kd.find(v.co)[2] / trim_w) if bnd and trim_w > 0 else 0.0
        if attr_fn: t_ = attr_fn(rest[v], t_)
        trims.append(t_)
    for v in bm.verts:
        v.co = disp(v.co, nrm[v])
    if relax:
        inner = [v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)]
        bm.normal_update()
        before = {v: v.co.copy() for v in inner}
        for _ in range(relax):
            bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        for v in inner:                       # never let fabric sink below where it started (no shrink into body)
            d_ = v.co - before[v]
            if d_.dot(v.normal) < 0: v.co = v.co - v.normal * d_.dot(v.normal)
    bm.to_mesh(me); bm.free()
    ta = me.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for i, t_ in enumerate(trims): ta.data[i].color = (t_, t_, t_, 1)
    for p in me.polygons: p.use_smooth = True
    if smooth_w:
        nbr = collections.defaultdict(set)
        for e in me.edges:
            a2, b2 = e.vertices; nbr[a2].add(b2); nbr[b2].add(a2)
        nv = len(me.vertices)
        W = {g.name: [0.0] * nv for g in ob.vertex_groups}
        for v in me.vertices:
            for ge in v.groups: W[ob.vertex_groups[ge.group].name][v.index] = ge.weight
        live = [k for k, arr in W.items() if max(arr) > 0.001]
        for _ in range(smooth_w):
            for k in live:
                arr = W[k]
                W[k] = [(arr[i] + sum(arr[j] for j in nbr[i])) / (1 + len(nbr[i])) if nbr[i] else arr[i] for i in range(nv)]
        if name == "Jersey":      # torso panel must follow the spine only (arm weights cause bands when arms drop)
            for k in live:
                if k.startswith(("upperarm", "lowerarm", "clavicle", "breast")):
                    for i in range(nv):
                        W[k][i] *= ss(arm_z - 0.10, arm_z + 0.03, me.vertices[i].co.z)
        for i in range(nv):
            tot = sum(W[k][i] for k in live) or 1
            for k in live:
                w_ = W[k][i] / tot
                if w_ > 0.005: ob.vertex_groups[k].add([i], w_, "REPLACE")
                else: ob.vertex_groups[k].remove([i])
    ob.parent = arm
    a_ = ob.modifiers.new("arm", "ARMATURE"); a_.object = arm
    if name != "Shorts":
        sm = ob.modifiers.new("sm", "CORRECTIVE_SMOOTH"); sm.factor = 0.5; sm.iterations = 3
    s_ = ob.modifiers.new("sol", "SOLIDIFY"); s_.thickness = thick; s_.offset = 1
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 0; sb.render_levels = 1
    me.materials.append(m)
    return ob
def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
ARMB = ("upperarm", "lowerarm", "hand", "neck", "head", "thigh", "calf", "foot", "toes")
# ---- map garment design constants (authored on the 1.75 m base) onto the current body ----
_OLD = [0.0, 0.099, 0.507, 0.943, 1.041, 1.247, 1.407, 1.483, 1.747]
_NEW = [0.0, rb["foot_L"].head_local.z, rb["calf_L"].head_local.z, rb["thigh_L"].head_local.z, rb["spine01"].head_local.z,
        rb["spine03"].head_local.z, rb["upperarm_L"].head_local.z, rb["neck"].head_local.z, rb["head"].tail_local.z]
def _pl(z, A, B):
    if z <= A[0]: return B[0] + (z - A[0])
    for k in range(len(A) - 1):
        if z <= A[k + 1]: return B[k] + (z - A[k]) * (B[k + 1] - B[k]) / (A[k + 1] - A[k])
    return B[-1] + (z - A[-1])
def Zm(z): return _pl(z, _OLD, _NEW)       # old -> new
def Zi(z): return _pl(z, _NEW, _OLD)       # new -> old
XS = rb["upperarm_L"].head_local.x / 0.172
def to_old(c): return Vector((c.x / XS, c.y, Zi(c.z)))
print("landmarks", [round(v, 3) for v in _NEW], "XS", round(XS, 3))
def xa_f(z): return 0.108 + 0.10 * (1 - math.sqrt(ss(1.21, 1.415, z)))
def nl_f(x, y): return (1.365 + 1.35 * abs(x)) if y < 0 else 1.47 + 0.075 * (abs(x) / 0.075) ** 2
def jersey_pred(c, d):
    if any(d.startswith(k) for k in ARMB): return False
    if c.z < 0.94: return False
    ax = abs(c.x)
    xa = xa_f(c.z)      # armhole curve
    if ax > xa: return False
    nl = nl_f(c.x, c.y)  # neckline
    if c.z > nl: return False
    return True
def jersey_disp(p, n):
    o = 0.010 + 0.008 * (1 - ss(1.12, 1.30, p.z))                     # looser at belly
    q = p + n * o
    return q
def jersey_disp_new(p, n):
    po = to_old(p)
    o = 0.010 + 0.008 * (1 - ss(1.12, 1.30, po.z))
    q = p + n * o
    # hang straight from the chest: below the pecs, don't follow the waist inward
    if po.z < 1.27 and CH_R:
        ang = math.atan2(p.y - CH_C[1], p.x); k_ = int((ang + math.pi) / (2 * math.pi) * len(CH_R)) % len(CH_R)
        rr = math.hypot(q.x, q.y - CH_C[1]); tgt = CH_R[k_] * (0.985 - 0.06 * ss(1.27, 0.95, po.z))
        hang = ss(1.27, 1.12, po.z)
        if rr < tgt:
            f_ = (rr + (tgt - rr) * hang) / max(rr, 1e-6)
            q = Vector((q.x * f_, CH_C[1] + (q.y - CH_C[1]) * f_, q.z))
    return q
def jersey_snap(p0, q):
    if p0.z < 1.15: return q
    dxa = abs(abs(p0.x) - xa_f(p0.z)); dnl = abs(p0.z - nl_f(p0.x, p0.y))
    if dnl < dxa * 1.5 and abs(p0.x) < 0.13: q.z += nl_f(p0.x, p0.y) - p0.z
    else: q.x += math.copysign(xa_f(p0.z), p0.x) - p0.x
    return q
_cz = Zm(1.25)
_sl = [(VC[i].x, VC[i].y) for i in range(len(VC)) if abs(VC[i].z - _cz) < 0.012 and abs(VC[i].x) < 0.2 * XS and not dom.get(i, "").startswith(("upperarm", "lowerarm", "hand"))]
CH_C = (0.0, sum(q[1] for q in _sl) / len(_sl))
_N = 64; CH_R = [0.0] * _N
for x_, y_ in _sl:
    a_ = math.atan2(y_ - CH_C[1], x_); k_ = int((a_ + math.pi) / (2 * math.pi) * _N) % _N
    CH_R[k_] = max(CH_R[k_], math.hypot(x_, y_ - CH_C[1]) + 0.016)
for _ in range(3): CH_R = [max(CH_R[k], 0.5 * (CH_R[k - 1] + CH_R[(k + 1) % _N])) for k in range(_N)]
for _ in range(12): CH_R = [(CH_R[k - 1] + 2 * CH_R[k] + CH_R[(k + 1) % _N]) / 4 for k in range(_N)]
# ---------- cloth envelopes (straight, loose fabric like real kit) ----------
from envelope import Envelope
TORSO_B = ("spine", "pelvis", "clavicle", "breast", "neck")
crotch_z = min(VC[i].z for i in range(len(VC)) if abs(VC[i].x) < 0.012 and dom.get(i, "").startswith(("pelvis", "thigh")) and Zi(VC[i].z) > 0.6)
arm_z = rb["upperarm_L"].head_local.z - 0.07
print("crotch", round(crotch_z, 3), "armpit", round(arm_z, 3))
tor_pts = [tuple(VC[i]) for i in range(len(VC)) if dom.get(i, "").startswith(TORSO_B) and abs(VC[i].x) < 0.165 * XS]
def _cy(pts, z0=0.3, z1=1.7):
    zs = [z0 + 0.01 * k for k in range(int((z1 - z0) / 0.01) + 1)]
    raw = []
    for z in zs:
        sl = [p[1] for p in pts if abs(p[2] - z) < 0.015]
        raw.append((max(sl) + min(sl)) / 2 if sl else None)
    last = next(v for v in raw if v is not None)
    for i, v in enumerate(raw):
        if v is None: raw[i] = last
        else: last = v
    for _ in range(25): raw = [(raw[max(i-1,0)] + 2*raw[i] + raw[min(i+1,len(raw)-1)]) / 4 for i in range(len(raw))]
    def c(z):
        f = (z - z0) / 0.01; i = max(0, min(len(raw) - 2, int(f))); t = max(0.0, min(1.0, f - i))
        return (0.0, raw[i] * (1 - t) + raw[i + 1] * t)
    return c
ENV_T = Envelope(tor_pts, crotch_z - 0.02, arm_z + 0.12, _cy(tor_pts), hang_from=Zm(1.30), taper=-0.25, zsmooth=16)
def jersey_env_disp(p, n):
    q0 = jersey_disp(p, n)
    w = ss(arm_z + 0.02, arm_z - 0.06, p.z)          # 0 at armpit/straps -> 1 below
    if w <= 0: return q0
    x, y, z = ENV_T.project(p.x, p.y, max(p.z, Zm(0.915)), 0.022 + 0.03 * ss(1.06, 0.92, Zi(p.z)))
    return q0.lerp(Vector((x, y, z)), w)
pel_pts = [tuple(VC[i]) for i in range(len(VC)) if dom.get(i, "").startswith(("pelvis", "thigh", "spine01")) and abs(VC[i].x) < 0.26 * XS]
ENV_P = Envelope(pel_pts, crotch_z - 0.14, Zm(1.0), _cy(pel_pts), hang_from=Zm(0.93), taper=0.0)
ENV_L = {}
for sg, s in ((1, "L"), (-1, "R")):
    th = rb[f"thigh_{s}"]; A = th.head_local; B = th.tail_local
    lp = [tuple(VC[i]) for i in range(len(VC)) if dom.get(i, "").startswith(("thigh_" + s, "pelvis")) and VC[i].x * sg > 0.004 and VC[i].z < crotch_z + 0.03]
    def cen_(z, A=A, B=B):
        t = (z - A.z) / (B.z - A.z); return (A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t)
    ENV_L[sg] = Envelope(lp, Zm(0.5), crotch_z + 0.04, cen_, hang_from=crotch_z + 0.02, taper=0.0)
def shorts_env_disp(p, n):
    sg = 1 if p.x >= 0 else -1
    up = ENV_P.project(p.x, p.y, p.z, 0.026)
    lg = ENV_L[sg].project(p.x, p.y, p.z, 0.026)
    w = ss(crotch_z - 0.03, crotch_z - 0.10, p.z)    # front/back panel continues below body crotch (inseam)
    q = Vector(up).lerp(Vector(lg), w)
    if w > 0.5 and sg * q.x < 0.006: q.x = 0.006 * sg
    return q
garment("Jersey", lambda c, d: jersey_pred(to_old(c), d), jersey_env_disp, M_J, 0.004, 0.016, attr_fn=lambda p, t: t if Zi(p.z) > 1.15 else 0.0, hems=((Zm(0.7), Zm(1.05), Zm(0.915)),), relax=0, smooth_w=20)
def shorts_pred(c, d):
    if any(d.startswith(k) for k in ("spine02", "spine03", "upperarm", "lowerarm", "hand", "calf", "foot", "toes")): return False
    return 0.575 < c.z < 0.995
def shorts_disp(p, n):
    s_ = 1 if p.x >= 0 else -1
    th = rb["thigh_L" if s_ > 0 else "thigh_R"]
    A = th.head_local; B = th.tail_local; ax = (B - A).normalized()
    t = (p - A).dot(ax); foot_ = A + ax * t; r = p - foot_; rl = r.length
    radial = foot_ + r.normalized() * max(rl + 0.018, 0.112) if rl > 1e-6 else p
    if s_ * radial.x < 0.004: radial.x = 0.004 * s_
    w = 1 - ss(0.88, 0.99, Zi(p.z))
    q = (p + n * 0.016) * (1 - w) + radial * w
    # bridge the gap between the legs (fabric spans front & back instead of hugging the crotch)
    zo = Zi(p.z)
    if abs(q.x) < 0.12 * XS and 0.62 < zo < 0.99:
        R_ = 0.112 + 0.02
        yf = A.y - R_ * 0.92; yb = A.y + R_ * 0.92
        k = ss(0.12 * XS, 0.02, abs(q.x)) * ss(0.62, 0.70, zo)
        if q.y < A.y: q.y = q.y + (min(q.y, yf) - q.y) * k
        else: q.y = q.y + (max(q.y, yb) - q.y) * k * 0.8
    return q
def hull_ring(pts2, cx, cy, margin, N=48):
    bins = [0.0] * N
    for (x, y) in pts2:
        ang = math.atan2(y - cy, x - cx); k = int((ang + math.pi) / (2 * math.pi) * N) % N
        bins[k] = max(bins[k], math.hypot(x - cx, y - cy))
    for _ in range(3):   # fill empty bins & make convex-ish by max-smoothing
        bins = [max(bins[k], 0.5 * (bins[k - 1] + bins[(k + 1) % N])) for k in range(N)]
    for _ in range(4):
        bins = [(bins[k - 1] + 2 * bins[k] + bins[(k + 1) % N]) / 4 for k in range(N)]
    return [(cx + (bins[k] + margin) * math.cos(-math.pi + (k + 0.5) * 2 * math.pi / N),
             cy + (bins[k] + margin) * math.sin(-math.pi + (k + 0.5) * 2 * math.pi / N)) for k in range(N)]
def build_shorts():
    lower = [VC[i] for i in range(len(VC)) if dom.get(i, "").startswith(("pelvis", "thigh", "spine01")) and abs(VC[i].x) < 0.26]
    Z_TOP, Z_HEM, Z_CR = 0.995, 0.535, 0.79
    bm = bmesh.new()
    def tube(rings):
        vs = [[bm.verts.new((x, y, z)) for x, y in r] for z, r in rings]
        N = len(vs[0])
        for a_, b_ in zip(vs, vs[1:]):
            for k in range(N): bm.faces.new((a_[k], a_[(k + 1) % N], b_[(k + 1) % N], b_[k]))
        bm.faces.new(vs[0][::-1]); bm.faces.new(vs[-1])
    rings = []
    z = Z_TOP + 0.02
    while z > Z_CR - 0.05:
        sl = [(p.x, p.y) for p in lower if abs(p.z - z) < 0.012]
        cy = sum(q[1] for q in sl) / len(sl)
        rings.append((z, hull_ring(sl, 0.0, cy, 0.024)))
        z -= 0.02
    tube(rings)
    for sg in (1, -1):
        rings = []; z = Z_CR + 0.03
        while z > Z_HEM - 0.03:
            sl = [(p.x, p.y) for p in lower if abs(p.z - z) < 0.012 and p.x * sg > 0.0]
            cx = sum(q[0] for q in sl) / len(sl); cy = sum(q[1] for q in sl) / len(sl)
            fl_ = ss(Z_CR, Z_HEM, z)
            r_ = hull_ring(sl, cx, cy, 0.024 + 0.02 * fl_)
            # don't cross the midline
            r_ = [(x if x * sg > 0.006 else 0.006 * sg, y) for x, y in r_]
            rings.append((z, r_)); z -= 0.02
        tube(rings)
    me = bpy.data.meshes.new("Shorts"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("Shorts", me); bpy.context.collection.objects.link(ob)
    rm = ob.modifiers.new("rm", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.006
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    me2 = bpy.data.meshes.new_from_object(ev); ob.modifiers.clear(); ob.data = me2
    bm = bmesh.new(); bm.from_mesh(me2)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z > Z_TOP or f.calc_center_median().z < Z_HEM], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    for _ in range(6):
        bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for v in bm.verts:   # flatten hems
        if any(e.is_boundary for e in v.link_edges):
            v.co.z = Z_TOP if v.co.z > 0.8 else Z_HEM
    bm.to_mesh(me2); bm.free()
    # trim + weights from nearest body vert on same side
    bvs = [i for i in range(len(VC)) if dom.get(i, "").startswith(("pelvis", "thigh", "spine01"))]
    kds = {}
    for sg in (1, -1):
        ids = [i for i in bvs if VC[i].x * sg >= -0.01]
        kd = mathutils.kdtree.KDTree(len(ids))
        for k, i in enumerate(ids): kd.insert(VC[i], k)
        kd.balance(); kds[sg] = (kd, ids)
    groups = {g: ob.vertex_groups.new(name=g) for g in vg}
    wmap = collections.defaultdict(dict)
    for g, lst in vg.items():
        for i, w in lst: wmap[i][g] = w
    ta = me2.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for v in me2.vertices:
        sg = 1 if v.co.x >= 0 else -1
        kd, ids = kds[sg]
        acc = collections.defaultdict(float); tw = 0
        for co, k, dist in kd.find_n(v.co, 6):
            w_ = 1 / (dist + 1e-4); tw += w_
            for g, ww in wmap[ids[k]].items(): acc[g] += ww * w_
        for g, ww in acc.items():
            if ww / tw > 0.01: groups[g].add([v.index], ww / tw, "REPLACE")
        t_ = 1.0 if v.co.z < Z_HEM + 0.016 else (0.0)
        ta.data[v.index].color = (t_, t_, t_, 1)
    for p in me2.polygons: p.use_smooth = True
    ob.parent = arm
    a_ = ob.modifiers.new("arm", "ARMATURE"); a_.object = arm
    s_ = ob.modifiers.new("sol", "SOLIDIFY"); s_.thickness = 0.004; s_.offset = 1
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 0; sb.render_levels = 1
    me2.materials.append(M_S)
    return ob
def shorts_attr(p, t):
    sg = 1 if p.x >= 0 else -1
    th = rb["thigh_L" if sg > 0 else "thigh_R"]
    A = th.head_local; B = th.tail_local; ax = (B - A).normalized()
    foot_ = A + ax * (p - A).dot(ax); r = p - foot_
    ang = math.degrees(math.atan2(r.y, r.x * sg))          # 0 = straight outward
    stripe = 1.0 if (abs(ang + 6) < 13 and Zi(p.z) < 0.97) else 0.0
    return max(t if Zi(p.z) < 0.7 else 0.0, stripe)
def build_shorts2(margin=0.026, voxel=0.0045):
    Z_TOP, Z_HEM = Zm(0.95), rb['calf_L'].head_local.z + 0.045
    bm = bmesh.new(); NA = 96
    def ring(env, z, m, sg=0):
        cx, cy = env.center(z); r = []
        for a in range(NA):
            th = -math.pi + (a + 0.5) * 2 * math.pi / NA
            rr = env.radius(z, th) + m
            x, y = cx + rr * math.cos(th), cy + rr * math.sin(th)
            if sg and x * sg < 0.004: x = 0.004 * sg
            r.append((x, y))
        return r
    def tube(rings):
        vs = [[bm.verts.new((x, y, z)) for x, y in r] for z, r in rings]
        for a_, b_ in zip(vs, vs[1:]):
            for k in range(NA): bm.faces.new((a_[k], a_[(k + 1) % NA], b_[(k + 1) % NA], b_[k]))
        bm.faces.new(vs[0][::-1]); bm.faces.new(vs[-1])
    # tailored pattern: superellipse cross-sections, straight outer seam, inseam gap opening downward
    low = [VC[i] for i in range(len(VC)) if dom.get(i, "").startswith(("pelvis", "thigh", "spine01")) and abs(VC[i].x) < 0.26 * XS]
    def ext_raw(z, sg=0):
        sl = [p for p in low if abs(p.z - z) < 0.012 and (sg == 0 or p.x * sg > 0.0)]
        return (max(abs(p.x) for p in sl), min(p.y for p in sl), max(p.y for p in sl), min(abs(p.x) for p in sl))
    zs_all = []; z = Z_TOP + 0.03
    while z > Z_HEM - 0.03: zs_all.append(round(z, 3)); z -= 0.01
    TAB = {sg: [ext_raw(z, sg) for z in zs_all] for sg in (0, 1, -1)}
    for sg in TAB:                       # smooth tables along z (no lumps)
        for _ in range(6):
            T = TAB[sg]; TAB[sg] = [tuple((T[max(i-1,0)][j] + 2*T[i][j] + T[min(i+1,len(T)-1)][j]) / 4 for j in range(4)) for i in range(len(T))]
    def ext(z, sg=0): return TAB[sg][min(range(len(zs_all)), key=lambda i: abs(zs_all[i] - z))]
    XO = {}; cur = 0.0
    for z in zs_all:
        cur = max(cur, ext(z)[0] + margin) if z > crotch_z - 0.15 else cur
        XO[z] = cur
    def se(cx, cy, a, b, n=2.6):
        out = []
        for k in range(NA):
            t = 2 * math.pi * k / NA; c, s_ = math.cos(t), math.sin(t)
            out.append((cx + a * math.copysign(abs(c) ** (2 / n), c), cy + b * math.copysign(abs(s_) ** (2 / n), s_)))
        return out
    def depth(z, sg=0):
        y0 = min(ext(zz, sg)[1] for zz in zs_all if zz >= z - 1e-6 and zz > crotch_z - 0.06) if z > crotch_z - 0.06 else ext(z, sg)[1]
        y1 = max(ext(zz, sg)[2] for zz in zs_all if zz >= z - 1e-6 and zz > crotch_z - 0.06) if z > crotch_z - 0.06 else ext(z, sg)[2]
        return y0 - margin, y1 + margin
    up = []
    for z in [z for z in zs_all if z > crotch_z - 0.03]:
        y0, y1 = depth(max(z, crotch_z + 0.01)); xo = XO[z] + 0.012 * ss(Z_TOP - 0.02, crotch_z, z)
        up.append((z, se(0.0, (y0 + y1) / 2, xo, (y1 - y0) / 2, n=3.0)))
    tube(up)
    for sg in (1, -1):
        rings = []
        for z in [z for z in zs_all if z < crotch_z - 0.015]:
            xi = min(0.004 + max(0.0, crotch_z - 0.04 - z) * 0.30, ext(z, sg)[3] - 0.014) if z < crotch_z - 0.01 else 0.004
            xi = max(0.004, xi)
            xo = XO[z] + 0.012 + 0.025 * ss(crotch_z, Z_HEM, z)
            y0, y1 = depth(z, sg); y0 -= 0.012 + 0.015 * ss(crotch_z, Z_HEM, z); y1 += 0.01; y0 = max(min(y0, depth(crotch_z + 0.01)[0] + 0.012), depth(crotch_z + 0.01)[0] + 0.006); y1 = min(max(y1, depth(crotch_z + 0.01)[1] - 0.02), depth(crotch_z + 0.01)[1] - 0.006)
            rings.append((z, se(sg * (xi + xo) / 2, (y0 + y1) / 2, (xo - xi) / 2, (y1 - y0) / 2)))
        tube(rings)
    me = bpy.data.meshes.new("Shorts"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("Shorts", me); bpy.context.collection.objects.link(ob)
    rm = ob.modifiers.new("rm", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = voxel
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); ob.modifiers.clear(); ob.data = me2
    bm = bmesh.new(); bm.from_mesh(me2)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z > Z_TOP or f.calc_center_median().z < Z_HEM], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    inner = [v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)]
    for _ in range(20):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for v in bm.verts:
        if any(e.is_boundary for e in v.link_edges): v.co.z = Z_TOP if v.co.z > crotch_z else Z_HEM
    SH_XO = XO
    bm.to_mesh(me2); bm.free()
    # weights: nearest body verts (same side), then smoothed over the garment surface
    bvs = [i for i in range(len(VC)) if dom.get(i, "").startswith(("pelvis", "thigh", "spine01"))]
    kds = {}
    for sg in (1, -1):
        ids = [i for i in bvs if VC[i].x * sg >= -0.01]
        kd = mathutils.kdtree.KDTree(len(ids))
        for k, i in enumerate(ids): kd.insert(VC[i], k)
        kd.balance(); kds[sg] = (kd, ids)
    wmap = collections.defaultdict(dict)
    for g, lst in vg.items():
        for i, w in lst: wmap[i][g] = w
    nv = len(me2.vertices); W = collections.defaultdict(lambda: [0.0] * nv)
    for v in me2.vertices:
        kd, ids = kds[1 if v.co.x >= 0 else -1]
        acc = collections.defaultdict(float); tw = 0
        for co, k, dist in kd.find_n(v.co, 8):
            w_ = 1 / (dist + 1e-3); tw += w_
            for g, ww in wmap[ids[k]].items(): acc[g] += ww * w_
        for g, ww in acc.items(): W[g][v.index] = ww / tw
    nbr = collections.defaultdict(set)
    for e in me2.edges:
        a2, b2 = e.vertices; nbr[a2].add(b2); nbr[b2].add(a2)
    for _ in range(20):
        for g in list(W):
            arr = W[g]; W[g] = [(arr[i] + sum(arr[j] for j in nbr[i])) / (1 + len(nbr[i])) for i in range(nv)]
    groups = {g: ob.vertex_groups.new(name=g) for g in W}
    for i in range(nv):
        tot = sum(W[g][i] for g in W) or 1
        for g in W:
            w_ = W[g][i] / tot
            if w_ > 0.005: groups[g].add([i], w_, "REPLACE")
    MAXX = collections.defaultdict(float)
    for v in me2.vertices: MAXX[round(v.co.z, 2)] = max(MAXX[round(v.co.z, 2)], abs(v.co.x))
    ta = me2.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for v in me2.vertices:
        t_ = 1.0 if v.co.z < Z_HEM + 0.018 else 0.0
        if v.co.z > Z_HEM + 0.018:
            zb_ = round(v.co.z, 2)
            t_ = 1.0 if abs(v.co.x) > MAXX.get(zb_, 9) - 0.011 and v.co.z < Z_TOP - 0.03 else 0.0
        ta.data[v.index].color = (t_, t_, t_, 1)
    for p in me2.polygons: p.use_smooth = True
    ob.parent = arm
    a_ = ob.modifiers.new("arm", "ARMATURE"); a_.object = arm
    s_ = ob.modifiers.new("sol", "SOLIDIFY"); s_.thickness = 0.004; s_.offset = 1
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 0; sb.render_levels = 1
    me2.materials.append(M_S)
    return ob
build_shorts2()
# --- sneakers: offset shell of the foot, rubber sole band ---
M_SH = mat("shoe", (0.85, 0.85, 0.84), rough=0.4, sheen=0.0, trim=True)
M_SH.node_tree.nodes["Mix"].inputs[7].default_value = (0.03, 0.03, 0.035, 1)
def shoe_pred(c, d):
    return d.startswith(("foot", "toes")) or (d.startswith("calf") and c.z < 0.155)
def shoe_disp(p, n):
    q = p + n * 0.016
    q.z = max(q.z, 0.0)
    return q
def build_shoe(side):
    sg = 1 if side == "L" else -1
    pts = [VC[i] for i in range(len(VC)) if (dom.get(i, "").startswith(("foot_" + side, "toes_" + side))
           or (dom.get(i, "") == "calf_" + side and Zi(VC[i].z) < 0.16)) and VC[i].x * sg > 0]
    fb = rb[f"foot_{side}"]; tb = rb[f"toes_{side}"]
    f = Vector((tb.tail_local.x - fb.head_local.x, tb.tail_local.y - fb.head_local.y, 0)).normalized()
    l = f.cross(Vector((0, 0, 1))).normalized()
    o = Vector((fb.head_local.x, fb.head_local.y, 0))
    loc = [((p - o).dot(f), (p - o).dot(l), p.z) for p in pts if Zi(p.z) < 0.135]
    s0 = min(q[0] for q in loc); s1 = max(q[0] for q in loc)
    bm = bmesh.new(); rings = []
    N = 32; st = s0
    while st <= s1 + 1e-6:
        sl = [(q[1], q[2]) for q in loc if abs(q[0] - st) < 0.008]
        if len(sl) >= 6:
            cu = sum(q[0] for q in sl) / len(sl); cz = sum(q[1] for q in sl) / len(sl)
            r = hull_ring(sl, cu, cz, 0.013, N)
            r = [(u, max(z, 0.0)) for u, z in r]
            rings.append((st, r))
        st += 0.01
    def scaled(st, r, k):
        cu = sum(q[0] for q in r) / N; cz = sum(q[1] for q in r) / N
        return (st, [(cu + (u - cu) * k, max(0.0, cz + (z - cz) * k)) for u, z in r])
    rings = [scaled(rings[0][0] - 0.02, rings[0][1], 0.45), scaled(rings[0][0] - 0.01, rings[0][1], 0.85)] + rings + \
            [scaled(rings[-1][0] + 0.012, rings[-1][1], 0.8), scaled(rings[-1][0] + 0.022, rings[-1][1], 0.4)]
    vs = []
    for st, r in rings:
        vs.append([bm.verts.new(o + f * st + l * u + Vector((0, 0, z))) for u, z in r])
    for a_, b_ in zip(vs, vs[1:]):
        for k in range(N): bm.faces.new((a_[k], a_[(k + 1) % N], b_[(k + 1) % N], b_[k]))
    bm.faces.new(vs[0][::-1]); bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(f"Shoe_{side}"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f"Shoe_{side}", me); bpy.context.collection.objects.link(ob)
    ta = me.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        t_ = 1.0 if v.co.z < 0.022 else 0.0
        ta.data[v.index].color = (t_, t_, t_, 1)
    for p in me.polygons: p.use_smooth = True
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 1; sb.render_levels = 2
    me.materials.append(M_SH)
    ob.parent = arm; ob.parent_type = "BONE"; ob.parent_bone = f"foot_{side}"
    ob.matrix_parent_inverse = (arm.matrix_world @ fb.matrix_local @ Matrix.Translation((0, fb.length, 0))).inverted()
def build_shoe2(side):
    sg = 1 if side == "L" else -1
    fb = rb[f"foot_{side}"]; tb = rb[f"toes_{side}"]
    pts = [VC[i] for i in range(len(VC)) if dom.get(i, "").startswith(("foot_" + side, "toes_" + side)) and VC[i].x * sg > 0]
    f = Vector((tb.tail_local.x - fb.head_local.x, tb.tail_local.y - fb.head_local.y, 0)).normalized()
    l = Vector((0, 0, 1)).cross(f).normalized()
    o = Vector((fb.head_local.x, fb.head_local.y, 0))
    loc = [((p - o).dot(f), (p - o).dot(l), p.z) for p in pts]
    s0 = min(q[0] for q in loc) - 0.012; s1 = max(q[0] for q in loc) + 0.035
    L = s1 - s0
    def width(st):      # half widths (l-) and (l+) from foot hull at this station
        sl = [q[1] for q in loc if abs(q[0] - st) < 0.015]
        if not sl: sl = [q[1] for q in loc if abs(q[0] - min(max(st, s0 + 0.03), s1 - 0.03)) < 0.03]
        return min(sl) - 0.012, max(sl) + 0.012
    def height(t):      # top of upper along the foot (t: 0 heel -> 1 toe)
        pts_ = [(0.0, 0.10), (0.12, 0.118), (0.35, 0.108), (0.6, 0.08), (0.85, 0.064), (1.0, 0.052)]
        for (a, ha), (b, hb) in zip(pts_, pts_[1:]):
            if a <= t <= b: return ha + (hb - ha) * (t - a) / (b - a)
        return 0.04
    NS, NA = 48, 64
    bm = bmesh.new(); rings = []; sole_rings = []
    WT = [list(width(s0 + L * k / NS)) for k in range(NS + 1)]
    for _ in range(12):
        WT = [[(WT[max(i-1,0)][j] + 2*WT[i][j] + WT[min(i+1,NS)][j]) / 4 for j in (0, 1)] for i in range(NS + 1)]
    for k in range(NS + 1):
        t = k / NS; st = s0 + L * t
        w0, w1 = WT[k]
        # round off heel and toe in plan view
        rnd = math.sqrt(max(0.0, 1 - (max(0.0, 0.09 - t) / 0.09) ** 2)) * math.sqrt(max(0.0, 1 - (max(0.0, t - 0.86) / 0.14) ** 2))
        rnd = max(rnd, 0.3)
        c = (w0 + w1) / 2; hw = (w1 - w0) / 2 * rnd
        zt = height(t) * (0.35 + 0.65 * math.sqrt(rnd)); zb = 0.0
        ring = []
        for a in range(NA):
            th = 2 * math.pi * a / NA; cs, sn = math.cos(th), math.sin(th)
            u = c + hw * math.copysign(abs(cs) ** (2 / 3.2), cs)
            if sn >= 0: z = zb + 0.028 + (zt - 0.028) * abs(sn) ** (2 / 2.4)
            else: z = zb + 0.02 + 0.008 * (1 - abs(sn) ** (2 / 6.0))
            ring.append(bm.verts.new(o + f * st + l * u + Vector((0, 0, z))))
        rings.append(ring)
        sole_rings.append((st, c, hw * 1.0 + 0.007))
    for a_, b_ in zip(rings, rings[1:]):
        for k in range(NA): bm.faces.new((a_[k], a_[(k + 1) % NA], b_[(k + 1) % NA], b_[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(f"Shoe_{side}"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f"Shoe_{side}", me); bpy.context.collection.objects.link(ob)
    ta = me.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        t_ = 0.0
        ta.data[v.index].color = (t_, t_, t_, 1)
    for p in me.polygons: p.use_smooth = True
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 1; sb.render_levels = 2
    me.materials.append(M_SH)
    ob.parent = arm; ob.parent_type = "BONE"; ob.parent_bone = f"foot_{side}"
    ob.matrix_parent_inverse = (arm.matrix_world @ fb.matrix_local @ Matrix.Translation((0, fb.length, 0))).inverted()
    # midsole slab: plan outline extruded 0..3cm, rounded
    sb_ = bmesh.new(); outl = []
    for st, c, hw in sole_rings: outl.append(o + f * (st) + l * (c - hw))
    for st, c, hw in reversed(sole_rings): outl.append(o + f * (st) + l * (c + hw))
    hull2 = []
    for zz in (0.0, 0.03):
        hull2.append([sb_.verts.new(Vector((p.x, p.y, zz))) for p in outl])
    n_ = len(outl)
    for k in range(n_): sb_.faces.new((hull2[0][k], hull2[0][(k + 1) % n_], hull2[1][(k + 1) % n_], hull2[1][k]))
    sb_.faces.new(hull2[0][::-1]); sb_.faces.new(hull2[1])
    bmesh.ops.recalc_face_normals(sb_, faces=sb_.faces[:])
    me_s = bpy.data.meshes.new(f"Sole_{side}"); sb_.to_mesh(me_s); sb_.free()
    so = bpy.data.objects.new(f"Sole_{side}", me_s); bpy.context.collection.objects.link(so)
    ta2 = me_s.color_attributes.new("trim", "FLOAT_COLOR", "POINT")
    for v in me_s.vertices: t2 = 1.0 if v.co.z < 0.01 else 0.0; ta2.data[v.index].color = (t2, t2, t2, 1)
    bv_ = so.modifiers.new("bev", "BEVEL"); bv_.width = 0.008; bv_.segments = 4
    sbs_ = so.modifiers.new("sub", "SUBSURF"); sbs_.levels = 1; sbs_.render_levels = 2
    me_s.materials.append(M_SH)
    so.parent = arm; so.parent_type = "BONE"; so.parent_bone = f"foot_{side}"
    so.matrix_parent_inverse = ob.matrix_parent_inverse.copy()
build_shoe2("L"); build_shoe2("R")
M_SK = mat("socks", (0.006, 0.006, 0.007), rough=0.9, sheen=0.05)
garment("Socks", lambda c, d: (d.startswith("calf") and 0.07 < Zi(c.z) < 0.245) or (d.startswith("foot") and Zi(c.z) > 0.075), lambda p, n: p + n * 0.004, M_SK, 0.002, 0.0)
# skin params: young, smooth
for m in body.data.materials:
    if m and m.name.startswith("MBLab_skin"):
        for n in m.node_tree.nodes:
            if n.type == "VALUE":
                if n.name == "skin_bump": n.outputs[0].default_value = 0.12
                if n.name == "skin_veins": n.outputs[0].default_value = 0.0
                if n.name == "skin_melanin": n.outputs[0].default_value = 0.35
                if n.name == "skin_oil": n.outputs[0].default_value = 0.15
            if n.type == "GROUP" and "Character height" in n.inputs: n.inputs["Character height"].default_value = 1.75
        m.displacement_method = "BUMP"
    if m and m.name == "MBLab_Iris_V4":
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                n.image = img(n.image.name, "bump" in n.image.name)
            if n.type == "VALUE" and n.name == "eyes_value": n.outputs[0].default_value = 0.10
            if n.type == "VALUE" and n.name == "eyes_saturation": n.outputs[0].default_value = 0.25
            if n.type == "VALUE" and n.name == "eyes_hue": n.outputs[0].default_value = 0.0
    if m and m.name == "MBLab_Iris_V4":
        nt = m.node_tree
        tx = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and "iris_color" in n.image.name][0]
        bwm = nt.nodes.new("ShaderNodeBsdfPrincipled"); bwm.inputs["Specular IOR Level"].default_value = 0.1
        bw = nt.nodes.new("ShaderNodeRGBToBW"); nt.links.new(tx.outputs["Color"], bw.inputs[0])
        cr = nt.nodes.new("ShaderNodeValToRGB")
        cr.color_ramp.elements[0].color = (0.025, 0.010, 0.004, 1); cr.color_ramp.elements[1].color = (0.30, 0.13, 0.04, 1)
        nt.links.new(bw.outputs[0], cr.inputs[0]); nt.links.new(cr.outputs[0], bwm.inputs["Base Color"]); bwm.inputs["Roughness"].default_value = 0.6
        for out in [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"]:
            out.target = "ALL"; nt.links.new(bwm.outputs[0], out.inputs["Surface"])
    if m and m.name == "MBlab_human_eyes":
        nt = m.node_tree
        for n in nt.nodes:
            if n.type == "TEX_IMAGE": n.image = img("sclera_color.png"); tx_ = n
        pe = nt.nodes["Principled BSDF"]; nt.links.new(tx_.outputs["Color"], pe.inputs["Base Color"]); pe.inputs["Roughness"].default_value = 0.2
        for o_ in [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"]: o_.target = "ALL"; nt.links.new(pe.outputs[0], o_.inputs["Surface"])
nm_ = bpy.data.materials.get("MBLab_nails")
if nm_:
    nt = nm_.node_tree
    for n_ in list(nt.nodes):
        if n_.type != "OUTPUT_MATERIAL": nt.nodes.remove(n_)
    pn = nt.nodes.new("ShaderNodeBsdfPrincipled"); pn.inputs["Base Color"].default_value = (0.62, 0.40, 0.36, 1); pn.inputs["Roughness"].default_value = 0.3
    for o_ in [n_ for n_ in nt.nodes if n_.type == "OUTPUT_MATERIAL"]: o_.target = "ALL"; nt.links.new(pn.outputs[0], o_.inputs["Surface"])
cm_ = bpy.data.materials.get("MBlab_cornea")
if cm_:
    nt = cm_.node_tree
    for n_ in list(nt.nodes):
        if n_.type != "OUTPUT_MATERIAL": nt.nodes.remove(n_)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); gl = nt.nodes.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = 0.02
    fr = nt.nodes.new("ShaderNodeFresnel"); fr.inputs["IOR"].default_value = 1.376
    mxs = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fr.outputs[0], mxs.inputs[0]); nt.links.new(tr.outputs[0], mxs.inputs[1]); nt.links.new(gl.outputs[0], mxs.inputs[2])
    for o_ in [n_ for n_ in nt.nodes if n_.type == "OUTPUT_MATERIAL"]: o_.target = "ALL"; nt.links.new(mxs.outputs[0], o_.inputs["Surface"])
    cm_.blend_method = "HASHED" if hasattr(cm_, "blend_method") else None
# blend hair mask into skin albedo
for m in body.data.materials:
    if m and m.name.startswith("MBLab_skin"):
        nt = m.node_tree
        alb = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.name.endswith("skn_albedo")][0]
        links = [l for l in nt.links if l.from_node == alb and l.from_socket.name == "Color"]
        at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "hairmask"
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2500; nz.inputs["Detail"].default_value = 2
        hc_ = nt.nodes.new("ShaderNodeMix"); hc_.data_type = "RGBA"
        hc_.inputs[6].default_value = (0.012, 0.010, 0.009, 1); hc_.inputs[7].default_value = (0.05, 0.04, 0.035, 1)
        nt.links.new(nz.outputs["Fac"], hc_.inputs[0])
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
        mt = nt.nodes.new("ShaderNodeMath"); mt.operation = "MULTIPLY"; mt.inputs[1].default_value = 0.96
        nt.links.new(at.outputs["Fac"], mt.inputs[0]); nt.links.new(mt.outputs[0], mx.inputs[0])
        nt.links.new(alb.outputs["Color"], mx.inputs[6]); nt.links.new(hc_.outputs[2], mx.inputs[7])
        for l in links: nt.links.new(mx.outputs[2], l.to_socket)
        # replace heavy MB-Lab skin group with a clean principled skin
        outs = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"]
        pr = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(mx.outputs[2], pr.inputs["Base Color"])
        pr.inputs["Roughness"].default_value = 0.5
        pr.inputs["Subsurface Weight"].default_value = 0.18
        pr.inputs["Subsurface Radius"].default_value = (1.0, 0.4, 0.25)
        pr.inputs["Subsurface Scale"].default_value = 0.012
        pr.inputs["Coat Weight"].default_value = 0.0
        bmp = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.name.endswith("skn_bump")][0]
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.04
        nt.links.new(bmp.outputs["Color"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], pr.inputs["Normal"])
        warm = nt.nodes.new("ShaderNodeMix"); warm.data_type = "RGBA"; warm.blend_type = "MULTIPLY"
        warm.inputs[0].default_value = 1.0; warm.inputs[7].default_value = tuple(float(x) for x in os.environ.get("SKIN_TINT", "0.92,0.74,0.58").split(",")) + (1,)
        nt.links.new(alb.outputs["Color"], warm.inputs[6]); nt.links.new(warm.outputs[2], pr.inputs["Base Color"])
        pr.inputs["Roughness"].default_value = 0.68; pr.inputs["Specular IOR Level"].default_value = 0.22
        hp = nt.nodes.new("ShaderNodeBsdfPrincipled")
        hp.inputs["Base Color"].default_value = (0.010, 0.008, 0.007, 1); hp.inputs["Roughness"].default_value = 0.75
        hb2 = nt.nodes.new("ShaderNodeBump"); hb2.inputs["Strength"].default_value = 0.35
        nt.links.new(nz.outputs["Fac"], hb2.inputs["Height"]); nt.links.new(hb2.outputs["Normal"], hp.inputs["Normal"])
        ms = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(mt.outputs[0], ms.inputs[0]); nt.links.new(pr.outputs[0], ms.inputs[1]); nt.links.new(hp.outputs[0], ms.inputs[2])
        for out in outs:
            out.target = "ALL"
            nt.links.new(ms.outputs[0], out.inputs["Surface"])
            for l in list(out.inputs["Displacement"].links): nt.links.remove(l)
        for out in outs[1:]: nt.nodes.remove(out)
for u in body.data.uv_layers: u.active_render = (u.name == "UVMap")
body.data.uv_layers.active = body.data.uv_layers["UVMap"]
# skin/teeth/nail image nodes explicitly on UVMap
for m in body.data.materials:
    if not (m and m.use_nodes): continue
    if m.name.startswith("MBLab_skin") or m.name in ("MBLab_nails", "MBlab_human_teeth", "MBLab_tongue", "MBlab_eyelash"):
        uvn = m.node_tree.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "UVMap"
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and not n.inputs["Vector"].links:
                m.node_tree.links.new(uvn.outputs[0], n.inputs["Vector"])
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT, "height", max(v[2] for v in verts))
