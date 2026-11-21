"""C-P trúc (Opus tự làm, 22/11): cắt bụi trúc từ rừng trúc sau nguyệt môn trong concept C gốc.
Công thức chung: median theo ô ~3,05 px nguồn/px; chuyển trung bình/độ lệch từng kênh (chỉ trên điểm
đặc) về vùng trúc của V1.png; lượng tử về bảng màu; alpha 0/255.
- Mặt nạ: điểm sáng (lum > TH) và ngả lục (G-B > GB) là lá/thân được nắng; nền tối giữa thân -> trong suốt.
- Tán cắt thẳng ở y 0..290 (trên mái nguyệt môn). Phần thân dưới bị mái che nên kéo dài các cột thân
  thật xuống bằng cách lặp đoạn K hàng ngay dưới tán (chỉ ở cột đang là thân).
- Mảnh base = cả bụi (khu chỉ dùng base). Mảnh _roof = chỉ phần tán, để dành (area chưa dùng).
Giữ anchor/footprint/collide của C-P cùng tên. Ghi vào kit CM-TERR (cùng bộ cắt concept C).
Chạy: python -X utf8 tools/sprites/CM-TERR/bamboo.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, re, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stair as st

ROOT, OUT, V1 = st.ROOT, st.OUT, st.V1
OLD = ROOT / 'public/assets/kits/C-P'
S = 3.05
TH, GB, K = 55, 8, 12
MINC = 12
# (tên, khung nguồn x0, y0, x1 (y1 = y0 + cao_tán*S), cao_tán, soi_gương)
PLAN = {
    'bamboo_a': (0, 0, 280, 95, False),
    'bamboo_b': (120, 0, 376, 95, False),      # tránh tảng đá rêu x380..470 y245..300
    'bamboo_edge': (250, 40, 445, 65, True),   # trên tảng đá
}
REF = V1[0:83, 0:130].reshape(-1, 3).astype(float)
REF = REF[REF.mean(1) > 50]   # trúc ở V1.png (1x đã duyệt) xám-lục trầm, G-B chỉ ~6: lọc theo sáng thôi


def palette():
    style = (ROOT / 'docs/assetgen/STYLE.md').read_text(encoding='utf-8')
    sec = style.split('## 5.')[1].split('## 6.')[0]
    cols = {tuple(bytes.fromhex(h)) for h in re.findall(r'#([0-9a-fA-F]{6})', sec)}
    cols |= {tuple(int(v) for v in c) for c in np.unique(REF.astype(np.uint8), axis=0)}
    return np.array(sorted(cols), dtype=np.int32)


PAL = palette()


def quantize(img):
    flat = img.reshape(-1, 3).astype(np.int32)
    idx = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(2).argmin(1)
    return PAL[idx].reshape(img.shape).astype(np.uint8)


def clump(name):
    x0, y0, x1, hc, mirror = PLAN[name]
    w, H = Image.open(OLD / f"{name}.png").size
    y1 = round(y0 + hc * (x1 - x0) / w)            # cùng tỉ lệ hai trục
    rgb = st.cells(x0, x1, np.linspace(y0, y1, hc + 1).round().astype(int), w)
    f = rgb.astype(float)
    m = (f.mean(2) > TH) & (f[:, :, 1] - f[:, :, 2] > GB)
    ext = H - hc
    stem = m[-K:].mean(0) > 0.6                     # cột đang là thân ở đáy tán
    # Lặp lệch pha theo cột (scout 22/11: lặp cùng pha thành sọc ngang).
    rows = np.array([[hc - K + ((r + 5 * x) % K) for x in range(w)] for r in range(ext)], int).reshape(ext, w)
    cols = np.arange(w)[None].repeat(ext, 0)
    er = rgb[rows, cols] if ext > 0 else np.zeros((0, w, 3), np.uint8)
    em = (stem[None] & m[rows, cols]) if ext > 0 else np.zeros((0, w), bool)
    rgb = np.concatenate([rgb, er], 0); m = np.concatenate([m, em], 0)
    if mirror:
        rgb, m = rgb[:, ::-1], m[:, ::-1]
    # Chuyển màu trên điểm đặc.
    p = rgb[m].astype(float)
    p = (p - p.mean(0)) / (p.std(0) + 1e-6) * REF.std(0) + REF.mean(0)
    out = np.zeros_like(rgb); out[m] = quantize(np.clip(p, 0, 255).astype(np.uint8)[None])[0]
    # Bỏ điểm đặc cô lập (không láng giềng 4 hướng nào đặc).
    pm = np.pad(m, 1); lone = m & ~(pm[:-2, 1:-1] | pm[2:, 1:-1] | pm[1:-1, :-2] | pm[1:-1, 2:])
    m = m & ~lone
    # Bỏ cụm đặc < MINC điểm (đoạn thân lơ lửng, scout 22/11).
    from scipy import ndimage
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= MINC]
    # Bỏ cụm dẹt (cao <= 2 hàng): mép mái nguyệt môn lọt mặt nạ.
    keep = [i for i in keep if np.ptp(np.nonzero(lab == i)[0]) >= 2]
    m = m & np.isin(lab, keep)
    return out, m, hc


def build():
    pieces = {}
    for name in PLAN:
        rgb, m, hc = clump(name)
        a = np.where(m, 255, 0).astype(np.uint8)
        pieces[name] = (rgb, a)
        ar = a.copy(); ar[hc:] = 0
        pieces[f'{name}_roof'] = (rgb, ar)
    return pieces


NAMES = [n for p in PLAN for n in (p, f'{p}_roof')]


def save(pieces):
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); oldp = oldp.get('pieces', oldp)
    for name, (rgb, a) in pieces.items():
        rgb = rgb.copy(); rgb[a == 0] = 0
        Image.fromarray(np.dstack([rgb, a]), 'RGBA').save(OUT / f'{name}.png', optimize=False)
        meta = dict(oldp[name]); meta['file'] = f'{name}.png'
        x0, y0, x1, hc, mir = PLAN[name.replace('_roof', '')]
        meta['source'] = f'V1-original bamboo grove x{x0}..{x1} y{y0}.. canopy {hc}px{" mirrored" if mir else ""} (Opus CM-TERR)'
        kit['pieces'][name] = meta
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def verify():
    ok = True; pal = {tuple(c) for c in PAL.tolist()}
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))['pieces']
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); oldp = oldp.get('pieces', oldp)
    for n in NAMES:
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA')); o = Image.open(OLD / f'{n}.png').size
        cols = {tuple(c) for c in a[a[:, :, 3] > 0, :3].tolist()}
        same = all(kit[n][k] == oldp[n][k] for k in ('anchor', 'footprint', 'collide', 'layer'))
        good = ((a.shape[1], a.shape[0]) == o and set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}
                and not (cols - pal) and same and len(cols) >= 8)
        print(f"{'PASS' if good else 'FAIL'} {n} {a.shape[1]}x{a.shape[0]} (C-P {o[0]}x{o[1]}) solid={(a[:, :, 3] > 0).mean():.0%} "
              f"colors={len(cols)} off_palette={len(cols - pal)} meta_same={same}")
        ok &= good
    print('PASS CM-TERR bamboo' if ok else 'FAIL CM-TERR bamboo'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save(build())
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in NAMES}
        h1 = h(); save(build()); print('REPRO', 'PASS' if h1 == h() else 'FAIL', len(h1), 'files')
    else:
        print('built', NAMES)
