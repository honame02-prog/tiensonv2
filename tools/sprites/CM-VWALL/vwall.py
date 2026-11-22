"""Tường dọc (B–N) HVQ — bước 3 (Opus tự làm, 22/11) theo công thức CM-TERR.

Luật chiếu (design/tienson/20-bang-chieu-lop-hvq.md): tường dọc chỉ thấy NÓC NGÓI (dải hẹp
chạy theo Y) và mặt đứng của ĐẦU NAM. Không có mặt đỏ bên (cwall_v cũ sai luật).

Nguồn: concept C V1-original.png (1672x941, V1.png = thu 3,483 lần)
  - dải ngói hai mái + sống sáng: x638..696, y0..274
  - đầu hồi trang trí:            y274..313
  - chân đá đầu Nam (mặt đứng):   y313..362, x641..693
Cách làm: median theo ô (17 cột, hàng 3,483 px) -> chuyển trung bình/độ lệch kênh về vùng
tương ứng trong V1.png -> lượng tử bảng STYLE §5 + màu V1 vùng tường dọc -> khử điểm cô lập.

Mảnh (kit CM-VWALL, layer base, mỗi mảnh 17x32, anchor [0,32], footprint/collide 16x32):
  vwall_32     dải ngói lặp dọc (chu kỳ 32 chọn theo mối nối nhỏ nhất)
  vwall_end_S  7 hàng ngói + đầu hồi 11 + chân đá 14 (đầu Nam, chân = đáy mảnh)
  vwall_end_N  đầu Bắc: đầu hồi lật + 21 hàng ngói (nối khít với vwall_32 bên dưới)
Base chia theo đoạn 32 px để sắp lớp theo y đúng với nhân vật.

Chạy: python -X utf8 tools/sprites/CM-VWALL/vwall.py [--verify]
"""
from pathlib import Path
import json, re, sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
REF = ROOT / '.agents/refs/CM'
OUT = ROOT / 'public/assets/kits/CM-VWALL'
SRC = np.array(Image.open(REF / 'V1-original.png').convert('RGB'))
V1 = np.array(Image.open(REF / 'V1.png').convert('RGB'))
K = 3.483
X0, X1, W = 638, 696, 17
STRIP_Y = (0, 274)
GABLE_Y = (274, 313)
STONE_Y = (313, 362)
STONE_X = (641, 693)
V1_BOX = (slice(0, 105), slice(183, 201))      # cùng vùng trong V1.png
V = (0, 79, 90, 104)                           # V1.png: ngói / đầu hồi / chân đá
VX = (183, 200)                                # 17 cột, viền tối 183 và 199


def palette():
    style = (ROOT / 'docs/assetgen/STYLE.md').read_text(encoding='utf-8')
    sec = style.split('## 5.')[1].split('## 6.')[0]
    cols = {tuple(bytes.fromhex(h)) for h in re.findall(r'#([0-9a-fA-F]{6})', sec)}
    cols |= {tuple(int(v) for v in c) for c in np.unique(V1[V1_BOX].reshape(-1, 3), axis=0)}
    return np.array(sorted(cols), dtype=np.int32)


PAL = palette()


def quantize(img):
    flat = img.reshape(-1, 3).astype(np.int32)
    idx = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(2).argmin(1)
    return PAL[idx].reshape(img.shape).astype(np.uint8)


def cells(y0, y1):
    n = max(1, round((y1 - y0) / K))
    ye = np.linspace(y0, y1, n + 1).round().astype(int)
    xe = np.linspace(X0, X1, W + 1).round().astype(int)
    out = np.zeros((n, W, 3), np.uint8)
    for y in range(n):
        for x in range(W):
            c = SRC[ye[y]:ye[y + 1], xe[x]:xe[x + 1]]
            out[y, x] = np.median(c.reshape(-1, 3), axis=0)
    return out, xe


def isolated(q, a):
    h, w = q.shape[:2]; p = np.pad(q, ((1, 1), (1, 1), (0, 0)), mode='edge')
    iso = np.ones((h, w), bool)
    for dy, dx in ((0, 1), (2, 1), (1, 0), (1, 2)):
        iso &= ~(p[dy:dy + h, dx:dx + w] == q).all(2)
    return iso & a


def despeckle(q, a):
    h, w = q.shape[:2]; p = np.pad(q, ((1, 1), (1, 1), (0, 0)), mode='edge'); out = q.copy()
    for y, x in zip(*np.nonzero(isolated(q, a))):
        nb = [tuple(p[y + dy, x + dx]) for dy in range(3) for dx in range(3) if (dy, dx) != (1, 1)]
        out[y, x] = max(sorted(set(nb)), key=nb.count)
    return out


def build():
    """Cắt thẳng từ V1.png (concept C ở đúng tỉ lệ game 1x). Bản median từ V1-original (v1)
    mất vân ngói chữ V và sống sáng -> thành sạn; V1.png giữ được cấu trúc."""
    strip = quantize(V1[V[0]:V[1], VX[0]:VX[1]])          # 79 x 17
    gable = quantize(V1[V[1]:V[2], VX[0]:VX[1]])          # 11
    stone = quantize(V1[V[2]:V[3], VX[0]:VX[1]])          # 14
    sf = strip.astype(float)
    score = {w: float(np.abs(sf[w] - sf[w + 32]).mean() + np.abs(sf[w + 31] - sf[w + 32]).mean())
             for w in range(4, len(strip) - 33)}
    w = min(score, key=score.get)
    tile = strip[w:w + 32]
    stone_a = np.ones(stone.shape[:2], bool); stone_a[:, 0] = stone_a[:, -1] = False
    pieces = {'vwall_32': (tile, np.ones((32, W), bool))}
    pieces['vwall_end_S'] = (np.concatenate([tile[:7], gable, stone]),
                             np.concatenate([np.ones((7 + len(gable), W), bool), stone_a]))
    pieces['vwall_end_N'] = (np.concatenate([gable[::-1], tile[len(gable):]]), np.ones((32, W), bool))
    out = {}
    for n, (rgb, al) in pieces.items():
        assert rgb.shape[:2] == (32, W), (n, rgb.shape)
        out[n] = np.dstack([rgb, np.where(al, 255, 0).astype(np.uint8)])
        out[n][~al, :3] = 0
    return out, {'tile_window': [w, w + 32], 'seam': round(score[w], 2)}


SOURCE = {'file': '.agents/refs/CM/V1-original.png', 'strip': [X0, STRIP_Y[0], X1, STRIP_Y[1]],
          'gable': [X0, GABLE_Y[0], X1, GABLE_Y[1]], 'stone': [STONE_X[0], STONE_Y[0], STONE_X[1], STONE_Y[1]],
          'scale': K, 'v1_crop': [VX[0], V[0], VX[1], V[3]], 'method': 'Opus 22/11 buoc 3: direct crop V1.png 1x (game scale) '
          'x183..199 y0..104; strip period 32 by min seam; STYLE5+V1 palette; alpha 0/255; roof-only N/S wall (no side face)'}


def save(out, info):
    OUT.mkdir(parents=True, exist_ok=True)
    kit = {'kit': 'CM-VWALL', 'tile': 32, 'palette': ['#%02x%02x%02x' % tuple(c) for c in PAL], 'pieces': {}}
    for n, a in out.items():
        Image.fromarray(a, 'RGBA').save(OUT / f'{n}.png', optimize=False)
        kit['pieces'][n] = {'file': f'{n}.png', 'layer': 'base', 'anchor': [0, 32], 'footprint': [16, 32],
                            'collide': [[0, -32, 16, 32]], 'source': dict(SOURCE, **info)}
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def verify():
    out, info = build()
    kit = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    pal = {tuple(c) for c in PAL}
    for n, a in out.items():
        disk = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        assert np.array_equal(disk, a), f'{n} khác bản build'
        assert set(np.unique(disk[:, :, 3])) <= {0, 255}, n
        assert {tuple(c) for c in disk[disk[:, :, 3] > 0, :3]} <= pal, f'{n} màu ngoài bảng'
        assert kit['pieces'][n]['layer'] == 'base'
    t = out['vwall_32'].astype(float)
    wrap = float(np.abs(t[31, :, :3] - t[0, :, :3]).mean())
    inner = float(np.mean([np.abs(t[y, :, :3] - t[y + 1, :, :3]).mean() for y in range(31)]))
    assert wrap <= inner * 1.6, (wrap, inner)
    for n in ('vwall_end_S', 'vwall_end_N'):   # nối khít với vwall_32
        e = out[n].astype(float)
        # mối nối thật: end_S hàng 0 nằm dưới vwall_32 hàng 31; vwall_32 hàng 0 nằm dưới end_N hàng 31
        j = np.abs(e[0, :, :3] - t[31, :, :3]).mean() if n.endswith('S') else np.abs(t[0, :, :3] - e[31, :, :3]).mean()
        assert j <= inner * 1.6, (n, j, inner)
    s = out['vwall_end_S']
    assert not s[-14:, 0, 3].any() and not s[-14:, -1, 3].any(), 'chân đá phải hẹp hơn mái'
    print(f'PASS CM-VWALL: 3 mảnh khớp build, alpha 0/255, bảng màu; mối lặp {wrap:.1f} <= 1,6x trong-dải {inner:.1f}; '
          f'cửa sổ lặp {info["tile_window"]}')


if __name__ == '__main__':
    if '--verify' in sys.argv:
        verify()
    else:
        out, info = build(); save(out, info); print('saved', list(out), info)
        verify()
