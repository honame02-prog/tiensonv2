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
# v3c: giảm vàng ~40 %: lá trộn lục STYLE (G>R) với lục-vàng concept; lõi tán lục đậm
G = {k: tuple(v) for k, v in {'g0': (22, 34, 28), 'g1': (33, 46, 39), 'g2': (43, 56, 48), 'g3': (54, 70, 54),
     'g4': (70, 88, 63), 'g5': (87, 105, 72), 'g6': (105, 122, 82), 'g7': (125, 139, 93)}.items()}
LEAF = {'core': [C[0], C[1], C[2], C[3]],
        'back': [C[2], C[4], C[6], C[8]],
        'mid': [C[6], C[9], G['g3'], C[13], C[14]],
        'front': [C[12], G['g3'], C[16], G['g4'], C[19], G['g5'], C[21], C[22]]}
SHADOW = C[1]
STEM = {'back': (C[6], C[10], C[14]), 'front': (C[13], C[19], C[23])}   # bóng, thân, sáng
NODE = C[4]

# (tên, số thân, dải cao (tỉ lệ H), độ xoè gốc, hc tán)
PLAN = {
    'bamboo_a': (7, (0.60, 0.90), 0.20, 95),
    'bamboo_b': (6, (0.58, 0.90), 0.22, 95),
    'bamboo_edge': (6, (0.55, 0.88), 0.34, 65),
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


def leaf(img, x, y, ang, ln, cols, rnd, shade=False):
    """Lá lưỡi mác (v3c): dài ln 10-15 px, bụng 2 px ở 15-60 % chiều dài, đuôi 1 px, trọng lực kéo
    cong rủ xuống. Mép trên bụng sáng (đón nắng), gân/mép dưới tối; đuôi tối dần."""
    dark, base, light = cols[0], cols[len(cols) // 2], cols[-1]
    g = rnd.uniform(0.035, 0.065)                     # độ rủ
    vx, vy = math.cos(ang), math.sin(ang)
    px, py = x, y
    for t in range(ln):
        f = t / ln
        vy += g; n = math.hypot(vx, vy); vx, vy = vx / n, vy / n
        px += vx; py += vy
        if shade and 0.1 <= f <= 0.75:
            put(img, px, py + 1, SHADOW)
        if 0.15 <= f <= 0.60:
            put(img, px, py - 1, light if f < 0.45 else base)
            put(img, px, py, base)
        else:
            put(img, px, py, base if f < 0.8 else dark)


def spray(img, x, y, side, layer, rnd, n=None):
    """Chùm lá ở mắt cành (v3c): cành ngắn chéo lên rồi 4-7 lá xoè hình quạt/ô, từ chếch lên
    ngoài -> ngang -> rủ xuống; phần lớn lá về phía 'side', 1-2 lá ngược lại cho tròn chùm."""
    cols = LEAF[layer]
    n = n or (rnd.randint(5, 8) if layer == 'front' else rnd.randint(4, 7))
    k = rnd.randint(2, 4)
    for t in range(1, k + 1):
        put(img, x + side * t, y - t * 0.7, STEM['front' if layer == 'front' else 'back'][1])
    bx, by = x + side * k, y - k * 0.7
    lo = {'core': (8, 12), 'back': (9, 13), 'mid': (10, 14), 'front': (11, 15)}[layer]
    for i in range(n):
        f = (i + rnd.uniform(0.2, 0.8)) / n                 # 0 = chếch lên ngoài, 1 = rủ gần thẳng
        a = math.radians(-35 + f * 120)
        s2 = side if i < n - 1 or n < 5 else -side
        ang = a if s2 > 0 else math.pi - a
        sub = rnd.sample(cols, min(3, len(cols))); sub.sort(key=sum)
        leaf(img, bx, by, ang, rnd.randint(*lo), sub, rnd, shade=layer in ('mid', 'front'))


def clump(name):
    nst, (hlo, hhi), spread, hc = PLAN[name]
    w, H = Image.open(OLD / f'{name}.png').size
    meta = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); meta = meta.get('pieces', meta)[name]
    gy = meta['anchor'][1] - 1                           # chân khóm
    img = np.zeros((H, w, 4), np.uint8)
    rnd = random.Random(f'hvq-{name}-v3e')
    cx = w / 2
    stems = []
    for i in range(nst):
        u = (i + 0.5) / nst - 0.5
        x0 = cx + u * w * spread * 2 + rnd.uniform(-2, 2)
        h = (hlo + (hhi - hlo) * rnd.random()) * (H - 4)
        if i in (nst // 2, nst // 2 - 1): h = hhi * (H - 4)      # cao nhất ~0,9 H (v3c: chừa đỉnh chùm)      # 2 thân giữa cao nhất
        lean = u * w * 0.55 + rnd.uniform(-4, 4)
        layer = 'back' if i % 2 else 'front'
        stems.append((x0, gy - h, lean, layer, 3 if layer == 'front' and abs(u) < 0.3 else 2))
    order = [s for s in stems if s[3] == 'back'] + [s for s in stems if s[3] == 'front']
    # lớp 0: khối lục đậm giữa tán (lõi tối, che khoảng hở giữa các thân)
    for x0, top, lean, layer, wd in stems:
        pts = stem_path(x0, gy, top, lean)
        for j in range(4, int(len(pts) * 0.6), 2):
            x, y = pts[-1 - j]
            spray(img, x + rnd.uniform(-4, 4), y, rnd.choice((-1, 1)), 'core', rnd, n=rnd.randint(6, 8))
    # lớp 1: lá sau phủ vùng tán
    for x0, top, lean, layer, wd in stems:
        pts = stem_path(x0, gy, top, lean)
        for j in range(0, int(len(pts) * 0.62), 4):
            x, y = pts[-1 - j]
            for side in (-1, 1):
                spray(img, x, y, side, 'back', rnd, n=rnd.randint(3, 5))
    # lớp 2-3: thân rồi lá giữa / lá trước
    for x0, top, lean, layer, wd in order:
        pts = stem_path(x0, gy, top, lean)
        draw_stem(img, pts, layer, wd, rnd)
        for j in range(2, int(len(pts) * 0.55), rnd.choice((7, 8, 9))):
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
        kit['pieces'][n]['source'] = 'Opus ve bang ma bamboo_draw.py v3e (mau rung truc concept C)'
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
