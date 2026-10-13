import sys, numpy as np
from PIL import Image
def sil(im):
    a=np.asarray(im.convert('RGBA')).astype(int)
    if a[...,3].min()<250: return a[...,3]>128
    return ~((a[...,2]>a[...,0]+40)&(a[...,2]>a[...,1]+10))
def ratios(im):
    m=sil(im); ys=np.where(m.sum(1)>3)[0]; t,b=ys.min(),ys.max(); H=b-t
    W=np.array([(np.where(m[y])[0].max()-np.where(m[y])[0].min()) if m[y].any() else 0 for y in range(t,b)])/H
    i0,i1=int(.07*H),int(.2*H); neck=i0+np.argmin(W[i0:i1])
    # chin ~ where width drops below 0.8*headw going down from head max
    hm=int(np.argmax(W[:neck])); hw=W[hm]
    chin=hm+next((i for i,v in enumerate(W[hm:neck]) if v<0.82*hw), neck-hm)
    sh=W[neck:int(.32*H)].max(); shy=neck+int(np.argmax(W[neck:int(.32*H)]))
    # crotch: first row below 40% where silhouette splits into 2 legs in middle
    cx=int(np.median(np.where(m[t+int(.6*H)])[0]))
    cr=next(y for y in range(t+int(.4*H),b) if not m[y,cx-2:cx+3].any())
    return dict(heads=H/chin, chin=chin/H, neck=neck/H, neck_w=W[neck], head_w=hw, sh_w=sh, sh_y=shy/H, crotch=(cr-t)/H)
REF="/root/.claude/uploads/f6cda236-86ed-5ede-b6e0-84d77123ae3b/d8db2636-image.png"
r=Image.open(REF); w,h=r.size; R=ratios(r.crop((0,0,w//2,int(h*.95))))
if __name__=="__main__":
  M=ratios(Image.open(sys.argv[1]))
  for k in R: print(f"{k:8s} ref {R[k]:.3f}  me {M[k]:.3f}  {'OK' if abs(M[k]-R[k])/max(R[k],1e-3)<0.05 else 'XX'}")
