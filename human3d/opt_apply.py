import json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from opt import PARAMS, ST
from score import score
S = json.load(open(ST)); x = S["x"]
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/opt.blend"
env = dict(os.environ, MB_HAIR=os.environ.get("MB_HAIR", "20000"), MB_OUT=out)
env["MB_SLIDERS"] = json.dumps({k: v for k, v in x.items() if PARAMS[k][0] == "sl"})
for k, v in x.items():
    if PARAMS[k][0] == "env": env[k] = str(v)
env["POSE_JSON"] = json.dumps({k: v for k, v in x.items() if PARAMS[k][0] == "pose"})
subprocess.run(["python3", "build_mb.py"], cwd=D, env=env, capture_output=True)
subprocess.run(["python3", "sil_render.py", "/tmp/best.png"], cwd=D, env=env, capture_output=True)
print(score("/tmp/best.png", "/tmp/diff_best.png"), json.dumps(x))
