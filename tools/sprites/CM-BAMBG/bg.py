"""Bước 4 (Opus 22/11): trúc phông nền sau tường. Gộp base + _roof của trúc CM-TERR (đã duyệt,
không sửa) thành một mảnh layer base, KHÔNG pair roof -> tán không còn đè nguyệt môn/nhân vật,
sắp lớp theo chân như mọi vật đứng (design/tienson/20-bang-chieu-lop-hvq.md, luật đặt 2).
Chạy: python -X utf8 tools/sprites/CM-BAMBG/bg.py [--verify]"""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
SRC, OUT = ROOT / 'public/assets/kits/CM-TERR', ROOT / 'public/assets/kits/CM-BAMBG'
NAMES = ['bamboo_a', 'bamboo_b', 'bamboo_edge']

def build():
    src = json.loads((SRC / 'kit.json').read_text(encoding='utf-8'))['pieces']
    ims, kit = {}, {'kit': 'CM-BAMBG', 'tile': 32, 'pieces': {}}
    for n in NAMES:
        b = Image.open(SRC / f'{n}.png').convert('RGBA'); r = Image.open(SRC / f'{n}_roof.png').convert('RGBA')
        ims[n + '_bg'] = Image.alpha_composite(b, r)
        p = src[n]
        kit['pieces'][n + '_bg'] = {'file': f'{n}_bg.png', 'layer': 'base', 'anchor': p['anchor'],
            'footprint': p['footprint'], 'collide': p['collide'], 'source': f'CM-TERR/{n} + {n}_roof composited (no roof pair)'}
    return ims, kit

def verify():
    ims, kit = build()
    assert json.loads((OUT / 'kit.json').read_text(encoding='utf-8')) == kit
    for n, im in ims.items():
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        assert np.array_equal(a, np.array(im)), n
        assert set(np.unique(a[:, :, 3])) <= {0, 255}, n
    print('PASS CM-BAMBG: 3 mảnh = base+roof CM-TERR, layer base, không pair')

if __name__ == '__main__':
    if '--verify' not in sys.argv:
        ims, kit = build(); OUT.mkdir(parents=True, exist_ok=True)
        for n, im in ims.items(): im.save(OUT / f'{n}.png')
        (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')
    verify()
