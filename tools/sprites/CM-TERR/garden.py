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
PATH_X_E = 224 - (1166 - 1056)   # Đông: mảnh soi gương đặt x=1056, tâm lỗ cổng Đông x=1166 (cổng Đông = Tây +1028, không đối xứng)
C = sorted(bb.concept_cols(), key=sum)
SOIL = [C[0], C[2], C[4], C[6]]                 # đất ẩm tối
MOSS = [C[9], C[12], C[15], C[18]]              # rêu / cỏ thấp
LEAFD = [C[21], C[23], C[25]]                   # lá trúc khô rơi
slab = np.asarray(Image.open(OUT / 'slab_worn_128.png').convert('RGBA'))
_sc = slab[slab[:, :, 3] > 0, :3].reshape(-1, 3)
_lum = _sc.mean(1)
STONE = [tuple(int(v) for v in _sc[np.argsort(_lum)[int(len(_lum) * q)]]) for q in (0.02, 0.08, 0.16, 0.3, 0.45)]   # v2: đá tối hơn, chìm vào đất (scout/Opus: v1 như vạch sáng)
NAMES = ['garden_bed_w', 'garden_bed_e']


def noise(rnd, w, h, cell):
    g = np.array([[rnd.random() for _ in range(w // cell + 2)] for _ in range(h // cell + 2)])
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0, y0 = xs.astype(int), ys.astype(int); fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def bed(path_x=PATH_X):
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
    # đá bước v3 (scout v3f: v2 thành cột thẳng cách đều như thang): lối uốn chữ S, thẳng dần về
    # tâm lỗ cổng ở phần dưới (nhìn qua lỗ nguyệt môn), khoảng cách 11-23 px, phiến xoay lệch,
    # to nhỏ khác nhau, đôi chỗ thêm đá con lệch bên; đá chìm một phần dưới rêu.
    def stone(cx, cy, rw, rh, ang):
        ca, sa = math.cos(ang), math.sin(ang)
        R = int(max(rw, rh)) + 3
        for py in range(int(cy) - R, int(cy) + R + 1):
            for px in range(int(cx) - R, int(cx) + R + 1):
                if not (0 <= px < W and 0 <= py < H): continue
                u, v = (px - cx) * ca + (py - cy) * sa, -(px - cx) * sa + (py - cy) * ca
                d = (u / rw) ** 4 + (v / rh) ** 4 + (n3[py, px] - 0.5) * 0.25
                us, vs = u - 1.6 * sa, v - 1.6 * ca
                ds = (us / rw) ** 4 + (vs / rh) ** 4
                if d <= 1:
                    k = 3 if v < -rh * 0.45 else (2 if n3[py, px] > 0.45 else 1)
                    if v >= rh * 0.55: k = 0
                    rgb[py, px] = MOSS[rnd.choice((1, 1, 2)) % len(MOSS)] if (n2[py, px] > 0.6 and k < 3) else STONE[k]
                    m[py, px] = True
                elif ds <= 1.08:
                    rgb[py, px] = SOIL[0]; m[py, px] = True

    y = H - 9
    i = 0
    phase = rnd.uniform(0, math.pi)
    while y > 22:
        bend = min(1.0, max(0.0, (150 - y) / 70))          # dưới y150 (lỗ cổng): gần thẳng tâm
        cx = path_x + bend * 13 * math.sin(phase + y / 34) + (1 if i % 2 else -1) * rnd.uniform(2, 5)
        rw, rh = rnd.uniform(6, 12.5), rnd.uniform(3.5, 6.2)
        stone(cx, y, rw, rh, rnd.uniform(-0.38, 0.38))
        if rnd.random() < 0.3:                              # đá con lệch bên
            side = 1 if rnd.random() < 0.5 else -1
            stone(cx + side * (rw + rnd.uniform(3, 6)), y + rnd.uniform(-4, 4),
                  rnd.uniform(2.5, 4), rnd.uniform(2, 3), rnd.uniform(-0.6, 0.6))
        y -= rnd.uniform(11, 23); i += 1
    # khử điểm đặc cô lập
    pm = np.pad(m, 1)
    m &= (pm[:-2, 1:-1] | pm[2:, 1:-1] | pm[1:-1, :-2] | pm[1:-1, 2:])
    return rgb, m


def save():
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    for name, flip in (('garden_bed_w', False), ('garden_bed_e', True)):
        rgb, m = bed(PATH_X_E if flip else PATH_X)
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
