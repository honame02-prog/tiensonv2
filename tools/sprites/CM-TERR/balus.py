"""CM-TERR lan can (Opus): cắt lan can đá từ V1-original, cùng công thức tường chắn.
Mảnh thân lan can không có trụ (trụ là balus_post đặt riêng ở mối nối, giấu mối nối).
Chạy: python -X utf8 tools/sprites/CM-TERR/balus.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import quantize, PAL, REF, OUT, OLD, ROOT  # noqa: E402

H = 30
SC = (757 - 586) / 56          # cùng tỉ lệ với tường chắn (~3,05 px nguồn / px game)
Y1 = 590                        # chân lan can trên gờ tường chắn
Y0 = Y1 - H * SC
RAIL_TOP, CAP_TOP = 535, 508    # đỉnh tay vịn; đỉnh mũ trụ
POSTS = [(617, 652), (791, 827), (995, 1030), (1195, 1230)]


def cells(src, mask, x0, x1):
    w = round((x1 - x0) / SC)
    xe = np.linspace(x0, x1, w + 1).round().astype(int)
    ye = np.linspace(Y0, Y1, H + 1).round().astype(int)
    rgb = np.zeros((H, w, 3), np.uint8); a = np.zeros((H, w), np.uint8)
    for y in range(H):
        for x in range(w):
            sl = (slice(ye[y], max(ye[y] + 1, ye[y + 1])), slice(xe[x], max(xe[x] + 1, xe[x + 1])))
            m = mask[sl]
            if m.mean() >= .5:
                rgb[y, x] = np.median(src[sl][m], axis=0); a[y, x] = 255
    return rgb, a


def build():
    src = np.array(Image.open(REF / 'V1-original.png').convert('RGB'))
    mask = np.zeros(src.shape[:2], bool)
    mask[RAIL_TOP:Y1 + 1, :] = True
    for p0, p1 in POSTS:
        mask[CAP_TOP:Y1 + 1, p0:p1] = True
    spans = [cells(src, mask, POSTS[i][1], POSTS[i + 1][0]) for i in range(len(POSTS) - 1)]
    rail = np.concatenate([s[0] for s in spans], 1); ra = np.concatenate([s[1] for s in spans], 1)
    post, pa = cells(src, mask, *POSTS[0])
    # Chuyển màu về concept 1x (ảnh gốc ám cam), đo trên pixel đặc của vùng lan can V1.png.
    ref = np.array(Image.open(REF / 'V1.png').convert('RGB')).astype(float)[154:169, 178:346].reshape(-1, 3)
    allpx = np.concatenate([rail[ra > 0], post[pa > 0]]).astype(float)
    mu, sd = allpx.mean(0), allpx.std(0) + 1e-6
    fix = lambda im: np.clip((im.astype(float) - mu) / sd * ref.std(0) + ref.mean(0), 0, 255).astype(np.uint8)
    post = quantize(fix(post))[:, :11]; pa = pa[:, :11]
    # Concept có trụ mỗi ~57-65 px. Như C-R1: trụ ở x=0 và mỗi 64 px, giữa là một nhịp
    # tay vịn thật (2 ô khắc) cắt giữa từ các nhịp nguồn rộng 54-55 px.
    segs = []
    for rgb, a in spans[1:]:
        w = rgb.shape[1]; o = (w - 53) // 2
        segs.append((quantize(fix(rgb[:, o:o + 53])), a[:, o:o + 53]))

    def run(width, start):
        rgb = []; al = []
        k = start
        while sum(r.shape[1] for r in rgb) < width:
            s = segs[k % len(segs)]; k += 1
            rgb += [post, s[0]]; al += [pa, s[1]]
        return np.concatenate(rgb, 1)[:, :width], np.concatenate(al, 1)[:, :width]
    out = {'balus_post': (post, pa)}
    for name, w, st in [('balus_4', 128, 0), ('balus_2', 64, 1), ('balus_1', 32, 0), ('balus_short_48', 48, 1)]:
        out[name] = run(w, st)
    return out


def save(pieces):
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    oldp = json.loads((OLD / 'kit.json').read_text(encoding='utf-8'))
    oldp = oldp.get('pieces', oldp)
    for name, (rgb, a) in pieces.items():
        Image.fromarray(np.dstack([rgb, a]), 'RGBA').save(OUT / f'{name}.png', optimize=False)
        meta = dict(oldp[name]); meta['file'] = f'{name}.png'
        meta['source'] = f'V1-original balustrade y{Y0:.0f}..{Y1}, posts {POSTS} (Opus CM-TERR)'
        kit['pieces'][name] = meta
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


NAMES = ['balus_post', 'balus_4', 'balus_2', 'balus_1', 'balus_short_48']


def verify():
    ok = True; pal = {tuple(c) for c in PAL.tolist()}
    for n in NAMES:
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA')); o = Image.open(OLD / f'{n}.png').size
        cols = {tuple(c) for c in a[a[:, :, 3] > 0, :3].tolist()}
        good = (a.shape[1], a.shape[0]) == o and set(np.unique(a[:, :, 3]).tolist()) <= {0, 255} and not (cols - pal)
        solid = (a[:, :, 3] > 0).mean()
        print(f"{'PASS' if good else 'FAIL'} {n} {a.shape[1]}x{a.shape[0]} (C-R1 {o[0]}x{o[1]}) solid={solid:.0%} off_palette={len(cols - pal)}")
        ok &= good
    print('PASS CM-TERR balus' if ok else 'FAIL CM-TERR balus'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save(build())
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in NAMES}
        h1 = h(); save(build()); print('REPRO', 'PASS' if h1 == h() else 'FAIL')
    else:
        print('built', NAMES)
