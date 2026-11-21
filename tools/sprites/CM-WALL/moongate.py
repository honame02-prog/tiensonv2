"""Nguyệt môn CM-WALL/moongate_h làm lại (Opus tự làm, 22/11) theo công thức CM-TERR
(stair.py/slab.py/bamboo.py): cắt từ concept C gốc V1-original.png, median theo ô,
chuyển trung bình/độ lệch từng kênh THEO CHẤT LIỆU (mái ngói / vòng đá / vữa đỏ) về đúng
vùng đó trong V1.png (V1 = V1-original thu 3,483 lần, khớp lệch 0 px), đo trên điểm đặc;
lượng tử về bảng STYLE §5 + màu V1.png vùng cổng; khử điểm cô lập; alpha 0/255.
Hai đầu tường 34x70 = đúng mép cwall_h_2 (tường viện CM-WALL3 đã duyệt) như cũ để nối khít.
Giữ kích thước 192x146, anchor/footprint/collide như mảnh cũ.

Tỉ lệ: SX 3,15 (thân cổng nguồn x112..502 rơi đúng cột 34..158 giữa hai đầu tường),
SY 3,25 (mái cao tới y~287 vẫn nằm trong khung 146 px; với 3,05 sẽ mất đỉnh mái).
Lòng cổng nguồn (307,2; 571,3; 148 x 153) -> game ~94 x 94 px, vẫn tròn.

Chạy: python -X utf8 tools/sprites/CM-WALL/moongate.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, io, json, math, re, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/kits/CM-WALL'
REF = ROOT / '.agents/refs/CM'
SRCF = REF / 'V1-original.png'
W, H = 192, 146
SX, SY = 3.15, 3.25
CX, GROUND = 307.2, 760.0            # tâm lòng cổng -> cột 96; chân tường -> đáy khung
X0 = CX - 96 * SX
Y0 = GROUND - H * SY
# Khớp elip mép trong vòng đá (72 tia) = (307,2; 571,3; 148,0; 153,2), nới 3%: dải trong cùng
# là bóng lòng vòm (28% điểm tối) làm mép trong lởm chởm.
INNER = (307.2, 571.3, 152.4, 157.8)
OUTER = (308.5, 570.9, 167.0, 171.6)   # mép ngoài vòng đá (+1 px)
# Vòng cổng khớp trực tiếp trên V1.png (65 tia, ngưỡng sáng 105).
V1_INNER = (86.5, 157.6, 54.0, 53.4)
V1_OUTER = (86.8, 159.3, 57.2, 57.3)
V1_C, SRC_C = (86.6, 158.5), (307.8, 571.1)
V1_K = ((148 + 166) / (54.0 + 56.5), (153.2 + 170.6) / (53.4 + 56.6))   # ~2,84 / 2,94
# Mép dưới mái ngói (đầu vữa đỏ) theo |x-307| đo trên bản đồ chất liệu nguồn.
EAVE_DX = [0, 75, 100, 120, 125, 130, 140, 160, 190, 260]
EAVE_Y = [382, 390, 398, 406, 414, 422, 430, 438, 446, 446]
# Viền cổng vẽ tay (từ build.py cũ): mái + thân + tường thấp hai bên.
CONTOUR = [(0, 613), (112, 613), (112, 424), (102, 416), (100, 409), (87, 402),
    (80, 389), (79, 377), (84, 370), (92, 370), (99, 376), (110, 376), (124, 363),
    (133, 350), (123, 344), (115, 334), (112, 324), (114, 316), (121, 311), (129, 312),
    (134, 318), (130, 323), (140, 329), (158, 329), (184, 322), (217, 309),
    (251, 298), (281, 290), (308, 287), (336, 290), (370, 299), (403, 312),
    (432, 325), (456, 331), (474, 327), (483, 320), (483, 313), (493, 312),
    (500, 318), (504, 329), (500, 341), (489, 351), (496, 363), (508, 374),
    (521, 375), (527, 369), (535, 371), (540, 379), (538, 390), (530, 401),
    (515, 411), (509, 423), (508, 613), (618, 613), (618, 760), (0, 760)]
PLASTER_SPLIT = 640
ENDS = ((slice(76, 146), slice(0, 34)), (slice(76, 146), slice(158, 192)))
SOURCE = {'file': '.agents/refs/CM/V1-original.png', 'crop': [0, 286, 618, 760],
          'scale': [SX, SY], 'inner_ellipse': list(INNER), 'outer_ellipse': list(OUTER),
          'method': 'CM-TERR recipe (Opus 22/11): median cells; per-material (roof/rim/plaster) '
                    'channel mean/std transfer to V1.png same region (solid pixels); STYLE5+V1 palette; '
                    'despeckle; alpha 0/255; ends = CM-WALL/cwall_h_2 34x70'}


def palette():
    style = (ROOT / 'docs/assetgen/STYLE.md').read_text(encoding='utf-8')
    sec = style.split('## 5.')[1].split('## 6.')[0]
    cols = {tuple(bytes.fromhex(h)) for h in re.findall(r'#([0-9a-fA-F]{6})', sec)}
    v1 = np.array(Image.open(REF / 'V1.png').convert('RGB'))[73:219, :176]
    cols |= {tuple(int(v) for v in c) for c in np.unique(v1.reshape(-1, 3), axis=0)}
    return np.array(sorted(cols), dtype=np.int32)


PAL = palette()


def quantize(rgb):
    flat = rgb.reshape(-1, 3).astype(np.int32)
    return PAL[((flat[:, None, :] - PAL[None]) ** 2).sum(2).argmin(1)].reshape(rgb.shape).astype(np.uint8)


def materials(x, y):
    """Nhãn chất liệu tại toạ độ nguồn: 0 lòng cổng, 1 vòng đá, 2 mái ngói, 3 vữa đỏ thân, 4 vữa tường thấp."""
    def inside(e, k=1.0):
        return ((x - e[0]) / (e[2] * k)) ** 2 + ((y - e[1]) / (e[3] * k)) ** 2 <= 1
    lab = np.full(np.shape(x), 3, np.int8)
    lab[y >= PLASTER_SPLIT] = 4          # tường thấp dưới (vữa ấm khác thân trên; scout 22/11)
    lab[y < np.interp(np.abs(x - 307), EAVE_DX, EAVE_Y)] = 2
    lab[inside(OUTER)] = 1
    lab[inside(INNER)] = 0
    return lab


def contour_mask(shape):
    m = Image.new('L', (shape[1], shape[0]))
    ImageDraw.Draw(m).polygon(CONTOUR, fill=255)
    return np.array(m) > 0


def cells():
    src = np.array(Image.open(SRCF).convert('RGB'))
    solid_src = contour_mask(src.shape)
    xe = X0 + np.arange(W + 1) * SX; ye = Y0 + np.arange(H + 1) * SY
    rgb = np.zeros((H, W, 3), np.uint8); alpha = np.zeros((H, W), bool)
    for y in range(H):
        y0 = int(round(ye[y])); y1 = max(y0 + 1, int(round(ye[y + 1])))
        for x in range(W):
            x0 = int(round(xe[x])); x1 = max(x0 + 1, int(round(xe[x + 1])))
            s = solid_src[y0:y1, x0:x1]
            if s.size and s.mean() >= .5:
                rgb[y, x] = np.median(src[y0:y1, x0:x1][s], axis=0); alpha[y, x] = True
    gx, gy = np.meshgrid(X0 + (np.arange(W) + .5) * SX, Y0 + (np.arange(H) + .5) * SY)
    lab = materials(gx, gy)
    alpha &= lab > 0
    # Vòng đá liền: ô nằm trên vòng mà viền tay bỏ sót thì vẫn đặc (lấy median ô như thường).
    for y, x in zip(*np.nonzero((lab == 1) & ~alpha)):
        y0 = int(round(ye[y])); x0 = int(round(xe[x]))
        rgb[y, x] = np.median(src[y0:y0 + 3, x0:x0 + 3].reshape(-1, 3), axis=0); alpha[y, x] = True
    return rgb, alpha, lab


def targets():
    """Thống kê đích từng chất liệu trên V1.png, chỉ điểm đặc. Ở vùng cổng V1.png KHÔNG phải
    bản thu đều của V1-original (cổng to hơn ~1,17 lần, vòng mảnh hơn), nên: vòng/lòng cổng
    dùng elip khớp trực tiếp trên V1.png; viền mái/vữa ánh xạ từ nguồn qua tâm + bán kính vòng."""
    v1 = np.array(Image.open(REF / 'V1.png').convert('RGB')).astype(float)
    sh = (941, 1672); solid_src = contour_mask(sh)
    vy, vx = np.mgrid[70:225, 0:185]
    vx = vx + .5; vy = vy + .5
    sx = SRC_C[0] + (vx - V1_C[0]) * V1_K[0]; sy = SRC_C[1] + (vy - V1_C[1]) * V1_K[1]
    solid = solid_src[np.clip(sy.astype(int), 0, sh[0] - 1), np.clip(sx.astype(int), 0, sh[1] - 1)]
    lab = materials(sx, sy)
    def inside(e):
        return ((vx - e[0]) / e[2]) ** 2 + ((vy - e[1]) / e[3]) ** 2 <= 1
    low = lab <= 1
    lab[low] = np.where(sy[low] >= PLASTER_SPLIT, 4, 3)
    lab[inside(V1_OUTER)] = 1
    lab[inside(V1_INNER)] = 0
    v1 = v1[70:225, 0:185]
    out = {}
    for k in (1, 2, 3, 4):
        px = v1[solid & (lab == k)]
        out[k] = (px.mean(0), px.std(0) + 1e-6, len(px))
    return out


def isolated(a):
    q = a[:, :, :3]; s = a[:, :, 3] > 0; h, w = s.shape
    p = np.pad(q, ((1, 1), (1, 1), (0, 0)), mode='edge'); ps = np.pad(s, 1)
    iso = s.copy()
    for dy, dx in ((0, 1), (2, 1), (1, 0), (1, 2)):
        iso &= ~((p[dy:dy + h, dx:dx + w] == q).all(2) & ps[dy:dy + h, dx:dx + w])
    return iso


def despeckle(a, keep):
    """Như stair.py: điểm đặc không trùng màu láng giềng 4 hướng nào -> màu đặc phổ biến nhất
    trong 8 láng giềng. Một lượt, tất định; không đụng vùng `keep`."""
    h, w = a.shape[:2]; out = a.copy()
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)))
    for y, x in zip(*np.nonzero(isolated(a) & ~keep)):
        nb = [tuple(p[y + dy, x + dx, :3]) for dy in range(3) for dx in range(3)
              if (dy, dx) != (1, 1) and p[y + dy, x + dx, 3] > 0]
        if nb:
            out[y, x, :3] = max(sorted(set(nb)), key=nb.count)
    return out


def ends():
    wall = np.array(Image.alpha_composite(Image.open(OUT / 'cwall_h_2.png').convert('RGBA'),
                                          Image.open(OUT / 'cwall_h_2_roof.png').convert('RGBA')))
    L = wall[:, 30:64].copy(); L[:, 0] = wall[:, 0]
    R = wall[:, :34].copy(); R[:, -1] = wall[:, -1]
    return L, R


def build():
    rgb, alpha, lab = cells()
    tg = targets(); f = rgb.astype(float)
    for k in (1, 2, 3, 4):
        m = alpha & (lab == k)
        mu, sd = f[m].mean(0), f[m].std(0) + 1e-6
        f[m] = (f[m] - mu) / sd * tg[k][1] + tg[k][0]
    # Khử xanh (scout 22/11: mảng xanh-tối ở mép mái trái, mép vòng đá lởm chởm rêu): điểm có
    # G > R trên vòng đá và 2 px mép mái -> xám giữ độ sáng, như đá/ngói concept.
    edge = alpha.copy()
    for _ in range(2):
        edge = edge & np.roll(edge, 1, 0) & np.roll(edge, -1, 0) & np.roll(edge, 1, 1) & np.roll(edge, -1, 1)
    m = alpha & ((lab == 1) | ((lab == 2) & ~edge)) & (f[:, :, 1] > f[:, :, 0])
    lum = f[m] @ np.array([.299, .587, .114])
    f[m] = np.stack([lum * 1.04, lum, lum * .93], 1)
    a = np.zeros((H, W, 4), np.uint8)
    a[alpha, :3] = quantize(np.clip(f[alpha], 0, 255).astype(np.uint8)[:, None, :])[:, 0]
    a[alpha, 3] = 255
    keep = np.zeros((H, W), bool)
    for ys, xs in ENDS: keep[ys, xs] = True
    a = despeckle(a, keep)
    # Mép thân trái giáp mái tường viện: nguồn có bóng lan can đổ lên (điểm lum < 45, cột 34..37,
    # hàng 76..112) thành vệt đen lởm chởm; lấy vữa cùng hàng cách 4 cột. Mép phải không có bóng này.
    lum = a[:, :, :3].astype(float) @ np.array([.299, .587, .114])
    for y in range(76, 112):
        for x in range(34, 38):
            if a[y, x, 3] and lum[y, x] < 45:
                a[y, x] = a[y, x + 4]
    L, R = ends()
    a[ENDS[0]] = L; a[ENDS[1]] = R
    a[a[:, :, 3] == 0] = 0
    yy, xx = np.indices((H, W))
    roofmask = (yy < 60) | (((xx < 34) | (xx >= 158)) & (yy < 96))
    base = a.copy(); roof = a.copy(); base[roofmask] = 0; roof[~roofmask] = 0
    return {'moongate_h.png': Image.fromarray(base), 'moongate_h_roof.png': Image.fromarray(roof)}, a


def pngbytes(im):
    b = io.BytesIO(); im.save(b, format='PNG', optimize=False); return b.getvalue()


def save(ims):
    for n, im in ims.items(): (OUT / n).write_bytes(pngbytes(im))
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    for n in ('moongate_h', 'moongate_h_roof'):
        kit['pieces'][n]['source'] = SOURCE
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def verify():
    ok = True
    ims, whole = build()
    disk = {n: np.array(Image.open(OUT / n).convert('RGBA')) for n in ims}
    b, r = disk['moongate_h.png'], disk['moongate_h_roof.png']
    full = np.array(Image.alpha_composite(Image.fromarray(b), Image.fromarray(r)))
    def check(name, cond, info=''):
        nonlocal ok; ok &= bool(cond); print(f"{'PASS' if cond else 'FAIL'} {name} {info}")
    check('size', b.shape == r.shape == (H, W, 4), f'{W}x{H}')
    check('disk==build', np.array_equal(full, whole))
    check('alpha 0/255', set(np.unique(b[:, :, 3])) <= {0, 255} and set(np.unique(r[:, :, 3])) <= {0, 255})
    check('layers disjoint', not ((b[:, :, 3] > 0) & (r[:, :, 3] > 0)).any())
    cols = {tuple(c) for c in full[full[:, :, 3] > 0, :3].tolist()}
    check('palette', cols <= {tuple(c) for c in PAL.tolist()}, f'{len(cols)} colors')
    L, R = ends()
    check('ends = cwall_h_2', np.array_equal(full[ENDS[0]], L) and np.array_equal(full[ENDS[1]], R))
    gx, gy = np.meshgrid(X0 + (np.arange(W) + .5) * SX, Y0 + (np.arange(H) + .5) * SY)
    lab = materials(gx, gy)
    hole = (full[:, :, 3][lab == 0] == 0).mean()
    check('aperture transparent', hole >= .99, f'{hole:.1%}')
    ring = lab == 1
    check('ring solid', (full[:, :, 3][ring] > 0).all(), f'{ring.sum()} px')
    seen = set(); st = tuple(np.argwhere(ring)[0]); q = deque([st]); seen.add(st)
    while q:
        y, x = q.popleft()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            p = (y + dy, x + dx)
            if 0 <= p[0] < H and 0 <= p[1] < W and ring[p] and p not in seen: seen.add(p); q.append(p)
    check('ring connected', len(seen) == ring.sum())
    iy, ix = np.nonzero(lab == 0)
    check('aperture size', 90 <= ix.max() - ix.min() + 1 <= 100, f'{ix.max()-ix.min()+1}x{iy.max()-iy.min()+1}')
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))['pieces']
    import subprocess
    old = json.loads(subprocess.check_output(['git', 'show', 'b0f792d:public/assets/kits/CM-WALL/kit.json'], cwd=ROOT))['pieces']
    same = all(kit[n][k] == old[n][k] for n in ('moongate_h', 'moongate_h_roof')
               for k in ('file', 'layer', 'anchor', 'footprint', 'collide') if k in old[n])
    check('anchor/footprint/collide = b0f792d', same, str(kit['moongate_h']['collide']))
    gate = np.ones((H, W), bool)
    for ys, xs in ENDS: gate[ys, xs] = False
    iso = isolated(full)[gate & (full[:, :, 3] > 0)].mean()
    print(f'INFO isolated (gate, ends excluded)={iso:.1%}')
    print('PASS CM-WALL moongate' if ok else 'FAIL CM-WALL moongate'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    ims, _ = build(); save(ims)
    if '--repro' in sys.argv:
        h1 = {n: hashlib.sha256((OUT / n).read_bytes()).hexdigest() for n in ims}
        ims2, _ = build(); save(ims2)
        h2 = {n: hashlib.sha256((OUT / n).read_bytes()).hexdigest() for n in ims}
        print('REPRO', 'PASS' if h1 == h2 else 'FAIL', {n: v[:12] for n, v in h1.items()})
    else:
        print('built', list(ims))
