"""Ảnh so sánh bậc thềm: concept | game (V1, bậc giữa, bậc vào cổng) | mảnh mới/cũ phóng to."""
from pathlib import Path
from PIL import Image, ImageDraw
R = Path(__file__).resolve().parents[3]; B = (42, 46, 42); T = (225, 225, 210)
K = R / 'public/assets/kits'
c = Image.new('RGB', (1940, 1960), B); d = ImageDraw.Draw(c)
src = Image.open(R / '.agents/refs/CM/V1-original.png').convert('RGB').crop((1150, 480, 1600, 780))
c.paste(src.resize((900, 600), Image.NEAREST), (10, 20)); d.text((10, 4), 'CONCEPT C goc x1150..1600 y480..780', fill=T)
shots = [('game-stair-v1', 'GAME V1 view 0,17.78 (bac 3x2, nguyet mon)', (970, 20)),
         ('game-stair-main', 'GAME bac giua 4x2', (10, 660)),
         ('game-stair-gate', 'GAME bac vao cong 4x3', (980, 660))]
for f, lab, (x, y) in shots:
    im = Image.open(R / f'records/CM-TERR/{f}.png').convert('RGB')
    c.paste(im.resize((960, 540), Image.NEAREST), (x, y)); d.text((x, y - 16), lab, fill=T)
names = ['stair_3x2', 'stair_4x2', 'stair_moon_60', 'stair_cheek_L', 'stair_cheek_R', 'stair_cheek_long_L']
y = 1230
for lab, kit in [('MOI CM-TERR (bac 4x, ma 3x)', 'CM-TERR'), ('CU C-R1 (bac 4x, ma 3x)', 'C-R1')]:
    d.text((10, y), lab, fill=T); x = 10
    for n in names:
        im = Image.open(K / kit / f'{n}.png').convert('RGBA')
        s = 3 if 'cheek' in n else 4
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
        c.paste(im, (x, y + 16), im); x += im.width + 12
    y += 365
c.save(R / 'records/CM-TERR/compare-stair.png'); print('saved', c.size)
