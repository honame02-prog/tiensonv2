from pathlib import Path
from PIL import Image, ImageDraw
R = Path(__file__).resolve().parents[3]; B = (42, 46, 42)
cv = Image.open(R/'.agents/refs/CM/V1.png').convert('RGB'); gm = Image.open(R/'records/CM-TERR/game-v1.png').convert('RGB')
names = ['rwall_6', 'rwall_4', 'rwall_2', 'rwall_end_L', 'rwall_end_R']
rows = [('CM-TERR (Opus) 4x', 'CM-TERR'), ('C-R1 cu 4x', 'C-R1')]
c = Image.new('RGB', (1950, 1128), B); d = ImageDraw.Draw(c)
c.paste(cv.resize((960, 540), Image.NEAREST), (10, 20)); c.paste(gm.resize((960, 540), Image.NEAREST), (980, 20))
d.text((10, 4), 'CONCEPT V1', fill=(220, 220, 210)); d.text((980, 4), 'GAME (CM-TERR rwall, Opus)', fill=(220, 220, 210))
y = 580
for lab, kit in rows:
    d.text((10, y), lab, fill=(220, 220, 210)); x = 10
    for n in names:
        im = Image.open(R/f'public/assets/kits/{kit}/{n}.png').convert('RGB')
        c.paste(im.resize((im.width*4, im.height*4), Image.NEAREST), (x, y+16)); x += im.width*4+12
    y += 56*4+40
c.save(R/'records/CM-TERR/compare.png')
