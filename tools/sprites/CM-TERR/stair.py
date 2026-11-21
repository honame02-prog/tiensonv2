"""CM-TERR bậc thềm (Opus tự làm, 22/11): cắt từ bậc đá giữa hai má trong concept C gốc.
Công thức như build.py/balus.py: median theo ô từ V1-original, chuyển trung bình/độ lệch
từng kênh về vùng bậc của V1.png (ảnh gốc ám cam), lượng tử về bảng màu, alpha 0/255.
Mỗi bậc nguồn (~25 px, giữa hai vạch tối chân cổ bậc) -> đúng 8 px game, nên bậc luôn khớp lưới.
Giữ anchor/footprint/collide của C-R1 cùng tên.
Chạy: python -X utf8 tools/sprites/CM-TERR/stair.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, re, sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
REF = ROOT / '.agents/refs/CM'
OUT = ROOT / 'public/assets/kits/CM-TERR'
OLD = ROOT / 'public/assets/kits/C-R1'
SRC = np.array(Image.open(REF / 'V1-original.png').convert('RGB'))
V1 = np.array(Image.open(REF / 'V1.png').convert('RGB'))

# Ranh giới 8 bậc trong nguồn (vạch tối chân cổ bậc, đo theo trung bình hàng x1260..1480).
UNITS = [561, 586, 609, 634, 658, 683, 708, 734, 759]
SX0, SX1 = 1241, 1503            # mặt bậc giữa hai má
STEP_W = round((SX1 - SX0) / 3.05)   # 86 px, cùng tỉ lệ ~3,05 như tường chắn
EDGE_L, EDGE_R = 14, 8           # bóng má đổ lên mép bậc, giữ nguyên ở hai đầu
CHEEK_X = {'L': (1205, 1241), 'R': (1503, 1539)}
CHEEK_Y = (599, 766)
V1_BOX = (slice(161, 220), slice(346, 442))   # vùng bậc + hai má trong V1.png (1672/480 = 3,483)


def palette():
    style = (ROOT / 'docs/assetgen/STYLE.md').read_text(encoding='utf-8')
    sec = style.split('## 5.')[1].split('## 6.')[0]
    cols = {tuple(bytes.fromhex(h)) for h in re.findall(r'#([0-9a-fA-F]{6})', sec)}
    for box in (V1_BOX, (slice(165, 225), slice(180, 360))):   # bậc + tường chắn (đồng bộ CM-TERR)
        cols |= {tuple(int(v) for v in c) for c in np.unique(V1[box].reshape(-1, 3), axis=0)}
    return np.array(sorted(cols), dtype=np.int32)


PAL = palette()


def quantize(img):
    flat = img.reshape(-1, 3).astype(np.int32)
    idx = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(2).argmin(1)
    return PAL[idx].reshape(img.shape).astype(np.uint8)


def cells(x0, x1, ys, w):
    """Median theo ô: cột chia đều x0..x1 thành w ô, hàng theo mép ys."""
    xe = np.linspace(x0, x1, w + 1).round().astype(int)
    out = np.zeros((len(ys) - 1, w, 3), np.uint8)
    for y in range(len(ys) - 1):
        for x in range(w):
            c = SRC[ys[y]:max(ys[y] + 1, ys[y + 1]), xe[x]:max(xe[x] + 1, xe[x + 1])]
            out[y, x] = np.median(c.reshape(-1, 3), axis=0)
    return out


def unit_rows(u):
    return np.linspace(UNITS[u], UNITS[u + 1], 9).round().astype(int)


# Bậc nguồn ở 1x: 8 bậc x 8 hàng x 86 cột.
STEPS = [cells(SX0, SX1, unit_rows(u), STEP_W) for u in range(8)]
CHEEKS = {s: cells(*CHEEK_X[s], np.linspace(*CHEEK_Y, 85).round().astype(int), 16) for s in 'LR'}

# Một phép chuyển màu chung cho cả bậc và má: thống kê trên bậc ghép, đích là vùng V1.png.
_all = np.concatenate([np.concatenate(STEPS, 0).reshape(-1, 3), CHEEKS['L'].reshape(-1, 3),
                       CHEEKS['R'].reshape(-1, 3)]).astype(float)
MU, SD = _all.mean(0), _all.std(0) + 1e-6
_ref = V1[V1_BOX].reshape(-1, 3).astype(float)


def isolated(q):
    h, w = q.shape[:2]; p = np.pad(q, ((1, 1), (1, 1), (0, 0)), mode='edge')
    iso = np.ones((h, w), bool)
    for dy, dx in ((0, 1), (2, 1), (1, 0), (1, 2)):
        iso &= ~(p[dy:dy + h, dx:dx + w] == q).all(2)
    return iso


def despeckle(q):
    """Điểm không trùng màu láng giềng 4 hướng nào (hạt lấm tấm, scout 22/11) -> màu phổ biến
    nhất trong 8 láng giềng. Một lượt, tất định; màu thay vẫn thuộc bảng."""
    h, w = q.shape[:2]; p = np.pad(q, ((1, 1), (1, 1), (0, 0)), mode='edge'); out = q.copy()
    for y, x in zip(*np.nonzero(isolated(q))):
        nb = [tuple(p[y + dy, x + dx]) for dy in range(3) for dx in range(3) if (dy, dx) != (1, 1)]
        out[y, x] = max(sorted(set(nb)), key=nb.count)
    return out


def fix(im):
    f = (im.astype(float) - MU) / SD * _ref.std(0) + _ref.mean(0)
    return despeckle(quantize(np.clip(f, 0, 255).astype(np.uint8)))


def step_row(u, width, off):
    """Một bậc rộng `width`: giữ mép bóng hai đầu, phần giữa lấy vòng (giữa + soi gương)
    từ vị trí `off` để mạch đá các bậc không thẳng hàng."""
    s = STEPS[u]
    mid = s[:, EDGE_L:STEP_W - EDGE_R]
    loop = np.concatenate([mid, mid[:, ::-1]], 1)
    need = width - EDGE_L - EDGE_R
    idx = (np.arange(need) + off) % loop.shape[1]
    return np.concatenate([s[:, :EDGE_L], loop[:, idx], s[:, STEP_W - EDGE_R:]], 1)


# Thứ tự bậc + độ lệch mạch cho từng mảnh (bậc trên cùng là 0, chân là 7).
PLAN = {
    'stair_2x2': (64, [0, 1, 2, 3, 4, 5, 6, 7], [0, 9, 3, 14, 6, 11, 1, 8]),
    'stair_3x2': (96, [0, 1, 2, 3, 4, 5, 6, 7], [0] * 8),            # gần đúng bề rộng nguồn
    'stair_4x2': (128, [0, 1, 2, 3, 4, 5, 6, 7], [0, 40, 12, 52, 24, 64, 6, 30]),
    'stair_4x3': (128, [0, 1, 2, 3, 4, 5, 2, 3, 4, 5, 6, 7], [0, 40, 12, 52, 24, 64, 90, 18, 76, 34, 6, 30]),
    'stair_moon_60': (60, [5, 6, 7], [20, 2, 11]),
}


def cheek(side, h):
    c = CHEEKS[side]                         # 84 hàng: nắp 0..9, khối 1 ~9..28, khối 2 ~28..65, chân 65..
    if h == 84:
        return c
    ins = c[28:28 + (h - 84)]                # chèn thêm một đoạn khối giữa ở mạch khối
    return np.concatenate([c[:28], ins, c[28:]], 0)


def build():
    out = {}
    for name, (w, order, offs) in PLAN.items():
        out[name] = fix(np.concatenate([step_row(u, w, o) for u, o in zip(order, offs)], 0))
    for side in 'LR':
        out[f'stair_cheek_{side}'] = fix(cheek(side, 84))
        out[f'stair_cheek_long_{side}'] = fix(cheek(side, 116))
    return out


NAMES = list(PLAN) + ['stair_cheek_L', 'stair_cheek_R', 'stair_cheek_long_L', 'stair_cheek_long_R']


def save(pieces):
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8'))
    oldp = oldp.get('pieces', oldp)
    for name, rgb in pieces.items():
        a = np.dstack([rgb, np.full(rgb.shape[:2], 255, np.uint8)])
        Image.fromarray(a, 'RGBA').save(OUT / f'{name}.png', optimize=False)
        meta = dict(oldp[name]); meta['file'] = f'{name}.png'
        meta['source'] = (f'V1-original stairs x{SX0}..{SX1} units {UNITS[0]}..{UNITS[-1]} (8 px/bac), '
                          f'cheeks y{CHEEK_Y[0]}..{CHEEK_Y[1]} (Opus CM-TERR)')
        kit['pieces'][name] = meta
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def verify():
    ok = True; pal = {tuple(c) for c in PAL.tolist()}
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))['pieces']
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); oldp = oldp.get('pieces', oldp)
    for n in NAMES:
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA')); o = Image.open(OLD / f'{n}.png').size
        cols = {tuple(c) for c in a[a[:, :, 3] > 0, :3].tolist()}
        same_meta = all(kit[n][k] == oldp[n][k] for k in ('anchor', 'footprint', 'collide', 'layer'))
        good = ((a.shape[1], a.shape[0]) == o and set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}
                and not (cols - pal) and same_meta)
        iso = float(isolated(a[:, :, :3]).mean())
        print(f"{'PASS' if good else 'FAIL'} {n} {a.shape[1]}x{a.shape[0]} (C-R1 {o[0]}x{o[1]}) "
              f"colors={len(cols)} off_palette={len(cols - pal)} meta_same={same_meta} isolated={iso:.1%}")
        ok &= good
    # Nhịp bậc: hàng tối nhất trong mỗi 8 hàng phải rơi cùng một vị trí (bậc khớp lưới 8 px).
    s = np.array(Image.open(OUT / 'stair_4x3.png').convert('L')).astype(float).mean(1)
    dark = [int(np.argmin(s[i:i + 8])) for i in range(0, len(s), 8)]
    print(f"step rhythm stair_4x3 darkest-row-in-step={dark}")
    print('PASS CM-TERR stair' if ok else 'FAIL CM-TERR stair'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save(build())
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in NAMES}
        h1 = h(); save(build()); print('REPRO', 'PASS' if h1 == h() else 'FAIL', len(h1), 'files')
    else:
        print('built', NAMES)
