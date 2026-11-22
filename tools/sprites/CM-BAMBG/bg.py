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
        ims[n + '_bg'] = recolor(Image.alpha_composite(b, r))
        p = src[n]
        kit['pieces'][n + '_bg'] = {'file': f'{n}_bg.png', 'layer': 'base', 'anchor': p['anchor'],
            'footprint': p['footprint'], 'collide': p['collide'], 'source': f'CM-TERR/{n} + {n}_roof composited (no roof pair), '
            'recolored to bamboo_wall_w palette by luminance rank (22/11 trúc dày)'}
    return ims, kit

def recolor(im):
    """22/11 (người dùng: màu game xanh/vàng hơn concept): khớp độ sáng theo hạng với vách trúc cắt từ
    V1.png rồi lấy màu bảng vách gần nhất về độ sáng -> lục xám như concept, giữ hình khóm."""
    w = np.array(Image.open(OUT / 'bamboo_wall_w.png').convert('RGBA')).reshape(-1, 4)
    w = w[w[:, 3] == 255, :3].astype(float)
    lw = w @ [0.3, 0.59, 0.11]
    pal = np.unique(w, axis=0); lp = pal @ [0.3, 0.59, 0.11]
    a = np.array(im).copy(); m = a[:, :, 3] == 255
    px = a[m, :3].astype(float); l = px @ [0.3, 0.59, 0.11]
    rank = np.argsort(np.argsort(l)) / max(len(l) - 1, 1)
    tgt = np.quantile(lw, rank)
    a[m, :3] = pal[np.abs(lp[None, :] - tgt[:, None]).argmin(1)].astype(np.uint8)
    return Image.fromarray(a, 'RGBA')

def verify():
    ims, kit = build()
    k = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
    assert {n: k['pieces'][n] for n in kit['pieces']} == kit['pieces'] and k['kit'] == kit['kit']
    for n, im in ims.items():
        a = np.array(Image.open(OUT / f'{n}.png').convert('RGBA'))
        assert np.array_equal(a, np.array(im)), n
        assert set(np.unique(a[:, :, 3])) <= {0, 255}, n
    print('PASS CM-BAMBG: 3 mảnh = base+roof CM-TERR, layer base, không pair')

if __name__ == '__main__':
    if '--verify' not in sys.argv:
        ims, kit = build(); OUT.mkdir(parents=True, exist_ok=True)
        for n, im in ims.items(): im.save(OUT / f'{n}.png')
        p = OUT / 'kit.json'; j = json.loads(p.read_text(encoding='utf-8')) if p.exists() else kit
        j['pieces'].update(kit['pieces'])
        p.write_text(json.dumps(j, ensure_ascii=False, indent=2), encoding='utf-8', newline='')
    verify()
