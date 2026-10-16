"""Runs AI jobs in ai/jobs/*.json on GitHub Actions (full internet).
Step types:
  gemini_image: Nano Banana image edit/generation  {input?, refs[], prompt, out, model?}
  fal:          any fal.ai endpoint                  {endpoint, args{}, files{argpath: localpath}, out}
A step is skipped if its `out` exists (delete it to re-run). Logs -> ai/out/<job>_log.txt"""
import os, sys, json, glob, base64, time, traceback, mimetypes, urllib.request
import requests

GEM = os.environ.get("GEMINI_API_KEY", ""); FAL = os.environ.get("FAL_KEY", "")
MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-2.5-flash-image-preview"]

def b64(p): return base64.b64encode(open(p, "rb").read()).decode()

def gemini_image(st):
    parts = []
    for p in ([st["input"]] if st.get("input") else []) + st.get("refs", []):
        parts.append({"inline_data": {"mime_type": mimetypes.guess_type(p)[0] or "image/png", "data": b64(p)}})
    parts.append({"text": st["prompt"]})
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}}
    if st.get("aspect"): body["generationConfig"]["imageConfig"] = {"aspectRatio": st["aspect"]}
    last = None
    for m in ([st["model"]] if st.get("model") else MODELS):
        r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                          headers={"x-goog-api-key": GEM, "Content-Type": "application/json"}, json=body, timeout=300)
        print("gemini", m, r.status_code)
        if r.status_code != 200: last = r.text[:800]; print(last); continue
        for c in r.json().get("candidates", []):
            for p in c.get("content", {}).get("parts", []):
                d = p.get("inline_data") or p.get("inlineData")
                if d:
                    open(st["out"], "wb").write(base64.b64decode(d["data"])); print("saved", st["out"]); return
                if "text" in p: print("text:", p["text"][:400])
        last = "no image in response"
    raise RuntimeError(last)

def gemini_tts(st):
    import wave
    body = {"contents": [{"parts": [{"text": st["text"]}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": st.get("voice", "Charon")}}}}}
    last = None
    for m in ([st["model"]] if st.get("model") else ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]):
        r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                          headers={"x-goog-api-key": GEM, "Content-Type": "application/json"}, json=body, timeout=300)
        print("tts", m, r.status_code)
        if r.status_code != 200: last = r.text[:800]; print(last); continue
        for c in r.json().get("candidates", []):
            for p in c.get("content", {}).get("parts", []):
                d = p.get("inline_data") or p.get("inlineData")
                if d:
                    pcm = base64.b64decode(d["data"]); rate = 24000
                    mt = d.get("mime_type") or d.get("mimeType") or ""
                    if "rate=" in mt: rate = int(mt.split("rate=")[1].split(";")[0])
                    w = wave.open(st["out"], "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm); w.close()
                    print("saved", st["out"], mt); return
        last = "no audio in response"
    raise RuntimeError(last)

def fal_upload(path):
    import fal_client
    return fal_client.upload_file(path)

def fal(st):
    import fal_client
    args = json.loads(json.dumps(st.get("args", {})))
    def setp(obj, path, val):
        ks = path.split(".")
        for k in ks[:-1]:
            k = int(k) if k.isdigit() else k
            obj = obj[k]
        k = ks[-1]; k = int(k) if k.isdigit() else k
        obj[k] = val
    for path, local in st.get("files", {}).items():
        url = fal_upload(local); print("uploaded", local, url); setp(args, path, url)
    def upd(u):
        if hasattr(u, "logs") and u.logs:
            for l in u.logs: print(l.get("message"))
    res = fal_client.subscribe(st["endpoint"], arguments=args, with_logs=True, on_queue_update=upd)
    print(json.dumps(res)[:1500])
    url = (res.get("video") or res.get("image") or (res.get("images") or [{}])[0]).get("url")
    urllib.request.urlretrieve(url, st["out"]); print("saved", st["out"])

for jf in sorted(glob.glob("ai/jobs/*.json")):
    job = json.load(open(jf)); name = os.path.splitext(os.path.basename(jf))[0]
    log = open(f"ai/out/{name}_log.txt", "a"); sys.stdout = log
    print(f"=== {time.ctime()} {name}")
    for st in job["steps"]:
        if os.path.exists(st["out"]): print("skip", st["out"]); continue
        try:
            if st["type"] == "gemini_image":
                if not GEM: print("NO GEMINI_API_KEY secret"); break
                gemini_image(st)
            elif st["type"] == "gemini_tts":
                if not GEM: print("NO GEMINI_API_KEY secret"); break
                gemini_tts(st)
            elif st["type"] == "fal":
                if not FAL: print("NO FAL_KEY secret"); break
                fal(st)
        except Exception:
            traceback.print_exc()
            if not job.get("independent"): break      # later steps depend on earlier ones
        log.flush()
    sys.stdout = sys.__stdout__; log.close()
