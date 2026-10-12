import glob, json, os
from gtts import gTTS
for path in sorted(glob.glob("jobs/*.json")):
    jid = os.path.splitext(os.path.basename(path))[0]
    job = json.load(open(path, encoding="utf-8"))
    d = f"out/{jid}/gtts"; os.makedirs(d, exist_ok=True)
    for i, line in enumerate(job["lines"]):
        fn = f"{d}/{i:02d}.mp3"
        if not os.path.exists(fn):
            gTTS(line, lang="th").save(fn); print("wrote", fn)
