"""Coordinate-descent fit of body sliders / pose / garment params to the reference silhouette.
State in opt_state.json; resumable; stops before the time budget."""
import json, os, subprocess, time, sys
D = os.path.dirname(os.path.abspath(__file__)); ST = os.path.join(D, "opt_state.json")
from score import score
PARAMS = {  # name: (kind, start, step, lo, hi)
 "Shoulders_PosZ": ("sl", 0.0, 0.2, 0, 1), "Neck_TrapeziousSize": ("sl", 0.3, 0.2, 0, 1), "Neck_Length": ("sl", 0.85, 0.15, 0, 1),
 "Shoulders_SizeX": ("sl", 1.0, 0.15, 0, 1), "Shoulders_Size": ("sl", 0.6, 0.2, 0, 1), "Torso_Vshape": ("sl", 0.9, 0.15, 0, 1),
 "Chest_Girth": ("sl", 0.82, 0.15, 0, 1), "Arms_UpperarmGirth": ("sl", 0.7, 0.15, 0, 1), "Arms_UpperarmLength": ("sl", 0.82, 0.15, 0, 1),
 "Arms_ForearmLength": ("sl", 0.78, 0.15, 0, 1), "Legs_UpperlegLength": ("sl", 0.8, 0.15, 0, 1), "Legs_LowerlegLength": ("sl", 0.78, 0.15, 0, 1),
 "Legs_UpperThighGirth": ("sl", 0.62, 0.15, 0, 1), "Legs_CalfGirth": ("sl", 0.8, 0.15, 0, 1), "Head_Size": ("sl", 0.7, 0.15, 0, 1),
 "Torso_Length": ("sl", 0.25, 0.15, 0, 1), "Waist_Size": ("sl", 0.2, 0.15, 0, 1),
 "SH_MARGIN": ("env", 0.026, 0.01, 0.005, 0.06), "SH_HEM": ("env", 0.045, 0.03, -0.05, 0.15),
 "foot_x": ("pose", 0.16, 0.03, 0.08, 0.26), "hand_dx": ("pose", 0.12, 0.04, -0.02, 0.25), "hand_L": ("pose", 0.95, 0.02, 0.85, 0.99),
 "hand_dy": ("pose", -0.06, 0.04, -0.2, 0.1),
}
def load():
    if os.path.exists(ST): return json.load(open(ST))
    return {"x": {k: v[1] for k, v in PARAMS.items()}, "best": None, "queue": [], "evals": 0, "round": 0}
def evaluate(x, tag, need_build=True):
    env = dict(os.environ, MB_HAIR="20000", MB_OUT="/tmp/opt.blend")
    env["MB_SLIDERS"] = json.dumps({k: v for k, v in x.items() if PARAMS[k][0] == "sl"})
    for k, v in x.items():
        if PARAMS[k][0] == "env": env[k] = str(v)
    env["POSE_JSON"] = json.dumps({k: v for k, v in x.items() if PARAMS[k][0] == "pose"})
    key = json.dumps({k: v for k, v in x.items() if PARAMS[k][0] != "pose"}, sort_keys=True)
    if need_build or S.get("built") != key:
        subprocess.run(["python3", "build_mb.py"], cwd=D, env=env, capture_output=True); S["built"] = key
    out = f"/tmp/opt_{tag}.png"
    subprocess.run(["python3", "sil_render.py", out], cwd=D, env=env, capture_output=True)
    l, w = score(out)
    return l + 2 * w
if __name__ == '__main__':
    T0 = time.time(); BUDGET = float(sys.argv[1]) if len(sys.argv) > 1 else 540
    S = load()
    if S["best"] is None:
        S["best"] = evaluate(S["x"], "base"); S["evals"] += 1; json.dump(S, open(ST, "w"), indent=1)
        print("base", S["best"])
    while time.time() - T0 < BUDGET - 90:
        if not S["queue"]:
            S["round"] += 1
            S["queue"] = [(k, d) for k in PARAMS for d in (+1, -1)]
            if S["round"] > 1: PARAMS_scale = 0.5 ** (S["round"] - 1)
        k, d = S["queue"].pop(0)
        kind, _, step, lo, hi = PARAMS[k]
        step *= 0.6 ** (S["round"] - 1)
        x = dict(S["x"]); x[k] = round(min(hi, max(lo, x[k] + d * step)), 4)
        if x[k] == S["x"][k]: continue
        f = evaluate(x, "try", need_build=(kind != "pose")); S["evals"] += 1
        msg = f"r{S['round']} {k} {S['x'][k]}->{x[k]}  {f:.4f} vs {S['best']:.4f}"
        if f < S["best"] - 1e-4:
            S["best"] = f; S["x"] = x; msg += "  ACCEPT"
            S["queue"] = [q for q in S["queue"] if q[0] != k]   # skip opposite direction
        print(msg, flush=True)
        json.dump(S, open(ST, "w"), indent=1)
    print("best", S["best"], "evals", S["evals"], "queue", len(S["queue"]))
