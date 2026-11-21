"""Ảnh so nguyệt môn: concept | game mới | game cũ (2 view) + mảnh 4x mới/cũ.
Chạy sau moongate.py và scene_shot (records/CM-TERR/game-moongate-*.png)."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[3]
REC = ROOT / 'records/CM-TERR'
K = ROOT / 'public/assets/kits/CM-WALL'


def comp(d):
    return Image.alpha_composite(Image.open(d / 'moongate_h.png').convert('RGBA'),
                                 Image.open(d / 'moongate_h_roof.png').convert('RGBA'))


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)


bg = (42, 46, 42)
board = Image.new('RGB', (3 * 960 + 40, 2 * 560 + 660), bg); d = ImageDraw.Draw(board)
cells = [('CONCEPT V1.png', ROOT / '.agents/refs/CM/V1.png'),
         ('GAME MOI view 0,17.78125', REC / 'game-moongate-17.78125.png'),
         ('GAME CU view 0,17.78125', REC / 'game-moongate-old-17.78125.png'),
         (None, None),
         ('GAME MOI view 0,13', REC / 'game-moongate-13.png'),
         ('GAME CU view 0,13', REC / 'game-moongate-old-13.png')]
for i, (label, p) in enumerate(cells):
    if p is None: continue
    x = 10 + (i % 3) * 970; y = 24 + (i // 3) * 560
    d.text((x, y - 18), label, fill='white'); board.paste(up(Image.open(p).convert('RGB'), 2), (x, y))
y = 24 + 2 * 560
for j, (label, src) in enumerate((('MANH MOI 4x', K), ('MANH CU 4x (b0f792d)', REC / 'moongate-old'))):
    x = 10 + j * 800
    d.text((x, y - 18), label, fill='white'); g = up(comp(src), 4); board.paste(g, (x, y), g)
board.save(REC / 'compare-moongate.png')
print('saved', REC / 'compare-moongate.png', board.size)
