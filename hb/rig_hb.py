"""Standard Blender pipeline on the CC0 'GEO-body_male_realistic' base mesh:
   Rigify Human metarig -> fit to landmarks -> Generate rig -> automatic weights -> clean limb bleed.
Landmarks come from a geodesic segmentation of the mesh (arms / legs / torso / head) so A-pose
hands next to the thighs never get confused with the legs.
Output: hb_rig.blend  (objects: Body, Eye.L, Eye.R, rig, metarig)"""
import bpy, addon_utils, os, sys, json, heapq
import numpy as np
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "human_base_meshes_bundle.blend")
OUT = os.environ.get("HB_OUT", os.path.join(D, "hb_rig.blend"))
TARGET_H = float(os.environ.get("HB_HEIGHT", 1.88))
addon_utils.enable("rigify", default_set=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("rigify", default_set=True)
sc = bpy.context.scene

# ---------------- load + normalise ----------------
with bpy.data.libraries.load(SRC) as (src, dst):
    dst.objects = ["GEO-body_male_realistic", "GEO-body_male_realistic.eye.L", "GEO-body_male_realistic.eye.R"]
for o in dst.objects: sc.collection.objects.link(o)
bpy.context.view_layer.update()
body = bpy.data.objects["GEO-body_male_realistic"]; body.name = "Body"
eyes = [bpy.data.objects["GEO-body_male_realistic.eye.L"], bpy.data.objects["GEO-body_male_realistic.eye.R"]]
for e, n in zip(eyes, ("Eye.L", "Eye.R")):
    mw = e.matrix_world.copy(); e.parent = None; e.matrix_world = mw; e.name = n
bpy.context.view_layer.update()
V0 = np.array([body.matrix_world @ v.co for v in body.data.vertices])
cx = (V0[:, 0].min() + V0[:, 0].max()) / 2; z0 = V0[:, 2].min(); s = TARGET_H / (V0[:, 2].max() - z0)
T = Matrix.Scale(s, 4) @ Matrix.Translation((-cx, 0, -z0))
for o in [body] + eyes:
    o.matrix_world = T @ o.matrix_world; o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
H = max(v.co.z for v in body.data.vertices)
me = body.data
P = np.array([v.co[:] for v in me.vertices]); N = len(P)

# ---------------- geodesic segmentation ----------------
adj = [[] for _ in range(N)]
for e in me.edges:
    a, b = e.vertices; d = float(np.linalg.norm(P[a] - P[b])); adj[a].append((b, d)); adj[b].append((a, d))
def dijkstra(seed):
    dist = np.full(N, 1e9); dist[seed] = 0; pq = [(0.0, seed)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]: continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]: dist[v] = nd; heapq.heappush(pq, (nd, v))
    return dist
def nearest(p): return int(np.argmin(np.linalg.norm(P - np.array(p), axis=1)))
seeds = {
    "armL": int(np.argmax(P[:, 0])), "armR": int(np.argmin(P[:, 0])),
    "legL": nearest((0.11 * H / 1.8, -0.02, 0.29 * H)), "legR": nearest((-0.11 * H / 1.8, -0.02, 0.29 * H)),
    "head": int(np.argmax(P[:, 2])), "torso": nearest((0, -0.12, 0.62 * H)),
}
DIST = {k: dijkstra(v) for k, v in seeds.items()}
keys = list(DIST); M = np.stack([DIST[k] for k in keys], 1)
LAB = np.array(keys)[np.argmin(M, 1)]
for k in keys: print("region", k, int((LAB == k).sum()))

# ---------------- landmarks ----------------
def pca(pts):
    c = pts.mean(0); u, sv, vt = np.linalg.svd(pts - c, full_matrices=False); return c, vt
LM = {}
for s_, sg in (("L", 1), ("R", -1)):
    A = P[LAB == "arm" + s_]
    tip = P[seeds["arm" + s_]]
    lower = A[A[:, 2] < 0.74 * H]
    c, vt = pca(lower); ax = vt[0] * (1 if vt[0][2] < 0 else -1)          # pointing down the arm
    sh = c + ax * ((0.815 * H - c[2]) / ax[2]); sh[0] -= sg * 0.03 * H / 1.8
    L = (tip - sh) @ ax
    proj = (A - sh) @ ax
    best = None
    for f in np.arange(0.55, 0.85, 0.01):                                   # wrist = narrowest section
        band = A[np.abs(proj - f * L) < 0.008]
        if len(band) < 6: continue
        perp = band - np.outer((band - sh) @ ax, ax)
        w = np.max(np.linalg.norm(perp - perp.mean(0), axis=1))
        if best is None or w < best[0]: best = (w, f)
    fw = best[1]; wr = sh + ax * fw * L
    el = sh + ax * (0.54 * fw * L) + np.array([0, 0.015, 0])               # elbow bent slightly back
    hand = A[proj > fw * L]
    hc, hv = pca(hand)
    pn = hv[2]                                                              # palm normal (thin axis)
    if pn[0] * sg < 0: pn = -pn                                             # A-pose: palms face the thighs -> outward normal
    LM["arm" + s_] = dict(sh=sh, el=el, wr=wr, tip=tip, pn=pn, ax=ax)
    G = P[LAB == "leg" + s_]
    foot = G[G[:, 2] < 0.07 * H]
    toe = foot[np.argmin(foot[:, 1])]; heel = foot[np.argmax(foot[:, 1])]
    def cen(z, tol=0.012):
        sl = G[np.abs(G[:, 2] - z) < tol]; return np.array([(sl[:, 0].min() + sl[:, 0].max()) / 2, (sl[:, 1].min() + sl[:, 1].max()) / 2, z])
    knee = cen(0.285 * H) + np.array([0, -0.012, 0])                         # knee bent slightly forward
    ank = cen(0.055 * H); ank[1] += 0.01
    LM["leg" + s_] = dict(knee=knee, ank=ank, toe=toe, heel=heel, top=cen(G[:, 2].max() - 0.03))
T_ = P[LAB == "torso"]
crotch = T_[np.abs(T_[:, 0]) < 0.03][:, 2].min()
hipz = crotch + 0.07 * H / 1.8
for s_, sg in (("L", 1), ("R", -1)):
    LM["leg" + s_]["hip"] = np.array([sg * 0.092 * H / 1.8, LM["leg" + s_]["knee"][1] + 0.01, hipz])
def ymid(z):
    sl = P[(np.abs(P[:, 2] - z) < 0.01) & (np.abs(P[:, 0]) < 0.08)]
    return (sl[:, 1].min() + sl[:, 1].max()) / 2 if len(sl) else 0.0
HEADP = P[LAB == "head"]
neck_base = 0.835 * H; head_base = 0.885 * H
print("crotch/H", round(crotch / H, 3), "hip/H", round(hipz / H, 3), "wrist frac", [round(float(np.linalg.norm(LM[k]["wr"] - LM[k]["sh"])), 3) for k in ("armL", "armR")])

# ---------------- metarig fit ----------------
bpy.ops.object.armature_human_metarig_add()
meta = bpy.context.object
bpy.ops.object.mode_set(mode="EDIT")
eb = meta.data.edit_bones
# drop the face rig (body-only character for now)
def kill(b):
    for c in list(b.children): kill(c)
    eb.remove(b)
if "face" in eb: kill(eb["face"])
old = {b.name: (b.head.copy(), b.tail.copy(), b.z_axis.copy()) for b in eb}
mh = max(max(h.z, t.z) for h, t, _ in old.values())
V = lambda a: Vector([float(x) for x in a])
def setb(n, h, t):
    b = eb[n]; oh, ot, oz = old[n]
    R = (ot - oh).normalized().rotation_difference((V(t) - V(h)).normalized()).to_matrix()
    b.head = V(h); b.tail = V(t); b.align_roll(R @ oz)
# spine chain
pel = (V(LM["legL"]["hip"]) + V(LM["legR"]["hip"])) / 2
zs = [pel.z, 0.62 * H, 0.70 * H, 0.77 * H, neck_base, 0.865 * H, head_base, H]
names = ["spine", "spine.001", "spine.002", "spine.003", "spine.004", "spine.005", "spine.006"]
for i, n in enumerate(names):
    setb(n, (0, ymid(zs[i]) + 0.01, zs[i]), (0, ymid(min(zs[i + 1], 0.97 * H)) + 0.01, zs[i + 1]))
for s_ in ("L", "R"):
    a = LM["arm" + s_]; l = LM["leg" + s_]; sg = 1 if s_ == "L" else -1
    setb(f"shoulder.{s_}", (sg * 0.02, ymid(0.80 * H) - 0.02, 0.80 * H), a["sh"])
    setb(f"upper_arm.{s_}", a["sh"], a["el"]); setb(f"forearm.{s_}", a["el"], a["wr"])
    # hand: wrist -> knuckles (45% to the fingertip); fingers follow by similarity transform
    knuck = V(a["wr"]) + (V(a["tip"]) - V(a["wr"])) * 0.45
    oh0, ot0, _ = old[f"hand.{s_}"]; omid = old[f"f_middle.03.{s_}"][1]
    va = omid - oh0; vb = V(a["tip"]) - V(a["wr"])
    R = va.normalized().rotation_difference(vb.normalized()).to_matrix()
    # align palm normals
    on = (old[f"palm.01.{s_}"][0] - old[f"palm.04.{s_}"][0]).cross(va).normalized()
    on2 = R @ on; tgt = V(a["pn"]); vbn = vb.normalized()
    on2 -= vbn * on2.dot(vbn); tgt -= vbn * tgt.dot(vbn)
    if on2.length > 1e-6 and tgt.length > 1e-6:
        R = on2.normalized().rotation_difference(tgt.normalized()).to_matrix() @ R
    k = vb.length / va.length
    for n, (h, t, z) in old.items():
        if n.endswith("." + s_) and n.split(".")[0] in ("hand", "palm", "f_index", "f_middle", "f_ring", "f_pinky", "thumb"):
            b = eb[n]; b.head = V(a["wr"]) + R @ (h - oh0) * k; b.tail = V(a["wr"]) + R @ (t - oh0) * k; b.align_roll(R @ z)
    setb(f"thigh.{s_}", l["hip"], l["knee"]); setb(f"shin.{s_}", l["knee"], l["ank"])
    ball = V(l["toe"]) + (V(l["heel"]) - V(l["toe"])) * 0.25; ball.z = 0.02 * H
    setb(f"foot.{s_}", l["ank"], ball); setb(f"toe.{s_}", ball, (l["toe"][0], l["toe"][1], 0.02 * H))
    hb = V(l["heel"]); setb(f"heel.02.{s_}", (hb.x - 0.04 * sg, hb.y, 0.0), (hb.x + 0.04 * sg, hb.y, 0.0))
    setb(f"pelvis.{s_}", (0, pel.y, pel.z), (sg * 0.12 * H / 1.8, pel.y - 0.08, pel.z + 0.12))
    setb(f"breast.{s_}", (sg * 0.10 * H / 1.8, ymid(0.73 * H) + 0.02, 0.73 * H), (sg * 0.10 * H / 1.8, ymid(0.73 * H) - 0.12, 0.73 * H))
bpy.ops.object.mode_set(mode="OBJECT")
# ---------------- generate ----------------
bpy.context.view_layer.objects.active = meta
for o in bpy.context.selected_objects: o.select_set(False)
meta.select_set(True)
bpy.ops.pose.rigify_generate()
rig = [o for o in bpy.data.objects if o.type == "ARMATURE" and o != meta][0]
rig.name = "rig"
print("rig bones", len(rig.data.bones))
# ---------------- bind ----------------
for o in bpy.context.selected_objects: o.select_set(False)
body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
gid = {g.index: g.name for g in body.vertex_groups}
ARMG = ("DEF-upper_arm", "DEF-forearm", "DEF-hand", "DEF-f_", "DEF-thumb", "DEF-palm")
LEGG = ("DEF-thigh", "DEF-shin", "DEF-foot", "DEF-toe")
fixed = 0
for v in me.vertices:
    lab = LAB[v.index]
    bad = []
    for ge in v.groups:
        n = gid[ge.group]
        if lab.startswith("leg") and n.startswith(ARMG): bad.append(ge.group)
        elif lab.startswith("arm") and n.startswith(LEGG): bad.append(ge.group)
        elif lab.startswith("arm") and n.endswith((".L", ".R")) and n[-1] != lab[-1]: bad.append(ge.group)
        elif lab.startswith("leg") and n.endswith((".L", ".R")) and n[-1] != lab[-1]: bad.append(ge.group)
    if not bad: continue
    keep = [(ge.group, ge.weight) for ge in v.groups if ge.group not in bad]
    for g in bad: body.vertex_groups[g].remove([v.index])
    tot = sum(w for _, w in keep)
    for g, w in keep: body.vertex_groups[g].add([v.index], w / tot if tot > 1e-5 else 0, "REPLACE")
    if tot <= 1e-5:
        fb = {"armL": "DEF-hand.L", "armR": "DEF-hand.R", "legL": "DEF-thigh.L", "legR": "DEF-thigh.R"}.get(lab, "DEF-spine")
        body.vertex_groups[fb].add([v.index], 1.0, "REPLACE")
    fixed += 1
print("bleed fixed", fixed)
mr = body.modifiers["Multires"]
if body.modifiers[0].name != "Multires": body.modifiers.move(body.modifiers.find("Multires"), 0)
mr.levels = 0; mr.render_levels = 2
for e in eyes:
    mw = e.matrix_world.copy(); e.parent = rig; e.parent_type = "BONE"; e.parent_bone = "DEF-spine.006"
    bpy.context.view_layer.update(); e.matrix_world = mw
meta.hide_render = True; meta.hide_viewport = True
np.save(os.path.join(D, "hb_labels.npy"), LAB)
json.dump({k: {kk: [float(x) for x in vv] for kk, vv in v.items()} for k, v in LM.items()}, open(os.path.join(D, "hb_landmarks.json"), "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT)
