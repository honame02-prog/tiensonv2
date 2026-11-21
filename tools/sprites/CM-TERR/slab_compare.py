"""Ảnh so sánh sân lát: concept | game (chiếu nghỉ dưới bậc) | mảnh mới/cũ phóng to."""
from pathlib import Path
from PIL import Image, ImageDraw
R = Path(__file__).resolve().parents[3]; B = (42, 46, 42); T = (225, 225, 210)
K = R / 'public/assets/kits'
c = Image.new('RGB', (1940, 1700), B); d = ImageDraw.Draw(c)
src = Image.open(R / '.agents/refs/CM/V1-original.png').convert('RGB').crop((760, 100, 1630, 540))
c.paste(src.resize((870, 440), Image.NEAREST), (10, 20)); d.text((10, 4), 'CONCEPT C goc san tren x760..1630 y100..540', fill=T)
g = Image.open(R / 'records/CM-TERR/game-slab.png').convert('RGB')
c.paste(g.resize((960, 540), Image.NEAREST), (970, 20))
d.text((970, 4), 'GAME view 9,20: chieu nghi duoi bac = slab_worn_128 moi (khung vang)', fill=T)
d.rectangle([970 + 160, 20 + 192, 970 + 416, 20 + 448], outline=(230, 200, 60))
for lab, kit, x in [('MOI CM-TERR: slab_worn_128 3x | slab_256 2x', 'CM-TERR', 10),
                   ('CU C-R1 (worn la lop phu 22% dac)', 'C-R1', 980)]:
    d.text((x, 584), lab, fill=T)
    for n, s in (('slab_worn_128', 3), ('slab_256', 2)):
        im = Image.open(K / kit / f'{n}.png').convert('RGBA')
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
        c.paste(im, (x, 600), im); x += im.width + 10
c.save(R / 'records/CM-TERR/compare-slab.png'); print('saved', c.size)
