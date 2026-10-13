import sys, numpy as np
from PIL import Image
REF = "/root/.claude/uploads/f6cda236-86ed-5ede-b6e0-84d77123ae3b/d8db2636-image.png"
def ref_sil():
    im = Image.open(REF).convert("RGB"); w, h = im.size; im = im.crop((0, 0, w // 2, h))
    a = np.asarray(im).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ~((b > r + 40) & (b > g + 10))
def norm(m, H=600, cut=0.92):
    ys, xs = np.where(m); top, bot = ys.min(), ys.max()
    # horizontal center from head (top 8%) for alignment
    hh = bot - top; head = m[top:top + int(0.08 * hh)]; hx = np.where(head)[1].mean()
    sc = H / hh
    im = Image.fromarray((m * 255).astype("uint8"))
    W = int(m.shape[1] * sc); im = im.resize((W, int(m.shape[0] * sc)))
    a = np.asarray(im) > 127
    t = int(top * sc); cx = int(hx * sc)
    out = np.zeros((int(H * cut), 400), bool)
    sub = a[t:t + out.shape[0], max(0, cx - 200):cx + 200]
    out[:sub.shape[0], :sub.shape[1]] = sub
    return out
R = norm(ref_sil())
def score(path, save=None):
    a = np.asarray(Image.open(path).convert("RGBA"))[..., 3] > 128
    M = norm(a)
    inter = (R & M).sum(); uni = (R | M).sum()
    # row-wise width error, weighted
    wr = R.sum(1); wm = M.sum(1)
    err = np.abs(wr - wm).mean() / 400
    if save:
        v = np.zeros(R.shape + (3,), np.uint8); v[R & M] = 255; v[R & ~M] = (255, 60, 60); v[M & ~R] = (60, 160, 255)
        Image.fromarray(v).save(save)
    return 1 - inter / uni, err
if __name__ == "__main__":
    iou_loss, werr = score(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(f"{iou_loss:.4f} {werr:.4f}")
