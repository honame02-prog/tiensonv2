"""Mép Đông/Tây HVQ (Opus vẽ bằng mã, 22/11) — sơ đồ 15 mục 1.4: "dải cổ thụ 1–2 ô rồi vách".
Trước đây x 0..31 (có đoạn tới 63) và x 1216/1248..1279 của ground.png là nền xanh khối, không mảnh nào.
Mảnh dọc 80x224 (anchor chân trái-dưới, lớp base, không va chạm — va chạm mép đã có trong lưới col):
  - vách đá ở mép ngoài (x 0..~22): phiến đá dựng xám nâu, khe tối dọc, gờ sáng trên, rêu loang;
  - 2-3 cổ thụ: thân to 6-9 px vỏ nâu xám, rễ bò ra đất, tán tròn chồng lớp (đáy tối, mép trên sáng);
  - nền dưới: đất tối + lá khô, phủ đặc mọi hàng ở x < 40 để che hết nền xanh.
edge_w_a / edge_w_b: hai biến thể (seed khác); edge_e_a / edge_e_b: soi gương cho Đông lộ.
Màu: đá từ sân lát CM-TERR (garden.STONE), tán/đất từ rừng trúc concept (bamboo.concept_cols).
Chạy: python -X utf8 tools/sprites/CM-TERR/edge.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, math, random, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bamboo as bb
import garden as gd

OUT = bb.OUT
W, H = 96, 224   # v2: 96 rộng, đất đặc tới x<64 (nền xanh ground.png tới x63 / x1184)
C = sorted(bb.concept_cols(), key=sum)
STONE = gd.STONE                                   # 5 tông đá tối -> sáng
SOIL = [C[0], C[1], C[2], C[4]]
FOL = [C[0], C[2], C[5], C[8], C[11], C[14], C[17]]   # tán cổ thụ: tối hơn trúc, lục ô liu trầm
FOL_HI = [(70, 88, 63), (87, 105, 72)]                # mép sáng (lục STYLE, không vàng)
BARK = [C[0], C[3], (66, 58, 48), (92, 82, 66)]       # vỏ: bóng, thân, nâu xám, sáng
NAMES = ['edge_w_a', 'edge_w_b', 'edge_e_a', 'edge_e_b']


def snap(c):
    p = bb.PAL; i = ((p - np.array(c)) ** 2).sum(1).argmin(); return tuple(int(v) for v in p[i])


BARK = [snap(c) for c in BARK]
FOL_HI = [snap(c) for c in FOL_HI]


def draw(seed):
    rnd = random.Random(f'hvq-edge-{seed}')
    img = np.zeros((H, W, 3), np.uint8); m = np.zeros((H, W), bool)
    yy, xx = np.mgrid[0:H, 0:W]
    n1 = gd.noise(rnd, W, H, 9); n2 = gd.noise(rnd, W, H, 3)

    def put(x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H: img[y, x] = c; m[y, x] = True

    # 1. nền đất tối: đặc ở x < 64 (che hết nền xanh), răng cưa mềm tới ~78
    soil = (xx < 64) | (xx + (n1 - 0.5) * 24 < 72)
    img[soil] = np.array(SOIL)[np.clip((n1[soil] * 0.7 + n2[soil] * 0.3) * 4, 0, 3).astype(int)]
    m |= soil
    for _ in range(90):                               # lá khô rơi
        x, y = rnd.uniform(0, 72), rnd.uniform(4, H - 2)
        if soil[int(y), int(x)]:
            c = C[rnd.choice((15, 18, 20))]
            for k in range(3): put(x + k, y + (k % 2) * 0.5, c)
    # 2. vách đá dựng ở mép ngoài: phiến đứng cao 14-30 px, rộng 6-11 px
    y = H
    while y > 0:
        x = 0
        hh = rnd.randint(14, 30)
        while x < 24:
            w = rnd.randint(6, 11); top = y - hh + rnd.randint(-3, 3)
            for py in range(max(0, top), min(H, y)):
                for px in range(x, min(W, x + w)):
                    if px > 22 + (n1[py, px] - 0.5) * 8: continue
                    f = (py - top) / max(1, y - top)
                    k = 3 if py - top < 2 else (0 if px == x + w - 1 or py >= y - 1 else (2 if f < 0.4 else 1))
                    c = STONE[k]
                    if n2[py, px] > 0.66 and k in (1, 2): c = C[rnd.choice((9, 12))]   # rêu
                    put(px, py, c)
            x += w
        y -= hh - rnd.randint(0, 3)
    # 3. cổ thụ: thân + rễ, rồi tán
    trees = []
    for i in range(rnd.choice((2, 3))):
        tx = rnd.uniform(16, 44); foot = H - 4 - rnd.uniform(0, 60) - i * 70
        if foot < 70: break
        trees.append((tx, foot, rnd.randint(6, 9)))
    for tx, foot, tw in trees:
        top = foot - rnd.uniform(70, 110)
        bend = rnd.uniform(-6, 6)
        for py in range(int(top), int(foot) + 1):
            f = (foot - py) / (foot - top)
            cx = tx + bend * f * f
            w = tw + (3 if py > foot - 5 else 0)           # chân loe
            for k in range(w):
                c = BARK[3] if k == 0 else (BARK[0] if k >= w - 2 else (BARK[2] if (py * 3 + k * 5) % 11 < 3 else BARK[1]))
                put(cx - w / 2 + k, py, c)
        for side in (-1, 1):                              # rễ bò
            for k in range(rnd.randint(5, 9)):
                put(tx + side * (tw / 2 + k), foot - 1 + k * 0.25, BARK[1 if k % 3 else 0])
    # 4. tán: đốm tròn chồng lớp từ sau ra trước; đáy-phải tối, mép trên-trái sáng
    blobs = []
    for tx, foot, tw in trees:
        cy0 = foot - rnd.uniform(85, 120)
        for _ in range(rnd.randint(16, 22)):
            blobs.append((tx + rnd.uniform(-20, 16), cy0 + rnd.uniform(-40, 40), rnd.uniform(5, 9)))
    for _ in range(12):                                   # tán lấp khoảng trên vách (cây ngoài khu)
        blobs.append((rnd.uniform(-6, 22), rnd.uniform(0, H - 40), rnd.uniform(6, 10)))
    blobs.sort(key=lambda b: b[1] + b[2] * 0.5)
    for bx, by, r in blobs:
        for py in range(int(by - r - 1), int(by + r + 2)):
            for px in range(int(bx - r - 1), int(bx + r + 2)):
                if not (0 <= px < W and 0 <= py < H): continue
                d = math.hypot(px - bx, (py - by) * 1.1) / r + (n2[py, px] - 0.5) * 0.8
                if d > 1 or px > 62 + (n1[py, px] - 0.5) * 12: continue   # tán không lấn sang lối/tường
                lit = ((bx - px) * 0.6 + (by - py)) / r      # sáng từ trên-trái
                t = 0.45 + lit * 0.35 + (n2[py, px] - 0.5) * 0.7      # nhiễu mạnh: chùm lá, không bóng tròn
                if d > 0.8 and lit > 0.45 and n2[py, px] > 0.45:
                    c = FOL_HI[int(n2[py, px] * 2) % 2]
                else:
                    c = FOL[int(np.clip(t * len(FOL), 0, len(FOL) - 1))]
                put(px, py, c)
    # khử điểm đặc cô lập
    pm = np.pad(m, 1)
    m &= (pm[:-2, 1:-1] | pm[2:, 1:-1] | pm[1:-1, :-2] | pm[1:-1, 2:])
    return img, m


def save():
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    for seed in ('a', 'b'):
        rgb, m = draw(seed)
        for side, flip in (('w', False), ('e', True)):
            r, a = (rgb[:, ::-1], m[:, ::-1]) if flip else (rgb, m)
            name = f'edge_{side}_{seed}'
            out = np.dstack([np.where(a[..., None], r, 0), np.where(a, 255, 0)]).astype(np.uint8)
            Image.fromarray(out, 'RGBA').save(OUT / f'{name}.png', optimize=False)
            kit['pieces'][name] = {'file': f'{name}.png', 'layer': 'base', 'anchor': [0, H - 1], 'footprint': [W, 20],
                                   'collide': [], 'source': 'Opus edge.py: vach da + co thu mep Dong/Tay (so do 15 muc 1.4)'
                                   + (' (soi guong)' if flip else '')}
    # edge_fill: miếng đất 48x40 lớp ground, lấp nền xanh lẻ ở chỗ mảnh dọc không tới (Đông x1184..1215 y1088..1119)
    rnd = random.Random('hvq-edge-fill'); FW, FH = 48, 40
    n1 = gd.noise(rnd, FW, FH, 9); n2 = gd.noise(rnd, FW, FH, 3)
    yy, xx = np.mgrid[0:FH, 0:FW]
    e = np.minimum.reduce([xx / 6, (FW - 1 - xx) / 6, yy / 6, (FH - 1 - yy) / 6, np.ones_like(n1)])
    fm = e + (n1 - 0.5) * 0.8 > 0.25
    frgb = np.array(SOIL)[np.clip((n1 * 0.7 + n2 * 0.3) * 4, 0, 3).astype(int)]
    for _ in range(14):
        x, y = rnd.randrange(3, FW - 4), rnd.randrange(3, FH - 3)
        for k in range(3): frgb[y, x + k] = C[rnd.choice((15, 18, 20))]
    out = np.dstack([np.where(fm[..., None], frgb, 0), np.where(fm, 255, 0)]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(OUT / 'edge_fill.png', optimize=False)
    kit['pieces']['edge_fill'] = {'file': 'edge_fill.png', 'layer': 'ground', 'anchor': [0, 0], 'footprint': [FW, FH],
                                  'collide': [], 'source': 'Opus edge.py: mieng dat lap nen xanh le o mep'}
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def verify():
    ok = True; pal = {tuple(c) for c in bb.PAL.tolist()}
    for n in NAMES:
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        cols = {tuple(c) for c in a[a[:, :, 3] > 0, :3].tolist()}
        outer = a[:, :40, 3] if '_w_' in n else a[:, -40:, 3]
        good = (a.shape[:2] == (H, W) and not (cols - pal) and set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}
                and (outer > 0).mean() > 0.995 and len(cols) >= 12)
        print(f"{'PASS' if good else 'FAIL'} {n} {W}x{H} solid={(a[:, :, 3] > 0).mean():.0%} outer40={(outer > 0).mean():.1%} "
              f"colors={len(cols)} off_palette={len(cols - pal)}")
        ok &= good
    print('PASS CM-TERR edge' if ok else 'FAIL CM-TERR edge'); return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save()
    if '--repro' in sys.argv:
        h = lambda: {n: hashlib.sha256((OUT / f'{n}.png').read_bytes()).hexdigest() for n in NAMES + ['edge_fill']}
        h1 = h(); save(); print('REPRO', 'PASS' if h1 == h() else 'FAIL')
    else:
        print('built', NAMES)
