"""Convex 'cloth envelope': per z-slice convex hull of body points, optionally made to hang
(monotone down from a level), smoothed; garments are projected onto it -> straight, loose fabric."""
import math

def _hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3: return pts
    def cr(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

def _ray(poly, cx, cy, th):
    dx, dy = math.cos(th), math.sin(th); best = None
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        ex, ey = x2 - x1, y2 - y1
        den = dx * ey - dy * ex
        if abs(den) < 1e-12: continue
        t = ((x1 - cx) * ey - (y1 - cy) * ex) / den
        u = ((x1 - cx) * dy - (y1 - cy) * dx) / den
        if t > 0 and -1e-6 <= u <= 1 + 1e-6 and (best is None or t < best): best = t
    return best

class Envelope:
    def __init__(self, pts, z0, z1, center, dz=0.01, NA=96, hang_from=None, hang_dir=-1, taper=0.0, zsmooth=4, slab=0.012):
        """pts: list of (x,y,z). center(z)->(cx,cy). hang_from: z level from which radius never shrinks
        moving in hang_dir (-1 = downward). taper: radius change per meter in hang region (+ flares)."""
        self.z0, self.dz, self.NA, self.center = z0, dz, NA, center
        nz = int((z1 - z0) / dz) + 1; self.nz = nz
        R = []
        for k in range(nz):
            z = z0 + k * dz; cx, cy = center(z)
            sl = [(p[0], p[1]) for p in pts if abs(p[2] - z) < slab]
            poly = _hull(sl) if len(sl) >= 3 else None
            row = []
            for a in range(NA):
                th = -math.pi + (a + 0.5) * 2 * math.pi / NA
                r = _ray(poly, cx, cy, th) if poly else None
                row.append(r)
            R.append(row)
        # fill missing rows/cells from neighbours
        for k in range(nz):
            for a in range(NA):
                if R[k][a] is None:
                    for d in range(1, nz):
                        for kk in (k - d, k + d):
                            if 0 <= kk < nz and R[kk][a] is not None: R[k][a] = R[kk][a]; break
                        if R[k][a] is not None: break
                    if R[k][a] is None: R[k][a] = 0.1
        if hang_from is not None:
            ks = int((hang_from - z0) / dz)
            order = range(ks - 1, -1, -1) if hang_dir < 0 else range(ks + 1, nz)
            prev = ks
            for k in order:
                for a in range(NA):
                    R[k][a] = max(R[k][a], R[prev][a] + taper * dz)
                prev = k
        for _ in range(zsmooth):
            R = [[(R[max(k-1,0)][a] + 2*R[k][a] + R[min(k+1,nz-1)][a]) / 4 for a in range(NA)] for k in range(nz)]
        for _ in range(3):
            R = [[(row[a-1] + 2*row[a] + row[(a+1) % NA]) / 4 for a in range(NA)] for row in R]
        self.R = R

    def radius(self, z, th):
        fk = (z - self.z0) / self.dz; k0 = max(0, min(self.nz - 1, int(math.floor(fk)))); k1 = min(self.nz - 1, k0 + 1)
        tk = max(0.0, min(1.0, fk - k0))
        fa = (th + math.pi) / (2 * math.pi) * self.NA - 0.5; a0 = int(math.floor(fa)) % self.NA; a1 = (a0 + 1) % self.NA
        ta = fa - math.floor(fa)
        def g(k): return self.R[k][a0] * (1 - ta) + self.R[k][a1] * ta
        return g(k0) * (1 - tk) + g(k1) * tk

    def project(self, x, y, z, margin):
        cx, cy = self.center(z); th = math.atan2(y - cy, x - cx)
        r = self.radius(z, th) + margin
        return (cx + r * math.cos(th), cy + r * math.sin(th), z)
