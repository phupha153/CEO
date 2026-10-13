import sys, numpy as np
from PIL import Image
def sil(im):
    a = np.asarray(im.convert("RGB")).astype(int); r,g,b = a[...,0],a[...,1],a[...,2]
    # background is blue: b high relative to r
    return ~((b > r + 40) & (b > g + 10))
def profile(im, label):
    m = sil(im); H, W = m.shape
    rows = np.where(m.sum(1) > 3)[0]; top, bot = rows.min(), rows.max(); h = bot - top
    out = {}
    for f in [0.03,0.07,0.10,0.13,0.15,0.17,0.19,0.21,0.24,0.28,0.32,0.36,0.40,0.44,0.48,0.52,0.56,0.62,0.70,0.80,0.90]:
        y = int(top + f * h); xs = np.where(m[y])[0]
        out[f] = ((xs.max() - xs.min()) / h) if len(xs) else 0
    return h, out
ref = Image.open("/root/.claude/uploads/f6cda236-86ed-5ede-b6e0-84d77123ae3b/d8db2636-image.png")
w, hh = ref.size
r = ref.crop((0, 0, w // 2, int(hh * 0.95)))
m = Image.open(sys.argv[1])
h1, p1 = profile(r, "ref"); h2, p2 = profile(m, "me")
print("height px", h1, h2)
for f in p1: print(f"{f:.2f}  ref {p1[f]:.3f}  me {p2[f]:.3f}  diff {p2[f]-p1[f]:+.3f}")
Image.fromarray((sil(r)*255).astype('uint8')).save('/tmp/sil_ref.png'); Image.fromarray((sil(m)*255).astype('uint8')).save('/tmp/sil_me.png')
