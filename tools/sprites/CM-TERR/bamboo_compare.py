"""Ảnh so sánh trúc: concept gốc + V1 1x | game tây/đông | mảnh mới/cũ 3x."""
from pathlib import Path
from PIL import Image, ImageDraw
R = Path(__file__).resolve().parents[3]; B = (42, 46, 42); T = (225, 225, 210)
K = R / 'public/assets/kits'
c = Image.new('RGB', (1940, 1700), B); d = ImageDraw.Draw(c)
src = Image.open(R / '.agents/refs/CM/V1-original.png').convert('RGB').crop((0, 0, 470, 300))
c.paste(src.resize((705, 450), Image.NEAREST), (10, 20)); d.text((10, 4), 'CONCEPT C goc x0..470 y0..300', fill=T)
v1 = Image.open(R / '.agents/refs/CM/V1.png').convert('RGB').crop((0, 0, 135, 86))
c.paste(v1.resize((405, 258), Image.NEAREST), (10, 500)); d.text((10, 484), 'V1.png 1x (mau dich) 3x', fill=T)
for f, lab, (x, y) in [('game-bamboo-w', 'GAME tay view 0,13', (970, 20)), ('game-bamboo-e', 'GAME dong view 25,13', (970, 600))]:
    im = Image.open(R / f'records/CM-TERR/{f}.png').convert('RGB')
    c.paste(im.resize((960, 540), Image.NEAREST), (x, y)); d.text((x, y - 16), lab, fill=T)
y = 800
for lab, kit in [('MOI (CM-TERR) 3x: a, b, edge', 'CM-TERR'), ('CU (C-P) 3x: a, b, edge', 'C-P')]:
    d.text((10, y), lab, fill=T); x = 10
    for n in ('bamboo_a', 'bamboo_b', 'bamboo_edge'):
        im = Image.open(K / kit / f'{n}.png').convert('RGBA'); im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
        c.paste(im, (x, y + 16), im); x += im.width + 12
    y += 445
c.save(R / 'records/CM-TERR/compare-bamboo.png'); print('saved', c.size)
