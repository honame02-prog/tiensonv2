"""Trúc HVQ v3 (Opus vẽ tay bằng mã, 22/11) — thay bản cắt concept (người dùng chê: nhạt, thưa).
Đích thẩm mỹ = rừng trúc concept C (V1-original): thân lục-ô liu có đốt, cành lá xoè thành chùm
lưỡi mác rủ, ba lớp sáng (lá sau tối, lá giữa, lá trước vàng lục được nắng), khóm dày ở tán, thân
lộ ở dưới. Màu chỉ lấy từ 28 màu đại diện rừng trúc concept (bamboo.concept_cols) -> nằm trong bảng.
Giữ kích thước/anchor/footprint/collide của C-P cùng tên. _roof = chỉ phần tán (hàng < hc).
Chạy: python -X utf8 tools/sprites/CM-TERR/bamboo_draw.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, math, random, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bamboo as bb

OUT, OLD = bb.OUT, bb.OLD
C = sorted(bb.concept_cols(), key=sum)          # 28 màu tối -> sáng
LEAF = {'back': [C[3], C[7], C[11]], 'mid': [C[12], C[16], C[19]], 'front': [C[20], C[23], C[26], C[27]]}
STEM = {'back': (C[6], C[10], C[14]), 'front': (C[13], C[19], C[24])}   # bóng, thân, sáng
NODE = C[4]

# (tên, số thân, dải cao (tỉ lệ H), độ xoè gốc, hc tán)
PLAN = {
    'bamboo_a': (7, (0.62, 1.0), 0.20, 95),
    'bamboo_b': (6, (0.58, 1.0), 0.22, 95),
    'bamboo_edge': (4, (0.55, 0.95), 0.30, 65),
}


def put(img, x, y, c):
    h, w = img.shape[:2]
    x, y = int(round(x)), int(round(y))
    if 0 <= x < w and 0 <= y < h:
        img[y, x, :3] = c; img[y, x, 3] = 255


def stem_path(x0, y0, top, lean):
    """Điểm thân từ gốc (y0) lên ngọn (top): cong bậc 2, ngọn lệch 'lean' px."""
    n = int(y0 - top)
    return [(x0 + lean * (i / n) ** 1.8, y0 - i) for i in range(n + 1)]


def draw_stem(img, pts, layer, width, rnd):
    sh, mid, hi = STEM[layer]
    gap = rnd.randint(8, 11); ph = rnd.randint(0, gap - 1)
    for i, (x, y) in enumerate(pts):
        taper = width if i < len(pts) * 0.75 else max(1, width - 1)
        for k in range(taper):
            c = hi if (k == 0 and taper > 1) else (sh if k == taper - 1 and taper > 2 else mid)
            put(img, x + k, y, c)
        if (i + ph) % gap == 0 and i > 3:                 # đốt: vạch tối + chấm sáng dưới
            for k in range(taper): put(img, x + k, y, NODE)
            put(img, x, y + 1, hi)


def leaf(img, x, y, ang, ln, cols, rnd):
    """Lá lưỡi mác rủ: cuống 1 px, bụng 2 px ở 25-55 % chiều dài, đuôi 1 px cong rủ xuống.
    Bụng: hàng trên màu sáng, hàng dưới màu tối (mặt lá đón nắng từ trên)."""
    dark, base, light = cols[0], cols[len(cols) // 2], cols[-1]
    droop = rnd.uniform(0.010, 0.030)
    for t in range(ln):
        a = ang + droop * t * (1 if math.cos(ang) >= 0 else -1)
        px = x + math.cos(ang) * t
        py = y + math.sin(ang) * t + droop * t * t * 3
        f = t / ln
        if 0.22 <= f <= 0.58:
            put(img, px, py - 1, light); put(img, px, py, base if f < 0.5 else dark)
        else:
            put(img, px, py, base if f < 0.85 else dark)


def spray(img, x, y, side, layer, rnd, n=None):
    """Chùm lá ở một mắt cành: cành chéo lên 2-4 px rồi 3-5 lá xoè hình quạt rủ về phía 'side'."""
    cols = LEAF[layer]
    n = n or rnd.randint(3, 5)
    k = rnd.randint(2, 4)
    for t in range(1, k + 1):
        put(img, x + side * t, y - t * 0.6, STEM['front' if layer == 'front' else 'back'][1])
    bx, by = x + side * k, y - k * 0.6
    a0 = math.radians(rnd.uniform(18, 40)); step = math.radians(rnd.uniform(16, 24))
    for i in range(n):
        a = a0 + i * step                                   # quạt từ ngang-chếch xuống tới gần thẳng đứng
        ang = a if side > 0 else math.pi - a
        ln = rnd.randint(8, 13) if layer == 'front' else rnd.randint(7, 11)
        leaf(img, bx, by, ang, ln, cols, rnd)


def clump(name):
    nst, (hlo, hhi), spread, hc = PLAN[name]
    w, H = Image.open(OLD / f'{name}.png').size
    meta = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); meta = meta.get('pieces', meta)[name]
    gy = meta['anchor'][1] - 1                           # chân khóm
    img = np.zeros((H, w, 4), np.uint8)
    rnd = random.Random(f'hvq-{name}-v3')
    cx = w / 2
    stems = []
    for i in range(nst):
        u = (i + 0.5) / nst - 0.5
        x0 = cx + u * w * spread * 2 + rnd.uniform(-2, 2)
        h = (hlo + (hhi - hlo) * rnd.random()) * (H - 4)
        if i in (nst // 2, nst // 2 - 1): h = hhi * (H - 4)      # 2 thân giữa cao nhất
        lean = u * w * 0.55 + rnd.uniform(-4, 4)
        layer = 'back' if i % 2 else 'front'
        stems.append((x0, gy - h, lean, layer, 3 if layer == 'front' and abs(u) < 0.3 else 2))
    order = [s for s in stems if s[3] == 'back'] + [s for s in stems if s[3] == 'front']
    # lớp 1: lá sau (tối) phủ dày vùng tán -> khối khóm không thưa
    for x0, top, lean, layer, wd in stems:
        pts = stem_path(x0, gy, top, lean)
        for j in range(0, int(len(pts) * 0.62), 4):
            x, y = pts[-1 - j]
            for side in (-1, 1):
                spray(img, x, y, side, 'back', rnd, n=rnd.randint(3, 4))
    # lớp 2-3: thân rồi lá giữa / lá trước
    for x0, top, lean, layer, wd in order:
        pts = stem_path(x0, gy, top, lean)
        draw_stem(img, pts, layer, wd, rnd)
        for j in range(0, int(len(pts) * 0.55), rnd.choice((5, 6, 7))):
            x, y = pts[-1 - j]
            side = 1 if (j // 5 + (lean > 0)) % 2 else -1
            spray(img, x, y, side, 'mid' if layer == 'back' else 'front', rnd)
        x, y = pts[-1]                                     # chỏm ngọn: chùm sáng nhỏ
        spray(img, x, y, 1 if lean > 0 else -1, 'front', rnd, n=3)
    a = img[:, :, 3].copy(); rgb = img[:, :, :3].copy()
    return rgb, a > 0, hc


def build():
    pieces = {}
    for name in PLAN:
        rgb, m, hc = clump(name)
        a = np.where(m, 255, 0).astype(np.uint8)
        pieces[name] = (rgb, a)
        ar = a.copy(); ar[hc:] = 0
        pieces[f'{name}_roof'] = (rgb, ar)
    return pieces


def save(pieces):
    bb.save(pieces)
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    for n in pieces:
        kit['pieces'][n]['source'] = 'Opus ve bang ma bamboo_draw.py v3 (mau rung truc concept C)'
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if bb.verify() else 1)
    save(build())
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in bb.NAMES}
        h1 = h(); save(build()); print('REPRO', 'PASS' if h1 == h() else 'FAIL', len(h1), 'files')
    else:
        print('built', bb.NAMES)
