import sys, numpy as np
from PIL import Image
from ratios import sil
def arm(im):
    m=sil(im); ys=np.where(m.sum(1)>3)[0]; t,b=ys.min(),ys.max(); H=b-t
    cx=int(np.median(np.where(m[t+int(.05*H)])[0]))
    res={}
    for side,sg in (("L",-1),("R",1)):
        # wrist/fingertip: lowest row where silhouette exists in the outermost band beyond shorts
        best=None
        for y in range(t+int(.35*H), t+int(.75*H)):
            xs=np.where(m[y])[0]; xs=xs[(xs-cx)*sg>0]
            if len(xs)==0: continue
            # gap present between body and arm?
            row=m[y]; seg=[]; inside=False
            rng=range(cx,m.shape[1]) if sg>0 else range(cx,-1,-1)
            for x in rng:
                if row[x] and not inside: seg.append(x); inside=True
                elif not row[x]: inside=False
            if len(seg)>=2: best=y
        res[side]=(best-t)/H if best else None
    # elbow approx: narrowest arm row? skip
    return res
REF="/root/.claude/uploads/f6cda236-86ed-5ede-b6e0-84d77123ae3b/d8db2636-image.png"
r=Image.open(REF); w,h=r.size
print("ref", arm(r.crop((0,0,w//2,int(h*.95)))))
print("me ", arm(Image.open(sys.argv[1])))
