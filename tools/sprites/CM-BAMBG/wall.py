"""Trúc dày (Opus 22/11, người dùng: 'phần trúc còn thưa'). Vách trúc phông nền cắt THẲNG từ
concept C V1.png (1x = tỉ lệ game, khung view (1,16) = world x32 y512): vùng vườn Tây
cột 0..183, hàng 0..147 là khối lá lục xám kín. Phần bị cổng nguyệt/mái che trong concept được
lấp bằng chính vân trúc phía trên (chép dọc chu kỳ P). Mở rộng: trái x0..32 = soi gương cột 0..31,
trên 72 hàng = hàng 0..71 dịch ngang (đỉnh tán rìa lá tách theo độ sáng). Lượng tử về bảng màu
của chính vùng concept (K màu). Đông = lật ngang (x' = 1296 - x - w).
Mảnh layer base, chân y=530 (sau mọi khóm CM-BAMBG chân >= 540), anchor kéo ảnh xuống tới
y=530-AY+H < 725 (không vắt qua chân tường), không roof, không va chạm (vườn đã có tường).
Chạy: python -X utf8 tools/sprites/CM-BAMBG/wall.py [--verify]"""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
V1 = np.array(Image.open(ROOT / '.agents/refs/CM/V1.png').convert('RGB')).astype(np.int16)
OUT = ROOT / 'public/assets/kits/CM-BAMBG'
CW, CH = 184, 148            # vùng concept: cột 0..183 (tới mép tường dọc), hàng 0..147 (tới đỉnh lan can)
P = 72                       # chu kỳ chép dọc để lấp phần bị cổng che
GATE = (18, 161, 70)         # cổng nguyệt + mái trong concept: cột 18..160 từ hàng 70 trở xuống
TOP, LEFT = 72, 32           # mở rộng phía trên (vườn kéo lên tới ~y440) và trái (world x0..32)
FOOT, K = 530, 28


def lum(a): return a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11

def core():
    c = V1[:CH, :CW].copy()
    for y in range(GATE[2], CH):                 # lấp từ trên xuống: hàng y lấy hàng y-P (đã sạch)
        c[y, GATE[0]:GATE[1]] = c[y - P, GATE[0]:GATE[1]]
    return c

def build():
    c = core(); rng = np.random.default_rng(22)
    left = c[:, :LEFT][:, ::-1]
    body = np.concatenate([left, c], 1)                       # 148 x 216
    R = np.roll(body, 37, axis=1)                             # tán phía trên: vân hàng 0..71 dịch ngang
    rgb = np.concatenate([R[:TOP], body], 0)                  # 220 x 216
    H, W = rgb.shape[:2]
    # mối nối răng cưa (tránh vạch ngang ở y512): mỗi cột phần trên lấn xuống 0..12 hàng, nhịp theo cụm 3-5 cột
    x = 0
    while x < W:
        k, j = int(rng.integers(3, 6)), int(rng.integers(0, 13))
        rgb[TOP:TOP + j, x:x + k] = R[TOP:TOP + j, x:x + k]; x += k
    a = np.ones((H, W), bool)
    # đỉnh tán: đường vồng theo khóm + rìa lá theo độ sáng (lá sáng giữ, khe tối bỏ)
    xs = np.arange(W)
    crest = 18 + 10 * np.sin(xs / 23.0) + 6 * np.sin(xs / 9.0 + 1.3) + rng.integers(-2, 3, W)
    L = lum(rgb)
    for x in range(W):
        cy = int(crest[x])
        a[:max(cy, 0), x] = False
        for y in range(max(cy, 0), min(cy + 16, H)):          # dải rìa 16 px: bỏ dần pixel tối
            if L[y, x] < 70 + (cy + 16 - y) * 3: a[y, x] = False
    # chân: mép lởm chởm 0..4 px
    for x in range(W):
        a[H - rng.integers(0, 5):, x] = False
    # bỏ điểm cô lập ở rìa
    for _ in range(2):
        n = sum(np.roll(np.roll(a, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a
        a &= n >= 3
    im = Image.fromarray(rgb.clip(0, 255).astype(np.uint8))
    q = im.quantize(K, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(q), a.astype(np.uint8) * 255])
    w = Image.fromarray(out, 'RGBA')
    ims = {'bamboo_wall_w': w, 'bamboo_wall_e': w.transpose(Image.Transpose.FLIP_LEFT_RIGHT)}
    AY = TOP + 18                                             # chân (y530) nằm ở hàng ~90 -> ảnh từ y440 tới y660
    kit = {n: {'file': f'{n}.png', 'layer': 'base', 'anchor': [0, AY], 'footprint': [W, 20], 'collide': [],
               'source': 'Opus 22/11: direct crop .agents/refs/CM/V1.png cols 0..183 rows 0..147 (gate filled from rows above, '
                         f'P={P}), mirror-left {LEFT}, top {TOP} rolled, quantize {K}' + (', flipped' if n.endswith('_e') else '')}
           for n in ims}
    return ims, kit

def verify():
    ims, kit = build()
    k = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))['pieces']
    for n, im in ims.items():
        assert k[n] == kit[n], n
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        assert np.array_equal(a, np.array(im)), n
        h = a.shape[0]; assert FOOT - kit[n]['anchor'][1] + h < 723, 'vắt qua chân tường'
    print(f'PASS CM-BAMBG wall: {list(ims)} {ims["bamboo_wall_w"].size}, đáy y{FOOT - kit["bamboo_wall_w"]["anchor"][1] + ims["bamboo_wall_w"].size[1]}')

if __name__ == '__main__':
    if '--verify' not in sys.argv:
        ims, kit = build()
        for n, im in ims.items(): im.save(OUT / f'{n}.png')
        p = OUT / 'kit.json'; j = json.loads(p.read_text(encoding='utf-8'))
        j['pieces'].update(kit)
        p.write_text(json.dumps(j, ensure_ascii=False, indent=2), encoding='utf-8', newline='')
    verify()
