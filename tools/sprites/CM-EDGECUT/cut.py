"""Sửa 'nền rừng trúc lem ra ngoài' (Opus 22/11, records/LEM): mảnh mép CM-TERR/edge_*_a đặt vắt qua
chân tường nguyệt môn (y725), sort theo chân y903 nên lá tối đè tường đỏ + sân. Bản _out: cùng ảnh
edge_w_a / edge_e_a nhưng chỉ giữ alpha ở dải lề bản đồ (x<~32 Tây, x>~1248 Đông), mép răng cưa nhẹ,
dùng cho đoạn mép NẰM DƯỚI chân tường (y>=726), nơi concept V1 là sân/lan can từ world x32.
Chạy: python -X utf8 tools/sprites/CM-EDGECUT/cut.py [--verify]"""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
SRC, OUT = ROOT / 'public/assets/kits/CM-TERR', ROOT / 'public/assets/kits/CM-EDGECUT'
KEEP = 32

def limit(h):
    y = np.arange(h)
    return (KEEP - 4 + 3 * np.sin(y / 7.0) + 2 * np.sin(y / 2.3 + 1)).round().astype(int)

def build():
    src = json.loads((SRC / 'kit.json').read_text(encoding='utf-8'))['pieces']
    ims, kit = {}, {'kit': 'CM-EDGECUT', 'tile': 32, 'pieces': {}}
    for n, west in (('edge_w_a', True), ('edge_e_a', False)):
        a = np.array(Image.open(SRC / f'{n}.png').convert('RGBA')); h, w = a.shape[:2]
        lim = limit(h); xx = np.arange(w)[None]
        keep = xx < lim[:, None] if west else xx >= (w - lim)[:, None]
        a[~keep] = 0
        ims[n + '_out'] = Image.fromarray(a)
        p = src[n]
        kit['pieces'][n + '_out'] = {'file': f'{n}_out.png', 'layer': p['layer'], 'anchor': p['anchor'],
            'footprint': p['footprint'], 'collide': p['collide'], 'source': f'CM-TERR/{n} alpha cut to map margin ~{KEEP}px'}
    return ims, kit

def verify():
    ims, kit = build()
    assert json.loads((OUT / 'kit.json').read_text(encoding='utf-8')) == kit
    for n, im in ims.items():
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        assert np.array_equal(a, np.array(im)), n
        cols = np.nonzero(a[:, :, 3].any(0))[0]
        assert (cols.max() < KEEP + 2) if '_w_' in n else (cols.min() >= a.shape[1] - KEEP - 2), (n, cols.min(), cols.max())
    print('PASS CM-EDGECUT: edge_w_a_out / edge_e_a_out chỉ phủ lề <= 33 px')

if __name__ == '__main__':
    if '--verify' not in sys.argv:
        ims, kit = build(); OUT.mkdir(parents=True, exist_ok=True)
        for n, im in ims.items(): im.save(OUT / f'{n}.png')
        (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')
    verify()
