"""jobs/<id>.json -> out/<id>/<voice>/<nn>.mp3 via Microsoft Edge neural TTS (no API key)."""
import asyncio, glob, json, os
import edge_tts

async def one(text, voice, rate, pitch, fn):
    for attempt in range(4):
        try:
            c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await c.save(fn)
            return
        except Exception as e:
            print("retry", fn, e); await asyncio.sleep(5 * (attempt + 1))
    raise RuntimeError(fn)

async def main():
    for path in sorted(glob.glob("jobs/*.json")):
        jid = os.path.splitext(os.path.basename(path))[0]
        job = json.load(open(path, encoding="utf-8"))
        for voice in job.get("edge_voices", ["th-TH-NiwatNeural"]):
            d = f"out/{jid}/{voice}"; os.makedirs(d, exist_ok=True)
            for i, line in enumerate(job["lines"]):
                fn = f"{d}/{i:02d}.mp3"
                if not os.path.exists(fn):
                    await one(line, voice, job.get("rate", "+0%"), job.get("pitch", "+0Hz"), fn)
                    print("wrote", fn)
asyncio.run(main())
