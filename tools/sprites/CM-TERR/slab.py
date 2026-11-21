"""CM-TERR sân lát (Opus tự làm, 22/11): cắt từ sân đá lát liền phía trên tường chắn trong concept C gốc.
Công thức như stair.py: median theo ô ~3,05 px nguồn/px, chuyển trung bình/độ lệch từng kênh về
vùng tương ứng của V1.png, lượng tử về bảng màu, khử điểm cô lập, alpha 255.
- slab_worn_128: một ô 390x390 nguồn, cắt thẳng (có rêu, nứt sẵn trong concept).
- slab_256: nguồn chỉ cao ~440 px (cần 780), nên ghép dải sân 256x144 với bản dịch vòng 128 px của nó,
  ghép 3 dải (gốc, dịch vòng 128, dịch vòng 64), chồng 20 hàng, nối theo đường ít khác biệt nhất.
Giữ anchor/footprint/collide của C-R1 cùng tên.
Chạy: python -X utf8 tools/sprites/CM-TERR/slab.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stair as st   # dùng chung cells/quantize/despeckle/isolated/palette nguồn

ROOT, OUT, OLD, SRC, V1 = st.ROOT, st.OUT, st.OLD, st.SRC, st.V1
K = 3483 / 1000                 # V1-original 1672 -> V1.png 480
W128 = (1240, 112, 1630, 502)   # ô sân trên, tránh chân điện và đầu trụ lan can (y>505)
W256 = (880, 118, 1660, 500)    # dải sân trên 780x382 nguồn -> 256x125, tránh chân điện/trụ
OVER = 20


def v1box(x0, y0, x1, y1):
    return V1[round(y0 / K):round(y1 / K), round(x0 / K):round(x1 / K)].reshape(-1, 3).astype(float)


PAL = np.array(sorted({tuple(c) for c in st.PAL.tolist()} |
                      {tuple(int(v) for v in c) for c in np.unique(v1box(*W256).astype(np.uint8), axis=0)}),
               dtype=np.int32)


def quantize(img):
    flat = img.reshape(-1, 3).astype(np.int32)
    idx = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(2).argmin(1)
    return PAL[idx].reshape(img.shape).astype(np.uint8)


def grab(box, w, h):
    x0, y0, x1, y1 = box
    return st.cells(x0, x1, np.linspace(y0, y1, h + 1).round().astype(int), w)


FLAT, BLUR = 0.7, 10
KNEE_P, KNEE_K = 70, 0.5   # scout 22/11: đốm sáng mảng lớn kiểu mây -> bớt 70 % sáng tần thấp


def flatten(f):
    """Trừ phần sáng tần thấp (vệt nắng/mây của ảnh nguồn), giữ mạch vữa, nứt, rêu."""
    lum = f.mean(2)
    k = np.exp(-0.5 * (np.arange(-3 * BLUR, 3 * BLUR + 1) / BLUR) ** 2); k /= k.sum()
    p = np.pad(lum, 3 * BLUR, mode='reflect')
    p = np.apply_along_axis(lambda r: np.convolve(r, k, 'valid'), 1, p)
    lo = np.apply_along_axis(lambda c: np.convolve(c, k, 'valid'), 0, p)
    f = f - FLAT * (lo - lum.mean())[:, :, None]
    # Vệt sáng trong lòng phiến (cỡ 5-15 px, scout vòng 2): nén một nửa phần sáng vượt phân vị 70.
    l2 = f.mean(2); knee = np.percentile(l2, KNEE_P)
    return f - (KNEE_K * np.clip(l2 - knee, 0, None))[:, :, None]


def fix(im, box):
    f = im.reshape(-1, 3).astype(float); ref = v1box(*box)
    f = (f - f.mean(0)) / (f.std(0) + 1e-6) * ref.std(0) + ref.mean(0)
    f = flatten(f.reshape(im.shape))
    return st.despeckle(quantize(np.clip(f, 0, 255).astype(np.uint8)))


def seam_stack(a, b, h):
    """a trên, b dưới, chồng OVER hàng; đường nối là đường ngang (mỗi cột lệch <=1 hàng)
    qua các điểm tối nhất của cả hai (mạch vữa) và ít khác biệt nhất giữa a và b."""
    top = h - b.shape[0]                      # hàng bắt đầu b trong ảnh ghép
    ov_a = a[top:top + OVER].astype(float); ov_b = b[:OVER].astype(float)
    cost = 0.3 * (ov_a.mean(2) + ov_b.mean(2)) + np.abs(ov_a - ov_b).sum(2)
    H, W = cost.shape; acc = cost.copy(); back = np.zeros((H, W), int)
    for x in range(1, W):
        for y in range(H):
            lo, hi = max(0, y - 1), min(H, y + 2)
            j = lo + int(np.argmin(acc[lo:hi, x - 1])); back[y, x] = j; acc[y, x] += acc[j, x - 1]
    path = [int(np.argmin(acc[:, -1]))]
    for x in range(W - 1, 0, -1):
        path.append(back[path[-1], x])
    path = path[::-1]
    out = np.zeros((h, a.shape[1], 3), np.uint8)
    for x, s in enumerate(path):
        out[:top + s, x] = a[:top + s, x]
        out[top + s:, x] = b[s:, x]
    return out


def build():
    out = {'slab_worn_128': fix(grab(W128, 128, 128), W128)}
    a = grab(W256, 256, 125)
    # 3 dải: gốc, dịch vòng 128, dịch vòng 64 (không soi gương, scout 22/11); mỗi lần chồng OVER hàng.
    big = seam_stack(a, np.roll(a, 128, axis=1), 2 * 125 - OVER)
    big = seam_stack(big, np.roll(a, 64, axis=1), big.shape[0] + 125 - OVER)[:256]
    out['slab_256'] = fix(big, W256)
    return out


NAMES = ['slab_worn_128', 'slab_256']


def save(pieces):
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); oldp = oldp.get('pieces', oldp)
    for name, rgb in pieces.items():
        Image.fromarray(np.dstack([rgb, np.full(rgb.shape[:2], 255, np.uint8)]), 'RGBA').save(OUT / f'{name}.png', optimize=False)
        meta = dict(oldp[name]); meta['file'] = f'{name}.png'
        box = W128 if name == 'slab_worn_128' else W256
        meta['source'] = f'V1-original upper court x{box[0]}..{box[2]} y{box[1]}..{box[3]} (Opus CM-TERR)'
        kit['pieces'][name] = meta
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def verify():
    ok = True; pal = {tuple(c) for c in PAL.tolist()}
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))['pieces']
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8')); oldp = oldp.get('pieces', oldp)
    for n in NAMES:
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA')); o = Image.open(OLD / f'{n}.png').size
        cols = {tuple(c) for c in a[:, :, :3].reshape(-1, 3).tolist()}
        same = all(kit[n][k] == oldp[n][k] for k in ('anchor', 'footprint', 'collide', 'layer'))
        good = ((a.shape[1], a.shape[0]) == o and set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}
                and not (cols - pal) and same)
        lum = a[:, :, :3].astype(float).mean(2)
        print(f"{'PASS' if good else 'FAIL'} {n} {a.shape[1]}x{a.shape[0]} (C-R1 {o[0]}x{o[1]}) colors={len(cols)} "
              f"off_palette={len(cols - pal)} meta_same={same} isolated={st.isolated(a[:, :, :3]).mean():.1%} "
              f"mean_lum={lum.mean():.0f}")
        ok &= good
    # Mép ghép slab_256: chênh sáng trung bình giữa hai nửa không quá lớn.
    s = np.array(Image.open(OUT / 'slab_256.png').convert('L')).astype(float)
    print(f"slab_256 top/bottom half mean lum {s[:128].mean():.0f}/{s[128:].mean():.0f}")
    print('PASS CM-TERR slab' if ok else 'FAIL CM-TERR slab'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save(build())
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in NAMES}
        h1 = h(); save(build()); print('REPRO', 'PASS' if h1 == h() else 'FAIL', len(h1), 'files')
    else:
        print('built', NAMES)
