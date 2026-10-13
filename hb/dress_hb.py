"""Dress the rigged CC0 body: skin, eyes, short hair, basketball kit (cloth-simulated drape), socks, sneakers.
in: hb_rig.blend  out: hb_char.blend"""
import bpy, bmesh, os, sys, math, random, json, collections
import numpy as np
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
D = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(D, "hb_rig.blend"); OUT = os.environ.get("HB_CHAR", os.path.join(D, "hb_char.blend"))
SIM = int(os.environ.get("CLOTH_FRAMES", 40))
bpy.ops.wm.open_mainfile(filepath=IN)
sc = bpy.context.scene
body = bpy.data.objects["Body"]; rig = bpy.data.objects["rig"]
LAB = np.load(os.path.join(D, "hb_labels.npy")); LM = json.load(open(os.path.join(D, "hb_landmarks.json")))
me = body.data; P = np.array([v.co[:] for v in me.vertices]); H = P[:, 2].max()
NRM = [v.normal.copy() for v in me.vertices]
def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

# ======================= materials =======================
def principled(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*color, 1); p.inputs["Roughness"].default_value = rough
    return m, m.node_tree, p
# --- skin: warm tan, SSS, pore bump, subtle colour variation, darker scalp stubble
M_SKIN, nt, ps = principled("skin", (0.62, 0.40, 0.28), 0.48)
ps.inputs["Subsurface Weight"].default_value = 0.25
ps.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2); ps.inputs["Subsurface Scale"].default_value = 0.008
ps.inputs["Specular IOR Level"].default_value = 0.28
tc = nt.nodes.new("ShaderNodeTexCoord")
nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6; nz.inputs["Detail"].default_value = 4
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.36, 0.17, 0.08, 1); ramp.color_ramp.elements[1].color = (0.44, 0.22, 0.11, 1)
nt.links.new(tc.outputs["Object"], nz.inputs["Vector"]); nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
# scalp mask (vertex attribute) mixes in stubble colour
at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "scalp"
mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs[7].default_value = (0.05, 0.035, 0.03, 1)
nt.links.new(ramp.outputs[0], mix.inputs[6]); nt.links.new(at.outputs["Fac"], mix.inputs[0]); nt.links.new(mix.outputs[2], ps.inputs["Base Color"])
pore = nt.nodes.new("ShaderNodeTexVoronoi"); pore.inputs["Scale"].default_value = 900
bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.12; bp.inputs["Distance"].default_value = 0.0005; bp.invert = True
nt.links.new(tc.outputs["Object"], pore.inputs["Vector"]); nt.links.new(pore.outputs["Distance"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], ps.inputs["Normal"])
rv = nt.nodes.new("ShaderNodeMapRange"); rv.inputs["To Min"].default_value = 0.52; rv.inputs["To Max"].default_value = 0.66
nt.links.new(nz.outputs["Fac"], rv.inputs["Value"]); nt.links.new(rv.outputs[0], ps.inputs["Roughness"])
me.materials.clear(); me.materials.append(M_SKIN)
# --- eyes: sclera / brown iris / pupil by angle from the eye's forward axis, glossy
for e in (bpy.data.objects["Eye.L"], bpy.data.objects["Eye.R"]):
    vs = [e.matrix_world @ v.co for v in e.data.vertices]; c = sum(vs, Vector()) / len(vs)
    m, n2, pe = principled("eye_" + e.name, (0.9, 0.88, 0.85), 0.05)
    tce = n2.nodes.new("ShaderNodeTexCoord"); vm = n2.nodes.new("ShaderNodeVectorMath"); vm.operation = "SUBTRACT"; vm.inputs[1].default_value = c
    nm = n2.nodes.new("ShaderNodeVectorMath"); nm.operation = "NORMALIZE"
    dt = n2.nodes.new("ShaderNodeVectorMath"); dt.operation = "DOT_PRODUCT"; dt.inputs[1].default_value = (0, -1, 0)
    cr = n2.nodes.new("ShaderNodeValToRGB"); E = cr.color_ramp.elements
    E[0].position = 0.80; E[0].color = (0.85, 0.82, 0.78, 1); E[1].position = 0.86; E[1].color = (0.20, 0.09, 0.03, 1)
    e3 = E.new(0.955); e3.color = (0.10, 0.045, 0.015, 1); e4 = E.new(0.965); e4.color = (0.005, 0.004, 0.004, 1)
    n2.links.new(tce.outputs["Object"], vm.inputs[0]); n2.links.new(vm.outputs[0], nm.inputs[0]); n2.links.new(nm.outputs[0], dt.inputs[0])
    n2.links.new(dt.outputs["Value"], cr.inputs[0]); n2.links.new(cr.outputs[0], pe.inputs["Base Color"])
    pe.inputs["Coat Weight"].default_value = 0.8; pe.inputs["Coat Roughness"].default_value = 0.02
    e.data.materials.clear(); e.data.materials.append(m)
eyeL = bpy.data.objects["Eye.L"]; ev = [v.co for v in eyeL.data.vertices]
EYE_Z = sum(v.z for v in ev) / len(ev); EYE_Y = sum(v.y for v in ev) / len(ev)
EYE_X = abs(sum(v.x for v in ev) / len(ev))

# ======================= scalp + hair =======================
head = P[LAB == "head"]; HTOP = H
scalp = np.zeros(len(P))
for i, p in enumerate(P):
    if LAB[i] != "head" or p[2] < EYE_Z - 0.09: continue
    dz = p[2] - EYE_Z; dy = p[1] - EYE_Y
    m = 0.0
    if dz > 0.06 - 0.25 * max(0, dy - 0.02): m = 1.0                  # top; hairline slopes down to the back
    if dy > 0.085 and dz > -0.07: m = 1.0                               # back of the head
    if dy > 0.05 and abs(p[0]) > 0.055 and -0.01 < dz < 0.2: m = 1.0      # above / behind ears
    if abs(p[0]) > EYE_X + 0.035 and 0.03 < dy < 0.085 and dz < 0.035: m = 0.0   # ears clear
    scalp[i] = m
nb = collections.defaultdict(set)
for e in me.edges: a, b = e.vertices; nb[a].add(b); nb[b].add(a)
sm = scalp.copy()
for _ in range(2): sm = np.array([(sm[i] * 2 + sum(sm[j] for j in nb[i])) / (2 + len(nb[i])) if nb[i] else sm[i] for i in range(len(sm))])
attr = me.color_attributes.new("scalp", "FLOAT", "POINT")
for i, v in enumerate(sm): attr.data[i].value = float(min(1.0, v * 0.9))
# hair strands from the dense (multires level 2) surface for even density
mr = body.modifiers["Multires"]; mr.levels = 2
dg = bpy.context.evaluated_depsgraph_get()
ev_me = body.evaluated_get(dg).to_mesh()
kd = KDTree(len(P))
for i, p in enumerate(P): kd.insert(Vector(p), i)
kd.balance()
cap = []
for poly in ev_me.polygons:
    c = poly.center
    _, i, _ = kd.find(c)
    if scalp[i] > 0.5: cap.append((c.copy(), poly.normal.copy(), poly.area))
body.evaluated_get(dg).to_mesh_clear(); mr.levels = 0
# distance to hairline for tapering
edge_pts = [Vector(P[i]) for i in range(len(P)) if scalp[i] > 0.5 and any(scalp[j] < 0.5 for j in nb[i])]
kde = KDTree(len(edge_pts))
for i, p in enumerate(edge_pts): kde.insert(p, i)
kde.balance()
random.seed(7); SEG = 7; NS = int(os.environ.get("HAIR_N", 90000))
areas = [c[2] for c in cap]
pos = []; rad = []
for _ in range(NS):
    c, n, a = random.choices(cap, weights=areas)[0]
    root = c + Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * math.sqrt(a) * 0.5
    edge = min(1.0, kde.find(root)[2] / 0.022)
    if abs(root.x) > EYE_X + 0.045 and root.z - EYE_Z < 0.05 and root.y - EYE_Y < 0.09: continue
    if random.random() > 0.5 + 0.5 * edge: continue
    dz = root.z - EYE_Z; dy = root.y - EYE_Y
    top = max(0.0, min(1.0, (dz - 0.05) / 0.07)); fb = ss(0.0, 0.11, dy); crown = 1 - abs(fb - 0.5) * 2
    L = (0.006 + 0.044 * top ** 1.2) * (0.7 + 0.3 * edge) + random.uniform(-0.004, 0.006) * (0.3 + top)
    if top > 0.35:
        comb = Vector((random.uniform(-.3, .3), -1.0, -0.15)).lerp(Vector((random.uniform(-.3, .3), 0.6, -0.6)), fb)
        if comb.length < 0.3: comb = Vector((random.uniform(-1, 1), random.uniform(-1, 1), 0))
    else: comb = Vector((0, 0.45, -1))
    t = comb - n * comb.dot(n); t.normalize()
    lift0 = 0.15 + 0.45 * top + 0.25 * crown * top; lift1 = -0.10 + 0.10 * top
    x = root - n * 0.001; pts = [x.copy()]
    for k in range(1, SEG):
        s_ = k / (SEG - 1); lift = lift0 + (lift1 - lift0) * s_
        d = (n * lift + t * (1 - lift)).normalized() + Vector((random.gauss(0, .12), random.gauss(0, .12), random.gauss(0, .12)))
        x = x + d.normalized() * (L / (SEG - 1)); pts.append(x.copy())
    pos += pts; rad += [0.00046 * (0.6 + 0.4 * edge) * (1 - 0.85 * (k / (SEG - 1))) for k in range(SEG)]
hc = bpy.data.hair_curves.new("Hair"); hc.add_curves([SEG] * (len(pos) // SEG))
hc.attributes["position"].data.foreach_set("vector", [c for v in pos for c in v])
ra = hc.attributes.get("radius") or hc.attributes.new("radius", "FLOAT", "POINT"); ra.data.foreach_set("value", rad)
hair = bpy.data.objects.new("Hair", hc); sc.collection.objects.link(hair)
mh = bpy.data.materials.new("hair"); mh.use_nodes = True; nth = mh.node_tree
for n_ in list(nth.nodes):
    if n_.type != "OUTPUT_MATERIAL": nth.nodes.remove(n_)
hbs = nth.nodes.new("ShaderNodeBsdfHairPrincipled")
try: hbs.parametrization = "MELANIN"
except Exception: pass
for k, v in (("Melanin", 0.95), ("Melanin Redness", 0.25), ("Roughness", 0.32), ("Radial Roughness", 0.45), ("Random Roughness", 0.25), ("Random Color", 0.1)):
    if k in hbs.inputs: hbs.inputs[k].default_value = v
nth.links.new(hbs.outputs[0], nth.nodes["Material Output"].inputs["Surface"]); hc.materials.append(mh)
hb_ = rig.data.bones["DEF-spine.006"]
hair.parent = rig; hair.parent_type = "BONE"; hair.parent_bone = "DEF-spine.006"
hair.matrix_parent_inverse = (rig.matrix_world @ hb_.matrix_local @ Matrix.Translation((0, hb_.length, 0))).inverted()
print("hair strands", len(pos) // SEG)

# ======================= garments =======================
def cloth_mat(name, base, trim=(0.86, 0.86, 0.84)):
    m, n2, p = principled(name, base, 0.85)
    p.inputs["Sheen Weight"].default_value = 0.08; p.inputs["Sheen Roughness"].default_value = 0.5
    p.inputs["Specular IOR Level"].default_value = 0.15
    at_ = n2.nodes.new("ShaderNodeAttribute"); at_.attribute_name = "trim"
    mx = n2.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.inputs[6].default_value = (*base, 1); mx.inputs[7].default_value = (*trim, 1)
    th = n2.nodes.new("ShaderNodeMapRange"); th.inputs["From Min"].default_value = 0.42; th.inputs["From Max"].default_value = 0.58
    n2.links.new(at_.outputs["Fac"], th.inputs["Value"]); n2.links.new(th.outputs[0], mx.inputs[0]); n2.links.new(mx.outputs[2], p.inputs["Base Color"])
    tc_ = n2.nodes.new("ShaderNodeTexCoord"); vo = n2.nodes.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 1100
    bpn = n2.nodes.new("ShaderNodeBump"); bpn.inputs["Strength"].default_value = 0.3; bpn.inputs["Distance"].default_value = 0.0003
    n2.links.new(tc_.outputs["Object"], vo.inputs["Vector"]); n2.links.new(vo.outputs["Distance"], bpn.inputs["Height"]); n2.links.new(bpn.outputs["Normal"], p.inputs["Normal"])
    return m
M_J = cloth_mat("jersey", (0.012, 0.012, 0.014)); M_S = cloth_mat("shorts", (0.012, 0.012, 0.014))
SH = {s: Vector(LM["arm" + s]["sh"]) for s in "LR"}
waist_z = 0.585 * H; hem_j = 0.555 * H; knee_z = Vector(LM["legL"]["knee"]).z
def build_from_faces(name, keep_face, offset, subdiv=2):
    """copy selected body faces (base level), subdivide, push outward by `offset(p)`"""
    bm = bmesh.new(); bm.from_mesh(me)
    for f in list(bm.faces):
        if not keep_face(f): bm.faces.remove(f)
    for v in [v for v in bm.verts if not v.link_faces]: bm.verts.remove(v)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    if subdiv > 1: bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    # project subdivided verts onto the detailed body (multires level 2) then offset
    bm.normal_update()
    for v in bm.verts:
        v.co = v.co + v.normal * offset(v.co)
    # clean straight edges: drop spiky boundary faces, then smooth boundary loops (tangentially)
    for _ in range(2):
        bad = [f for f in bm.faces if sum(1 for e in f.edges if e.is_boundary) >= 2]
        bmesh.ops.delete(bm, geom=bad, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    for _ in range(40):
        newc = {}
        for v in bm.verts:
            be = [e for e in v.link_edges if e.is_boundary]
            if len(be) == 2:
                a_, b_ = (e.other_vert(v).co for e in be); newc[v] = v.co * 0.5 + (a_ + b_) * 0.25
        for v, c in newc.items(): v.co = c
    m_ = bpy.data.meshes.new(name); bm.to_mesh(m_); bm.free()
    ob = bpy.data.objects.new(name, m_); sc.collection.objects.link(ob)
    for p in m_.polygons: p.use_smooth = True
    return ob
def face_lab(f):
    return collections.Counter(LAB[v.index] for v in f.verts).most_common(1)[0][0]
def xa(z):        # armhole half-width (deep, athletic cut)
    return 0.112 * H / 1.8 + 0.09 * H / 1.8 * (1 - math.sqrt(ss(0.66 * H, 0.79 * H, z)))
def neck_ok(c):
    if c.y < 0: return c.z < 0.765 * H + 1.25 * abs(c.x)        # V-neck front
    return c.z < 0.80 * H + 12 * c.x * c.x
def jersey_face(f):
    c = f.calc_center_median(); lab = face_lab(f)
    if lab.startswith("arm") or lab == "head": return False
    if c.z < hem_j or abs(c.x) > xa(c.z): return False
    return neck_ok(c)
def shorts_face(f):
    c = f.calc_center_median(); lab = face_lab(f)
    if lab.startswith("arm"): return False
    return knee_z + 0.07 < c.z < waist_z + 0.01
jersey = build_from_faces("Jersey", jersey_face, lambda p: 0.012 + 0.025 * ss(0.68 * H, 0.60 * H, p.z))
def hull2d(pts):
    pts = sorted(set(map(tuple, np.round(pts, 4))))
    if len(pts) < 3: return pts
    def cr(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def ring_from_hull(h, c, margin, NA=72):
    out = []
    for k in range(NA):
        th = 2 * math.pi * k / NA; d = np.array([math.cos(th), math.sin(th)]); best = 0
        for a, b in zip(h, h[1:] + h[:1]):
            a = np.array(a) - c; b = np.array(b) - c; e = b - a
            den = d[0] * e[1] - d[1] * e[0]
            if abs(den) < 1e-12: continue
            t = (a[0] * e[1] - a[1] * e[0]) / den; u = (a[0] * d[1] - a[1] * d[0]) / den
            if t > 0 and -1e-6 <= u <= 1 + 1e-6: best = max(best, t)
        out.append(c + d * (best + margin))
    return out
mr.levels = 2; dg = bpy.context.evaluated_depsgraph_get(); em = body.evaluated_get(dg).to_mesh()
PD = np.array([v.co[:] for v in em.vertices]); body.evaluated_get(dg).to_mesh_clear(); mr.levels = 0
LABD = LAB[[kd.find(Vector(p))[1] for p in PD[::1]]] if False else None
crotch_z = min(p[2] for p in P[(LAB == "torso")] if abs(p[0]) < 0.03) if False else None
TOR = P[LAB == "torso"]; crotch_z = TOR[np.abs(TOR[:, 0]) < 0.03][:, 2].min() + float(os.environ.get("CROTCH_UP", 0.03))
print("shorts crotch/H", round(crotch_z / H, 3))
def leg_pts(sg, z, tol=0.01):
    sl = PD[(np.abs(PD[:, 2] - z) < tol) & (PD[:, 0] * sg > 0.003) & (np.abs(PD[:, 0]) < 0.24)]
    return sl
def all_pts(z, tol=0.01):
    return PD[(np.abs(PD[:, 2] - z) < tol) & (np.abs(PD[:, 0]) < 0.24)]
NA = 72; hem_s = knee_z + 0.075
bm = bmesh.new()
def tube(rings):
    vs = [[bm.verts.new((x, y, z)) for x, y in r] for z, r in rings]
    for a_, b_ in zip(vs, vs[1:]):
        for k in range(NA): bm.faces.new((a_[k], a_[(k + 1) % NA], b_[(k + 1) % NA], b_[k]))
    bm.faces.new(vs[0][::-1]); bm.faces.new(vs[-1])
# hips: hull of both legs+pelvis, hangs straight down from the widest point
rings = []; z = waist_z + 0.03; prev = None
while z > crotch_z - 0.05:
    pts = all_pts(z)[:, :2]; h = hull2d(pts); c = np.array([0.0, (pts[:, 1].min() + pts[:, 1].max()) / 2])
    r = ring_from_hull(h, c, 0.02, NA)
    if prev is not None: r = [np.where(np.linalg.norm(a - c) < np.linalg.norm(b - c), b, a) for a, b in zip(r, prev)]
    rings.append((z, [tuple(p) for p in r])); prev = np.array(r); z -= 0.01
tube(rings)
for sg in (1, -1):
    rings = []; z = crotch_z - 0.015; prev = None
    while z > hem_s - 0.03:
        pts = leg_pts(sg, z)[:, :2]; h = hull2d(pts); c = pts.mean(0)
        flare = 0.015 + 0.02 * ss(crotch_z, hem_s, z)
        r = ring_from_hull(h, c, flare, NA)
        r = [np.array([p[0] if p[0] * sg > 0.014 else 0.014 * sg, p[1]]) for p in r]
        if prev is not None: r = [np.where(np.linalg.norm(a - c) < np.linalg.norm(b - c), b, a) for a, b in zip(r, prev)]
        rings.append((z, [tuple(p) for p in r])); prev = np.array(r); z -= 0.01
    tube(rings)
sm_ = bpy.data.meshes.new("Shorts"); bm.to_mesh(sm_); bm.free()
shorts = bpy.data.objects.new("Shorts", sm_); sc.collection.objects.link(shorts)
rm = shorts.modifiers.new("rm", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.008
dg = bpy.context.evaluated_depsgraph_get(); m2 = bpy.data.meshes.new_from_object(shorts.evaluated_get(dg)); shorts.modifiers.clear(); shorts.data = m2
bm = bmesh.new(); bm.from_mesh(m2)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z > waist_z or f.calc_center_median().z < hem_s], context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
for _ in range(10): bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
for v in bm.verts:
    if any(e.is_boundary for e in v.link_edges): v.co.z = waist_z if v.co.z > crotch_z else hem_s
bm.to_mesh(m2); bm.free()
for p in m2.polygons: p.use_smooth = True
# trims: distance to open border -> white piping; shorts also get a side stripe
def add_trim(ob, width, side_stripe=False):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bnd = [v.co.copy() for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
    kt = KDTree(len(bnd))
    for i, p in enumerate(bnd): kt.insert(p, i)
    kt.balance()
    vals = []
    for v in bm.verts:
        t = max(0.0, min(1.0, 1.5 - kt.find(v.co)[2] / width))
        if side_stripe:
            sg = 1 if v.co.x > 0 else -1; l = LM["leg" + ("L" if sg > 0 else "R")]
            axc = Vector(l["hip"]); r = v.co - axc; ang = math.degrees(math.atan2(r.y, r.x * sg))
            if abs(ang + 5) < 9 and v.co.z < waist_z - 0.02: t = 1.0
        vals.append(t)
    bm.free()
    a_ = ob.data.color_attributes.new("trim", "FLOAT", "POINT")
    for i, t in enumerate(vals): a_.data[i].value = t
add_trim(jersey, 0.012); add_trim(shorts, 0.014, side_stripe=True)
for i, v in enumerate(jersey.data.vertices):
    if v.co.z < 0.62 * H: jersey.data.color_attributes['trim'].data[i].value = 0.0   # no piping on the hem
jersey.data.materials.append(M_J); shorts.data.materials.append(M_S)


# ======================= socks + sneakers =======================
M_SOCK = cloth_mat("socks", (0.01, 0.01, 0.012), trim=(0.01, 0.01, 0.012))
M_SHOE, ns, psh = principled("shoe", (0.86, 0.86, 0.85), 0.4)
at2 = ns.nodes.new("ShaderNodeAttribute"); at2.attribute_name = "trim"
mx2 = ns.nodes.new("ShaderNodeMix"); mx2.data_type = "RGBA"; mx2.inputs[6].default_value = (0.86, 0.86, 0.85, 1); mx2.inputs[7].default_value = (0.03, 0.03, 0.035, 1)
ns.links.new(at2.outputs["Fac"], mx2.inputs[0]); ns.links.new(mx2.outputs[2], psh.inputs["Base Color"])
ank_z = Vector(LM["legL"]["ank"]).z
socks = build_from_faces("Socks", lambda f: face_lab(f).startswith("leg") and ank_z - 0.02 < f.calc_center_median().z < ank_z + 0.13, lambda p: 0.004, subdiv=1)
socks.data.materials.append(M_SOCK)
for s_, sg in (("L", 1), ("R", -1)):
    F = PD[(PD[:, 2] < ank_z + 0.02) & (PD[:, 0] * sg > 0.02)]
    toe = Vector(LM["leg" + s_]["toe"]); heel = Vector(LM["leg" + s_]["heel"])
    fwd = Vector((toe.x - heel.x, toe.y - heel.y, 0)).normalized(); lat = Vector((0, 0, 1)).cross(fwd).normalized()
    o = Vector((heel.x, heel.y, 0))
    loc = np.array([((Vector(p) - o).dot(fwd), (Vector(p) - o).dot(lat), p[2]) for p in F])
    s0, s1 = loc[:, 0].min() - 0.012, loc[:, 0].max() + 0.03; Lf = s1 - s0
    NSt, NA2 = 40, 48
    def wid(st):
        sl = loc[np.abs(loc[:, 0] - st) < 0.015]
        if len(sl) < 3: sl = loc[np.abs(loc[:, 0] - min(max(st, s0 + 0.03), s1 - 0.04)) < 0.03]
        return sl[:, 1].min() - 0.013, sl[:, 1].max() + 0.013
    WT = [list(wid(s0 + Lf * k / NSt)) for k in range(NSt + 1)]
    for _ in range(10): WT = [[(WT[max(i-1,0)][j] + 2*WT[i][j] + WT[min(i+1,NSt)][j]) / 4 for j in (0, 1)] for i in range(NSt + 1)]
    def topz(t):
        pts_ = [(0.0, 0.105), (0.15, 0.12), (0.38, 0.11), (0.62, 0.082), (0.86, 0.066), (1.0, 0.052)]
        for (a, ha), (b, hb) in zip(pts_, pts_[1:]):
            if a <= t <= b: return (ha + (hb - ha) * (t - a) / (b - a)) * H / 1.8
        return 0.05
    bm = bmesh.new(); rings = []; outline = []
    for k in range(NSt + 1):
        t = k / NSt; st = s0 + Lf * t; w0, w1 = WT[k]
        rnd = math.sqrt(max(0.0, 1 - (max(0.0, 0.09 - t) / 0.09) ** 2)) * math.sqrt(max(0.0, 1 - (max(0.0, t - 0.86) / 0.14) ** 2)); rnd = max(rnd, 0.3)
        c = (w0 + w1) / 2; hw = (w1 - w0) / 2 * rnd; zt = topz(t) * (0.35 + 0.65 * math.sqrt(rnd))
        ring = []
        for a in range(NA2):
            th = 2 * math.pi * a / NA2; cs, sn = math.cos(th), math.sin(th)
            u = c + hw * math.copysign(abs(cs) ** (2 / 3.2), cs)
            z = 0.028 + (zt - 0.028) * abs(sn) ** (2 / 2.4) if sn >= 0 else 0.02 + 0.008 * (1 - abs(sn) ** (2 / 6.0))
            ring.append(bm.verts.new(o + fwd * st + lat * u + Vector((0, 0, z))))
        rings.append(ring); outline.append((st, c, hw + 0.007))
    for a_, b_ in zip(rings, rings[1:]):
        for k in range(NA2): bm.faces.new((a_[k], a_[(k + 1) % NA2], b_[(k + 1) % NA2], b_[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    # midsole slab
    ol = [o + fwd * st + lat * (c - hw) for st, c, hw in outline] + [o + fwd * st + lat * (c + hw) for st, c, hw in reversed(outline)]
    lo_ = [bm.verts.new((p.x, p.y, 0.0)) for p in ol]; hi_ = [bm.verts.new((p.x, p.y, 0.03)) for p in ol]
    n_ = len(ol)
    for k in range(n_): bm.faces.new((lo_[k], lo_[(k + 1) % n_], hi_[(k + 1) % n_], hi_[k]))
    bm.faces.new(lo_[::-1]); bm.faces.new(hi_)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    sm2 = bpy.data.meshes.new("Shoe_" + s_); bm.to_mesh(sm2); bm.free()
    sho = bpy.data.objects.new("Shoe_" + s_, sm2); sc.collection.objects.link(sho)
    ta = sm2.color_attributes.new("trim", "FLOAT", "POINT")
    for v in sm2.vertices: ta.data[v.index].value = 1.0 if v.co.z < 0.012 else 0.0
    for p in sm2.polygons: p.use_smooth = True
    sb = sho.modifiers.new("sub", "SUBSURF"); sb.levels = 1; sb.render_levels = 2
    sm2.materials.append(M_SHOE)
    fbone = rig.data.bones["DEF-foot." + s_]
    sho.parent = rig; sho.parent_type = "BONE"; sho.parent_bone = "DEF-foot." + s_
    sho.matrix_parent_inverse = (rig.matrix_world @ fbone.matrix_local @ Matrix.Translation((0, fbone.length, 0))).inverted()

# ======================= cloth simulation (drape at rest) =======================
def pin_group(ob, fn):
    g = ob.vertex_groups.new(name="pin")
    for v in ob.data.vertices:
        w = fn(v.co)
        if w > 0: g.add([v.index], w, "REPLACE")
    return g
pin_group(jersey, lambda p: 1.0 if p.z > 0.74 * H else 0.0)                      # straps / shoulders
pin_group(shorts, lambda p: 1.0 if p.z > waist_z - 0.035 else 0.0)              # waistband
mr.levels = 1
col = body.modifiers.new("collision", "COLLISION")
body.collision.thickness_outer = 0.006; body.collision.cloth_friction = 5
for ob, mass in ((jersey, 0.15), (shorts, 0.2)):
    cm = ob.modifiers.new("cloth", "CLOTH"); st = cm.settings
    st.quality = 6; st.mass = mass; st.tension_stiffness = 15; st.compression_stiffness = 15; st.shear_stiffness = 10
    st.bending_stiffness = 0.6; st.air_damping = 1; st.vertex_group_mass = "pin"
    cm.collision_settings.use_self_collision = False; cm.collision_settings.distance_min = 0.004
    cm.point_cache.frame_start = 1; cm.point_cache.frame_end = SIM
sc.frame_start = 1; sc.frame_end = SIM
for f in range(1, SIM + 1):
    sc.frame_set(f)
print("cloth simulated", SIM, "frames")
for ob in (jersey, shorts):
    dg = bpy.context.evaluated_depsgraph_get()
    newm = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    oldm = ob.data; ob.modifiers.clear(); ob.data = newm
    for a_ in oldm.color_attributes:
        if a_.name not in newm.color_attributes:
            na = newm.color_attributes.new(a_.name, a_.data_type, a_.domain)
            for i, d in enumerate(a_.data): na.data[i].value = d.value
body.modifiers.remove(col)
sc.frame_set(1)
mr.levels = 0
# thickness + follow the body when posed (surface deform binds to the deformed body)
for ob in (jersey, shorts, socks):
    so = ob.modifiers.new("sol", "SOLIDIFY"); so.thickness = 0.003; so.offset = 1
    sd = ob.modifiers.new("follow", "SURFACE_DEFORM"); sd.target = body; sd.falloff = 4
    bpy.context.view_layer.objects.active = ob
    ob.modifiers.move(ob.modifiers.find("follow"), 0)
    bpy.ops.object.surfacedeform_bind(modifier="follow")
    sb = ob.modifiers.new("sub", "SUBSURF"); sb.levels = 0; sb.render_levels = 2
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT)
