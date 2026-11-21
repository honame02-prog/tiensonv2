"""Vườn trúc Tây/Đông lộ HVQ (Opus vẽ bằng mã, 22/11) — thay 3 ô C-P/garden_path_64 (ô đặc cắt từ
lòng nguyệt môn concept, lát lặp thành cột sáng thẳng; người dùng chê "lòng vòng chưa xử lý").
garden_bed_w: nền đất rêu tối dưới khóm trúc, mép răng cưa mềm (không cắt thẳng), lá trúc khô rải,
lối ĐÁ BƯỚC so le dẫn thẳng vào lỗ nguyệt môn (tâm lỗ x=138 thế giới). garden_bed_e = bản soi gương.
Lớp ground, không va chạm. Màu: đất/rêu từ rừng trúc concept, đá từ sân lát CM-TERR slab_worn_128.
Chạy: python -X utf8 tools/sprites/CM-TERR/garden.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, math, random, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bamboo as bb

OUT = bb.OUT
W, H = 224, 200           # x 0..224 (mép khu -> tường viện dọc), y 516..716 (tới chân tường nguyệt môn)
PATH_X = 138              # tâm lỗ nguyệt môn Tây (x thế giới, mảnh đặt x=0)
C = sorted(bb.concept_cols(), key=sum)
SOIL = [C[0], C[2], C[4], C[6]]                 # đất ẩm tối
MOSS = [C[9], C[12], C[15], C[18]]              # rêu / cỏ thấp
LEAFD = [C[21], C[23], C[25]]                   # lá trúc khô rơi
slab = np.asarray(Image.open(OUT / 'slab_worn_128.png').convert('RGBA'))
_sc = slab[slab[:, :, 3] > 0, :3].reshape(-1, 3)
_lum = _sc.mean(1)
STONE = [tuple(int(v) for v in _sc[np.argsort(_lum)[int(len(_lum) * q)]]) for q in (0.08, 0.35, 0.6, 0.85, 0.97)]
NAMES = ['garden_bed_w', 'garden_bed_e']


def noise(rnd, w, h, cell):
    g = np.array([[rnd.random() for _ in range(w // cell + 2)] for _ in range(h // cell + 2)])
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0, y0 = xs.astype(int), ys.astype(int); fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def bed():
    rnd = random.Random('hvq-garden-v1')
    n1, n2, n3 = noise(rnd, W, H, 14), noise(rnd, W, H, 5), noise(rnd, W, H, 2)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    # mép: trái chạm mép khu (x=0, che bởi mép khu sau này), phải lùi trước tường dọc x=224,
    # trên răng cưa mềm; dưới liền tới chân tường nguyệt môn.
    edge = np.minimum.reduce([(W - 10 - xx) / 18, (yy - 4) / 22, np.full_like(xx, 1.0)])
    m = edge + (n1 - 0.5) * 0.9 + (n2 - 0.5) * 0.35 > 0.05
    rgb = np.zeros((H, W, 3), np.uint8)
    t = n1 * 0.6 + n2 * 0.3 + n3 * 0.1
    soil_i = np.clip((t * len(SOIL)).astype(int), 0, len(SOIL) - 1)
    rgb[:] = np.array(SOIL)[soil_i]
    moss = (n2 * 0.7 + n3 * 0.3) > 0.58
    moss_i = np.clip(((n3 - 0.2) * len(MOSS)).astype(int), 0, len(MOSS) - 1)
    rgb[moss] = np.array(MOSS)[moss_i][moss]
    # bóng tán trúc: tối dần về phía trái/trên (dưới khóm)
    shade = (n1 < 0.42) & (n2 < 0.55)
    rgb[shade] = np.array(SOIL[0])
    # lá trúc khô: nét 3-4 px chéo
    for _ in range(170):
        x, y = rnd.uniform(4, W - 14), rnd.uniform(8, H - 4)
        a = rnd.uniform(-0.6, 0.6) + (math.pi if rnd.random() < 0.5 else 0)
        c = LEAFD[rnd.randint(0, 2)]
        for k in range(rnd.randint(3, 4)):
            px, py = int(x + math.cos(a) * k), int(y + math.sin(a) * k * 0.5)
            if 0 <= px < W and 0 <= py < H: rgb[py, px] = c
    # đá bước: so le quanh tâm lối, cách đều ~17 px, phiến dẹt bo góc, gờ sáng trên, bóng dưới
    y = H - 9
    i = 0
    while y > 26:
        cx = PATH_X + (5 if i % 2 else -5) + rnd.uniform(-2, 2)
        rw, rh = rnd.uniform(9, 12), rnd.uniform(4.2, 5.6)
        for py in range(int(y - rh - 2), int(y + rh + 3)):
            for px in range(int(cx - rw - 2), int(cx + rw + 3)):
                if not (0 <= px < W and 0 <= py < H): continue
                d = ((px - cx) / rw) ** 4 + ((py - y) / rh) ** 4
                ds = ((px - cx) / rw) ** 4 + ((py - y - 1.6) / rh) ** 4
                if d <= 1:
                    k = 3 if py < y - rh * 0.45 else (2 if n3[py, px] > 0.45 else 1)
                    if py >= y + rh * 0.55: k = 0
                    rgb[py, px] = STONE[k]
                    m[py, px] = True
                elif ds <= 1.08:
                    rgb[py, px] = SOIL[0]; m[py, px] = True
        y -= rnd.uniform(15, 18); i += 1
    # khử điểm đặc cô lập
    pm = np.pad(m, 1)
    m &= (pm[:-2, 1:-1] | pm[2:, 1:-1] | pm[1:-1, :-2] | pm[1:-1, 2:])
    return rgb, m


def save():
    rgb, m = bed()
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    for name, flip in (('garden_bed_w', False), ('garden_bed_e', True)):
        r, a = (rgb[:, ::-1], m[:, ::-1]) if flip else (rgb, m)
        img = np.dstack([np.where(a[..., None], r, 0), np.where(a, 255, 0)]).astype(np.uint8)
        Image.fromarray(img, 'RGBA').save(OUT / f'{name}.png', optimize=False)
        kit['pieces'][name] = {'file': f'{name}.png', 'layer': 'ground', 'anchor': [0, 0], 'footprint': [W, H],
                               'collide': [], 'source': 'Opus garden.py: dat reu + da buoc toi long nguyet mon' + (' (soi guong)' if flip else '')}
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def verify():
    ok = True
    for n in NAMES:
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        good = a.shape[:2] == (H, W) and set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}
        cols = len({tuple(c) for c in a[a[:, :, 3] > 0, :3].tolist()})
        print(f"{'PASS' if good else 'FAIL'} {n} {a.shape[1]}x{a.shape[0]} solid={(a[:, :, 3] > 0).mean():.0%} colors={cols}")
        ok &= good
    print('PASS CM-TERR garden' if ok else 'FAIL CM-TERR garden'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save()
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in NAMES}
        h1 = h(); save(); print('REPRO', 'PASS' if h1 == h() else 'FAIL')
    else:
        print('built', NAMES)
