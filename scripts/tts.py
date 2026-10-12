"""Render TTS jobs: jobs/<id>.json -> out/<id>/<nn>.wav (one file per line).
Job format:
{ "model": "gemini-3.8-flash-tts", "voice": "Kore", "style": "...",
  "lines": ["ประโยคที่ 1", "ประโยคที่ 2", ...] }
"""
import base64, glob, json, os, sys, time, urllib.request, urllib.error

KEY = os.environ["GEMINI_API_KEY"]
URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

def tts(text, model, voice, style):
    item = {"type": "text", "text": text}
    if style:
        item["annotations"] = [{"type": "speech_metadata", "style": style}]
    body = {
        "model": model,
        "input": [{"type": "user_input", "content": [item]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(),
        headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                res = json.load(r)
            audio = [c for s in res.get("steps", []) if s.get("type") == "model_output"
                     for c in s.get("content", []) if c.get("type") == "audio"]
            if not audio:
                raise RuntimeError("no audio in response: " + json.dumps(res)[:500])
            return base64.b64decode(audio[-1]["data"])
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:500]
            print(f"HTTP {e.code}: {msg}", file=sys.stderr)
            if e.code in (429, 500, 503) and attempt < 3:
                time.sleep(10 * (attempt + 1)); continue
            raise

done = 0
for path in sorted(glob.glob("jobs/*.json")):
    jid = os.path.splitext(os.path.basename(path))[0]
    job = json.load(open(path, encoding="utf-8"))
    outdir = f"out/{jid}"
    os.makedirs(outdir, exist_ok=True)
    for i, line in enumerate(job["lines"]):
        fn = f"{outdir}/{i:02d}.wav"
        if os.path.exists(fn):
            continue
        wav = tts(line, job.get("model", "gemini-3.8-flash-tts"), job.get("voice", "Kore"), job.get("style", ""))
        open(fn, "wb").write(wav)
        print("wrote", fn, len(wav)); done += 1
print("done", done)
