"""Whole procedural H-STAIR sprites; no concept pixels enter the delivered kit.
Run from any directory: python -X utf8 tools/sprites/H-STAIR/build.py
Concept sampling is restricted to paving in the assembly evidence.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
PROJECT = next(p for p in ROOT.parents if (p / 'design/tienson/19-the-sprite-hvq.md').exists())
REF = PROJECT / 'design/tienson'
OUT = ROOT / 'public/assets/kits/H-STAIR'
REC = ROOT / 'records/S1-STAIR'
HALL = REF / 'tam-thanh/TT2/src/hall-reference.png'
CONCEPT = REF / 'hvq-scene/C'
COL = dict(shadow='#25241e', joint='#34312b', dark='#3e3a34', moss='#413e2d',
           face='#514d46', face_light='#5a5750', top='#74726e', worn='#8c8782',
           top_dark='#61615f', light='#b9b1a9', edge='#2b2922')
FONT = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 12)


def box(d, xy, color):
    d.rectangle(xy, fill=COL.get(color, color))


def stair(w, h, count, tread=5, riser=4):
    """Parallel horizontal courses, whole slabs; sparse chips >=2 pixels."""
    im = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(im)
    landing = h - count * (tread + riser)
    box(d, (0, 0, w-1, h-1), 'face')
    box(d, (0, 0, w-1, max(0, landing-1)), 'top_dark')
    if landing > 4:
        box(d, (2, 2, w-3, landing-2), 'top')
        for x in range(31, w, 32):
            box(d, (x, 1, x+1, landing-1), 'joint')
    for row in range(count):
        y = landing + row*(tread+riser)
        box(d, (0, y, w-1, y+tread-1), 'top')
        box(d, (0, y+tread, w-1, y+tread+riser-1), 'face')
        box(d, (0, y+tread-1, w-1, y+tread-1), 'worn')
        box(d, (0, y+tread+riser-1, w-1, y+tread+riser-1), 'joint')
        # Large staggered ashlar divisions: geometry, never speckled noise.
        for x in range(24 + (row % 2)*16, w-10, 40):
            box(d, (x, y, x+1, y+tread-2), 'top_dark')
            box(d, (x, y+tread, x+1, y+tread+riser-2), 'dark')
        # Long worn noses with restrained, disconnected 2px edge chips.
        cx = 12 + (row*23) % (w-28)
        box(d, (cx, y+tread-2, cx+8, y+tread-1), 'worn')
        if row % 3 == 1:
            box(d, (cx+4, y+tread-1, cx+6, y+tread), 'face_light')
        box(d, (0, y, 2, y+tread-1), 'dark')
        box(d, (w-3, y, w-1, y+tread-1), 'dark')
        if row % 3 == 0:
            box(d, (2, y+1, 5, y+2), 'moss')
            box(d, (w-7, y+2, w-4, y+3), 'moss')
    box(d, (0, h-1, w-1, h-1), 'edge')
    return im


def cheek(run):
    """Frontal oblique projection: parallel masonry, upright terminal posts.
    Top of deck is y=30. The diagonal handrail runs north/south in world
    space, projected as a longitudinal strip; no converging perspective.
    44px structural height is metadata; projected run is NOT wall height.
    """
    im = Image.new('RGBA', (18, run+30))
    d = ImageDraw.Draw(im)
    end = run+29
    # Closed masonry cheek, narrow cap, shadow along inner edge.
    box(d, (3, 30, 15, end), 'face')
    box(d, (3, 30, 5, end), 'top_dark')
    box(d, (14, 30, 15, end), 'joint')
    for y in range(35, end-3, 12):
        box(d, (4, y, 13, y+1), 'dark')
        box(d, (6, y+2, 12, min(y+7, end)), 'face_light')
    # Open rail slots. Uprights stay vertical in the image.
    for y in [35, run//2+25]:
        box(d, (6, y-6, 11, y+7), 'face_light')
        box(d, (11, y-6, 12, y+7), 'dark')
    box(d, (3, 9, 7, end-20), 'top_dark')
    box(d, (3, 9, 4, end-20), 'worn')
    box(d, (8, 12, 9, end-20), 'joint')
    # Back and toe baluster posts, both 28px tall and 14px wide.
    for y in [2, end-27]:
        box(d, (2, y+5, 15, y+27), 'face')
        box(d, (3, y+5, 5, y+25), 'top_dark')
        box(d, (12, y+6, 15, y+27), 'dark')
        box(d, (1, y+2, 16, y+5), 'top_dark')
        box(d, (2, y, 14, y+2), 'top')
        box(d, (3, y, 10, y), 'worn')
        box(d, (5, y+12, 10, y+15), 'face_light')
        box(d, (1, y+25, 16, y+27), 'joint')
    box(d, (3, end-3, 6, end-2), 'moss')
    return im


def actor():
    atlas = Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    frames = json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))['frames']
    f = next(f['frame'] for f in frames if f['filename'] == 'dao_si_idle_down_00')
    return atlas.crop((f['x'], f['y'], f['x']+f['w'], f['y']+f['h']))


def paving():
    # ONLY permitted concept crop, clear paving with no architectural object.
    tile = Image.open(CONCEPT/'V1.png').convert('RGBA').crop((230, 25, 366, 65))
    im = Image.new('RGBA', (480, 270))
    for y in range(0, 270, tile.height):
        for x in range(0, 480, tile.width):
            im.paste(tile, (x, y))
    return im


def temporary_wall(im, y, gaps):
    """Evidence only: grey 6px cap + 44px face, never exported as a piece."""
    d = ImageDraw.Draw(im)
    intervals = []
    edge = 0
    for left, right in sorted(gaps):
        intervals.append((edge, left)); edge = right
    intervals.append((edge, 480))
    for left, right in intervals:
        if right <= left:
            continue
        box(d, (left, y+6, right-1, y+49), 'face')
        box(d, (left, y, right-1, y+5), 'top')
        box(d, (left, y+48, right-1, y+49), 'joint')
        for yy in [y+19, y+34]:
            box(d, (left, yy, right-1, yy+1), 'dark')
        for x in range(left+24, right, 32):
            box(d, (x, y+7, x+1, y+18), 'dark')
        # Plain temporary horizontal rail and upright posts.
        box(d, (left, y-15, right-1, y-11), 'top_dark')
        for x in range(left, right-8, 32):
            box(d, (x, y-26, x+8, y-1), 'face_light')
            box(d, (x-1, y-28, x+9, y-25), 'top')


def compose(images, variant):
    im = paving()
    if variant == 1:
        specs = [('stair_3', 336, 158, '')]
        temporary_wall(im, 172, [(322, 446)])
        im.alpha_composite(images['stair_low_2'], (60, 196))
        rulers = [(384, 192), (284, 126)]
    else:
        specs = [('stair_4', 176, -44, '_4'), ('stair_3', 0, 180, ''), ('stair_3', 384, 180, '')]
        temporary_wall(im, 2, [(162, 318)])
        temporary_wall(im, 194, [(0, 110), (370, 480)])
        rulers = [(240, 36), (45, 226), (432, 216)]
    placements = []
    for name, x, y, suffix in specs:
        im.alpha_composite(images[name], (x, y))
        for side, xx in [('L', x-14), ('R', x+images[name].width-4)]:
            key = f'stair_cheek{suffix}_{side}'
            im.alpha_composite(images[key], (xx, y-30))
            placements.append(dict(piece=key, top_left=[xx,y-30]))
        placements.append(dict(piece=name, top_left=[x,y]))
    a = actor()
    for x,y in rulers:
        im.alpha_composite(a, (x-32, y-61))
    im.convert('RGB').save(REC/f'assembly-V{variant}.png')
    return im, placements


def evidence(images):
    sheet = Image.new('RGB', (790, 1480), '#262725')
    d = ImageDraw.Draw(sheet)
    y = 12
    for name, im in images.items():
        d.text((12,y), f'{name}  {im.width}x{im.height}  1x / 3x', font=FONT, fill='#ddd5c7')
        sheet.paste(im, (24,y+24), im)
        big = im.resize((im.width*3, im.height*3), Image.Resampling.NEAREST)
        sheet.paste(big, (220,y+24), big)
        y += max(96,im.height*3)+44
    sheet.crop((0,0,790,y)).save(REC/'sheet.png')
    panel = Image.new('RGB', (980, 600), '#262725')
    d = ImageDraw.Draw(panel)
    placements = {}
    for row, variant in enumerate([1,2]):
        im, p = compose(images, variant)
        placements[f'V{variant}'] = p
        y = row*300
        d.text((6,y+5), f'Concept C V{variant} 1x', font=FONT, fill='#ddd5c7')
        d.text((496,y+5), 'H-STAIR 1x / temporary grey wall', font=FONT, fill='#ddd5c7')
        panel.paste(Image.open(CONCEPT/f'V{variant}.png').convert('RGB'), (0,y+25))
        panel.paste(im.convert('RGB'), (490,y+25))
    panel.save(REC/'assembly.png')
    (REC/'placements.json').write_text(json.dumps(placements, indent=2)+'\n',encoding='utf-8')


def verify():
    hall = np.array(Image.open(HALL).convert('RGBA'))
    palette = set(map(tuple, hall[hall[:,:,3]>0,:3]))
    assert len(palette) == 48
    manifest = json.loads((OUT/'kit.json').read_text(encoding='utf-8'))
    outside = semi = gold = 0
    hashes = {}
    expected = {'stair_3':(96,64), 'stair_4':(128,96), 'stair_low_2':(60,24),
                'stair_cheek_L':(18,94), 'stair_cheek_R':(18,94),
                'stair_cheek_4_L':(18,126), 'stair_cheek_4_R':(18,126)}
    assert set(manifest['pieces']) == set(expected)
    for name, size in expected.items():
        path = OUT/f'{name}.png'
        im = Image.open(path)
        assert im.mode == 'RGBA' and im.size == size, name
        a = np.array(im)
        semi += int(((a[:,:,3]>0)&(a[:,:,3]<255)).sum())
        colors = a[a[:,:,3]>0,:3]
        outside += sum(tuple(c) not in palette for c in colors)
        gold += int(((colors[:,0]>120)&(colors[:,1]>75)&(colors[:,0]>colors[:,1]*1.2)&(colors[:,1]>colors[:,2]*1.35)).sum())
        assert np.all(a[a[:,:,3]==0] == 0), name
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    for suffix in ['', '_4']:
        a = np.array(Image.open(OUT/f'stair_cheek{suffix}_L.png'))
        b = np.array(Image.open(OUT/f'stair_cheek{suffix}_R.png'))
        assert np.array_equal(a[:,:,3], b[:,::-1,3]), 'cheek silhouette symmetry'
    assert outside == semi == gold == 0
    # Confirm every required tread reads as a brighter band than its riser.
    for name, n in [('stair_3',7),('stair_4',9),('stair_low_2',3)]:
        a = np.array(Image.open(OUT/f'{name}.png'))[:,:,:3].astype(float)
        pitch = 8 if n==3 else 9
        landing = a.shape[0]-n*pitch
        for i in range(n):
            y = landing+i*pitch
            assert a[y+1,8:-8].mean() > a[y+pitch-3,8:-8].mean()+12, (name,i)
    (REC/'checks.json').write_text(json.dumps(dict(pieces=7, KA5=outside, alpha_partial=semi,
        gold_pixels=gold, structural_height=44, wall_cap=6, sha256=hashes),indent=2)+'\n',encoding='utf-8')
    print(f'PASS H-STAIR: pieces=7 K-A5={outside} alpha_partial={semi} gold={gold} steps=7/9/3 cheek_pairs=2 symmetric; wall=44+6')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REC.mkdir(parents=True, exist_ok=True)
    images = {'stair_3':stair(96,64,7), 'stair_4':stair(128,96,9), 'stair_low_2':stair(60,24,3,4,4)}
    for suffix, run in [('',64),('_4',96)]:
        left = cheek(run)
        right = left.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        # Same silhouette, darker east-facing cap under upper-left light.
        a = np.array(right)
        for src,dst in [('worn','top'),('top','top_dark')]:
            rgb = tuple(bytes.fromhex(COL[src][1:]))
            mask = np.all(np.array(right)[:,:,:3] == rgb, axis=2)
            a[mask,:3] = tuple(bytes.fromhex(COL[dst][1:]))
        images[f'stair_cheek{suffix}_L'] = left
        images[f'stair_cheek{suffix}_R'] = Image.fromarray(a)
    pieces = {}
    for name, im in images.items():
        im.save(OUT/f'{name}.png')
        side = 'cheek' in name
        pieces[name] = dict(file=f'{name}.png', layer='base' if side else 'ground',
            anchor=[0,im.height], footprint=[im.width,im.height-30 if side else im.height],
            collide=[[0,-(im.height-30),18,im.height-30]] if side else [])
    (OUT/'kit.json').write_text(json.dumps(dict(kit='H-STAIR',pieces=pieces),indent=2)+'\n',encoding='utf-8')
    evidence(images)
    verify()


if __name__ == '__main__':
    main()
